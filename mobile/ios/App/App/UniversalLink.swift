import Foundation

/// Where a tapped HiveOp link (Universal Link) goes inside the app. Pure.
/// Reference rule: mobile/src/universalLink.ts (and its fixture src/fixtures/universalLink.cases.json).
/// Returns the URL to load, or nil to leave the app where it is. Needs PushPath (PushTap.swift).
enum UniversalLink {
    static func removeDots(_ path: String) -> String {
        var out: [Substring] = []
        let parts = path.split(separator: "/", omittingEmptySubsequences: false).dropFirst()
        let count = parts.count
        for (i, part) in parts.enumerated() {
            let s = part.lowercased()
            let last = i == count - 1
            if s == ".." || s == ".%2e" || s == "%2e." || s == "%2e%2e" {
                if !out.isEmpty { out.removeLast() }
                if last { out.append("") }
            } else if s == "." || s == "%2e" {
                if last { out.append("") }
            } else {
                out.append(part)
            }
        }
        return "/" + out.joined(separator: "/")
    }

    private static func excluded(_ path: String) -> Bool {
        guard let decoded = path.removingPercentEncoding?.lowercased() else { return true }
        for p in ["/api", "/desktop-return", "/.well-known"] where decoded == p || decoded.hasPrefix(p + "/") { return true }
        return false
    }

    static func target(_ raw: Any?, siteOrigin: String) -> String? {
        guard let s = raw as? String, s.utf16.count <= PushPath.maxLength else { return nil }
        for u in s.unicodeScalars where u == "\\" || u.value < 0x20 || u.value == 0x7f { return nil }
        var origin = siteOrigin
        while origin.hasSuffix("/") { origin.removeLast() }
        guard let site = URLComponents(string: origin), let siteHost = site.host,
              let c = URLComponents(string: s),
              c.scheme?.lowercased() == "https", c.user == nil, c.password == nil, c.port == nil,
              c.host?.lowercased() == siteHost.lowercased() else { return nil }
        let rawPath = c.percentEncodedPath
        let path = removeDots(rawPath.isEmpty ? "/" : rawPath)
        if excluded(path) { return nil }
        var full = path
        if let q = c.percentEncodedQuery { full += "?" + q }
        if let f = c.percentEncodedFragment { full += "#" + f }
        guard PushPath.sanitize(full) == full else { return nil }
        return origin + full
    }
}
