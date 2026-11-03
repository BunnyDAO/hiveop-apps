import UIKit
import UserNotifications
import WebKit
import Capacitor

/// Reference rule: mobile/src/pushPath.ts (and its fixture src/fixtures/pushPath.cases.json).
/// Only a plain site path opens; anything else opens the site root.
enum PushPath {
    static let maxLength = 2048

    static func sanitize(_ raw: Any?) -> String {
        guard let s = raw as? String, !s.isEmpty, s.utf16.count <= maxLength,
              s.hasPrefix("/"), !s.hasPrefix("//") else { return "/" }
        for u in s.unicodeScalars where u == "\\" || u.value < 0x20 || u.value == 0x7f { return "/" }
        return s
    }

    /// Plain concatenation: the path starts with one "/", so it cannot change the origin.
    static func targetURL(_ raw: Any?, siteOrigin: String) -> URL? {
        var origin = siteOrigin
        while origin.hasSuffix("/") { origin.removeLast() }
        return URL(string: origin + sanitize(raw)) ?? URL(string: origin + "/")
    }
}

/// Sits in front of Capacitor's notification router: it sees a tap first (to open the item's
/// path), then hands every call on, so Capacitor's push plugin keeps working unchanged.
final class PushTapRelay: NSObject, UNUserNotificationCenterDelegate {
    private let inner: UNUserNotificationCenterDelegate
    private let onOpen: (Any?) -> Void

    init(inner: UNUserNotificationCenterDelegate, onOpen: @escaping (Any?) -> Void) {
        self.inner = inner
        self.onOpen = onOpen
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        inner.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        if response.actionIdentifier == UNNotificationDefaultActionIdentifier,
           response.notification.request.trigger is UNPushNotificationTrigger {
            let path = response.notification.request.content.userInfo["path"]
            DispatchQueue.main.async { [onOpen] in onOpen(path) }
        }
        if let forward = inner.userNotificationCenter(_:didReceive:withCompletionHandler:) {
            forward(center, response, completionHandler)
        } else {
            completionHandler()
        }
    }
}

/// Loads a tapped notification's path in the web view. A tap that launches the app arrives
/// before the site has loaded, so it waits (briefly) for the first load to settle on the site.
final class PushOpener {
    private weak var webView: WKWebView?
    private let siteOrigin: String
    private var pending: URL?
    private var timer: Timer?
    private var tries = 0

    init(webView: WKWebView, siteOrigin: String) {
        self.webView = webView
        self.siteOrigin = siteOrigin
    }

    func open(_ rawPath: Any?) {
        guard let url = PushPath.targetURL(rawPath, siteOrigin: siteOrigin) else { return }
        pending = url
        tries = 0
        timer?.invalidate()
        attempt()
        if pending != nil {
            timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] t in
                guard let self = self else { t.invalidate(); return }
                self.tries += 1
                self.attempt()
                if self.pending == nil || self.tries > 80 { t.invalidate(); self.pending = nil }
            }
        }
    }

    private func attempt() {
        guard let webView = webView, let url = pending else { return }
        if webView.isLoading { return }
        guard let current = webView.url, ShellAsset.origin(of: current) == siteOrigin else { return }
        pending = nil
        webView.load(URLRequest(url: url))
    }
}
