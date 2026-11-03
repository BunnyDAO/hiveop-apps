import AVFoundation
import Capacitor
import WebKit

/// Reference rule: mobile/src/mediaPolicy.ts. getUserMedia is answered only for the site
/// origin, and only after the OS has said yes (same order as desktop/src/mediaAccess.ts).
/// Capacitor's own delegate grants every origin; this wraps it and takes over that one call,
/// forwarding everything else untouched.
final class MediaGate: NSObject, WKUIDelegate {
    private let inner: WKUIDelegate
    private let siteOrigin: String

    init(inner: WKUIDelegate, siteOrigin: String) {
        self.inner = inner
        self.siteOrigin = siteOrigin
    }

    static func origin(of url: URL?) -> String? {
        guard let url, let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
              url.user == nil, let host = url.host?.lowercased() else { return nil }
        let port = url.port
        let isDefault = port == nil || (scheme == "http" && port == 80) || (scheme == "https" && port == 443)
        return "\(scheme)://\(host)\(isDefault ? "" : ":\(port!)")"
    }

    static func originString(_ o: WKSecurityOrigin) -> String? {
        var c = URLComponents()
        c.scheme = o.protocol
        c.host = o.host
        if o.port != 0 { c.port = o.port }
        return origin(of: c.url)
    }

    private func devices(for type: WKMediaCaptureType) -> [AVMediaType] {
        switch type {
        case .microphone: return [.audio]
        case .camera: return [.video]
        case .cameraAndMicrophone: return [.video, .audio]
        @unknown default: return []
        }
    }

    private func ensureOS(_ media: [AVMediaType], then done: @escaping (Bool) -> Void) {
        guard let next = media.first else { return done(true) }
        let rest = Array(media.dropFirst())
        switch AVCaptureDevice.authorizationStatus(for: next) {
        case .authorized: ensureOS(rest, then: done)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: next) { ok in
                DispatchQueue.main.async { ok ? self.ensureOS(rest, then: done) : done(false) }
            }
        default: done(false)  // denied or restricted: the page sees NotAllowedError
        }
    }

    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let media = devices(for: type)
        guard !media.isEmpty, MediaGate.originString(origin) == siteOrigin else {
            return decisionHandler(.deny)
        }
        ensureOS(media) { ok in decisionHandler(ok ? .grant : .deny) }
    }

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || inner.responds(to: aSelector)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        inner.responds(to: aSelector) ? inner : super.forwardingTarget(for: aSelector)
    }
}

class MainViewController: CAPBridgeViewController {
    private var gate: MediaGate?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView, let inner = webView.uiDelegate,
              let site = MediaGate.origin(of: bridge?.config.serverURL) else { return }
        let g = MediaGate(inner: inner, siteOrigin: site)
        gate = g  // WKWebView holds its delegate weakly
        webView.uiDelegate = g
    }
}
