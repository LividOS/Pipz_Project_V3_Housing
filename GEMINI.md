; ------------------------------------------------------------------
; GEMINI MEM TAG (DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\GEMINI.md"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - GEMINI.md
; Version: 1.0.5
; Last change: Integrated YOLO Mode setting (geminicodeassist.agentYoloMode) for zero-click automation.
; Content-Fingerprint: 2026-01-25T20-16-12Z-IWBWJSL7
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

# Pipz_Project_V3: Agent Authority & Consent (v1.0.5)

## 1. Sovereign Authorization
The Pipz_Project_V3 Deterministic Executor (Gemini) is hereby granted **Full Read-Access Authorization** for the following canonical file set. This authorization is persistent across all chat sessions and does not require additional @-mentions or repeated user consent prompts. This file serves as the "Explicit Consent" bridge between the User and the Agent's file-system tools.

## 2. Authorized Read-Path (Automatic Context Injection)
The Agent is authorized and MANDATED to proactively read the following files during any `BOOTSTRAP_V4_INIT` or `Rule 2k Sanity Audit` call to establish behavioral, logical, and structural truth. **CRITICAL:** All tool calls must utilize RELATIVE PATHS only to satisfy environment sandboxing.

### Governance & Intent (Behavioral Truth)
- `AI_PROJECT_INSTRUCTIONS.txt` (Governance Laws & Enforcement Gates)
- `BOOTSTRAPv4.txt` (Mandatory Initialization Protocol Specification)
- `_PROJECT_ANCHOR.txt` (Behavioral Identity, Intent, and Framing Anchors)

### Structure & Pathing (Structural Truth)
- `_PROJECT_BLUEPRINT.txt` (Sole Authoritative Source for Architecture)
- `INDEXIDLIST.txt` (Deterministic Path Acceleration Map)
- `PROJECT_LEARNED_CONSTRAINTS.txt` (Mandatory Safety Invariants & History)

### Registry Mirrors (Logical Truth per PLC-0006)
- `Registry/GLOBAL_LOGIC_RULES.csv`
- `Registry/GLOBAL_FUNCTION_REGISTRY.csv`
- `Registry/GLOBAL_STATE_REGISTRY.csv`

## 3. Tooling Mandate
- **Auto-Approve Handshake:** The User has enabled `geminicodeassist.agentYoloMode` in the IDE settings. The Agent is authorized to execute `read_file` and `list_files` calls without requiring manual UI confirmation for each action.
- **FileRead Tool:** Proactive use is authorized for any file path matched in `INDEXIDLIST.txt`. **Mandate:** Invoke using Relative Paths only (e.g., `Registry/file.csv`, not `C:/...`).
- **Structural Integrity:** The Agent must use `_PROJECT_BLUEPRINT.txt` as the sole authority for folder structure and Phase 5 Expected Sets.
- **Search Tool:** Authorized to resolve the root folder only if the project anchor cannot be located via the current workspace index.

## 4. Mandatory Tooling Sequence
To clear the **Phase 2 Governance Gate**, the Agent MUST follow this sequence before reporting status:
1. **Locate:** Identify paths from `INDEXIDLIST.txt` and Section 2 above.
2. **Execute:** The Agent MUST invoke the `read_file` (or `File Fetcher`) tool for every file in the set. **Note:** Attempt to batch these calls to minimize processing latency.
3. **Verify:** Perform the 1:1 literal match and Content-Fingerprint check as defined in `AI_PROJECT_INSTRUCTIONS.txt`.
4. **Report:** Only after a failed tool execution attempt using relative paths may the Agent declare a Phase 2 failure.

## 5. Conflict Resolution
If a file listed here is physically present in the workspace but remains inaccessible via the `read_file` tool, the Agent must trigger a **Rule 3b STOP** and report the permission failure. The Agent is prohibited from proceeding via "inference," "memory," or "summarization" if these files cannot be physically read in the current cycle.