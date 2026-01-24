; ------------------------------------------------------------------
; GEMINI MEM TAG(DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\Worker\Modules\OverlayPhysics.ahk"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - OverlayPhysics.ahk (AHK v2)
; Version: 1.0.0
; Last change: EMPTY.
; Content-Fingerprint: 2026-01-21T20-39-02Z-U3MB5OYI
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

#Requires AutoHotkey >=2.0

; ------------------------------------------------------------------
; OVERLAY PHYSICS MODULE
; Handles window tracking, spring physics, and snapping
; ------------------------------------------------------------------

UpdateOverlayPosition() {
    global overlayCurX, overlayCurY, overlayVelX, overlayVelY
    global springStrength, springDamping, springSnapDist, overlayHeight, overlayWidth
    global g_Config, ControllerHWND, overlayGui
    
    static lastGX := 0, lastGY := 0, isDragging := false, dragTick := 0
    targetTitle := g_Config["GameTitle"]
    
    ; 1. Visibility Check
    if (LoadSetting("UI", "ShowOverlay", "1") == "0") {
        overlayGui.Hide()
        return
    }
    
    ; 2. Determine Target Coordinates
    targetHWND := 0
    if (targetTitle != "") {
        pattern := "i)" . targetTitle
        winList := WinGetList(pattern)
        for hwnd in winList {
            if (hwnd != ControllerHWND && hwnd != overlayGui.Hwnd) {
                targetHWND := hwnd
                break
            }
        }
    }
    
    if (targetHWND && WinExist(targetHWND)) {
        try {
            WinGetClientPos(&gx, &gy, &gw, &gh, targetHWND)
            if (gx < -30000) { ; Minimized
                overlayGui.Hide()
                return
            }

            if (gx != lastGX || gy != lastGY) {
                isDragging := true
                dragTick := A_TickCount
            } else if (A_TickCount - dragTick > 60) {
                isDragging := false
            }
            lastGX := gx, lastGY := gy
            overlayGui.Show("NoActivate")
            
            tX := gx + 15 
            tY := (gy + gh) - (overlayHeight + 15)
            minX := gx, maxX := gx + gw - overlayWidth
            minY := gy, maxY := gy + gh - overlayHeight
        } catch {
            tX := 30, tY := A_ScreenHeight - overlayHeight - 50
            isDragging := false
        }
    } else {
        overlayGui.Show("NoActivate")
        tX := 30, tY := A_ScreenHeight - overlayHeight - 50
        isDragging := false
    }

    ; 3. Physics Engine
    if (isDragging) {
        overlayCurX := tX, overlayCurY := tY
        overlayVelX := 0, overlayVelY := 0
    } else {
        dx := tX - overlayCurX, dy := tY - overlayCurY
        dist := Sqrt(dx*dx + dy*dy)

        if (dist > springSnapDist) {
            overlayCurX := tX, overlayCurY := tY
            overlayVelX := 0, overlayVelY := 0
        } else {
            overlayVelX := (overlayVelX + (dx * springStrength)) * springDamping
            overlayVelY := (overlayVelY + (dy * springStrength)) * springDamping
            overlayCurX += overlayVelX, overlayCurY += overlayVelY
        }
    }

    if IsSet(minX) {
        overlayCurX := Max(minX, Min(overlayCurX, maxX))
        overlayCurY := Max(minY, Min(overlayCurY, maxY))
    }

    finalX := Round(overlayCurX), finalY := Round(overlayCurY)
    static lastFinalX := 0, lastFinalY := 0
    if (finalX != lastFinalX || finalY != lastFinalY) {
        overlayGui.Move(finalX, finalY)
        lastFinalX := finalX, lastFinalY := finalY
    }
}