; ------------------------------------------------------------------
; GEMINI MEM TAG(DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\Controller\Modules\NavigationManager.ahk"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - NavigationManager.ahk (AHK v2)
; Version: 1.0.0
; Last change: EMPTY.
; Content-Fingerprint: 2026-01-21T19-37-13Z-E0SFNA8U
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

#Requires AutoHotkey >=2.0

; ------------------------------------------------------------------
; NAVIGATION MANAGER MODULE
; Handles tab switching and GUI group visibility
; ------------------------------------------------------------------

ShowTab(tabName) {
    global
    ; Define groups locally within the function to ensure they point to the correct GUI objects
    allGroups := [DashboardGroup, SettingsNavGroup, GeneralSetGroup, ScriptSetGroup, ABanNavGroup, ABanFeatGroup, ABanTuneGroup, LogsGroup, AboutGroup]
    
    for grp in allGroups
        for ctrl in grp
            ctrl.Visible := false

    if (tabName == "Dashboard") {
        for ctrl in DashboardGroup
            ctrl.Visible := true
    } else if (tabName == "Settings") {
        for ctrl in SettingsNavGroup
            ctrl.Visible := true
        ShowSettingsSubTab("General")
        ; Send placeholder hint to the EditTitle box
        SendMessage(0x1501, 0, StrPtr("RuneLite - CHARACTERNAME"), EditTitle.Hwnd)
    } else if (tabName == "Anti-Ban") {
        for ctrl in ABanNavGroup
            ctrl.Visible := true
        ShowABanSubTab("Features")
    } else if (tabName == "Logs") {
        for ctrl in LogsGroup
            ctrl.Visible := true
    } else if (tabName == "About") {
        for ctrl in AboutGroup
            ctrl.Visible := true
    }
}

ShowSettingsSubTab(subName) {
    global GeneralSetGroup, ScriptSetGroup
    for ctrl in GeneralSetGroup
        ctrl.Visible := (subName == "General")
    for ctrl in ScriptSetGroup
        ctrl.Visible := (subName == "Script")
}

ShowABanSubTab(subName) {
    global ABanFeatGroup, ABanTuneGroup
    for ctrl in ABanFeatGroup
        ctrl.Visible := (subName == "Features")
    for ctrl in ABanTuneGroup
        ctrl.Visible := (subName == "Tuning")
}

HandleClose(GuiObj) {
    ; Check the saved setting directly from the INI
    shouldTray := LoadSetting("UI", "MinimizeToTray", "0")
    
    if (shouldTray == "1") {
        GuiObj.Hide()
        A_IconTip := "Main Controller Template`nDouble-click to restore"
        TraySetIcon("shell32.dll", 28) ; Optional: Sets a specific icon
        
        ; Create a menu item to restore the app
        A_TrayMenu.Delete() ; Clear default menu
        A_TrayMenu.Add("Restore", (*) => GuiObj.Show())
        A_TrayMenu.Add("Exit", (*) => ExitApp())
        A_TrayMenu.Default := "Restore"
        
        UpdateLog("Application minimized to system tray.")
    } else {
        ExitApp()
    }
}