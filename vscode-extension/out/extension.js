"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
/**
 * AgentGuard VS Code 익스텐션 — "AI 시대의 Grammarly" IDE 판.
 *
 * 편집 중 문서를 /v1/inspect 로 병내 Diagnostics(밑줄)를 긋고,
 * CodeAction으로 시크릿 마스킹(/v1/redact)·무시를 제공한다.
 * 원문은 사용자가 설정한 백엔드(기본 localhost)에만 간다.
 */
const vscode = __importStar(require("vscode"));
const SEV_MAP = {
    critical: vscode.DiagnosticSeverity.Error,
    high: vscode.DiagnosticSeverity.Error,
    medium: vscode.DiagnosticSeverity.Warning,
    low: vscode.DiagnosticSeverity.Information,
};
const SEV_ORDER = ["low", "medium", "high", "critical"];
let collection;
let timer;
const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
function cfg() {
    const c = vscode.workspace.getConfiguration("agentguard");
    return {
        url: (c.get("apiUrl") || "http://localhost:8000").replace(/\/$/, ""),
        key: c.get("apiKey") || "",
        realtime: c.get("realtime") ?? true,
        minSev: c.get("minSeverity") || "low",
    };
}
async function postJSON(path, body) {
    const { url, key } = cfg();
    const headers = { "Content-Type": "application/json" };
    if (key)
        headers["X-API-Key"] = key;
    const res = await fetch(`${url}${path}`, {
        method: "POST", headers, body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(`AgentGuard HTTP ${res.status}`);
    return res.json();
}
async function scan(doc) {
    if (doc.uri.scheme !== "file" && doc.uri.scheme !== "untitled")
        return;
    const text = doc.getText();
    if (!text.trim()) {
        collection.delete(doc.uri);
        statusBar.hide();
        return;
    }
    try {
        const result = await postJSON("/v1/inspect", {
            text, kind: "auto",
        });
        const minIdx = SEV_ORDER.indexOf(cfg().minSev);
        const diags = result.issues
            .filter((i) => SEV_ORDER.indexOf(i.severity) >= minIdx)
            .map((i) => {
            const range = new vscode.Range(doc.positionAt(i.start), doc.positionAt(i.end));
            const d = new vscode.Diagnostic(range, `🛡️ ${i.title}${i.suggestion ? ` — ${i.suggestion}` : ""}`, SEV_MAP[i.severity]);
            d.source = `AgentGuard · ${i.rule_id}`;
            d.code = i.rule_id;
            return d;
        });
        collection.set(doc.uri, diags);
        const badge = result.overall === "green" ? "🛡️ 안전"
            : `🛡️ ${result.overall.toUpperCase()} · ${result.issues.length}건`;
        statusBar.text = badge;
        statusBar.tooltip = `AgentGuard 점수 ${result.score}/100`;
        statusBar.show();
    }
    catch {
        statusBar.text = "🛡️ 백엔드 오프라인";
        statusBar.tooltip = "AgentGuard 백엔드에 연결할 수 없습니다 (install.sh 실행)";
        statusBar.show();
    }
}
function schedule(doc) {
    if (!cfg().realtime)
        return;
    if (timer)
        clearTimeout(timer);
    timer = setTimeout(() => scan(doc), 800); // 디바운스
}
async function maskSecrets() {
    const editor = vscode.window.activeTextEditor;
    if (!editor)
        return;
    const doc = editor.document;
    try {
        const res = await postJSON("/v1/redact", { text: doc.getText() });
        if (res.count === 0) {
            vscode.window.showInformationMessage("마스킹할 시크릿·PII가 없습니다 🛡️");
            return;
        }
        await editor.edit((eb) => eb.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), res.masked));
        vscode.window.showInformationMessage(`🛡️ ${res.count}건 마스킹 완료 ([SECRET_n]/[PII_n] 토큰으로 치환됨)`);
    }
    catch (e) {
        vscode.window.showErrorMessage(`AgentGuard 마스킹 실패: ${e}`);
    }
}
class GuardCodeAction {
    provideCodeActions(doc) {
        const mask = new vscode.CodeAction("🛡️ 시크릿·PII 전체 마스킹", vscode.CodeActionKind.QuickFix);
        mask.command = { command: "agentguard.maskSecrets", title: "마스킹" };
        const rescan = new vscode.CodeAction("🛡️ 지금 다시 검사", vscode.CodeActionKind.QuickFix);
        rescan.command = { command: "agentguard.scanNow", title: "검사" };
        return [mask, rescan];
    }
}
function activate(ctx) {
    collection = vscode.languages.createDiagnosticCollection("agentguard");
    ctx.subscriptions.push(collection, statusBar);
    ctx.subscriptions.push(vscode.commands.registerCommand("agentguard.scanNow", () => {
        const doc = vscode.window.activeTextEditor?.document;
        if (doc)
            scan(doc);
    }), vscode.commands.registerCommand("agentguard.maskSecrets", maskSecrets), vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)), vscode.workspace.onDidOpenTextDocument((doc) => scan(doc)), vscode.window.onDidChangeActiveTextEditor((ed) => { if (ed)
        scan(ed.document); }), vscode.languages.registerCodeActionsProvider({ scheme: "file" }, new GuardCodeAction()));
    const doc = vscode.window.activeTextEditor?.document;
    if (doc)
        scan(doc);
}
function deactivate() {
    collection?.dispose();
    statusBar?.dispose();
}
//# sourceMappingURL=extension.js.map