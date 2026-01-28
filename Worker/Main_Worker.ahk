; ------------------------------------------------------------------
; GEMINI MEM TAG(DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\Worker\Main_Worker.ahk"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - Main_Worker.ahk (AHK v2)
; Version: 2.0.6
; Last change: Added #NoTrayIcon to hide worker from system tray.
; Content-Fingerprint: 2026-01-28T23-10-58Z-AKRROZR4
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; SIGNPOST GOVERNANCE — FILE: Main_Worker.ahk
; ------------------------------------------------------------------
; MODULE NAME:
;   Main_Worker (Worker Entrypoint)
;
; WHAT IT OWNS / CONTROLS:
;   - Worker process bootstrap and lifetime
;   - Overlay GUI construction and presentation
;   - Global runtime state initialization:
;       * g_Config map
;       * g_WorkerState
;       * runtime-only timing and physics state
;   - Entrypoints:
;       * WM_COPYDATA title updates
;       * IPC listener startup
;       * Timers (overlay physics + settings watchdog)
;       * Main execution loop
;
; INPUTS (events/messages/functions it responds to):
;   - IPC messages from Controller:
;       * WM_COPYDATA (0x004A) — title updates
;       * WM_TRIGGER_STATE — running/paused/inactive transitions
;   - Timers:
;       * UpdateOverlayPosition() (high-frequency)
;       * Watchdog_CheckSettings() (settings sync)
;   - Runtime loop triggers:
;       * g_WorkerState transitions
;
; OUTPUTS / SIDE EFFECTS (files, settings, processes, IPC, UI):
;   - UI:
;       * Shows, hides, moves overlay GUI
;       * Updates overlay status and timer text
;   - Settings:
;       * Reads settings.ini via Core_Utils loaders (NOT per-tick)
;   - Runtime behavior:
;       * Executes Humanoid logic while active
;       * Applies pause-time accounting and state transitions
;
; DEPENDENCIES (globals/functions it relies on):
;   - Included modules:
;       Core_Utils.ahk (defaults + settings + security)
;       Interop.ahk (IPC + state listener)
;       Humanoid.ahk (behavior engine)
;       Worker_Core.ahk (worker subsystems)
;   - Globals shared across worker runtime:
;       g_Config, g_WorkerState, g_ShowOverlay,
;       overlayGui, txtStatus, txtTimer,
;       overlayCurX/Y, overlayVelX/Y,
;       g_StartTime, g_PausedTimeTotal, g_PauseStart
;
; GOVERNANCE NOTES (hard-stop rules, invariants, what must remain true):
;   - This file is an **entrypoint** and part of the governed surface (Policy B).
;   - Overlay physics must never perform INI reads; watchdog is the only polling path.
;   - WM_COPYDATA handling for title updates must remain intact and discoverable.
;   - Worker main loop must remain resilient (no blocking UI calls).
;   - Any new timers or IPC handlers must be reflected in the governed registry.
; ------------------------------------------------------------------

#Requires AutoHotkey >=2.0
#SingleInstance Force
#NoTrayIcon

; ------------------------------------------------------------------
; MODULE INCLUDES
; ------------------------------------------------------------------
#Include ..\Lib\Core_Utils.ahk
#Include ..\Lib\Interop.ahk
#Include ..\Lib\Humanoid.ahk
#Include Worker_Core.ahk

; ------------------------------------------------------------------
; INITIALIZATION & SECURITY
; ------------------------------------------------------------------
SetTitleMatchMode("RegEx")
CoordMode("Mouse", "Client")
CoordMode("Pixel", "Client")
CoordMode("ToolTip", "Screen")

secret := "PIPSECMAX_LIREGKEY_11711503721976861054928319"
keyFile := A_ScriptDir "\license.key"
licData := ValidateLicense(secret, keyFile)

; Global Configuration & State
global g_Config := Map()
global g_LastSettingsUpdate := 0 ; INITIALIZED TO 0: Forces Watchdog to trigger on first change
global g_StartTime := 0
global g_WorkerState := "inactive" 
global InternalTitle := "Overlay_Worker_Internal"
global g_GameTitle := ""

; Communication HWNDs
global ControllerHWND := A_Args.Length > 0 ? Integer(A_Args[1]) : 0

; Defaults (single source of truth)
defaults := GetDefaultSettings()

; --- Global Variables (Matching Controller) ---
; Initialized from single-source defaults; LoadWorkerConfiguration() will then load persisted values.
global g_ShowOverlay       := defaults["UI|ShowOverlay"]

global g_OvershootEnabled  := defaults["AntiBan|OvershootEnabled"]
global g_OvershootPercent  := defaults["AntiBan|Overshoot"]

global g_MicroDelayEnabled := defaults["AntiBan|MicroDelayEnabled"]
global g_MicroDelayMax     := defaults["AntiBan|MicroDelayMax"]
global g_MicroDelayChance  := defaults["AntiBan|MicroDelayChance"]

global g_BreaksEnabled     := defaults["AntiBan|BreaksEnabled"]
global g_BreakChance       := defaults["AntiBan|BreakChance"]
global g_BreakSpacing      := defaults["AntiBan|BreakSpacing"]

; --- Runtime State (not persisted) ---
global g_PausedTimeTotal := 0
global g_PauseStart := 0

; Overlay Physics State
global overlayWidth := 360, overlayHeight := 108
global overlayCurX := 30.0, overlayCurY := 500.0 
global overlayVelX := 0.0, overlayVelY := 0.0
global springStrength := 0.45 
global springDamping  := 0.75 
global springSnapDist := 200  
global sleepThreshold := 0.1  

; 1. Load Initial Settings (Timestamp remains 0 for now)
LoadWorkerConfiguration()

; CRITICAL FIX: Removed the FileGetTime baseline. 
; This allows Watchdog_CheckSettings (triggered by timer) to detect the 
; difference between 0 and the actual file time, triggering the Cyan flash.

; 2. REMOVED: Initial baseline set. 
; We now allow Watchdog_CheckSettings to catch the first difference naturally.

; Listen for Title Updates (Message 0x004A)
OnMessage(0x004A, ReceiveWindowTitle) 

; ------------------------------------------------------------------
; WORKER OVERLAY CONSTRUCTION
; ------------------------------------------------------------------
overlayGui := Gui("+AlwaysOnTop -Caption +ToolWindow +E0x20", InternalTitle)
overlayGui.BackColor := "Black"

overlayGui.SetFont("s18 Bold cYellow", "Segoe UI")
txtTitle := overlayGui.AddText("x0 y0 w" overlayWidth " h42 Center +0x200", "SCRIPTTITLE_PLACEHOLDER")

overlayGui.SetFont("s12 Bold c808080", "Segoe UI")
txtStatus := overlayGui.AddText("x0 y40 w" overlayWidth " h28 Center +0x200", "Status - Inactive")

overlayGui.SetFont("s12 c808080", "Segoe UI")
txtTimer := overlayGui.AddText("x0 y68 w" overlayWidth " h28 Center +0x200", "Time Spent - 00:00:00")

overlayGui.Show("NoActivate w" overlayWidth " h" overlayHeight)
WinSetTransparent(210, overlayGui)

; --- Start Systems ---
SetupWorkerListener()
SetTimer(UpdateOverlayPosition, 10)
SetTimer(Watchdog_CheckSettings, 1000) ; Check for INI changes every second

; ------------------------------------------------------------------
; MAIN EXECUTION LOOP
; ------------------------------------------------------------------
Loop {
    if (g_WorkerState == "inactive") {
        g_StartTime := 0 
        UpdateWorkerOverlay("Status - Inactive", "808080")
        txtTimer.Opt("c808080")
        txtTimer.Value := "Time Spent - 00:00:00"
        Sleep(500)
        continue
    }
    
    if (g_WorkerState == "active" && g_StartTime == 0) {
        g_StartTime := A_TickCount
    }
    
    if (g_WorkerState == "paused") {
        UpdateWorkerOverlay("Status - Paused", "Yellow")
        txtTimer.Opt("cRed") 
        Sleep(500)
        continue
    }

    UpdateTimerDisplay()
    
    try AntiBanCheckpoint()

    UpdateWorkerOverlay("Status - Active", "00FF00")
    
    Sleep(100) 
}

OnExit((*) => ExitApp())