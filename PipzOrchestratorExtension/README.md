; ------------------------------------------------------------------
; GEMINI MEM TAG (DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\PipzOrchestratorExtension\README.md"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - README.md
; Version: 0.1.0
; Last change: Initial creation.
; Content-Fingerprint: YYYY-MM-DDTHH-MM-SSZ-XXXXXXXX
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

Pipz Orchestrator (MVP) — VS Code Extension
; ------------------------------------------------------------------

What this is
------------
A minimal VS Code extension that runs the local orchestrator stub.
v0.1 only performs bootstrap verification + audit artifact writing.

Run (developer mode)
--------------------
1) Open `PipzOrchestratorExtension/` in VS Code (as its own folder/workspace).
2) Open a terminal in that folder and run:
   - npm install
   - npm run compile
3) Press F5 to launch an Extension Development Host.
4) In the dev host: open your Pipz_Project_V3 workspace folder.
5) Command Palette -> run:
   Pipz: Governed Change (Orchestrator) — Bootstrap Audit (MVP)

Outputs
-------
Writes to:
  Pipz_Project_V3/.ORCH_AUDITLOG/<timestamp>_<request_id>/

Next steps
----------
Wire model calls (Architect/Executor/Supervisors) once bootstrap verification is stable.
