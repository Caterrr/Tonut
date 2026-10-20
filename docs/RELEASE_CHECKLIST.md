#0.4.0 release gates

- [x] Fixed scope: preserve avatar placement and original progress/animation behavior; reset-credit footer is read-only.
- [x] Transaction fixtures: fresh/repeated installation, selected-window preservation, every switch failure, interrupted rename and failed rollback recovery.
- [x] Mac live: upgrade and deliberately failing new worker restore previous bytes/config/service state without restarting host.
- [x] Mac live: final repeated installation, uninstall and fresh installation of the release candidate; both own jobs running afterward.
- [x] Identity fixtures: wrong owner, non-loopback, ambiguous main host, wrong page websocket and reconnect failure.
- [x] Privacy fixtures: fixed diagnostic vocabulary, recovery record and bounded rotation; release source allowlist excludes personal data and credentials.
- [x] Reset-credit source verified via official readonly snapshot; unknown/zero/detail truncation tested, no redemption method added.
- [x] Browser regression: original entry/exit/reduced-motion/click, unchanged ring geometry, credit count without expiry text and unknown/zero states.
- [ ] Remote Mac/Windows/Linux release CI: unit/fault tests, browser test, native compile/kernel locks and Windows simulated Store resolution.
- [ ] Published release: source ZIP and SHA256SUMS downloadable and verified; version tag points to CI-tested commit.
- [ ] Windows installed-host lifecycle/UI, actual Store upgrade and sign-in/reboot soak: not available; remains beta and clearly disclosed.

Unchecked Windows device tests are a declared support boundary, not a passing release test. No resource-usage benchmark or long-term stability claim is made.
