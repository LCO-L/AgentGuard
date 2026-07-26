> 🇰🇷 **한국어** | [🇺🇸 English](MAC_APP.en.md)

# 🍎 AgentGuard — macOS 앱 빌드 가이드

> 더블클릭하면 **로컬 백엔드(온디바이스)가 자동으로 켜지고**, 네이티브 창(WKWebView)에 AgentGuard가 뜹니다.
> 로컬을 못 띄우면 배포본(`https://agentguard.maeum.ai`)으로 자동 폴백합니다.

## 1. 한 줄 빌드

```bash
bash scripts/build_mac_app.sh          # dist/mac/AgentGuard.app 생성
# DMG까지:
bash scripts/build_mac_app.sh --dmg    # dist/mac/AgentGuard.dmg
```

- **swiftc가 있으면**(Xcode Command Line Tools) → 진짜 **네이티브 WKWebView 앱**으로 컴파일
- 없거나 실패하면 → **셸-런처 앱**(로컬 백엔드 기동 후 기본 브라우저로 열기)으로 자동 폴백
- `ui/icon.svg` → `.icns` 앱 아이콘도 자동 생성(가능할 때)

준비물: macOS 12+, (선택)`xcode-select --install`, 백엔드용 Python(프로젝트의 `.venv` 또는 시스템 `python3`).

## 2. 실행

```bash
open dist/mac/AgentGuard.app          # 또는 Finder에서 더블클릭
```

앱이 하는 일:
1. 상위 폴더에서 `app.py`(프로젝트 루트)를 찾음 → 있으면 `AG_ONDEVICE=1 PORT=8000`으로 백엔드 기동
2. `http://localhost:8000/v1/health`가 뜰 때까지 대기(최대 ~15초)
3. 네이티브 창에 로컬 앱 표시(안 되면 배포본)

> 앱을 프로젝트 밖으로 옮겼다면 환경변수로 경로를 알려줄 수 있어요:
> `AGENTGUARD_HOME=/경로/agentguard open dist/mac/AgentGuard.app`

## 3. 서명 안 된 앱 첫 실행(Gatekeeper)

배포 서명을 안 했으므로 처음엔 "확인되지 않은 개발자" 경고가 뜹니다.

- **우클릭 → 열기 → 열기**, 또는
- 격리 속성 제거: `xattr -dr com.apple.quarantine dist/mac/AgentGuard.app`

## 4. 구조

```
dist/mac/AgentGuard.app/
  Contents/
    Info.plist                 # ATS: localhost http 허용(NSAllowsLocalNetworking)
    MacOS/AgentGuard           # 네이티브 바이너리(swiftc) 또는 셸-런처
    Resources/AppIcon.icns     # 앱 아이콘(선택)
```

소스: `mac/AgentGuardApp.swift` (Cocoa + WebKit).

## 5. 배포 서명(선택, 유료 개발자 계정 필요)

```bash
codesign --deep --force --sign "Developer ID Application: <이름>" dist/mac/AgentGuard.app
xcrun notarytool submit dist/mac/AgentGuard.dmg --keychain-profile <프로필> --wait
xcrun stapler staple dist/mac/AgentGuard.dmg
```

서명·공증하면 Gatekeeper 경고 없이 배포할 수 있습니다.
