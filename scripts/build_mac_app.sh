#!/usr/bin/env bash
# AgentGuard.app 빌드 — macOS.
#   기본:   ./scripts/build_mac_app.sh          (네이티브 WKWebView 앱, 실패 시 셸-런처)
#   DMG도:  ./scripts/build_mac_app.sh --dmg
#
# 결과물: dist/mac/AgentGuard.app  (더블클릭 → 로컬 백엔드 자동 기동 + 창에 표시)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/dist/mac/AgentGuard.app"
MACOS="$APP/Contents/MacOS"
RES="$APP/Contents/Resources"

echo "▶ AgentGuard.app 빌드: $APP"
rm -rf "$APP"
mkdir -p "$MACOS" "$RES"

# ── Info.plist (ATS: localhost http 허용) ──
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>AgentGuard</string>
  <key>CFBundleDisplayName</key><string>AgentGuard</string>
  <key>CFBundleIdentifier</key><string>com.agentguard.mac</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>AgentGuard</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST

# ── 실행 파일: 네이티브(swiftc) 우선, 실패 시 셸-런처 ──
NATIVE=0
if command -v swiftc >/dev/null 2>&1 && [ -f "$ROOT/mac/AgentGuardApp.swift" ]; then
  echo "▶ Swift 네이티브 앱 컴파일…"
  if swiftc "$ROOT/mac/AgentGuardApp.swift" -o "$MACOS/AgentGuard" \
       -framework Cocoa -framework WebKit -O 2>/dev/null; then
    NATIVE=1
    echo "  ✓ 네이티브 WKWebView 앱"
  else
    echo "  ! swiftc 실패 → 셸-런처로 폴백"
  fi
fi

if [ "$NATIVE" -eq 0 ]; then
  cat > "$MACOS/AgentGuard" <<'LAUNCH'
#!/bin/bash
# 셸-런처: 프로젝트(app.py) 찾기 → 로컬 백엔드 기동 → 브라우저로 열기
DIR="$(cd "$(dirname "$0")" && pwd)"; ROOT=""; d="$DIR"
for i in 1 2 3 4 5 6 7 8; do d="$(dirname "$d")"; [ -f "$d/app.py" ] && ROOT="$d" && break; done
if [ -n "$ROOT" ]; then
  cd "$ROOT"
  if ! curl -s http://localhost:8000/v1/health >/dev/null 2>&1; then
    PY="python3"; [ -x "$ROOT/.venv/bin/python" ] && PY="$ROOT/.venv/bin/python"
    AG_ONDEVICE=1 PORT=8000 "$PY" app.py >/tmp/agentguard.log 2>&1 &
    for i in $(seq 1 30); do curl -s http://localhost:8000/v1/health >/dev/null 2>&1 && break; sleep 0.5; done
  fi
  open "http://localhost:8000"
else
  open "https://agentguard.maeum.ai"
fi
LAUNCH
  echo "  ✓ 셸-런처(브라우저로 열기)"
fi
chmod +x "$MACOS/AgentGuard"

# ── 아이콘: ui/icon.svg → PNG(qlmanage) → icns(iconutil) ──
ICON_SVG="$ROOT/ui/icon.svg"
if command -v qlmanage >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1 && [ -f "$ICON_SVG" ]; then
  TMP="$(mktemp -d)"
  qlmanage -t -s 1024 -o "$TMP" "$ICON_SVG" >/dev/null 2>&1 || true
  PNG="$(ls "$TMP"/*.png 2>/dev/null | head -1)"
  if [ -n "$PNG" ]; then
    SET="$TMP/AppIcon.iconset"; mkdir -p "$SET"
    for s in 16 32 128 256 512; do
      sips -z $s $s "$PNG" --out "$SET/icon_${s}x${s}.png" >/dev/null 2>&1 || true
      sips -z $((s*2)) $((s*2)) "$PNG" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null 2>&1 || true
    done
    iconutil -c icns "$SET" -o "$RES/AppIcon.icns" 2>/dev/null && echo "  ✓ 아이콘" || echo "  ! 아이콘 생략"
  fi
  rm -rf "$TMP"
fi

echo "✅ 완료: $APP"
echo "   실행: open \"$APP\"   (또는 Finder에서 더블클릭)"

# ── DMG (선택) ──
if [ "${1:-}" = "--dmg" ] && command -v hdiutil >/dev/null 2>&1; then
  DMG="$ROOT/dist/mac/AgentGuard.dmg"
  hdiutil create -volname AgentGuard -srcfolder "$APP" -ov -format UDZO "$DMG" >/dev/null
  echo "✅ DMG: $DMG"
fi
