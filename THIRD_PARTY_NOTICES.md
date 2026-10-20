# Third-party notices

Startup helpers (`macos/startup/bridge.m`, `macos/startup/watch.cjs`, `startup/*`) and startup controller tests are adapted from [jaykinhoo9/codex-usage-badge](https://github.com/jaykinhoo9/codex-usage-badge), commit `d014efcd7735a4349576c6b424cac23b614f9115`. Copyright (c) 2026 Codex Usage Badge contributors. MIT license: [full notice](docs/UPSTREAM-LICENSE).

Changes: removed Dock preference migration and PowerShell execution-policy bypass; added plain-launch and native single-instance guards on macOS; separate Tonut install paths; minimized error logging. No upstream UI, account databases, token estimators or updater is included.

Runtime: Node.js 24+ and the user's installed official Codex CLI. No runtime npm dependencies are bundled. Browser tests use the user's external Playwright installation; Chromium and Playwright are not redistributed. System frameworks are supplied by each OS.

Additional Tonut changes in0.4.0: transactional deployment and crash recovery, privacy-bounded diagnostics, host/listener identity verification, kernel installation/runtime locks, Windows parent supervision and exact Store-package re-resolution. The original upstream MIT notice remains in full.

Development-only dependency: `playwright-core`1.57.0, Apache-2.0. It is installed separately from npm for tests and is not redistributed in the release source archive. Node, Chromium, the official Codex CLI and operating-system frameworks are not bundled. The SVG reset-credit icon is original Tonut artwork under the repository MIT license.
