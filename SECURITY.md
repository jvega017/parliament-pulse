# Security Policy & External Review Checklist

## Reporting Security Issues

Please report security vulnerabilities to [security contact - to be added] rather than using the public issue tracker.

## External Security Review Checklist

This checklist is designed for independent security reviewers to validate the warrantos claim verification system against key threat models.

### Envelope & Attestation

Verify cryptographic binding between prose content, component build manifest (CBOM), and checkpoint signatures.

- [ ] **Signature Schema**: Confirm that `envelope.signatures[0]` binds both `prose_sha256` and `cbom_sha256` to the checkpoint body
- [ ] **v1 Legacy Rejection**: Verify that v1 envelope versions are rejected as `LEGACY_UNBOUND` (never `VALID`)
- [ ] **Tamper Detection - Prose Swap**: Test scenario where prose content is replaced while envelope is reused; confirm detection fails
- [ ] **Tamper Detection - CBOM Swap**: Test scenario where CBOM is modified while prose/signature remain; confirm detection fails
- [ ] **Tamper Detection - Ledger Entry Swap**: Test scenario where audit ledger entry is modified; confirm integrity check fails
- [ ] **Offline Verification**: Verify that offline signature verification works without network access to any external service
- [ ] **Cross-Signature Validation**: Confirm that mixing signatures from different checkpoints is rejected

### SSRF & Network Safety

Validate that URL fetches and network requests cannot be exploited for server-side request forgery (SSRF) attacks.

- [ ] **Scheme Validation**: Confirm that only `http://` and `https://` schemes are accepted; `file://`, `gopher://`, `dict://` etc. are rejected
- [ ] **IP Whitelist/Blacklist**: Verify that resolved IPs are validated as globally routable (not private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, ::1)
- [ ] **Redirect Hops Cap**: Confirm that HTTP redirects are capped at 3 hops; chains longer than 3 are rejected
- [ ] **Redirect Target Validation**: Verify that each redirect target is re-validated against scheme and IP whitelist rules
- [ ] **DNS Rebinding TOCTOU**: Document known limitation: DNS responses may be rebounded between resolution and connection; recommend using stable DNS TTLs and monitoring
- [ ] **Timeout & Resource Limits**: Confirm reasonable timeouts on all network operations (e.g., 10s connection, 30s total)
- [ ] **Certificate Validation**: Verify that HTTPS connections validate certificates and reject self-signed unless explicitly trusted

### Injection Surfaces

Identify and validate all untrusted input entry points to prevent injection attacks.

- [ ] **GitHub Action Input Passing**: Confirm that GitHub Action inputs are passed via environment variables (ENV), never interpolated into shell commands
- [ ] **Subprocess Safety**: Verify that subprocess calls use parameterized argument lists, not shell string interpolation
- [ ] **JSON Parsing**: Confirm that JSON parsing uses safe libraries (e.g., standard `json` module in Python); no `eval()` or untrusted `pickle`
- [ ] **Path Traversal**: Verify that all path operations use `resolve_under()` or equivalent containment checks to prevent directory traversal
- [ ] **Command Injection**: Test that shell metacharacters in claim text (e.g., `; rm -rf /`) are not executed
- [ ] **Format String Attacks**: Verify that user-supplied text is never used as format string argument to `printf`, `str.format()`, etc.
- [ ] **Regular Expression DoS**: Confirm that regex patterns on user input have bounded complexity (no catastrophic backtracking on inputs like `(a+)+b`)
- [ ] **XML External Entity (XXE)**: If XML parsing occurs, verify that external entity processing is disabled

### Append-Only Ledger

Validate that the audit ledger enforces append-only semantics and cannot be corrupted by tampering.

