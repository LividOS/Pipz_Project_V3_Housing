; ------------------------------------------------------------------
; GEMINI MEM TAG(DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\Controller\Modules\MaintenanceManager.ahk"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - MaintenanceManager.ahk (AHK v2)
; Version: 1.1.8
; Last change: Logic Test 20.
; Content-Fingerprint: 2026-01-21T19-35-39Z-DWDGM3ZE
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

#Requires AutoHotkey >=2.0

RestoreDefaultSettings(*) {
    global EditTitle, chkOverlay ; Access the GUI controls
    
    if MsgBox("Restore all settings to default values?", "Settings Confirmation", 1) == "OK" {
        ; 1. Reset GUI Visuals
        if IsSet(EditTitle)
            EditTitle.Value := ""
        if IsSet(chkOverlay)
            chkOverlay.Value := 1
            
        ; 2. Persist to Disk
        SaveSetting("Game", "WindowTitle", "")
        SaveSetting("UI", "ShowOverlay", "1")
        
        ; 3. Notify Log
        if (fUpdateLog := HasMethod(UpdateLog, "Call") ? UpdateLog : 0)
            UpdateLog("All settings reset to default values.")
    }
}