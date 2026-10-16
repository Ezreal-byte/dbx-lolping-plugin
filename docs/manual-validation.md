# Desktop acceptance checklist

Record OS version, display topology, DPI, DBX version, package SHA-256 and result. Unchecked items are not claims of support.

- [ ] Install the unsigned development package in DBX and open the workbench. Verify the UI and host binary/event permissions.
- [ ] Start twice; only one helper and one overlay per display should exist. Close the settings tab and continue pinging. Stop, reopen, start and stop again.
- [ ] Normal clicks, double clicks, drag-selection, typing, modifier taps and Alt+Tab continue to reach the underlying application without delay or stuck modifiers.
- [ ] Ping and emote hold/drag/release gestures, center cancellation, trigger+click settings, Caps Lock and mouse side buttons (where available), custom triggers and pause hotkey.
- [ ] Capture a new trigger/shortcut while running. Cancel with Escape and by timeout. Input listening resumes afterward, including if the settings page closes during capture.
- [ ] Confirm transparent pixels, no focus stealing, no taskbar entry, correct animation, volume/mute and sound output device behavior.
- [ ] Two displays with mixed DPI and negative origins; move between them, unplug one, change resolution/scale, and verify coordinates and cleanup.
- [ ] Preview from stopped state; it must not install input hooks. Preview windows close automatically.
- [ ] Import the offline pack, reimport it, and verify 44 built-in emotes. Import static/animated custom images and sounds, assign wheel slots, restart and remove.
- [ ] Stop DBX normally and force-close the sidecar. No helper, hook, overlay or locked package file remains. Upgrade/uninstall while the plugin has been running.
- [ ] macOS 13+ Apple Silicon: first permission denial, granting Accessibility, retry, revocation, update/regrant, fullscreen Spaces, Mission Control, multi-monitor coordinate conversion and no Dock/focus activation.
- [ ] Confirm behavior in ordinary maximized and borderless fullscreen windows. Exclusive fullscreen games, elevated applications and secure desktops are not guaranteed.

The automated smoke report covers protocol, resources, persistence and selected real overlay lifecycle checks. It does not replace this checklist.
