import UIKit
import AuthenticationServices
import CryptoKit

/// Nonce rules for Sign in with Apple (ph-06). The RAW nonce stays in the shell until the sheet returns; Apple
/// gets sha256(raw) as lowercase hex and echoes it in the identity token; the backend recomputes the same hash.
/// src/fixtures/appleNonce.cases.json is the shared truth (scripts/check-apple-nonce-swift.sh runs it).
enum AppleNonce {
    private static let alphabet = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")

    static func random(length: Int = 32) -> String {
        var out = ""
        while out.count < length {
            var byte: UInt8 = 0
            guard SecRandomCopyBytes(kSecRandomDefault, 1, &byte) == errSecSuccess else { continue }
            // 256 is a multiple of 64: no modulo bias.
            out.append(alphabet[Int(byte) % alphabet.count])
        }
        return out
    }

    static func sha256Hex(_ raw: String) -> String {
        SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// Shows Apple's native sheet and answers the page with { identityToken, nonce (RAW), name? }, or nil when the
/// user closes it. One sheet at a time. Called only for the site's main frame (HiveOpChannel guards the origin).
final class AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var reply: ((Any?, String?) -> Void)?
    private var rawNonce = ""
    private var controller: ASAuthorizationController?
    private weak var anchor: UIWindow?

    func start(anchor: UIWindow?, reply: @escaping (Any?, String?) -> Void) {
        guard self.reply == nil else { reply(nil, "busy"); return }
        self.reply = reply
        self.anchor = anchor
        rawNonce = AppleNonce.random()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = AppleNonce.sha256Hex(rawNonce)
        let c = ASAuthorizationController(authorizationRequests: [request])
        c.delegate = self
        c.presentationContextProvider = self
        controller = c
        c.performRequests()
    }

    private func finish(_ value: Any?, _ error: String?) {
        let r = reply
        reply = nil; controller = nil; rawNonce = ""
        r?(value, error)
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor ?? ASPresentationAnchor()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = cred.identityToken, let token = String(data: data, encoding: .utf8) else {
            finish(nil, "no identity token")
            return
        }
        // Apple sends the name only on the first authorization.
        let name = [cred.fullName?.givenName, cred.fullName?.familyName].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
        finish(["identityToken": token, "nonce": rawNonce, "name": name.isEmpty ? NSNull() : name as Any], nil)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if (error as? ASAuthorizationError)?.code == .canceled {
            finish(NSNull(), nil)
        } else {
            finish(nil, "apple sign-in failed")
        }
    }
}
