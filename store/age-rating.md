# Age rating, content and export compliance — HiveOp

Drafted 2026-11-04. Answer honestly; the console computes the rating. Apple's questionnaire changed in 2026 (new declarations due by 2027-01-12, per https://developer.apple.com/news/), so read each question fresh and use this as the intent.

## What the app is, for the questionnaire
A developer workspace. Users chat with teammates and AI agents, run terminals, open web pages in a browser pane, dictate, and upload files. No game content, gambling, contests, dating or sale of goods.

## Apple age rating (App Store Connect)
| Question | Answer | Why |
|---|---|---|
| Violence (cartoon, realistic, graphic), horror, sexual content/nudity, profanity, drugs, alcohol, medical, gambling, contests | None | none in app content |
| Simulated gambling / loot boxes | None | no |
| Unrestricted web access | **Yes** | browser pane and outside links open arbitrary sites (shell sheet policy: `mobile/src` nav policy, ph-03) |
| User-generated content / messaging between users | **Yes** | workspace chat + global chat; block/mute/report exist (`services/moderation.service.ts`) |
| Chat with AI / generative AI | **Yes** | agents produce text and code (if the questionnaire asks) |
| Social media capabilities (new, Jul 2026) | Answer as the console words it; chat and following exist (`lib/followGraph.ts`) |
| Shared location, dating and relationships (new) | No | none |
| Parental controls, age assurance | None | Declared Age Range API is not used |
Expected result: 13+ or 16+ because of UGC + open web. Do not argue it down. Account sign-in already needs an adult-level email account; the privacy page says not for under 13.
Also set: **Made for Kids = No**.

## Google Play (IARC questionnaire)
- Category: Utility/Productivity (not game, not social network app, not news).
- Violence, sexual, profanity, drugs, gambling, fear: No.
- Users can interact or exchange content: **Yes** (chat, shared files). Shares location: No. Digital purchases: Yes (credits and plans, bought on the web, link-out in the US). Unrestricted internet: Yes.
- Expected: Teen / PEGI 12 / equivalent. Target audience: 18+ (avoid Families Policy).

## Export compliance (Apple + Play)
- Apple: `ITSAppUsesNonExemptEncryption` = **NO** is correct only if the app uses standard encryption (HTTPS/TLS from the OS) and nothing proprietary. Shell has no custom crypto (`mobile/package.json`: Capacitor core, push, splash). Answer in App Store Connect: "uses encryption" Yes -> "exempt: only standard encryption (HTTPS) / OS-provided". Do not edit `mobile/ios` Info.plist here (another agent owns build config); recommend the build agent add `ITSAppUsesNonExemptEncryption=false` to skip the prompt per upload.
- France: no extra declaration when exempt.
- Google Play: no export questionnaire; US export-law self-certification checkbox at publish, same standard-encryption basis.
