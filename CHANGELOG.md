# Changelog

## 0.4.1

- Refine the reset-credit row spacing after visual review: increase its top margin from13px to16px. Available doughnuts remain left aligned; a true zero still shows right-aligned “没有！！”, unknown shows “—”.
- Preserve the existing fonts, colors, avatar geometry, quota reset bar and 480ms/160ms entry animations.

## 0.4.0

- Stage and validate complete updates before stopping Tonut; retain the last good installation and automatically roll back files, selected quota period and service configuration after a failed update. Recover an interrupted transaction on the next install/recover operation.
- Protect concurrent installers with OS kernel locks. Keep the host desktop application running during updates.
- Verify the official host signature/process and its ownership of the loopback CDP listener; validate exact page identity before injecting. Keep quota requests read-only.
- Add fixed-category, bounded and rotated local diagnostics plus process health receipts. Never record chat text, raw account responses, credential material or raw command lines.
- Add Windows watchdog supervision, abandoned-lock recovery, cooperative child shutdown and exact-package Store path resolution. Windows remains beta pending installed-host lifecycle/UI testing.
- Show real available reset-credit count as small original SVG doughnuts, with count only and no expiry text, inside the existing avatar tooltip. Unknown remains unknown. No reset-credit redemption command is permitted.
- Preserve avatar/ring positioning,480ms bar/160ms panel entry, immediate dismissal, reduced-motion support and host theme inheritance.

## 0.3.0

Independent Tonut project, official Codex quota ring, guarded startup and retained MIT attribution.
