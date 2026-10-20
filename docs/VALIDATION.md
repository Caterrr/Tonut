# Validation —0.4.0

The release uses the official readonly Codex rate-limit endpoint. Local verification records, actual quota snapshots, account data, screenshots, native process receipts and personal paths are excluded from source and release packages.

Automated fixtures cover config preservation, complete staging, no-stop-before-validation, fresh install failure, repeated update, faults before/after rename/start/health, child-process interruption, retained recovery receipts, diagnostic data minimization/rotation, strict host/listener/page identity, quota read failures, reconnect/re-injection, unknown/reset-credit semantics and cooperative Windows worker restart/Store-path change.

Browser tests retain480ms bar/160ms panel entry, immediate exit, cancellation, rapid reentry, ordinary interpolation, reduced motion and original avatar click. Added tests check two mock credit icons, absence of credit expiry text and preservation of the quota reset bar, unknown and zero counts, unchanged ring geometry and inherited accent. These are isolated browser tests, not a screenshot-derived or hardcoded live account count.

On the Mac: source helper compiled for arm64/x86_64, own signature verified;0.3→0.4 upgrade succeeded; a syntax-valid failing new agent was staged and started, health failure triggered automatic restoration of the prior runtime/config/services, and the restored tasks became healthy. Final repeated installation, uninstall and fresh installation passed; both own jobs were running afterward. The desktop host was not quit or patched. Remote release gates are tracked in RELEASE_CHECKLIST.

Windows: CI parses PowerShell and compiles native C# without activating the host. The added Windows test exercises an isolated real kernel mutex/abandoned owner and fixture Store-package path resolution. Task registration, installed-host GUI/normal-quit refusal, actual Store upgrades, sign-in/reboot and long-term operation still need a Windows device. Mac sign-in/reboot and long-term soak are also not claimed. Neither platform has a CPU/RSS/battery benchmark.

The complete Mac/Windows/Linux matrix passed in [release check run 39356308335](https://github.com/Caterrr/Tonut/actions/runs/39356308335). Repository text uses LF on every platform so the editable SVG matches its generated runtime literal and source packaging stays consistent.

No paid certificate, notarization bypass, new system software, credential or broadening of the loopback listener is part of this release. The Mac package is a source installer requiring Node24 and Xcode Command Line Tools; it is not a notarized standalone app.
