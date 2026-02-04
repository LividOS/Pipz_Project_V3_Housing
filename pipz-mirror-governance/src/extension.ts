// ------------------------------------------------------------------
// GEMINI MEM TAG (DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\pipz-mirror-governance\src\extension.ts"
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// MAINTEMPLATE - extension.ts
// Version: 0.0.2
// Last change: Added watched-file pointer bump (BUILD_ID 8-digit) + UPDATED_UTC refresh; broadened watched path matching.
// Content-Fingerprint: 2026-02-04T23-13-01Z-UHLCZ89Z
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// ALL CONTENT MUST GO BELOW THIS POINT (LINES 1-14 RESERVED)
// ------------------------------------------------------------------

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

//
// ================================
// CONFIG (align with your mandates)
// ================================
//

// Mirror runtime -> mirror file
const MIRROR_RUNTIME_EXTS = new Set([".ahk", ".ini"]);

// Standalone fingerprinting (governed files) — extensions included
// NOTE: JSON excluded (no comments allowed)
const STANDALONE_FP_EXTS = new Set([
  ".txt",
  ".js",
  ".ts",
  ".py",
  ".yml",
  ".yaml",
  ".md",
  ".governance.txt", // sidecars are governed
]);

const EXCLUDED_EXTS = new Set([
  ".json",
]);

// Mandatory scans
const GEMINI_SCAN_LINES = 12;
const HEADER_SCAN_LINES = 200;

// Audit logging
const AUDIT_DIR_REL = ".ORCH_AUDITLOG/mirror";

// ================================
// Regexes (multi-comment-prefix)
// ================================

// GEMINI MEM TAG path line
const GEMINI_PATH_RE = /MY\s+FULL\s+PATH\s+IS\s+"([^"]+)"/i;

