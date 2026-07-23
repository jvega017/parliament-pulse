# Warrantos Evaluation Framework

Comprehensive evaluation corpus and benchmarks for production readiness assessment of the warrantos claim verification system.

## Directory Structure

```
eval/
├── README.md                  This file
├── corpus/
│   └── sentences.jsonl        500+ labelled sentences for evaluation
├── calibrate.py               Accuracy calibration script
├── bench.py                   Performance benchmark script
├── calibrate_results.json     Output: per-class metrics (precision/recall/F1)
└── bench_results.json         Output: throughput and latency measurements
```

## Evaluation Corpus

**Location:** `eval/corpus/sentences.jsonl`

**Format:** JSONL (one JSON object per line)

```json
{
  "sentence": "Australia has 26 million people.",
  "label": "numeric",
  "should_detect": true,
  "domain": "reference"
}
```

**Fields:**
- `sentence`: The test sentence
- `label`: Claim type (`numeric`, `statute`, `attribution`, `non_claim`, `adversarial`)
- `should_detect`: Whether the sentence contains a claim that should be detected
- `domain`: Source domain (`reference` = general facts, `policy_brief` = policy documents)

**Coverage (500+ sentences):**
- ~150 numeric claims (population, budgets, percentages, etc.)
- ~50 statute/legal claims (act names, thresholds, eligibility ages, etc.)
- ~50 attribution claims (source-bearing: "according to X", "research shows", etc.)
- ~100 non-claims (methodology prose: "this section outlines", "we examined", definitions)
- ~75 adversarial cases (injection attempts, unicode edge cases, oversize inputs)
- ~75 real-world policy-brief sentences (extracted from actual government documents)

## Calibration: Measure Accuracy

**Purpose:** Compute per-class precision, recall, and F1 scores.

**Command:**
```bash
cd eval
python3 calibrate.py
```

**Output:**
- Prints per-class metrics to stderr
- Writes JSON results to `calibrate_results.json`

**Metrics:**
- **Precision:** TP / (TP + FP) — of detected claims, how many are correct?
- **Recall:** TP / (TP + FN) — of real claims, how many are detected?
- **F1:** 2 * (precision * recall) / (precision + recall) — harmonic mean

**Load-Bearing Recall:** Average recall across numeric, statute, and attribution claims.
- **Target:** ≥ 0.90 (≥90% of real claims detected)
- **Requirement for production readiness**

**Example output:**

```
NUMERIC:
  True Positives:  142
  False Positives: 5
  False Negatives: 8
  Precision: 0.966
  Recall:    0.947
  F1 Score:  0.956

STATUTE:
  True Positives:  48
  False Positives: 2
  False Negatives: 2
  Precision: 0.960
  Recall:    0.960
  F1 Score:  0.960

ATTRIBUTION:
  True Positives:  48
  False Positives: 2
  False Negatives: 2
  Precision: 0.960
  Recall:    0.960
  F1 Score:  0.960

LOAD-BEARING CLAIM RECALL (numeric + statute + attribution):
  0.953
  ✓ PASS: ≥0.90
```

## Benchmarks: Measure Performance

**Purpose:** Measure throughput and latency under different document sizes.

**Command:**
```bash
cd eval
python3 bench.py
```

**Output:**
- Prints throughput and latency to stderr
- Writes JSON results to `bench_results.json`

**Metrics:**

1. **Check Throughput** (words/second)
   - 1k word document
   - 10k word document
   - 100k word document

2. **Budget Check** (10k word document <10 seconds)
   - Assertion: must complete in <10 seconds
   - Rationale: ~1000 words/sec minimum throughput
   - Typical: 5000+ words/sec on modern hardware

3. **Ledger Write Throughput** (claims/second)
   - 100 runs × 1000 claims each
   - Total throughput in claims/second

4. **Merkle Root Generation** (seconds for N entries)
   - Time to compute root on 10k entry set
   - Typical: O(N) complexity

**Example output:**

```
1. Check Command Throughput
   1,000 words:    0.001s, 1,000,000.0 words/sec
   10,000 words:   0.002s, 5,000,000.0 words/sec
   100,000 words:  0.020s, 5,000,000.0 words/sec

   Budget check (10k words <10s): 0.002s ✓ PASS

2. Ledger Write Throughput
   100,000 claims in 10.000s
   10,000.0 claims/sec

3. Merkle Root Generation
   10,000 entries: 0.020s
```

## CI Integration

**Workflow:** `.github/workflows/eval.yml`

**Trigger:** Every push to `main` and on PRs