- [ ] **SQLite Trigger Enforcement**: Confirm that SQLite triggers on audit tables prevent UPDATE and DELETE operations
- [ ] **INSERT Semantics**: Verify that INSERT operations are allowed and accumulate claims in chronological order
- [ ] **Rollback Prevention**: Test that transaction rollbacks do not remove committed audit entries
- [ ] **Multiple Run Accumulation**: Verify that running the tool multiple times accumulates entries (does not overwrite or deduplicate)
- [ ] **Integrity on Failure**: Confirm that transaction failures during ledger writes do not leave the ledger in a corrupted state
- [ ] **Concurrent Access**: If applicable, test concurrent writes to ledger and verify no data loss or corruption
- [ ] **WAL Mode**: Confirm that SQLite write-ahead logging (WAL) is enabled for durability

### Exception Handling & Error Messages

Validate that all exceptions are handled safely and error messages do not leak sensitive information.

- [ ] **No Silent Swallows**: Verify that no exception handlers silently suppress errors on critical integrity paths (signature verification, ledger writes, etc.)
- [ ] **Stderr Logging**: Confirm that all errors are logged to stderr with sufficient context for debugging
- [ ] **Error Message Sanitization**: Verify that error messages do not leak sensitive information (file paths, internal state, secrets)
- [ ] **KeyboardInterrupt Propagation**: Test that Ctrl+C (KeyboardInterrupt) and system signals (SIGTERM) propagate cleanly
- [ ] **SystemExit Handling**: Verify that SystemExit exceptions are not caught and suppressed
- [ ] **Graceful Degradation**: If crypto operations are unavailable, confirm that degradation is explicit (error logged) rather than silent
- [ ] **Stack Traces**: Ensure that stack traces in production are not exposed to end users; log to stderr only
- [ ] **Unhandled Exceptions**: Run under a debugger or with aggressive exception handling to confirm no unhandled exceptions escape

### Cryptographic Implementation

Validate that cryptographic operations follow best practices and are resistant to common attacks.

- [ ] **Algorithm Selection**: Confirm that SHA-256 is used for content hashing (not MD5, SHA-1)
- [ ] **ECDSA Parameters**: If ECDSA signatures are used, verify that curves are modern (P-256, P-384, or newer; not P-192)
- [ ] **Random Number Generation**: Verify that cryptographic randomness uses `os.urandom()` or `secrets` module, not `random` module
- [ ] **Key Storage**: If keys are stored, confirm they are not hardcoded in source; use secure key management
- [ ] **Timing Side Channels**: If timing-sensitive comparisons occur (e.g., signature verification), use constant-time comparison functions
- [ ] **Entropy Seeding**: Test that randomness is properly seeded and does not repeat across runs

### Access Control & Authentication

Validate that access controls are correctly enforced for sensitive operations.

- [ ] **Command-Line Flags**: Verify that `--json`, `--verbose`, etc. flags do not inadvertently expose sensitive data
- [ ] **File Permissions**: Confirm that ledger files and cached data are readable only by the intended user (mode 0600 or similar)
- [ ] **GitHub API Credentials**: If GitHub API is used, verify that tokens are read from secure environment or credential stores, not hardcoded
- [ ] **Privilege Escalation**: Test that unprivileged users cannot perform privileged operations (e.g., modify ledger, change signature)
- [ ] **Session Validation**: If sessions/tokens are used, verify expiry and revocation logic

### Input Validation & Parsing

Validate that all input parsing is robust and does not crash or behave unexpectedly.

- [ ] **Oversized Input**: Test with extremely large documents (e.g., 1GB text); verify graceful handling (timeout, memory limit) not crash
- [ ] **Malformed JSON**: Test that malformed JSON in `--json` output is caught and reported, not crashes parser
- [ ] **Unicode Edge Cases**: Test with emoji, RTL text, normalization forms (NFC vs NFD); verify no crashes or normalization bypasses
- [ ] **Null Bytes**: Test input containing null bytes (`\x00`); verify safe handling
- [ ] **Control Characters**: Test input with tabs, newlines, control characters; verify correct escaping in output
- [ ] **Boundary Conditions**: Test minimum (empty string) and maximum valid inputs for all parameters
- [ ] **Type Confusion**: Test passing wrong types to APIs (e.g., int where string expected); verify errors not crashes

### Logging & Monitoring

Validate that security-relevant events are logged and can be audited.

