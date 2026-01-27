// ------------------------------------------------------------------
// GEMINI MEM TAG (DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\orchestrator\orch_bootstrap.js"
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// MAINTEMPLATE - orch_bootstrap.js
// Version: 0.1.0
// Last change: Initial creation.
// Content-Fingerprint: 2026-01-27T16-31-27Z-38LOEAGA
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// ALL CONTENT MUST GO BELOW THIS POINT (LINES 1-14 RESERVED)
// ------------------------------------------------------------------

// orch_bootstrap.js
// MVP: local bootstrap verification + audit log writing
// No model calls. No file changes.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function parseArgs(argv) {
  const args = { repo: null, goal: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") args.repo = argv[++i];
    else if (a === "--goal") args.goal = argv[++i];
  }
  if (!args.repo) throw new Error("Missing --repo <path>");
  return args;
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function hasGeminiMemTag(text) {
  return /GEMINI MEM TAG/i.test(text) && /MY FULL PATH IS\s+\"Pipz_Project_V3\\/i.test(text);
}

function extractFingerprint(text) {
  const m = text.match(/Content-Fingerprint:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z-[A-Z0-9]{8})/);
  return m ? m[1] : null;
}

function utcStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}Z`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  const { repo, goal } = parseArgs(process.argv);
  const requestId = crypto.randomUUID();
  const stamp = utcStamp();

  const auditRoot = path.join(repo, ".ORCH_AUDITLOG");
  const runDir = path.join(auditRoot, `${stamp}_${requestId}`);
  ensureDir(runDir);

  const required = [
    "AI_PROJECT_INSTRUCTIONS.txt",
    "BOOTSTRAPv4.txt",
    "_PROJECT_BLUEPRINT.txt",
    "_PROJECT_ANCHOR_MASTER.txt",
    "INDEXIDLIST.txt",
    "PROJECT_LEARNED_CONSTRAINTS.txt",
    "AUDIT_RUNNER.txt",
    "PHASE5_AUDIT_MASTER.txt",
    "GLOBAL STATE REGISTRY.xlsx"
  ];

  const checks = [];
  const fingerprints_used = {};
  const errors = [];

  for (const rel of required) {
    const fp = path.join(repo, rel);
    if (!fs.existsSync(fp)) {
      errors.push({ file: rel, error: "MISSING" });
      checks.push({ file: rel, exists: false, gemini_mem_tag: "FAIL", content_fingerprint: "FAIL" });
      continue;
    }

    const isXlsx = rel.toLowerCase().endsWith(".xlsx");
    if (isXlsx) {
      checks.push({ file: rel, exists: true, gemini_mem_tag: "N/A", content_fingerprint: "N/A" });
      continue;
    }

    const text = readText(fp);
    const g = hasGeminiMemTag(text) ? "PASS" : "FAIL";
    const fpr = extractFingerprint(text);
    const f = fpr ? "PASS" : "FAIL";

    if (fpr) fingerprints_used[rel] = fpr;
    if (g === "FAIL") errors.push({ file: rel, error: "MISSING_GEMINI_MEM_TAG" });
    if (f === "FAIL") errors.push({ file: rel, error: "MISSING_OR_MALFORMED_CONTENT_FINGERPRINT" });

    checks.push({ file: rel, exists: true, gemini_mem_tag: g, content_fingerprint: f });
  }

  const status = errors.length === 0 ? "PASS" : "FAIL";

  const workorder = {
    workorder_version: "0.1",
    request_id: requestId,
    created_utc: new Date().toISOString(),
    repo_root: repo,
    audit_dir: runDir,
    user_goal: goal,
    requested_output: { full_files_default: true, diff_on_request: true },
    bootstrap: { status, required_files: required, checks, fingerprints_used, errors },
    architect: { model: "gpt-5.2", status: "PENDING", execution_plan: null, notes: "" },
    executor: { model: "gpt-4.1", status: "PENDING", touched_files: [], outputs: { full_files: {}, diff: null } },
    subsupervisor: { model: "gpt-4.1", status: "PENDING", checklist: [] },
    headsupervisor: { model: "gpt-5.2", status: "PENDING", semantic_review: { summary: "", risks: [] } },
    final_verdict: { status: status === "PASS" ? "PENDING" : "FAIL", reason: status === "PASS" ? "" : "Bootstrap verification failed" }
  };

  fs.writeFileSync(path.join(runDir, "workorder.json"), JSON.stringify(workorder, null, 2), "utf8");
  fs.writeFileSync(path.join(runDir, "bootstrap_report.json"), JSON.stringify(workorder.bootstrap, null, 2), "utf8");

  process.stdout.write(
    `Pipz Orchestrator MVP\n` +
    `Repo: ${repo}\n` +
    `Audit: ${runDir}\n` +
    `Bootstrap: ${status}\n` +
    (errors.length ? `Errors:\n${errors.map(e => `- ${e.file}: ${e.error}`).join("\n")}\n` : "")
  );

  process.exit(status === "PASS" ? 0 : 2);
}

try { main(); } catch (e) { console.error(String((e && e.stack) || e)); process.exit(1); }
