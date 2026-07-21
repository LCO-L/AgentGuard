// © 2026 이동훈 (DONGHUN LEE) · All Rights Reserved · AgentGuard (Proprietary).
// AgentGuard — 네이티브 macOS 앱(Cocoa + WebKit).
//
// 하는 일:
//  1) 프로젝트 루트(app.py)를 찾아 로컬 백엔드(FastAPI)를 자동 기동 → 온디바이스 검사
//  2) 네이티브 창(WKWebView)에 http://localhost:8000 을 띄움
//  3) 로컬을 못 띄우면 배포본(https://agentguard.maeum.ai)으로 폴백
//
// 빌드: scripts/build_mac_app.sh  (swiftc -framework Cocoa -framework WebKit)
import Cocoa
import WebKit

let DEPLOYED = "https://agentguard.maeum.ai"
let LOCAL = "http://localhost:8000"

func findProjectRoot() -> String? {
    if let env = ProcessInfo.processInfo.environment["AGENTGUARD_HOME"],
       FileManager.default.fileExists(atPath: env + "/app.py") {
        return env
    }
    var dir = URL(fileURLWithPath: Bundle.main.bundlePath)
    for _ in 0..<8 {
        dir = dir.deletingLastPathComponent()
        if FileManager.default.fileExists(atPath: dir.appendingPathComponent("app.py").path) {
            return dir.path
        }
    }
    return nil
}

func isUp(_ base: String) -> Bool {
    guard let url = URL(string: base + "/v1/health") else { return false }
    var req = URLRequest(url: url)
    req.timeoutInterval = 1.5
    let sem = DispatchSemaphore(value: 0)
    var ok = false
    URLSession.shared.dataTask(with: req) { _, resp, _ in
        if let h = resp as? HTTPURLResponse, h.statusCode == 200 { ok = true }
        sem.signal()
    }.resume()
    _ = sem.wait(timeout: .now() + 2.0)
    return ok
}

var backendProc: Process?

func startBackend(_ root: String) {
    let p = Process()
    let venvPy = root + "/.venv/bin/python"
    if FileManager.default.fileExists(atPath: venvPy) {
        p.executableURL = URL(fileURLWithPath: venvPy)
        p.arguments = [root + "/app.py"]
    } else {
        p.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        p.arguments = ["python3", root + "/app.py"]
    }
    p.currentDirectoryURL = URL(fileURLWithPath: root)
    var env = ProcessInfo.processInfo.environment
    env["PORT"] = "8000"
    env["AG_ONDEVICE"] = "1"           // 설치형: 온디바이스 원클릭 허용
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
    p.environment = env
    try? p.run()
    backendProc = p
}

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var web: WKWebView!

    func applicationDidFinishLaunching(_ note: Notification) {
        var target = DEPLOYED
        if let root = findProjectRoot() {
            if !isUp(LOCAL) { startBackend(root) }
            for _ in 0..<30 {              // 최대 ~15초 대기
                if isUp(LOCAL) { break }
                Thread.sleep(forTimeInterval: 0.5)
            }
            if isUp(LOCAL) { target = LOCAL }
        }

        let rect = NSRect(x: 0, y: 0, width: 1120, height: 760)
        window = NSWindow(contentRect: rect,
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "AgentGuard"
        window.minSize = NSSize(width: 720, height: 520)
        window.center()

        let cfg = WKWebViewConfiguration()
        web = WKWebView(frame: rect, configuration: cfg)
        web.navigationDelegate = self
        web.autoresizingMask = [.width, .height]
        window.contentView = web
        if let url = URL(string: target) { web.load(URLRequest(url: url)) }

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ note: Notification) { backendProc?.terminate() }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
