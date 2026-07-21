/**
 * AgentGuard VS Code 익스텐션 — "AI 시대의 Grammarly" IDE 판.
 *
 * 편집 중 문서를 /v1/inspect 로 병내 Diagnostics(밑줄)를 긋고,
 * CodeAction으로 시크릿 마스킹(/v1/redact)·무시를 제공한다.
 * 원문은 사용자가 설정한 백엔드(기본 localhost)에만 간다.
 */
import * as vscode from "vscode";

interface Issue {
  start: number;
  end: number;
  category: string;
  rule_id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  suggestion?: string;
}
interface InspectResult {
  overall: string;
  score: number;
  issues: Issue[];
}

const SEV_MAP: Record<Issue["severity"], vscode.DiagnosticSeverity> = {
  critical: vscode.DiagnosticSeverity.Error,
  high: vscode.DiagnosticSeverity.Error,
  medium: vscode.DiagnosticSeverity.Warning,
  low: vscode.DiagnosticSeverity.Information,
};
const SEV_ORDER = ["low", "medium", "high", "critical"];

let collection: vscode.DiagnosticCollection;
let timer: NodeJS.Timeout | undefined;
const statusBar = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right, 100);

function cfg() {
  const c = vscode.workspace.getConfiguration("agentguard");
  return {
    url: (c.get<string>("apiUrl") || "http://localhost:8000").replace(/\/$/, ""),
    key: c.get<string>("apiKey") || "",
    realtime: c.get<boolean>("realtime") ?? true,
    minSev: c.get<string>("minSeverity") || "low",
  };
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const { url, key } = cfg();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["X-API-Key"] = key;
  const res = await fetch(`${url}${path}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AgentGuard HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function scan(doc: vscode.TextDocument): Promise<void> {
  if (doc.uri.scheme !== "file" && doc.uri.scheme !== "untitled") return;
  const text = doc.getText();
  if (!text.trim()) { collection.delete(doc.uri); statusBar.hide(); return; }

  try {
    const result = await postJSON<InspectResult>("/v1/inspect", {
      text, kind: "auto",
    });
    const minIdx = SEV_ORDER.indexOf(cfg().minSev);
    const diags = result.issues
      .filter((i) => SEV_ORDER.indexOf(i.severity) >= minIdx)
      .map((i) => {
        const range = new vscode.Range(doc.positionAt(i.start), doc.positionAt(i.end));
        const d = new vscode.Diagnostic(
          range, `🛡️ ${i.title}${i.suggestion ? ` — ${i.suggestion}` : ""}`,
          SEV_MAP[i.severity]);
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
  } catch {
    statusBar.text = "🛡️ 백엔드 오프라인";
    statusBar.tooltip = "AgentGuard 백엔드에 연결할 수 없습니다 (install.sh 실행)";
    statusBar.show();
  }
}

function schedule(doc: vscode.TextDocument): void {
  if (!cfg().realtime) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => scan(doc), 800); // 디바운스
}

async function maskSecrets(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const doc = editor.document;
  try {
    const res = await postJSON<{ masked: string; count: number }>(
      "/v1/redact", { text: doc.getText() });
    if (res.count === 0) {
      vscode.window.showInformationMessage("마스킹할 시크릿·PII가 없습니다 🛡️");
      return;
    }
    await editor.edit((eb) =>
      eb.replace(new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)),
        res.masked));
    vscode.window.showInformationMessage(
      `🛡️ ${res.count}건 마스킹 완료 ([SECRET_n]/[PII_n] 토큰으로 치환됨)`);
  } catch (e) {
    vscode.window.showErrorMessage(`AgentGuard 마스킹 실패: ${e}`);
  }
}

class GuardCodeAction implements vscode.CodeActionProvider {
  provideCodeActions(doc: vscode.TextDocument): vscode.CodeAction[] {
    const mask = new vscode.CodeAction(
      "🛡️ 시크릿·PII 전체 마스킹", vscode.CodeActionKind.QuickFix);
    mask.command = { command: "agentguard.maskSecrets", title: "마스킹" };
    const rescan = new vscode.CodeAction(
      "🛡️ 지금 다시 검사", vscode.CodeActionKind.QuickFix);
    rescan.command = { command: "agentguard.scanNow", title: "검사" };
    return [mask, rescan];
  }
}

export function activate(ctx: vscode.ExtensionContext): void {
  collection = vscode.languages.createDiagnosticCollection("agentguard");
  ctx.subscriptions.push(collection, statusBar);

  ctx.subscriptions.push(
    vscode.commands.registerCommand("agentguard.scanNow", () => {
      const doc = vscode.window.activeTextEditor?.document;
      if (doc) scan(doc);
    }),
    vscode.commands.registerCommand("agentguard.maskSecrets", maskSecrets),
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document)),
    vscode.workspace.onDidOpenTextDocument((doc) => scan(doc)),
    vscode.window.onDidChangeActiveTextEditor((ed) => { if (ed) scan(ed.document); }),
    vscode.languages.registerCodeActionsProvider({ scheme: "file" }, new GuardCodeAction()),
  );

  const doc = vscode.window.activeTextEditor?.document;
  if (doc) scan(doc);
}

export function deactivate(): void {
  collection?.dispose();
  statusBar?.dispose();
}
