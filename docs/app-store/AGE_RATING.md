# Age Rating — recommended answers

Based on actual app functionality (exam-aspirant matching + gated 1:1 chat), not aspirational/planned features.

| Apple question | Recommended answer | Reasoning |
|---|---|---|
| Unrestricted Web Access | **No** | No in-app browser/WebView found anywhere in the codebase; all external links (`Linking.openURL`) open the OS browser, which Apple doesn't count as "unrestricted web access within the app" |
| User-Generated Content | **Yes** | Chat messages (`messages` table) and profile fields (`bio`, `full_name`, etc.) are user-authored and shown to other users |
| Messaging/Chat with other users | **Yes** | Core feature — 1:1 chat gated behind mutual connection acceptance |
| Gambling / Contests | **No** | No such functionality anywhere in the app |
| Sexual Content or Nudity | **None** | Not present; no content-type feature that could introduce it (text profile fields + text chat only) |
| Violence | **None** | Not applicable to this app's functionality |
| Alcohol, Tobacco, or Drug Use/References | **None** | Not applicable |
| Medical/Treatment Information | **None** | The app is about exam logistics coordination, not medical content, despite NEET being a medical-entrance exam — no medical advice/content feature exists |
| Profanity or Crude Humor | **None** (app-authored) — user-generated chat content is technically unmoderated free text, so profanity *could* appear in user messages | See UGC_COMPLIANCE.md — block + report-via-block-reason exists as the mitigation Apple expects for this exact scenario |
| Advertising | **No** | No ad SDK/network found anywhere in the dependency tree |

## Recommended overall rating

Because user-generated content (free-text chat + profile fields) exists with **no automated content filter**
(only reactive block/report — see `UGC_COMPLIANCE.md`), Apple's own rating logic for "Unrestricted User
Generated Content" typically lands this class of app at **17+** unless active moderation/filtering is
demonstrated, **or** at a lower age band if you can show the reactive block/report + published contact
mechanism satisfies Apple's Guideline 1.2 minimum bar (which it likely does — see UGC file — but the *age
rating questionnaire itself* is stricter than the guideline's minimum bar and commonly defaults UGC apps to
17+ regardless).

**OWNER ACTION REQUIRED**: this is Apple's own automated rating computation based on your questionnaire
answers, not something this audit can pin to an exact number — answer the UGC/messaging questions honestly per
the table above and let App Store Connect compute the resulting age band.
