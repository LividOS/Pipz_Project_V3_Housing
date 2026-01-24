; ------------------------------------------------------------------
; GEMINI MEM TAG(DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\Worker\Modules\ConfigManager.ahk"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - ConfigManager.ahk (AHK v2)
; Version: 1.0.0
; Last change: EMPTY.
; Content-Fingerprint: 2026-01-21T20-38-19Z-RODX8LKJ
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

#Requires AutoHotkey >=2.0

; ------------------------------------------------------------------
; CONFIG MANAGER MODULE
; Handles initial loading of settings into the global map
; ------------------------------------------------------------------

LoadWorkerConfiguration() {
    global g_Config, g_LastSettingsUpdate
    global g_OvershootEnabled, g_OvershootPercent 
    global g_MicroDelayEnabled, g_MicroDelayMax, g_MicroDelayChance
    global g_BreaksEnabled, g_BreakChance, g_BreakSpacing
    
    ; 1. Load values using the centralized SettingsLoader functions
    g_Config["GameTitle"]         := LoadSetting("Game", "WindowTitle", "")
    g_Config["OvershootEnabled"]  := LoadSetting("AntiBan", "OvershootEnabled", 1)
    g_Config["Overshoot"]         := LoadSetting("AntiBan", "Overshoot", 5)
    g_Config["MicroDelayEnabled"] := LoadSetting("AntiBan", "MicroDelayEnabled", 1)
    g_Config["MicroDelayMax"]     := LoadSetting("AntiBan", "MicroDelayMax", 500)
    g_Config["MicroDelayChance"]  := LoadSetting("AntiBan", "MicroDelayChance", 15)
    g_Config["BreaksEnabled"]     := LoadSetting("AntiBan", "BreaksEnabled", 0)
    g_Config["BreakChance"]       := LoadSetting("AntiBan", "BreakChance", 5)
    g_Config["BreakSpacing"]      := LoadSetting("AntiBan", "BreakSpacing", 20)
    
    ; 2. Map the Config values to Global Variables for the logic modules
    g_OvershootEnabled  := g_Config["OvershootEnabled"]
    g_OvershootPercent  := g_Config["Overshoot"]
    g_MicroDelayEnabled := g_Config["MicroDelayEnabled"]
    g_MicroDelayMax     := g_Config["MicroDelayMax"]
    g_MicroDelayChance  := g_Config["MicroDelayChance"]
    g_BreaksEnabled     := g_Config["BreaksEnabled"]
    g_BreakChance       := g_Config["BreakChance"]
    g_BreakSpacing      := g_Config["BreakSpacing"]
    
    ; 3. Timestamp management for the Watchdog
    ; We ONLY update the timestamp here if it is NOT 0.
    ; This allows the initial Startup (where it is 0) to remain "dirty" 
    ; so the Watchdog catches the difference and triggers the Cyan flash.
    settingsFile := GetSettingsPath()
    if (settingsFile != "" && FileExist(settingsFile)) {
        try {
            if (g_LastSettingsUpdate != 0) {
                g_LastSettingsUpdate := FileGetTime(settingsFile, "M")
            }
        } catch {
            ; Skip if file is locked
        }
    }
}