# pipz-mirror-governance

A local governance enforcer for **Pipz_Project_V3** that runs inside **normal VS Code**.

This extension replaces the legacy Notepad++ PythonScript mirroring workflow by implementing the same core guarantees using VS Code save hooks.

## What it does

On file save, the extension enforces the following behaviors (fail-closed):

### 1) Content-Fingerprint updates (governed files)
- Updates the `Content-Fingerprint:` line inside a governed MAINTEMPLATE header.
- Works with comment-prefix variants:
  - `;` for `.txt`, `.ahk`, `.ini`, and governed `.md`
  - `//` for `.js` / `.ts`
  - `#` for `.py` / `.yml` / `.yaml`

### 2) Runtime mirroring (runtime → mirror)
For runtime files:
- `.ahk` → `.txt`
- `.ini` → `.txt`

The mirror is overwritten deterministically and begins with the AI SOT header:

; ------------------------------------------------------------------
; AI SOT TEXT FILE (DO NOT EVER REMOVE, EDIT OR INCLUDE IN FILE EDITS) - MY FULL PATH IS "<...>.txt"
; ------------------------------------------------------------------

### 3) Standalone governed fingerprinting
Applies to governed-readable files by extension (excluding raw JSON), including:
- `.txt`, `.js`, `.ts`, `.py`, `.yml`, `.yaml`, `.md`
- `.json.governance.txt` sidecars

### 4) UTF-8 + UTF-16 compatibility
Mirrors preserve the **encoding family** of the runtime file:
- UTF-16LE/UTF-16BE (with BOM) → mirror written UTF-16LE/BE (with BOM)
- UTF-8 (with or without BOM) → mirror written UTF-8 (matching BOM style)

## Governance rules (important)

This extension is designed to support strict project governance:

- Governed files must contain a valid **GEMINI MEM TAG** in the top scan window.
- Governed files must contain a delimited **MAINTEMPLATE** header block.
- If required governance markers are missing, the extension **does nothing** (fail-closed).
- `.json` files must remain **pure JSON** (no headers). Governance metadata lives in sidecar files:
  - `package.json.governance.txt`
  - `tsconfig.json.governance.txt`

## Audit logging

Audit logs are written to the project root under:

Pipz_Project_V3/.ORCH_AUDITLOG/mirror/

Events include:
- `fingerprint_stage` (PASS/FAIL)
- `mirror_write` (PASS/FAIL, including detected encoding)

Each event writes a JSON file with UTC timestamp.

## Requirements

- VS Code (desktop)
- Node.js is required only to build/package the extension. End-users do not need Node.
- This extension is designed for Windows paths, consistent with Pipz_Project_V3.

## Installation (local VSIX)

1) Build:
```powershell
npm install
npm run compile
