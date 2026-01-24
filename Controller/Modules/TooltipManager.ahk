; ------------------------------------------------------------------
; GEMINI MEM TAG(DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\Controller\Modules\TooltipManager.ahk"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - TooltipManager.ahk (AHK v2)
; Version: 1.0.0
; Last change: EMPTY.
; Content-Fingerprint: 2026-01-21T20-18-57Z-YUOCUQON
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

#Requires AutoHotkey >=2.0

/**
 * TooltipManager
 * Handles contextual hover help for GUI controls using precise coordinate mapping.
 */

global TooltipMap := Map()

; Register a control and its associated help text
RegisterTooltip(ctrlHwnd, text) {
    TooltipMap[ctrlHwnd] := text
}

; The Message Monitor function
ProcessTooltips(wParam, lParam, msg, *) {
    static PrevHwnd := 0
    
    ; Get the handle of the window/control specifically under the mouse cursor
    MouseGetPos(,,, &currHwnd, 2) ; The '2' flag retrieves the HWND of the control
    
    ; Optimization: Only process if the hovered control has changed
    if (currHwnd = PrevHwnd)
        return
    PrevHwnd := currHwnd

    if TooltipMap.Has(currHwnd) {
        ToolTip(TooltipMap[currHwnd])
        ; Hide tooltip after 10 seconds (15 might be a bit long for a small popup)
        SetTimer () => ToolTip(), -10000
    } else {
        ToolTip()
    }
}