# Parliament Pulse: licence architecture (founding policy)

**Status:** Founding product policy. Adopted 2026-07-19.
**Owner:** Juan Vega, Prometheus Policy Lab (personal-capacity venture).
**Why this exists:** every rendered surface, the email digest, the fixture data, and the D1 archive take their display rules from this file. No feature ships that breaches it.

---

## 1. The rule in one sentence

Parliament Pulse renders only facts, its own analysis and provenance, and links to the source. It never presents Australian Parliament House prose or verbatim feed content as its own product content.

## 2. Why this is the design

The Australian Parliament House website licenses its material under Creative Commons BY-NC-ND 4.0 (Verified 2026-07-19 from https://www.aph.gov.au/Help/Disclaimer_Privacy_Copyright: material may be copied and communicated "in its current form for all non-commercial purposes" with attribution). NonCommercial and NoDerivatives both bite a paid product that redistributes or transforms that prose.

Copyright protects original expression. It does not protect facts, and it does not restrict linking. A product whose every rendered element is a fact restated in its own words, its own analysis, or a hyperlink to aph.gov.au does not copy or communicate APH material, so the licence never engages.

Confidence labels: the licence text is **Verified**. The facts-are-free principle rests on Australian authority (IceTV v Nine Network, HCA 2009) and is **Based on training, lawyer to confirm before any customer-facing citation**. The claim that the facts-and-links surface avoids the licence entirely is **Inferred** and is the subject of the phase-3 fixed-fee legal review of this document.

## 3. What the product MAY show (its own content, licence does not engage)

**Facts, restated as structured data fields, each carrying a source link:**
- That a bill exists, and its formal short title used as an identifier.
- That an inquiry or hearing opened, and its subject.
- Sitting dates, hearing dates, submission deadlines.
- Division results and vote counts.
- Committee names, membership, chairs.
- Member names, parties, electorates.
- Document tabling events, chamber, and status.

**The product's own work:**
- Attention scores and the rationale behind each score.
- Clustering, threads, trend and momentum analysis.
- A one-line characterisation of each event, assembled from the structured fact fields (for example "New Senate inquiry opened: digital procurement governance; submissions close 19 May"), written from the facts and never as a paraphrase of APH prose.
- Watchlist matches and analyst notes.

**Provenance metadata (the product's own telemetry, its trust surface):**
- Fetch timestamps, HTTP status codes, feed health, schema versions, item counts.

**Links:**
- A deep link to the APH source page for every item, styled as the primary call to action. "Read the source at aph.gov.au" is a feature and it reinforces the provenance-first positioning.

## 4. What the product MAY NOT show as its own content (licence engages)

- RSS item titles and descriptions rendered verbatim as product content. The current Signal inbox does this and it changes in phase 1.
- APH summaries, media-release text, Bills Digest content, or Hansard excerpts beyond fair-dealing quotation, presented inside the paid surface.
- Any APH prose reproduced as though it were the product's own writing.

## 5. Boundary cases (flagged for the phase-3 lawyer, do not resolve by guesswork)

1. Verbatim short bill titles: probably insubstantial or purely factual as identifiers, confirm.
2. The D1 archive storing raw feed titles and descriptions internally: internal reproduction is still reproduction in strict terms. Mitigation options: store extracted fact fields plus a content hash rather than raw prose, or cover storage under the written-permission track (section 6).
3. Quotation within a paid analyst briefing: fair-dealing boundaries, confirm scope.

## 6. The parallel permission track

Facts-and-links is the primary path because it sits entirely in Juan's control. In parallel, a short written request goes to webmanager@aph.gov.au (Verified contact 2026-07-19) describing the product and asking for written permission or a commercial licence for feed metadata. A yes relaxes section 4 and 5 substantially. A no or silence changes nothing, because the architecture does not depend on the reply. No phase waits on it.

## 7. Adjacent sources inherit the same discipline

- **TheyVoteForYou:** its licensing page 403s non-browser fetchers; search snippets indicate Open Data Commons Open Database License (attribution share-alike). **Inferred, must be read in a real browser before any ingest**, because share-alike obligations on a commercial product are a genuine constraint.
- **Any future jurisdiction (for example QLD state parliament):** a licence check precedes the first line of ingest code, every time.

## 8. Conformance

Phase 1 exit requires every page checked against sections 3 and 4, zero verbatim feed prose on any surface, and the digest template conformed. CI carries an axe-core smoke and the jsx-sync check; a licence-conformance check on the render layer is added as the contract stabilises.

---

*This document is the single most important decision in the launch roadmap. It converts the APH licence from a launch blocker into a display-layer contract. Full roadmap: `08_Outputs/reviews/parliament-pulse-path-to-launch-fable.md`.*
