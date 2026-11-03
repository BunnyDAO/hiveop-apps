import UIKit
import WebKit
import AuthenticationServices
import CryptoKit

/// Google/GitHub sign-in through ASWebAuthenticationSession (ph-04). Mirrors src/authBounce.ts:
/// the PKCE verifier is made and kept here, in memory, one at a time; the page only receives
/// {handoff, verifier} after a valid hiveop://auth return.
enum AuthBounceCore {
    static func b64url(_ d: Data) -> String {
        d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    static func makeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return b64url(Data(bytes))
    }

    static func challenge(for verifier: String) -> String {
        b64url(Data(SHA256.hash(data: Data(verifier.utf8))))
    }

    static func startURL(oauthApi: String, siteOrigin: String, provider: String, challenge: String) -> URL? {
        var base = oauthApi
        while base.hasSuffix("/") { base.removeLast() }
        guard var c = URLComponents(string: base + "/auth/oauth/" + provider) else { return nil }
        c.queryItems = [
            URLQueryItem(name: "returnTo", value: siteOrigin + "/desktop-return"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
        ]
        return c.url
    }

    /// hiveop://auth?handoff=<token>: strict on charset, length and a single param.
    static func parseHandoff(_ raw: String?) -> String? {
        guard let raw = raw, let c = URLComponents(string: raw),
              c.scheme?.lowercased() == "hiveop", c.host?.lowercased() == "auth" else { return nil }
        let all = (c.queryItems ?? []).filter { $0.name == "handoff" }
        guard all.count == 1, let v = all[0].value,
              v.range(of: "^[A-Za-z0-9._~-]{16,512}$", options: .regularExpression) != nil else { return nil }
        return v
    }
}

/// Receives {provider} from the page (site origin, main frame only) and answers once.
final class AuthBounceHandler: NSObject, WKScriptMessageHandlerWithReply, ASWebAuthenticationPresentationContextProviding {
    private let oauthApi: String
    private let siteOrigin: String
    private weak var viewController: UIViewController?
    private var session: ASWebAuthenticationSession?
    private var verifier: String?
    private var reply: ((Any?, String?) -> Void)?
    /// Test seam: a launcher that returns the callback URL (or nil = cancelled) instead of a real session.
    var launch: ((URL, @escaping (URL?) -> Void) -> Void)?

    init(oauthApi: String, siteOrigin: String, viewController: UIViewController) {
        self.oauthApi = oauthApi
        self.siteOrigin = siteOrigin
        self.viewController = viewController
    }

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        let origin = ShellAsset.origin(of: message.frameInfo.request.url ?? URL(fileURLWithPath: "/"))
        guard message.frameInfo.isMainFrame, origin == siteOrigin,
              let body = message.body as? [String: Any], let provider = body["provider"] as? String,
              provider == "google" || provider == "github" else {
            replyHandler(nil, "refused")
            return
        }
        DispatchQueue.main.async { self.begin(provider: provider, reply: replyHandler) }
    }

    private func begin(provider: String, reply: @escaping (Any?, String?) -> Void) {
        finish(nil) // a newer start cancels the old one
        let v = AuthBounceCore.makeVerifier()
        guard let url = AuthBounceCore.startURL(oauthApi: oauthApi, siteOrigin: siteOrigin, provider: provider,
                                                challenge: AuthBounceCore.challenge(for: v)) else {
            reply(["result": "cancelled"], nil)
            return
        }
        verifier = v
        self.reply = reply
        NSLog("HiveOpAuth start %@", url.absoluteString)
        let done: (URL?) -> Void = { [weak self] callback in
            DispatchQueue.main.async { self?.finish(callback) }
        }
        if let launch = launch { launch(url, done); return }
        let s = ASWebAuthenticationSession(url: url, callbackURLScheme: "hiveop") { callback, _ in done(callback) }
        s.presentationContextProvider = self
        s.prefersEphemeralWebBrowserSession = false
        session = s
        if !s.start() { finish(nil) }
    }

    private func finish(_ callback: URL?) {
        let r = reply, v = verifier
        reply = nil; verifier = nil; session = nil
        guard let r = r else { return }
        if let v = v, let handoff = AuthBounceCore.parseHandoff(callback?.absoluteString) {
            r(["result": "handoff", "handoff": handoff, "verifier": v], nil)
        } else {
            r(["result": "cancelled"], nil)
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        viewController?.view.window ?? ASPresentationAnchor()
    }
}
