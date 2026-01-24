; ------------------------------------------------------------------
; GEMINI MEM TAG(DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\Lib\BreakManager.ahk"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - BreakManager.ahk (AHK v2)
; Version: 1.0.0
; Last change: EMPTY.
; Content-Fingerprint: 2026-01-21T20-23-54Z-1UC47OAC
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

#Requires AutoHotkey >=2.0

; ------------------------------------------------------------------
; BREAK MANAGER MODULE
; Handles probability-based pauses and weighted AFK durations.
; Shared by Controller and Worker via \Lib\
; ------------------------------------------------------------------

global LastBreakTick := 0
global LastEvalTick := 0

; The primary "Checkpoint" to be called within the Worker's loop
AntiBanCheckpoint() {
    MaybeMicroDelay()
    MaybeBreak()
}

MaybeMicroDelay() {
    global g_MicroDelayEnabled, g_MicroDelayMax, g_MicroDelayChance
    
    if (!g_MicroDelayEnabled || g_MicroDelayMax <= 0 || g_MicroDelayChance <= 0)
        return

    if (Random(1, 100) > g_MicroDelayChance)
        return

    extra := Random(10, g_MicroDelayMax)
    Sleep(extra)
}

MaybeBreak() {
    global g_BreaksEnabled, g_BreakChance, g_BreakSpacing, LastBreakTick, LastEvalTick
    
    if (!g_BreaksEnabled || g_BreakChance <= 0)
        return

    now := A_TickCount
    
    if (now - LastEvalTick < 10000)
        return
    LastEvalTick := now

    minBetweenBreaksMs := g_BreakSpacing * 60000
    if (LastBreakTick != 0 && (now - LastBreakTick < minBetweenBreaksMs))
        return

    if (Random(1, 100) > g_BreakChance)
        return

    pick := Random(1, 100)
    if (pick <= 80)
        DoBreak(1000, 5000)       ; 80% Chance: (1-5s) Quick micro-break
    else if (pick <= 95)
        DoBreak(10000, 30000)     ; 15% Chance: (10-30s) Short distraction 
    else if (pick <= 99)
        DoBreak(60000, 180000)    ; 4% Chance: (1-3m) Step away/Phone
    else
        DoBreak(300000, 900000)   ; 1% Chance: (5-15m) AFK/Bathroom

    LastBreakTick := A_TickCount
}

DoBreak(minMs, maxMs) {
    duration := Random(minMs, Max(minMs, maxMs))
    
    ; 1. Notify the Worker Overlay if significant
    if (duration > 5000) {
        ; Check if the function exists globally by name
        if (HasFunc("UpdateWorkerOverlay")) {
            f := %"UpdateWorkerOverlay"%
            f("Status - Break: " . Round(duration/1000) . "s", "Orange")
        }
        
        ; 2. Notify Controller Messenger (if the Messenger class exists)
        try {
            if IsSet(Messenger)
                Messenger.Log("Anti-Ban: Human-like break for " . Round(duration/1000, 1) . "s")
        }
    }
        
    Sleep(duration)
    
    ; Revert status if we are in the Worker
    if (HasFunc("UpdateWorkerOverlay")) {
        f := %"UpdateWorkerOverlay"%
        f("Status - Active", "00FF00")
    }
}

; Helper to safely check for a global function's existence without reserved word errors
HasFunc(fnName) {
    try {
        return IsSet(%fnName%) && %fnName% is Func
    }
    return false
}