// Any valid fingerprint line with supported prefixes
const FP_LINE_RE = /^(\s*(?:;|\/\/|#)\s*Content-Fingerprint\s*:\s*).+$/im;

// Delimiter line: "; -----", "// -----", "# -----"
const DELIM_RE = /^\s*(;|\/\/|#)\s*-{10,}\s*$/;

// Legacy "=====" delimiter support
const LEGACY_EQ_RE = /^\s*(;|\/\/|#)\s*=+\s*$/;

// ----------------------------
// Utility: Output channel
// ----------------------------
let OUT: vscode.OutputChannel;

// ----------------------------
// Guards to prevent recursion
// ----------------------------
const willSaveGuard = new Set<string>();
const didSaveGuard = new Set<string>();

// ================================
// BUILD_ID bump (watched files -> pointer)
// ================================

// Pointer file location: workspace root / PIPZ_POINTER.txt
const POINTER_FILE_NAME = "Governance/PIPZ_POINTER.txt";

// Watch list (workspace-relative paths, case-insensitive).
// Use forward slashes or backslashes — we normalize.
// IMPORTANT: Do NOT include PIPZ_POINTER.txt in this list.
const WATCHED_REL_PATHS = new Set<string>([
  // ---- GOVERNANCE / RUNBOOKS ----
  // Support both root-level and foldered layouts (case-insensitive after normalization).
  "GOVERNANCE_COMPENDIUM.txt",
  "PROTOCOL_RUNBOOK.txt",
  "Governance/GOVERNANCE_COMPENDIUM.txt",
  "Governance/PROTOCOL_RUNBOOK.txt",

  // ---- REGISTRIES ----
  "GLOBAL_REGISTRY_MASTER.csv",
  "INTERNAL_FUNCTION_INDEX.csv",

  // ---- CORE MIRRORS (optional) ----
  "Main_Controller.txt",
  "Controller_Core.txt",
  "Main_Worker.txt",
  "Worker_Core.txt",
  "Core_Utils.txt",
  "Interop.txt",
  "Humanoid.txt",
].map(p => normalizeRelPath(p)));

const pointerBumpGuard = new Set<string>();

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/g, "").toLowerCase();
}

function stripProjectPrefix(projectPath: string): string {
  // Converts: "Pipz_Project_V3\X\Y.txt" -> "X\Y.txt" (workspace-root relative)
  const norm = projectPath.replace(/\\/g, "/");
  const idx = norm.toLowerCase().indexOf("pipz_project_v3/");
  if (idx === -1) return norm;
  return norm.slice(idx + "pipz_project_v3/".length);
}

function pad8(n: number): string {
  return String(n).padStart(8, "0").slice(-8);
}

function nextBuildId8(current?: string): string {
  const nowSec = Math.floor(Date.now() / 1000);
  let v = nowSec % 100000000;

  if (current && /^\d{8}$/.test(current)) {
    const cur = Number(current);
    if (v === cur) v = (v + 1) % 100000000;
  }
  return pad8(v);
}

function detectEolFromText(raw: string): string {
  return raw.includes("\r\n") ? "\r\n" : "\n";
}

function formatUpdatedUtc(): string {
  // Produces: 2026-02-04T20-04-40Z
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
}

function isWatchedDoc(doc: vscode.TextDocument): boolean {
  // Prefer governed GEMINI path when available
  const text = doc.getText();
  let rel: string | null = null;

  if (hasGeminiMemTag(text)) {
    const projectPath = extractGeminiProjectPath(text);
    if (projectPath) rel = stripProjectPrefix(projectPath);
  }

  // Fallback: workspace-relative path
  if (!rel) {
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!folder) return false;
    rel = path.relative(folder.uri.fsPath, doc.fileName);
  }

  const normRel = normalizeRelPath(rel);
  return WATCHED_REL_PATHS.has(normRel);
}

function bumpPointerBuildId(workspaceRoot: string) {
  const pointerFs = path.join(workspaceRoot, POINTER_FILE_NAME);
  if (!fs.existsSync(pointerFs)) return;

  const guardKey = pointerFs.toLowerCase();
  if (pointerBumpGuard.has(guardKey)) return;

  try {
    pointerBumpGuard.add(guardKey);

    const raw = fs.readFileSync(pointerFs, "utf8");
    const eol = detectEolFromText(raw);

    const lines = raw.split(/\r?\n/);

    // --- BUILD_ID bump (8-digit) ---
    const buildIdx = lines.findIndex(l => /^\s*BUILD_ID\s*:/.test(l));
    if (buildIdx !== -1) {
      // Capture any prior value (timestamp, number, etc.) but only use it if it's already 8 digits.
      const m = lines[buildIdx].match(/^\s*BUILD_ID\s*:\s*(.*?)\s*$/);
      const prior = m?.[1];
      const cur8 = (prior && /^\d{8}$/.test(prior)) ? prior : undefined;

      const next = nextBuildId8(cur8);
      lines[buildIdx] = `BUILD_ID: ${next}`;
    }

    // --- UPDATED_UTC refresh (timestamp format preserved) ---
    const updIdx = lines.findIndex(l => /^\s*UPDATED_UTC\s*:/.test(l));
    if (updIdx !== -1) {
      lines[updIdx] = `UPDATED_UTC: ${formatUpdatedUtc()}`;
    }

    const updated = lines.join(eol);
    if (updated !== raw) {
      fs.writeFileSync(pointerFs, updated, "utf8");
      OUT.appendLine(`Pointer update PASS: ${POINTER_FILE_NAME} | BUILD_ID bumped + UPDATED_UTC refreshed`);
    }
  } catch (e: any) {
    OUT.appendLine(`Pointer update ERROR: ${String(e?.message ?? e)}`);
  } finally {
    pointerBumpGuard.delete(guardKey);
  }
}

// ================================
// Fingerprint generation
// ================================
function utcFingerprint(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts =
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}Z`;

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `${ts}-${suffix}`;
}

// ================================
// EOL helpers (preserve style)
// ================================
function eolString(doc: vscode.TextDocument): string {
  return doc.eol === vscode.EndOfLine.LF ? "\n" : "\r\n";
}

// ================================
// Encoding support (UTF-8 / UTF-16)
// ================================
type FileEncoding = "utf8" | "utf8bom" | "utf16le" | "utf16be";

function detectEncodingFromBytes(buf: Buffer): FileEncoding {
  if (buf.length >= 2) {
    // UTF-16 BOMs
    if (buf[0] === 0xff && buf[1] === 0xfe) return "utf16le";
    if (buf[0] === 0xfe && buf[1] === 0xff) return "utf16be";
  }
  if (buf.length >= 3) {
    // UTF-8 BOM
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return "utf8bom";
  }

  // Heuristic: NUL bytes early often indicates UTF-16 (common for UTF-16LE text)
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let nulCount = 0;
  for (let i = 0; i < sample.length; i++) if (sample[i] === 0x00) nulCount++;
  if (nulCount > 50) return "utf16le";

  return "utf8";
}

function readFileEncoding(fsPath: string): FileEncoding {
  try {
    const buf = fs.readFileSync(fsPath);
    return detectEncodingFromBytes(buf);
  } catch {
    return "utf8";
  }
}

function swapUtf16ByteOrder(bufLE: Buffer): Buffer {
  // bufLE is UTF-16LE bytes. Swap pairs to get UTF-16BE bytes.
  const out = Buffer.allocUnsafe(bufLE.length);
  for (let i = 0; i + 1 < bufLE.length; i += 2) {
    out[i] = bufLE[i + 1];
    out[i + 1] = bufLE[i];
  }
  return out;
}

function encodeText(text: string, enc: FileEncoding): Buffer {
  if (enc === "utf8") {
    return Buffer.from(text, "utf8");
  }

  if (enc === "utf8bom") {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    return Buffer.concat([bom, Buffer.from(text, "utf8")]);
  }

  if (enc === "utf16le") {
    const bom = Buffer.from([0xff, 0xfe]);
    const body = Buffer.from(text, "utf16le");
    return Buffer.concat([bom, body]);
  }

  // utf16be
  const bom = Buffer.from([0xfe, 0xff]);
  const bodyLE = Buffer.from(text, "utf16le");
  const bodyBE = swapUtf16ByteOrder(bodyLE);
  return Buffer.concat([bom, bodyBE]);
}

// ================================
// Governance gating
// ================================
function hasGeminiMemTag(text: string): boolean {
  const head = text.split(/\r?\n/).slice(0, GEMINI_SCAN_LINES).join("\n").toLowerCase();
  return head.includes("gemini mem tag") && head.includes("my full path is");
}

function extractGeminiProjectPath(text: string): string | null {
  const top = text.split(/\r?\n/).slice(0, GEMINI_SCAN_LINES).join("\n");
  const m = top.match(GEMINI_PATH_RE);
  return m ? m[1] : null;
}

function isHeaderDelim(line: string): boolean {
  const s = line.trim();
  if (DELIM_RE.test(s)) return true;
  if (LEGACY_EQ_RE.test(s)) return true;
  return false;
}

function findHeaderBlock(lines: string[]): { start: number | null; end: number | null } {
  const scanUpto = Math.min(lines.length, HEADER_SCAN_LINES);
  let start: number | null = null;
  let end: number | null = null;

  for (let i = 0; i < scanUpto; i++) {
    if (isHeaderDelim(lines[i])) {
      start = i;
      for (let j = i + 1; j < scanUpto; j++) {
        if (isHeaderDelim(lines[j])) {
          end = j;
          break;
        }
      }
      break;
    }
  }
  return { start, end };
}

function detectPrefixFromLine(line: string): string | null {
  const s = line.trimStart();
  if (s.startsWith("//")) return "//";
  if (s.startsWith("#")) return "#";
  if (s.startsWith(";")) return ";";
  return null;
}

function detectHeaderPrefix(lines: string[], start: number | null, end: number | null): string {
  const candidates: number[] = [];
  if (start !== null) candidates.push(start);
  if (end !== null) candidates.push(end);

  for (const idx of candidates) {
    const p = detectPrefixFromLine(lines[idx] || "");
    if (p) return p;
  }

  const scanUpto = Math.min(lines.length, HEADER_SCAN_LINES);
  for (let i = 0; i < scanUpto; i++) {
    const p = detectPrefixFromLine(lines[i] || "");
    if (p) return p;
  }

  // default fallback
  return ";";
}

function isExcluded(doc: vscode.TextDocument): boolean {
  const ext = path.extname(doc.fileName).toLowerCase();
  return EXCLUDED_EXTS.has(ext);
}

function isGovernedReadable(doc: vscode.TextDocument): boolean {
  const ext = path.extname(doc.fileName).toLowerCase();
  if (isExcluded(doc)) return false;
  if (STANDALONE_FP_EXTS.has(ext)) return true;
  // handle *.json.governance.txt style
  if (doc.fileName.toLowerCase().endsWith(".governance.txt")) return true;
  return false;
}

function isRuntimeMirrorTarget(doc: vscode.TextDocument): boolean {
  const ext = path.extname(doc.fileName).toLowerCase();
  return MIRROR_RUNTIME_EXTS.has(ext);
}

// ================================
// Mirror path mapping (.ahk/.ini -> .txt)
// ================================
function mirrorFsPathFromRuntime(runtimeFs: string): string {
  const dir = path.dirname(runtimeFs);
  const base = path.basename(runtimeFs);
  return path.join(dir, `${base}.txt`);
}

function mirrorProjectPathFromRuntimeProjectPath(runtimeProjectPath: string): string {
  // runtimeProjectPath is like: Pipz_Project_V3\Lib\Humanoid.ahk
  return `${runtimeProjectPath}.txt`;
}

// ================================
// AI SOT mirror header (written ONLY into .txt mirrors)
// ================================
function makeAiSotHeader(projectFullPathTxt: string, eol: string): string {
  return [
    "; ------------------------------------------------------------------",
    `; AI SOT TEXT FILE (DO NOT EVER REMOVE, EDIT OR INCLUDE IN FILE EDITS) - MY FULL PATH IS "${projectFullPathTxt}"`,
    "; ------------------------------------------------------------------",
    "",
    "",
  ].join(eol);
}

// ================================
// Audit logging (simple JSON drop)
// ================================
function workspaceRootForDoc(doc: vscode.TextDocument): string | null {
  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  if (!folder) return null;
  return folder.uri.fsPath;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeAuditEvent(workspaceRoot: string, payload: any) {
  try {
    const dir = path.join(workspaceRoot, AUDIT_DIR_REL);
    ensureDir(dir);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const fname = `${ts}-${crypto.randomBytes(3).toString("hex")}.json`;
    fs.writeFileSync(path.join(dir, fname), JSON.stringify(payload, null, 2), "utf8");
  } catch (e: any) {
    OUT.appendLine(`Audit write ERROR: ${String(e?.message ?? e)}`);
  }
}

// ================================
// Stage 1: fingerprint on will-save (governed-readable files)
// ================================
function handleWillSave(e: vscode.TextDocumentWillSaveEvent) {
  const doc = e.document;
  if (doc.uri.scheme !== "file") return;
  if (isExcluded(doc)) return;
  if (!isGovernedReadable(doc)) return;

  const key = doc.uri.toString();
  if (willSaveGuard.has(key)) return;
  willSaveGuard.add(key);

  e.waitUntil((async () => {
    try {
      const text = doc.getText();
      if (!hasGeminiMemTag(text)) {
        OUT.appendLine(`Fingerprint SKIP (no GEMINI MEM TAG): ${doc.fileName}`);
        return [];
      }

      // Find header block
      const lines = text.split(/\r?\n/);
      const { start, end } = findHeaderBlock(lines);
      if (start === null || end === null) {
        OUT.appendLine(`Fingerprint SKIP (no header block): ${doc.fileName}`);
        return [];
      }

      // Update Content-Fingerprint line (within header scan window)
      const headSlice = lines.slice(start, Math.min(lines.length, start + HEADER_SCAN_LINES)).join("\n");
      if (!FP_LINE_RE.test(headSlice)) {
        OUT.appendLine(`Fingerprint SKIP (no Content-Fingerprint line): ${doc.fileName}`);
        return [];
      }

      const newFp = utcFingerprint();

      // Replace in full text but only first occurrence within header region
      const prefix = detectHeaderPrefix(lines, start, end);
      const scoped = lines.slice(0, end + 1).join("\n");
      const rest = lines.slice(end + 1).join("\n");

      const scopedUpdated = scoped.replace(FP_LINE_RE, `$1${newFp}`);

      // If replacement didn't happen (shouldn't), fail closed
      if (scopedUpdated === scoped) {
        OUT.appendLine(`Fingerprint FAIL (replace no-op): ${doc.fileName}`);
        return [];
      }

      const eol = eolString(doc);
      const finalText = scopedUpdated.split("\n").join(eol) + (rest ? eol + rest.split("\n").join(eol) : "");

      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(text.length)
      );
      edit.replace(doc.uri, fullRange, finalText);

      OUT.appendLine(`Fingerprint PASS: ${doc.fileName} -> ${newFp}`);

      // Audit
      const root = workspaceRootForDoc(doc);
      if (root) {
        writeAuditEvent(root, {
          event: "fingerprint_stage",
          file: doc.fileName,
          result: "PASS",
          fingerprint: newFp,
          ts_utc: new Date().toISOString(),
        });
      }

      return [edit];
    } catch (err: any) {
      OUT.appendLine(`Fingerprint stage ERROR: ${String(err?.message ?? err)}`);
      const root = workspaceRootForDoc(doc);
      if (root) {
        writeAuditEvent(root, {
          event: "fingerprint_stage",
          file: doc.fileName,
          result: "FAIL",
          error: String(err?.message ?? err),
          ts_utc: new Date().toISOString(),
        });
      }
      return [];
    } finally {
      willSaveGuard.delete(key);
    }
  })());
}

// ================================
// Stage 2: mirror on save (post-save) with UTF-8/UTF-16 compatibility
// ================================
function handleDidSave(doc: vscode.TextDocument) {
  if (doc.uri.scheme !== "file") return;

  const key = doc.uri.toString();
  if (didSaveGuard.has(key)) return;

  didSaveGuard.add(key);
  try {
    // ----------------------------
    // NEW: Watched-file pointer bump
    // ----------------------------
    const root = workspaceRootForDoc(doc);
    if (root && isWatchedDoc(doc)) {
      bumpPointerBuildId(root);
    }

    // ----------------------------
    // Existing mirror behavior (runtime .ahk/.ini only)
    // ----------------------------
    if (!isRuntimeMirrorTarget(doc)) return;

    const text = doc.getText();

    // Require GEMINI MEM TAG and project path
    if (!hasGeminiMemTag(text)) {
      OUT.appendLine(`Mirror SKIP (no GEMINI MEM TAG): ${doc.fileName}`);
      return;
    }
    const runtimeProjectPath = extractGeminiProjectPath(text);
    if (!runtimeProjectPath) {
      OUT.appendLine(`Mirror SKIP (no project path in GEMINI): ${doc.fileName}`);
      return;
    }

    const eol = eolString(doc);

    const mirrorFs = mirrorFsPathFromRuntime(doc.fileName);
    const mirrorProjectPath = mirrorProjectPathFromRuntimeProjectPath(runtimeProjectPath);

    const mirrorContent = makeAiSotHeader(mirrorProjectPath, eol) + text;

    // Detect runtime file encoding (on disk) and mirror using same encoding family
    // This prevents UTF-16 INI files from being mishandled.
    const runtimeEnc = readFileEncoding(doc.fileName);

    // Write mirror with compatible encoding:
    // - utf16le/utf16be -> mirror in same UTF-16 encoding (with BOM)
    // - utf8/utf8bom -> mirror in same UTF-8 style
    const mirrorBuf = encodeText(mirrorContent, runtimeEnc);
    fs.writeFileSync(mirrorFs, mirrorBuf);

    OUT.appendLine(`Mirror write PASS: ${doc.fileName} -> ${mirrorFs} | enc=${runtimeEnc}`);

    const root2 = workspaceRootForDoc(doc);
    if (root2) {
      writeAuditEvent(root2, {
        event: "mirror_write",
        runtime: doc.fileName,
        mirror: mirrorFs,
        result: "PASS",
        encoding: runtimeEnc,
        ts_utc: new Date().toISOString(),
      });
    }
  } catch (e: any) {
    OUT.appendLine(`Mirror write ERROR: ${String(e?.message ?? e)}`);
    const root = workspaceRootForDoc(doc);
    if (root) {
      writeAuditEvent(root, {
        event: "mirror_write",
        runtime: doc.fileName,
        result: "FAIL",
        error: String(e?.message ?? e),
        ts_utc: new Date().toISOString(),
      });
    }
  } finally {
    didSaveGuard.delete(key);
  }
}

// ================================
// Activate
// ================================
export function activate(context: vscode.ExtensionContext) {
  OUT = vscode.window.createOutputChannel("Pipz Mirror Governance");
  OUT.appendLine("Pipz Mirror Governance: activated");
  OUT.show(true);

  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument(handleWillSave)
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(handleDidSave)
  );
}

export function deactivate() {}