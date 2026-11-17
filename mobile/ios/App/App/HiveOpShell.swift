import UIKit
import WebKit
import SafariServices
import StoreKit
import UserNotifications
import Capacitor
import LocalAuthentication
import Security

/// Mirror of src/navPolicy.ts `decide`, fed by public/hiveop-shell.json (written by `npm run prepare`).
enum NavDecision { case inApp, sheet, systemBrowser, deny }

struct ShellAsset: Decodable {
    let siteOrigin: String
    let authHosts: [String]
    let oauthApi: String?
    let bridgeScripts: [String: String]

    static func load() -> ShellAsset? {
        guard let url = Bundle.main.url(forResource: "hiveop-shell", withExtension: "json", subdirectory: "public"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(ShellAsset.self, from: data)
    }

    static func origin(of url: URL) -> String {
        guard let scheme = url.scheme, let host = url.host else { return "" }
        let defaultPort = scheme == "https" ? 443 : 80
        let port = url.port.flatMap { $0 == defaultPort ? nil : $0 }
        return "\(scheme)://\(host)" + (port.map { ":\($0)" } ?? "")
    }

    /// `linkOut`: the caller deliberately leaves the app (openExternal), so outside pages go to the system browser.
    func decide(_ url: URL, linkOut: Bool = false) -> NavDecision {
        guard let scheme = url.scheme?.lowercased() else { return .deny }
        if scheme == "hiveop" { return .inApp }
        guard scheme == "http" || scheme == "https", url.host != nil else { return .deny }
        if ShellAsset.origin(of: url) == siteOrigin { return .inApp }
        if scheme == "https", url.port == nil, let host = url.host?.lowercased(), authHosts.contains(host) { return .inApp }
        return linkOut ? .systemBrowser : .sheet
    }

    /// Mirror of src/navPolicy.ts `canLinkOut`: https only, no credentials, and only what a link-out intent
    /// sends out of the app (the site itself and the auth chain stay in-app).
    func canLinkOut(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "https", url.host != nil, url.user == nil, url.password == nil else { return false }
        return decide(url, linkOut: true) == .systemBrowser
    }
}

/// Opens outside pages in an SFSafariViewController over the app. The main web view never moves.
final class SheetPresenter {
    static func present(_ url: URL, from viewController: UIViewController?) {
        guard let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else { return }
        DispatchQueue.main.async {
            guard var top = viewController else { return }
            while let presented = top.presentedViewController { top = presented }
            if top is SFSafariViewController { return }
            let sheet = SFSafariViewController(url: url)
            sheet.preferredBarTintColor = UIColor(red: 0.043, green: 0.051, blue: 0.071, alpha: 1)
            sheet.preferredControlTintColor = .white
            sheet.dismissButtonStyle = .close
            top.present(sheet, animated: true)
        }
    }
}

/// Gets first say on every navigation (Capacitor asks plugins before its own allow-list).
@objc(HiveOpShellPlugin)
public final class HiveOpShellPlugin: CAPInstancePlugin, CAPBridgedPlugin {
    public let identifier = "HiveOpShellPlugin"
    public let jsName = "HiveOpShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]
    var asset: ShellAsset?

    /// This app's page in the phone's Settings (where a blocked notification switch is turned back on).
    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else { call.reject("no settings url"); return }
            UIApplication.shared.open(url) { _ in call.resolve() }
        }
    }

    @objc public override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let asset = asset, let url = navigationAction.request.url else { return nil }
        // Sub-frames (embeds) are left to Capacitor's default handling.
        if let target = navigationAction.targetFrame, !target.isMainFrame { return nil }
        // Local app pages (offline page, the app's own server URL) are not outside links.
        if url.scheme?.lowercased() == "capacitor" { return nil }
        switch asset.decide(url) {
        case .inApp: return nil
        case .deny, .systemBrowser: return true
        case .sheet:
            SheetPresenter.present(url, from: bridge?.viewController)
            return true
        }
    }
}

/// The native side of window.hiveopApp.storefront() / openExternal(): a script message handler with a
/// reply (the page gets a Promise). Answers only the main frame of the site origin.
final class HiveOpChannel: NSObject, WKScriptMessageHandlerWithReply {
    static let name = "hiveop"
    let asset: ShellAsset
    private let apple = AppleSignInCoordinator()
    /// The window the Apple sheet presents over.
    var anchor: (() -> UIWindow?)?

    init(asset: ShellAsset) { self.asset = asset }