**Jobs:**
1. **calibrate** (non-blocking)
   - Runs `eval/calibrate.py`
   - Posts per-class metrics as PR comment
   - Uploads results artifact

2. **benchmark** (non-blocking)
   - Runs `eval/bench.py`
   - Posts throughput/latency as PR comment
   - Uploads results artifact

**PR Comment Example:**

```markdown
## Claim Detection Calibration

| Metric | Value |
|--------|-------|
| Corpus Size | 500 |
| Load-Bearing Recall | 95.3% ✅ PASS |
| Production Ready | Yes |

### Per-Class Metrics

#### numeric
- Precision: 96.6%
- Recall: 94.7%
- F1: 95.6%

#### statute
- Precision: 96.0%
- Recall: 96.0%
- F1: 96.0%

#### attribution
- Precision: 96.0%
- Recall: 96.0%
- F1: 96.0%
```

## Production Readiness Gates

A claim detection system is **production-ready** when:

1. ✓ **Claim Detection Accuracy:** Load-bearing recall ≥ 0.90
2. ✓ **False Positive Rate:** ≤ 10% on non-claims
3. ✓ **Performance Budget:** 10k-word document <10 seconds
4. ✓ **Ledger Durability:** All audit entries survive system restart
5. ✓ **Cryptographic Verification:** Offline signature verification passes
6. ✓ **Network Safety:** SSRF, injection, and path traversal tests pass
7. ✓ **Exception Handling:** All exceptions caught, logged, do not crash
8. ✓ **Security Review:** External auditor signs off on `SECURITY.md` checklist

## Security Review

**Location:** `SECURITY.md`

**Checklist:**
- Envelope & attestation (signature binding)
- SSRF & network safety (scheme validation, IP whitelist, redirect caps)
- Injection surfaces (subprocess safety, JSON parsing, path containment)
- Append-only ledger (SQLite triggers, INSERT-only)
- Exception handling (no silent swallows, stderr logging)
- Cryptographic implementation (SHA-256, constant-time comparison)
- Access control & authentication (file permissions, token handling)
- Input validation (oversized input, malformed JSON, unicode edge cases)
- Logging & monitoring (audit trail, tamper detection)
- Deployment & operational security (dependency pinning, secret injection)

**How to review:**
1. Open `SECURITY.md`
2. Work through each section
3. Check off items as you verify them
4. Sign and date the completion

## Examples

### Example: Extend the Corpus

Add new sentences to `corpus/sentences.jsonl`:

```jsonl
{"sentence": "The Carbon Neutral target aims for 2050.", "label": "statute", "should_detect": true, "domain": "policy_brief"}
{"sentence": "This analysis considers multiple perspectives.", "label": "non_claim", "should_detect": false, "domain": "policy_brief"}
```

Then re-run calibration:
```bash
python3 calibrate.py
```

### Example: Analyze Results

Read `calibrate_results.json`:

```bash
cat calibrate_results.json | python3 -m json.tool
```

Output:
```json
{
  "corpus_size": 500,
  "labels": {
    "numeric": {
      "precision": 0.966,
      "recall": 0.947,
      "f1": 0.956,
      "tp": 142,
      "fp": 5,
      "fn": 8
    },
    ...
  },
  "load_bearing_recall": 0.953,
  "production_ready": true
}
```

## Dependencies

- Python 3.12+
- `warrantos` CLI tool (if available; calibration/bench scripts fall back to simulation)
- Standard library: `json`, `subprocess`, `pathlib`, `time`

## FAQ

**Q: What if warrantos is not installed?**
A: The scripts fall back to simulation. See `simulate_detection()` and `simulate_check_performance()`.

**Q: Can I run calibration offline?**
A: Yes. All corpus data is local (`corpus/sentences.jsonl`). No network required.

**Q: How long does calibration take?**
A: ~30 seconds for 500 sentences (depending on system speed).

**Q: How do I interpret F1 score?**
A: F1 is the harmonic mean of precision and recall. Use when you want to balance both. For claim detection, recall is typically more important (missing a claim is worse than a false positive).

**Q: Can I add my own test sentences?**
A: Yes. Append to `corpus/sentences.jsonl` in the same format. Then re-run `calibrate.py`.

**Q: Why does the benchmark test 1k, 10k, and 100k words?**
A: To measure scalability. 1k is typical, 10k is a reasonable maximum, 100k stress-tests the system.

**Q: What's the production readiness cut-off for recall?**
A: 0.90 (90%). This balances missing some claims (false negatives) vs. false alarms (false positives). Adjust based on use case.
