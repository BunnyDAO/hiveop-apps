import Foundation
let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let j = try JSONSerialization.jsonObject(with: data) as! [String: Any]
var bad = 0, n = 0
for row in j["cases"] as! [[Any]] { n += 1; let got = PushPath.sanitize(row[1] is NSNull ? nil : row[1]); if got != (row[2] as! String) { bad += 1; print("FAIL", row[0]) } }
for row in j["urls"] as! [[Any]] { n += 1; let got = PushPath.targetURL(row[1], siteOrigin: j["siteOrigin"] as! String)?.absoluteString; if got != (row[2] as! String) { bad += 1; print("FAIL", row[0], got ?? "nil") } }
print("swift pushPath rows: \(n), failures: \(bad)"); exit(bad == 0 ? 0 : 1)
