# App Store Metadata

All copy below is written strictly from functionality that exists in the codebase today (verified this audit)
— no planned/aspirational features are mentioned.

## App Name
```
Zenter
```

## Subtitle (27 / 30 characters)
```
Find your exam centre mates
```

## Promotional Text (112 / 170 characters)
```
Connect with aspirants at your exact exam centre. Coordinate travel, share stays, and never face exam day alone.
```

## Description (1,438 / 4,000 characters)
```
Zenter helps competitive-exam aspirants find and coordinate with other students assigned to the same exam centre — so you're never navigating an unfamiliar city alone on exam day.

WHY ZENTER
Every year, thousands of NEET, NEET PG, INICET, NEET MDS, and NEET SS aspirants travel to exam centres far from home. Zenter connects you with other aspirants heading to your exact centre, so you can coordinate travel, split accommodation costs, and simply feel less alone before a high-stakes exam.

HOW IT WORKS
- Complete your profile with your exam type, exam centre, and travel/stay preferences.
- Browse other aspirants at your centre in the Find tab, filtered by district.
- Send a connection request to aspirants you'd like to coordinate with.
- Once a request is accepted, chat directly inside the app to plan your trip.

PRIVACY BY DESIGN
Your phone number is never shown to other aspirants until you both explicitly accept a connection. You can block or report anyone at any time, and your profile can be paused or permanently deleted whenever you choose.

ZENTER PLUS
Upgrade for a featured profile card, priority placement in your district's feed, and unlimited connections and co-ordinations — free accounts can send limited connections and reveals per month.

Zenter is built specifically for the exam-centre coordination problem — not a general social network, not a study-group app. Just aspirants, finding their exam-day people.
```

**OWNER ACTION REQUIRED**: the exam list (NEET UG/PG, INICET, NEET MDS/SS) is pulled from the live
`platform_config.exam_config` — reconfirm it's current before publishing, since this is a remotely-editable
list that could drift from the store listing over time.

## Keywords (91 / 100 characters, including commas)
```
exam,neet,coordination,centre,travel,aspirant,mates,study,inicet,student,partner,exam buddy
```

## Support URL
```
https://zenter.in/contact
```
Verified live (HTTP 200, `<title>Contact Support - Zenter</title>`) during this audit.

## Marketing URL
```
https://zenter.in
```
Verified live (HTTP 200 after redirect, `<title>Zenter - Find Your Exam Centre Mates</title>`) during this
audit. Optional field — include it since a real, working marketing site exists.

## Version
```
1.0
```

## Copyright
```
AMSEL GOLD (Proprietorship)
```
Derived from the live Privacy Policy (§1, "Who We Are"): *"ZENTER Owned And Operated By: AMSEL GOLD
(Proprietorship), Proprietor: PON BUVANESHWARAN."* This also matches the name on the Apple Developer Program
account used to sign this build (Team ID `H5G7S347ZN`, "PON BUVANESHWARAN MATHIALAGAN," Individual
enrollment) — the two sources corroborate each other, so this is a high-confidence derivation, not a guess.
**OWNER ACTION REQUIRED**: confirm the exact legal copyright line you want shown (e.g. whether to include a
year, e.g. "© 2026 Amsel Gold" — App Store Connect's Copyright field convention is typically `[year]
[Legal Entity Name]`).
