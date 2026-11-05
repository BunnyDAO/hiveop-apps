import Foundation
// Usage: applenonce <cases.json>. cases = { "hash": [[name, raw, sha256hex]], "random": { "length": n, "pattern": "<regex>" } }
let data = try! Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let root = try! JSONSerialization.jsonObject(with: data) as! [String: Any]
var failed = 0
for c in root["hash"] as! [[String]] {
    let got = AppleNonce.sha256Hex(c[1])
    if got != c[2] { print("FAIL \(c[0]): got \(got)"); failed += 1 }
}
let r = root["random"] as! [String: Any]
let n = r["length"] as! Int
let re = try! NSRegularExpression(pattern: r["pattern"] as! String)
var seen = Set<String>()
for _ in 0..<50 {
    let v = AppleNonce.random()
    seen.insert(v)
    if v.count != n || re.firstMatch(in: v, range: NSRange(v.startIndex..., in: v)) == nil { print("FAIL random: \(v)"); failed += 1 }
}
if seen.count != 50 { print("FAIL random: repeats"); failed += 1 }
if failed > 0 { exit(1) }
print("apple nonce: ok")