- [ ] **Claim Detection Events**: Confirm that all detected claims are logged with context (sentence, confidence, timestamp)
- [ ] **Signature Verification Events**: Log successful and failed signature verification attempts
- [ ] **URL Fetch Events**: Log all URL fetches, redirects, and SSRF rejections
- [ ] **Ledger Write Events**: Log all ledger write operations with transaction ID
- [ ] **Error Events**: Log all errors, exceptions, and degradation events
- [ ] **Audit Trail**: Verify that logs are immutable and timestamped

### Configuration & Defaults

Validate that configuration is secure by default and that overrides do not introduce vulnerabilities.

- [ ] **Secure Defaults**: Verify that all security-relevant defaults are conservative (e.g., SSL/TLS verification on, redirects capped)
- [ ] **Configuration Precedence**: Document which configuration sources take precedence (env > config file > hardcoded); verify no surprises
- [ ] **Validation on Load**: Confirm that configuration is validated at load time, not at use time
- [ ] **Safe Fallbacks**: If a configuration option fails to load, verify that a safe default is used

### Deployment & Operational Security

Validate that the system can be deployed securely and that operational procedures are sound.

- [ ] **Dependency Pinning**: Confirm that all dependencies are pinned to specific versions; no floating versions like `>=1.0`
- [ ] **Supply Chain Integrity**: Verify that dependencies are fetched from trusted sources (PyPI, npm registry) with signature verification if available
- [ ] **Build Reproducibility**: Test that builds are reproducible; same source code always produces identical binaries (for verification purposes)
- [ ] **Secrets Management**: Document how secrets (API keys, signing keys) should be injected at deployment time, not build time
- [ ] **Backup & Recovery**: Confirm that the ledger can be backed up and recovered without data loss or corruption
- [ ] **Version Pinning in CI**: Verify that CI uses pinned action versions, not `@latest`

### Documentation & Training

Validate that security is properly documented and communicated.

- [ ] **README Security Section**: Confirm that README or security docs clearly state trust assumptions, threat model, and known limitations
- [ ] **Admin Guide**: Document operational security procedures (key rotation, secret injection, backup procedures)
- [ ] **Known Limitations Document**: List all known security limitations and mitigations (e.g., DNS rebinding TOCTOU)
- [ ] **Incident Response Plan**: Document how to respond to security incidents, including contact procedures

---

## Production Readiness Gates

A claim detection system may be considered production-ready when:

1. **Claim Detection Accuracy**: Load-bearing claim recall ≥ 0.90 (≥90% of real claims detected)
2. **False Positive Rate**: False positive rate on non-claims ≤ 10%
3. **Performance Budget**: 10,000-word documents complete in <10 seconds
4. **Ledger Durability**: All audit ledger entries survive system restart
5. **Cryptographic Verification**: Offline signature verification passes all test cases
6. **Network Safety**: All SSRF, injection, and path traversal tests pass
7. **Exception Handling**: All exceptions are caught, logged, and do not crash the tool
8. **External Review**: All items in this checklist have been reviewed and signed off by independent auditor

---

## Known Limitations & Mitigations

### DNS Rebinding TOCTOU

**Issue**: An attacker can control a domain and change its DNS response between the initial resolution (IP whitelist check) and the actual connection. This is a time-of-check to time-of-use (TOCTOU) race condition.

**Mitigation**: 
- Use stable DNS TTLs (recommend ≥300 seconds)
- Cache DNS results for the duration of a single operation
- Document this limitation in user-facing documentation

### Performance Variance

**Issue**: Performance on different hardware, network conditions, or under load will vary significantly.

**Mitigation**:
- Budgets are set conservatively (10 seconds for 10k words = ~1000 words/sec; typical modern systems can do 5000+)
- Monitor real-world performance and adjust budgets if needed

### Concurrent Ledger Access

**Issue**: If multiple processes write to the ledger simultaneously, SQLite may serialize writes, reducing throughput.

**Mitigation**:
- SQLite handles concurrent access safely (append-only semantics preserved)
- If throughput becomes a bottleneck, consider read replicas or sharding
