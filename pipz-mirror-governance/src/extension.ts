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

  return ";";
}

// ================================
// Decide if a document is a standalone FP target
// ================================
function isStandaloneFingerprintTarget(doc: vscode.TextDocument): boolean {
  const fp = doc.fileName;
  const lower = fp.toLowerCase();

  // Exclude JSON always
  if (lower.endsWith(".json")) return false;

  // Sidecar special-case
  if (lower.endsWith(".json.governance.txt")) return true;

  // Extension allowlist
  const ext = path.extname(lower);
  if (EXCLUDED_EXTS.has(ext)) return false;
  if (STANDALONE_FP_EXTS.has(ext)) return true;

  // Multi-extension support: ".governance.txt"
  if (lower.endsWith(".governance.txt")) return true;

  return false;
}

function isRuntimeMirrorTarget(doc: vscode.TextDocument): boolean {
  const ext = path.extname(doc.fileName.toLowerCase());
  return MIRROR_RUNTIME_EXTS.has(ext);
}

// ================================
// Fingerprint update (replace or insert)
// ================================
function updateFingerprintInText(
  text: string,
  eol: string
): { updated: string; changed: boolean; newFp?: string } {
  const newFp = utcFingerprint();

  // Replace existing fingerprint line
  if (FP_LINE_RE.test(text)) {
    const updated = text.replace(FP_LINE_RE, `$1${newFp}`);
    return { updated, changed: updated !== text, newFp };
  }

  // Insert into header block if possible
  const lines = text.split(/\r?\n/);
  const hb = findHeaderBlock(lines);

  if (hb.start !== null && hb.end !== null) {
    const prefix = detectHeaderPrefix(lines, hb.start, hb.end);
    lines.splice(hb.end, 0, `${prefix} Content-Fingerprint: ${newFp}`);
    return { updated: lines.join(eol), changed: true, newFp };
  }

  // Fail closed: no header block -> no insertion
  return { updated: text, changed: false };
}

// ================================
// Mirror creation
// ================================
function mirrorFsPathFromRuntime(runtimeFsPath: string): string {
  return runtimeFsPath.replace(/\.(ahk|ini)$/i, ".txt");
}

// AI SOT header for mirror files (keep your exact style)
function makeAiSotHeader(mirrorProjectPath: string, eol: string): string {
  return (
    "; ------------------------------------------------------------------" + eol +
    '; AI SOT TEXT FILE (DO NOT EVER REMOVE, EDIT OR INCLUDE IN FILE EDITS) - MY FULL PATH IS "' +
    mirrorProjectPath + '"' + eol +
    "; ------------------------------------------------------------------" + eol + eol
  );
}

// Convert GEMINI path for runtime .ahk/.ini into mirror .txt project path
function mirrorProjectPathFromRuntimeProjectPath(runtimeProjectPath: string): string {
  return runtimeProjectPath.replace(/\.(ahk|ini)$/i, ".txt");
}

// ================================
// Audit logging
// ================================
function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function writeAuditEvent(workspaceRoot: string, payload: any) {
  try {
    const auditDir = path.join(workspaceRoot, AUDIT_DIR_REL);
    ensureDir(auditDir);

    const stamp = new Date().toISOString().replace(/[:]/g, "-");
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString("hex");
    const fp = path.join(auditDir, `${stamp}_${id}.json`);
    fs.writeFileSync(fp, JSON.stringify(payload, null, 2), "utf8");
  } catch (e: any) {
    OUT.appendLine(`AUDIT LOG ERROR: ${String(e?.message ?? e)}`);
  }
}

function workspaceRootForDoc(doc: vscode.TextDocument): string | null {
  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  if (!folder) return null;
  return folder.uri.fsPath;
}

// ================================
// Stage 1 + 3: fingerprint on save (pre-save)
// ================================
async function handleWillSave(e: vscode.TextDocumentWillSaveEvent) {
  const doc = e.document;
  if (doc.uri.scheme !== "file") return;

  const key = doc.uri.toString();
  if (willSaveGuard.has(key)) return;

  const lower = doc.fileName.toLowerCase();

  // Exclude JSON
  if (lower.endsWith(".json")) return;

  // Decide if eligible
  const eligible = isRuntimeMirrorTarget(doc) || isStandaloneFingerprintTarget(doc);
  if (!eligible) return;

  const text = doc.getText();

  // Fail closed: require GEMINI MEM TAG
  if (!hasGeminiMemTag(text)) return;

  // Fail closed: require a delimited header block
  const lines = text.split(/\r?\n/);
  const hb = findHeaderBlock(lines);
  if (hb.start === null || hb.end === null) return;

  const eol = eolString(doc);
  const { updated, changed, newFp } = updateFingerprintInText(text, eol);
  if (!changed) return;

  willSaveGuard.add(key);

  const fullRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(text.length)
  );

  const edit = new vscode.WorkspaceEdit();
  edit.replace(doc.uri, fullRange, updated);

  e.waitUntil((async () => {
    try {
      await vscode.workspace.applyEdit(edit);
      OUT.appendLine(`Fingerprint staged (will-save): ${doc.fileName}${newFp ? ` | ${newFp}` : ""}`);

      const root = workspaceRootForDoc(doc);
      if (root) {
        writeAuditEvent(root, {
          event: "fingerprint_stage",
          file: doc.fileName,
          result: "PASS",
          fingerprint: newFp ?? null,
          ts_utc: new Date().toISOString(),
        });
      }
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

  if (!isRuntimeMirrorTarget(doc)) return;

  didSaveGuard.add(key);
  try {
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

    const root = workspaceRootForDoc(doc);
    if (root) {
      writeAuditEvent(root, {
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