    private func originString(_ o: WKSecurityOrigin) -> String {
        let defaultPort = o.protocol == "https" ? 443 : 80
        return "\(o.protocol)://\(o.host)" + (o.port == 0 || o.port == defaultPort ? "" : ":\(o.port)")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, originString(message.frameInfo.securityOrigin) == asset.siteOrigin,
              let body = message.body as? [String: Any], let method = body["m"] as? String else {
            replyHandler(nil, "denied")
            return
        }
        switch method {
        case "storefront":
            // StoreKit 2: the App Store storefront (alpha-3, e.g. "USA"); nil without an App Store storefront.
            // The bridge script converts to alpha-2. The app sells nothing through StoreKit (ADR-0002).
            Task { @MainActor in
                let code = await Storefront.current?.countryCode
                replyHandler(["country": code.map { $0 as Any } ?? NSNull()], nil)
            }
        case "appleSignIn":
            // ph-06: Apple's native sheet (Face ID). Replies { identityToken, nonce (RAW), name } or null if closed.
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { replyHandler(nil, "gone"); return }
                self.apple.start(anchor: self.anchor?(), reply: replyHandler)
            }
        case "openExternal":
            guard let args = body["a"] as? [String: Any], let raw = args["url"] as? String,
                  let url = URL(string: raw), asset.canLinkOut(url) else {
                replyHandler(nil, "not an external https URL")
                return
            }
            DispatchQueue.main.async {
                UIApplication.shared.open(url, options: [:]) { ok in
                    replyHandler(ok ? NSNull() : nil, ok ? nil : "could not open")
                }
            }
        case "deviceKeyAvailable":
            // ryc-09: a Secure Enclave key behind Face ID / Touch ID can be made here.
            replyHandler(["available": DeviceKeys.available()], nil)
        case "deviceKeyCreate", "deviceKeySign", "deviceKeyRemove":
            guard let args = body["a"] as? [String: Any], let alias = args["alias"] as? String,
                  DeviceKeys.aliases.contains(alias) else {
                replyHandler(nil, "bad request")
                return
            }
            // Off the main thread: signing with the unlock key blocks while Face ID shows.
            DispatchQueue.global(qos: .userInitiated).async {
                let reply: (Any?, String?) -> Void = { v, e in DispatchQueue.main.async { replyHandler(v, e) } }
                do {
                    switch method {
                    case "deviceKeyCreate":
                        let pub = try DeviceKeys.create(alias)
                        reply(["publicKey": pub.base64EncodedString()], nil)
                    case "deviceKeySign":
                        guard let b64 = args["data"] as? String, let data = Data(base64Encoded: b64),
                              !data.isEmpty, data.count <= DeviceKeys.maxData else {
                            reply(nil, "bad data")
                            return
                        }
                        let reason = String(((args["reason"] as? String) ?? "Unlock").prefix(100))
                        let sig = try DeviceKeys.sign(alias, data: data, reason: reason)
                        reply(["sig": sig.base64EncodedString()], nil)
                    default:
                        DeviceKeys.remove(alias)
                        reply(NSNull(), nil)
                    }
                } catch {
                    reply(nil, (error as? DeviceKeyError)?.message ?? "failed")
                }
            }
        default:
            replyHandler(nil, "unknown method")
        }
    }
}

struct DeviceKeyError: Error { let message: String }

/// ryc-09 (site PRD reach-your-computer D9): P-256 keys in the Secure Enclave, for the site's
/// "Reach your computer" viewer. Two fixed aliases: `device` (signs without a prompt) and `unlock`
/// (every signature needs Face ID / Touch ID; void when biometrics change). Private keys never
/// leave the Secure Enclave; the page gets the raw public point and DER signatures.
/// Checked standalone by scripts/check-device-keys-swift.sh.
enum DeviceKeys {
    static let aliases: Set<String> = ["device", "unlock"]
    static let maxData = 4096

    private static func tag(_ alias: String) -> Data { Data("io.hiveop.app.ryc.\(alias)".utf8) }

    static func available() -> Bool {
        var err: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err)
    }

    private static func find(_ alias: String, context: LAContext? = nil) -> SecKey? {
        var q: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: tag(alias),
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true,
        ]
        if let context = context { q[kSecUseAuthenticationContext as String] = context }
        var item: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess, let found = item,
              CFGetTypeID(found) == SecKeyGetTypeID() else { return nil }
        return (found as! SecKey)
    }

    /// The raw uncompressed public point (65 bytes), making the key on first use.
    static func create(_ alias: String) throws -> Data {
        guard aliases.contains(alias) else { throw DeviceKeyError(message: "unknown alias") }
        if let key = find(alias) { return try publicRaw(key) }
        if alias == "unlock" && !available() { throw DeviceKeyError(message: "biometrics unavailable") }
        var flags: SecAccessControlCreateFlags = [.privateKeyUsage]
        if alias == "unlock" { flags.insert(.biometryCurrentSet) }
        var cfErr: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, flags, &cfErr) else {
            throw DeviceKeyError(message: "access control failed")
        }
        let attrs: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: tag(alias),
                kSecAttrAccessControl as String: access,
            ] as [String: Any],
        ]
        guard let key = SecKeyCreateRandomKey(attrs as CFDictionary, &cfErr) else {
            throw DeviceKeyError(message: "no Secure Enclave key")
        }
        return try publicRaw(key)
    }

    private static func publicRaw(_ key: SecKey) throws -> Data {
        guard let pub = SecKeyCopyPublicKey(key),
              let raw = SecKeyCopyExternalRepresentation(pub, nil) as Data?, raw.count == 65, raw.first == 0x04 else {
            throw DeviceKeyError(message: "bad public key")
        }
        return raw
    }

    /// ECDSA P-256 SHA-256 over `data`, DER. For `unlock` this shows Face ID with `reason`.
    static func sign(_ alias: String, data: Data, reason: String) throws -> Data {
        guard aliases.contains(alias), data.count <= maxData else { throw DeviceKeyError(message: "bad request") }
        let context = LAContext()
        context.localizedReason = reason
        guard let key = find(alias, context: context) else { throw DeviceKeyError(message: "no key") }
        var cfErr: Unmanaged<CFError>?
        guard let sig = SecKeyCreateSignature(key, .ecdsaSignatureMessageX962SHA256, data as CFData, &cfErr) as Data? else {
            throw DeviceKeyError(message: "cancelled")
        }
        return sig
    }

    static func remove(_ alias: String) {
        let q: [String: Any] = [kSecClass as String: kSecClassKey, kSecAttrApplicationTag as String: tag(alias)]
        SecItemDelete(q as CFDictionary)
    }
}

