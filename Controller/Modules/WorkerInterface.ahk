; ------------------------------------------------------------------
; GEMINI MEM TAG(DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\Controller\Modules\WorkerInterface.ahk"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - WorkerInterface.ahk (AHK v2)
; Version: 1.0.0
; Last change: EMPTY.
; Content-Fingerprint: 2026-01-21T20-19-44Z-Q5U9YG8N
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

#Requires AutoHotkey >=2.0

; ------------------------------------------------------------------
; WORKER INTERFACE MODULE
; Handles UI logging and Worker process state management
; ------------------------------------------------------------------

UpdateLog(text) {
    global LogBox ; Reference the GUI control
    
    ; Check if the control actually exists yet
    try {
        if !IsSet(LogBox) || !LogBox.Hwnd
            return
    } catch {
        return
    }

    ; Add timestamped text
    LogBox.Value .= "[" FormatTime(, "HH:mm:ss") "] " text "`r`n"
    
    ; Scroll to bottom: WM_VSCROLL = 0x0115, SB_BOTTOM = 7
    SendMessage(0x0115, 7, 0, LogBox.Hwnd)
}

HandleWorkerCommand(cmd) {
    global g_WorkerPID, txtStatus, BtnStart, BtnStop, WorkerTitle
    
    if (cmd == "STOP") {
        ; Send signal to Worker via Messenger or Interop
        if (workerHWND := WinExist(WorkerTitle)) {
            ; Assuming SendWorkerSignal is defined in Interop.ahk
            SendWorkerSignal("paused") 
        }
        
        txtStatus.Text := "Script Status - Paused", txtStatus.Opt("cYellow")
        BtnStart.Text := "Resume", BtnStart.Enabled := true
        BtnStop.Text := "Paused", BtnStop.Enabled := false
        UpdateLog("Worker Paused, awaiting user action.")
    }
    else if (cmd == "RELOAD") {
        if !winId := WinExist(WorkerTitle) {
            LaunchWorker(true)
        } else {
            SendWorkerSignal("inactive")
        }
            
        txtStatus.Text := "Script Status - Inactive", txtStatus.Opt("cGray")
        BtnStart.Text := "Start", BtnStart.Enabled := true
        BtnStop.Text := "Stop", BtnStop.Enabled := true
        UpdateLog("Worker Reset, returning to inactive state.")
    }
}