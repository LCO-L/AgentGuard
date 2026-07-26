> [🇰🇷 한국어](MAC_APP.md) | 🇺🇸 **English**

# 🍎 AgentGuard — macOS App Build Guide

> Double-click and **the local backend (on-device) starts automatically**, and AgentGuard appears in a native window (WKWebView).
> If the local backend can't start, it automatically falls back to the deployed site (`https://agentguard.maeum.ai`).

## 1. One-line build

```bash
bash scripts/build_mac_app.sh          # creates dist/mac/AgentGuard.app
# with a DMG:
bash scripts/build_mac_app.sh --dmg    # dist/mac/AgentGuard.dmg
```

- **If swiftc is present** (Xcode Command Line Tools) → compiles a real **native WKWebView app**
- If absent or the build fails → automatically falls back to a **shell-launcher app** (starts the local backend, then opens the default browser)
- `ui/icon.svg` → `.icns` app icon is generated automatically too (when possible)

Prerequisites: macOS 12+, (optional) `xcode-select --install`, Python for the backend (the project's `.venv` or system `python3`).

## 2. Run

```bash
open dist/mac/AgentGuard.app          # or double-click in Finder
```

What the app does:
1. Looks for `app.py` (project root) in a parent folder → if found, starts the backend with `AG_ONDEVICE=1 PORT=8000`
2. Waits until `http://localhost:8000/v1/health` responds (up to ~15s)
3. Shows the local app in a native window (falls back to the deployed site if it can't)

> If you moved the app outside the project, point it at the path with an environment variable:
> `AGENTGUARD_HOME=/path/to/agentguard open dist/mac/AgentGuard.app`

## 3. First launch of an unsigned app (Gatekeeper)

Since it isn't signed for distribution, the first launch shows an "unidentified developer" warning.

- **Right-click → Open → Open**, or
- Remove the quarantine attribute: `xattr -dr com.apple.quarantine dist/mac/AgentGuard.app`

## 4. Structure

```
dist/mac/AgentGuard.app/
  Contents/
    Info.plist                 # ATS: allow localhost http (NSAllowsLocalNetworking)
    MacOS/AgentGuard           # native binary (swiftc) or shell launcher
    Resources/AppIcon.icns     # app icon (optional)
```

Source: `mac/AgentGuardApp.swift` (Cocoa + WebKit).

## 5. Distribution signing (optional, paid developer account required)

```bash
codesign --deep --force --sign "Developer ID Application: <name>" dist/mac/AgentGuard.app
xcrun notarytool submit dist/mac/AgentGuard.dmg --keychain-profile <profile> --wait
xcrun stapler staple dist/mac/AgentGuard.dmg
```

Once signed and notarized, it can be distributed without Gatekeeper warnings.