/// Forwards every WKUIDelegate call to Capacitor's handler except new-window requests
/// (target=_blank, window.open), which Capacitor would hand to Safari.
final class NewWindowUIDelegate: NSObject, WKUIDelegate {
    weak var original: WKUIDelegate?
    let asset: ShellAsset
    weak var viewController: UIViewController?

    init(original: WKUIDelegate?, asset: ShellAsset, viewController: UIViewController) {
        self.original = original
        self.asset = asset
        self.viewController = viewController
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, asset.decide(url) == .sheet {
            SheetPresenter.present(url, from: viewController)
        }
        // in-app targets, denied schemes, blank popups: never a second web view, never Safari.
        return nil
    }

    override func responds(to aSelector: Selector!) -> Bool {
        return super.responds(to: aSelector) || (original?.responds(to: aSelector) ?? false)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let original = original, original.responds(to: aSelector) { return original }
        return super.forwardingTarget(for: aSelector)
    }
}

/// Builds on MainViewController (MediaGate permissions): its gate becomes the "original" delegate we forward to.
class HiveOpViewController: MainViewController {
    private let asset = ShellAsset.load()
    private var uiDelegate: NewWindowUIDelegate?
    private var authHandler: AuthBounceHandler?
    private var pushOpener: PushOpener?
    private var pushRelay: PushTapRelay?

    private var linkOpener: PushOpener?
    private var pendingLink: URL?

    /// ph-07: open a tapped HiveOp link (vetted by UniversalLink). Waits for the first site load, and
    /// for the web view itself if the link launched the app.
    func openLink(_ url: URL) {
        guard let asset = asset, let target = UniversalLink.target(url.absoluteString, siteOrigin: asset.siteOrigin),
              let vetted = URL(string: target) else { return }
        if let opener = linkOpener { opener.open(url: vetted) } else { pendingLink = vetted }
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let asset = asset, let webView = webView else { return }
        // Capacitor swaps in its own content controller after webViewConfiguration(for:), so the
        // bridge goes on the live one. Injected at document start; its own origin guard keeps it
        // off every page but the site.
        if let script = asset.bridgeScripts["ios"] {
            webView.configuration.userContentController.addUserScript(
                WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let channel = HiveOpChannel(asset: asset)
        channel.anchor = { [weak self] in self?.view.window }
        webView.configuration.userContentController.addScriptMessageHandler(
            channel, contentWorld: .page, name: HiveOpChannel.name)
        let plugin = HiveOpShellPlugin()
        plugin.asset = asset
        bridge?.registerPluginInstance(plugin)
        // ph-04: sign-in sheet. The handler refuses any frame that is not the site's main frame.
        let auth = AuthBounceHandler(oauthApi: asset.oauthApi ?? "https://api.wenrwa.com/api/v1",
                                     siteOrigin: asset.siteOrigin, viewController: self)
        authHandler = auth
        webView.configuration.userContentController.addScriptMessageHandler(auth, contentWorld: .page, name: "hiveopAuth")
        let proxy = NewWindowUIDelegate(original: webView.uiDelegate, asset: asset, viewController: self)
        uiDelegate = proxy
        webView.uiDelegate = proxy

        let links = PushOpener(webView: webView, siteOrigin: asset.siteOrigin)
        linkOpener = links
        if let waiting = pendingLink { pendingLink = nil; links.open(url: waiting) }

        // A tapped notification opens its (sanitised) path in this web view.
        if let router = bridge?.notificationRouter, UNUserNotificationCenter.current().delegate === router {
            let opener = PushOpener(webView: webView, siteOrigin: asset.siteOrigin)
            let relay = PushTapRelay(inner: router, onOpen: { [weak opener] path in opener?.open(path) })
            pushOpener = opener
            pushRelay = relay
            UNUserNotificationCenter.current().delegate = relay
        }
    }
}
