; ------------------------------------------------------------------
; GEMINI MEM TAG(DO NOT EVER REMOVE OR EDIT) - MY FULL PATH IS "Pipz_Project_V3\Lib\Humanoid.ahk"
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; MAINTEMPLATE - Humanoid.ahk (AHK v2)
; Version: 1.0.0
; Last change: Initial merging of Movement, AntiBan, and BreakManager modules. 
; Content-Fingerprint: 2026-01-28T23-11-40Z-QYWGASK1
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ALL CONTENT MUST GO BELOW THIS POINT(LINES 1-14 RESERVED)
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; SIGNPOST GOVERNANCE — FILE: Humanoid.ahk
; ------------------------------------------------------------------
; MODULE NAME:
;   Humanoid (Shared Behavior Engine)
;
; WHAT IT OWNS / CONTROLS:
;   - Human-like behavior primitives shared by Controller and Worker:
;       * Mouse movement simulation (curves, easing, overshoot)
;       * Micro delays and timing jitter
;       * Micro wiggles / corrective movement noise
;       * Probabilistic breaks and AFK simulation
;
; INPUTS (events/messages/functions it responds to):
;   - Direct function calls from worker runtime (primary consumer):
;       * Movement execution (MoveMouse / internal helpers)
;       * Anti-ban helpers (micro delay, overshoot decisions)
;       * Break evaluation hooks
;   - Uses runtime globals injected by Controller/Worker:
;       * g_OvershootEnabled / g_OvershootPercent
;       * g_MicroDelayEnabled / g_MicroDelayMax / g_MicroDelayChance
;       * g_MicroWigglesEnabled / g_WiggleIntensity
;       * g_BreaksEnabled / g_BreakChance / g_BreakSpacing
;       * g_WorkerState (optional gating)
;
; OUTPUTS / SIDE EFFECTS (files, settings, processes, IPC, UI):
;   - Input simulation:
;       * MouseMove / mouse positioning events
;   - Timing modulation:
;       * Sleep() calls for micro delays and break durations
;
; DEPENDENCIES (globals/functions it relies on):
;   - Runtime globals populated elsewhere (no ownership here)
;   - AHK built-ins:
;       Random(), Sleep(), MouseGetPos(), MouseMove(),
;       A_TickCount, math helpers (Sqrt, Round, etc.)
;
; GOVERNANCE NOTES (hard-stop rules, invariants, what must remain true):
;   - This module MUST NOT:
;       * Perform any INI / file IO
;       * Depend on controller-only globals (e.g., g_Config)
;       * Assume overlay/UI helpers exist
;   - All behavior must remain gated by g_* enable flags.
;   - Must be safe to load in both Controller and Worker contexts.
;   - Changes here directly affect detection risk; modify conservatively.
; ------------------------------------------------------------------

#Requires AutoHotkey >=2.0

; ------------------------------------------------------------------
; Anti-Ban & Human Simulation Module (Originally from AntiBan.ahk) [DO NOT REMOVE]
; Handles micro delays, breaks, and overshoot logic to simulate human-like behavior.
; ------------------------------------------------------------------

global g_LastBreakTick := 0

; --- MATH UTILITIES ---
Clamp(val, min, max) => (val < min) ? min : (val > max ? max : val)

; --- 1. MICRO DELAY SYSTEM ---
PerformMicroDelay(minMs := 10, maxMs := "") {
    global g_MicroDelayEnabled, g_MicroDelayChance, g_MicroDelayMax

    if (!IsSet(g_MicroDelayEnabled) || !g_MicroDelayEnabled)
        return 0

    chance := IsSet(g_MicroDelayChance) ? g_MicroDelayChance : 0
    if (Random(1, 100) > chance)
        return 0

    maxCfg := IsSet(g_MicroDelayMax) ? g_MicroDelayMax : 500

    actualMin := Max(minMs, 10)
    actualMax := (maxMs == "") ? maxCfg : maxMs
    if (actualMax < actualMin)
        actualMax := actualMin

    delay := Random(actualMin, actualMax)
    Sleep(delay)
    return delay
}

; --- 2. BREAK SYSTEM ---
CheckForBreak() {
    global g_LastBreakTick
    global g_BreaksEnabled, g_BreakChance, g_BreakSpacing

    if (!IsSet(g_BreaksEnabled) || !g_BreaksEnabled)
        return false

    spacingMin := IsSet(g_BreakSpacing) ? g_BreakSpacing : 3
    cooldownMs := spacingMin * 60000
    if (A_TickCount - g_LastBreakTick < cooldownMs)
        return false

    chance := IsSet(g_BreakChance) ? g_BreakChance : 0
    if (Random(1, 100) > chance)
        return false

    ; Overlay updates only if the function exists (Worker context)
    try {
        if IsSet(UpdateWorkerOverlay) && (UpdateWorkerOverlay is Func)
            UpdateWorkerOverlay.Call("Status - Taking Break", "d88304")
    }

    breakDuration := Random(10000, 45000)
    Sleep(breakDuration)

    try {
        if IsSet(UpdateWorkerOverlay) && (UpdateWorkerOverlay is Func)
            UpdateWorkerOverlay.Call("Status - Active", "00FF00")
    }

    g_LastBreakTick := A_TickCount
    return true
}

; --- 3. OVERSHOOT LOGIC ---
ShouldOvershoot() {
    global g_OvershootEnabled, g_OvershootPercent

    if (!IsSet(g_OvershootEnabled) || !g_OvershootEnabled)
        return false

    pct := IsSet(g_OvershootPercent) ? g_OvershootPercent : 0
    return (Random(1, 100) <= pct)
}

; ------------------------------------------------------------------
; END OF Anti-Ban & Human Simulation Module
; ------------------------------------------------------------------

; ------------------------------------------------------------------

; ------------------------------------------------------------------
; Break Manager Module (Originally from BreakManager.ahk) [DO NOT REMOVE]
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

; ------------------------------------------------------------------
; END OF Break Manager Module
; ------------------------------------------------------------------

; ------------------------------------------------------------------

; ------------------------------------------------------------------
; Human-like Mouse Movements Module (Originally from Movement.ahk) [DO NOT REMOVE]
; Handles mouse movement with overshoot, micro-wiggles, and muscle memory simulation.
; ------------------------------------------------------------------

; ------------------------------------------------------------------
; ------------------------------------------------------------------
; Human-like Mouse Movements for AHK v2
; ------------------------------------------------------------------
; Added at end of the script so we can use the
; MoveMouse function
; ------------------------------------------------------------------
; ------------------------------------------------------------------
;  v1.7                                          ;
;  Original script by: Flight in Pascal                          ;
;  Link: https://github.com/SRL/SRL/blob/master/shared/mouse.simba                ;
;  More Flight's mouse moves: https://paste.villavu.com/show/3279/               ;
;  ModIfied script with simpler method MoveMouse() by: dexon in C#               ;
;  Conversion from C# into AHK by: HowDoIStayInDreams, with the help of Arekusei ;
;  Refactor & Rewrite v1.6+ by Pipz ;
; ------------------------------------------------------------------
; ------------------------------------------------------------------
;  Changelog:                                    
;  v1.3 added dynamic mouse speed;
;  v1.4 added acceleration and brake, shout-out to kl and Lazy;
;  v1.5 fixed jiggle at the destination (pointed out by Sound);
;   added smoother Sleep function;
;   maxStep is now more dynamic, using GlitchedSoul's weighted Random;
;  v1.6 added dynamic path weaving and smoothing;
;   added randomised destination overshoot and correction;
;   changed from square randomization to circular ;
;   added muscle memory simulation and decay;
;  v1.7 refactored and updated compatibility to autohotkey v2+;
;  v1.7.1 refactored for thread-safe global sync;
;  v1.8 integrated micro-wiggles and refined overshoot chance;
; ------------------------------------------------------------------

MoveMouse(x, y, speed := "", RD := "") {
    ; --- Global Synchronization ---
    global g_OvershootEnabled, g_OvershootPercent, g_MicroWigglesEnabled

    ; Thread-Safe Local Fetch
    currOverEnabled := (IsSet(g_OvershootEnabled) && g_OvershootEnabled)
    currOverPercent := IsSet(g_OvershootPercent) ? g_OvershootPercent : 0
    currOverBase    := currOverPercent / 100.0
    
    ; Wiggle Logic
    currWiggleEnabled := (IsSet(g_MicroWigglesEnabled) && g_MicroWigglesEnabled)

    if (speed == "") {
        speed := Random(25, 30) / 10.0
    }

    ; Circular Randomization of target destination (15px radius)
    angleDeg := Random(0, 360)
    angleRad := angleDeg * (3.14159 / 180)
    distance := Sqrt(Random(0, 100) / 100.0) * 15 

    offsetX := Cos(angleRad) * distance
    offsetY := Sin(angleRad) * distance

    targetX := x + offsetX
    targetY := y + offsetY

    ; --- Muscle Memory Simulation ---
    static MuscleMemory := Map()
    MEMORY_DECAY_INTERVAL := 10000
    MEMORY_DECAY_RATE := 0.01

    MouseGetPos(&startX, &startY)
    distX := targetX - startX
    distY := targetY - startY
    distanceTotal := Hypot(distX, distY)

    overshootOccurred := false
    overshootX := targetX
    overshootY := targetY

    ; Apply Overshoot Logic (Simulating Human Inaccuracy)
    if (currOverEnabled && currOverBase > 0) {
        targetKey := Round(targetX) "|" Round(targetY)
        reduction := 0
        
        if (MuscleMemory.Has(targetKey)) {
            mem := MuscleMemory[targetKey]
            elapsed := A_TickCount - mem.lastTime
            decaySteps := Floor(elapsed / MEMORY_DECAY_INTERVAL)
            mem.val := Max(mem.val - (decaySteps * MEMORY_DECAY_RATE), 0)
            MuscleMemory[targetKey] := mem
            reduction := mem.val
        }

        overshootChance := Max(currOverBase - reduction, 0)
        
        if (Random(0, 100) < overshootChance * 100) {
            factor := Min(Max(distanceTotal / 500 * 0.03, 0.02), 0.05)
            overshootFactor := Random(factor * 50, factor * 150) / 100
            overshootX := targetX + (distX * overshootFactor)
            overshootY := targetY + (distY * overshootFactor)
            overshootOccurred := true
        }
    }

    ; Perform Movement
    if (RD == "RD") {
        goRelative(overshootX, overshootY, speed, currWiggleEnabled)
    } else {
        goStandard(overshootX, overshootY, speed, currWiggleEnabled)
    }

    ; Correction Movement
    if (overshootOccurred) {
        PreciseSleep(Random(40, 90)) ; Human reaction delay before correction
        if (RD == "RD") {
            goRelative(targetX - overshootX, targetY - overshootY, speed * 1.5, false)
        } else {
            goStandard(targetX, targetY, speed * 1.5, false)
        }

        ; Record to Muscle Memory
        reductionAmount := 0.01 + (Random(0, 100) / 100) * 0.01
        targetKey := Round(targetX) "|" Round(targetY)
        if (MuscleMemory.Has(targetKey)) {
            mem := MuscleMemory[targetKey]
            mem.val := Min(mem.val + reductionAmount, 0.03)
            mem.lastTime := A_TickCount
            MuscleMemory[targetKey] := mem
        } else {
            MuscleMemory[targetKey] := {val: Min(reductionAmount, 0.03), lastTime: A_TickCount}
        }
    }
}

; --- Core Path Generation ---

WindMouse(xs, ys, xe, ye, gravity, wind, minWait, maxWait, maxStep, targetArea, SleepsArray, Wiggle := false) {
    windX := 0, windY := 0, veloX := 0, veloY := 0
    newX := Round(xs), newY := Round(ys)
    sqrt2 := Sqrt(2), sqrt3 := Sqrt(3), sqrt5 := Sqrt(5)
    dist := Hypot(xe - xs, ye - ys)
    i := 1
    stepVar := maxStep

    Loop {
        wind := Min(wind, dist)
        if (dist >= targetArea) {
            windX := windX / sqrt3 + (Random(0, Round(wind) * 2) - wind) / sqrt5
            windY := windY / sqrt3 + (Random(0, Round(wind) * 2) - wind) / sqrt5
            maxStep := RandomWeight(stepVar / 2, (stepVar + (stepVar / 2)) / 2, stepVar)
        } else {
            windX := windX / sqrt2
            windY := windY / sqrt2
            maxStep := (maxStep < 3) ? 1 : maxStep / 3
        }

        veloX += windX + gravity * (xe - xs) / dist
        veloY += windY + gravity * (ye - ys) / dist

        if (Hypot(veloX, veloY) > maxStep) {
            veloMag := Hypot(veloX, veloY)
            RandomDist := maxStep / 2 + (Random(0, Round(maxStep)) / 2)
            veloX := (veloX / veloMag) * RandomDist
            veloY := (veloY / veloMag) * RandomDist
        }

        ; --- MICRO-WIGGLE INJECTION ---
        if (Wiggle && Mod(i, 3) == 0) {
			intensity := IsSet(g_WiggleIntensity) ? Float(g_WiggleIntensity) : 1.0
            xs += Random(-intensity, intensity)
            ys += Random(-intensity, intensity)
        }

        oldX := Round(xs), oldY := Round(ys)
        xs += veloX, ys += veloY
        dist := Hypot(xe - xs, ye - ys)

        if (dist <= 1)
            break

        newX := Round(xs), newY := Round(ys)
        if (oldX != newX || oldY != newY)
            MouseMove(newX, newY)

        c := SleepsArray.Length
        if (c > 0) {
            idx := (i > c) ? c : i
            waitSleep := SleepsArray[idx]
            wait := Max(Round(Abs(Random(Float(waitSleep), Float(waitSleep) + 1))), 1)
            PreciseSleep(wait)
        } else {
            PreciseSleep(1) 
        }
        i++
    }

    if (Round(xe) != newX || Round(ye) != newY)
        MouseMove(Round(xe), Round(ye))
}

WindMouse2(xs, ys, xe, ye, gravity, wind, minWait, maxWait, maxStep, targetArea) {
    windX := 0, windY := 0, veloX := 0, veloY := 0
    newX := Round(xs), newY := Round(ys)
    waitDiff := maxWait - minWait
    sqrt2 := Sqrt(2), sqrt3 := Sqrt(3), sqrt5 := Sqrt(5)
    dist := Hypot(xe - xs, ye - ys)
    newArr := []
    stepVar := maxStep

    Loop {
        wind := Min(wind, dist)
        if (dist >= targetArea) {
            windX := windX / sqrt3 + (Random(0, Round(wind) * 2) - wind) / sqrt5
            windY := windY / sqrt3 + (Random(0, Round(wind) * 2) - wind) / sqrt5
            maxStep := RandomWeight(stepVar / 2, (stepVar + (stepVar / 2)) / 2, stepVar)
        } else {
            windX /= sqrt2
            windY /= sqrt2
            maxStep := (maxStep < 3) ? 1 : maxStep / 3
        }
        
        veloX += windX + gravity * (xe - xs) / dist
        veloY += windY + gravity * (ye - ys) / dist

        if (Hypot(veloX, veloY) > maxStep) {
            veloMag := Hypot(veloX, veloY)
            RandomDist := maxStep / 2 + (Random(0, Round(maxStep)) / 2)
            veloX := (veloX / veloMag) * RandomDist
            veloY := (veloY / veloMag) * RandomDist
        }

        oldX := Round(xs), oldY := Round(ys)
        xs += veloX, ys += veloY
        dist := Hypot(xe - xs, ye - ys)

        if (dist <= 1)
            break

        newX := Round(xs), newY := Round(ys)
        step := Hypot(xs - oldX, ys - oldY)
        mean := Round(waitDiff * (step / maxStep) + minWait) / 7
        wait := Muller((mean) / 2, (mean) / 2.718281)
        newArr.Push(wait)
    }
    return newArr
}

; --- Core Math & Utility ---

Hypot(dx, dy) => Sqrt(dx * dx + dy * dy)

PreciseSleep(ms) {
    DllCall("QueryPerformanceFrequency", "Int64*", &freq := 0)
    DllCall("QueryPerformanceCounter", "Int64*", &CounterBefore := 0)
    CounterAfter := CounterBefore
    while (((CounterAfter - CounterBefore) / freq * 1000) < ms) {
        DllCall("QueryPerformanceCounter", "Int64*", &CounterAfter)
    }
}

Muller(m, s) {
    static i := 0, Y := 0
    if (i := !i) {
        U := Sqrt(-2 * Ln(Random(0.0, 1.0))) * s
        VV := Random(0.0, 6.2831853071795862)
        Y := m + U * Sin(VV)
        return m + U * Cos(VV)
    }
    return Y
}

SortArray(arr, order := "A") {
    Loop arr.Length {
        idx := A_Index
        Loop arr.Length - idx {
            j := A_Index
            if (order = "A" ? (arr[j] > arr[j+1]) : (arr[j] < arr[j+1])) {
                temp := arr[j]
                arr[j] := arr[j+1]
                arr[j+1] := temp
            }
        }
    }
}

RandomWeight(minVal, target, maxVal) {
    Rmin := Random(minVal, target)
    Rmax := Random(target, maxVal)
    return Random(Rmin, Rmax)
}

goStandard(x, y, speed, wiggle := false) {
    MouseGetPos(&xpos, &ypos)
    distance := (Sqrt(Hypot(x - xpos, y - ypos))) * speed
    dynamicSpeed := (1 / Max(distance, 1)) * 60
    finalSpeed := Random(dynamicSpeed, dynamicSpeed + 0.8)
    stepArea := Max((finalSpeed / 2 + distance) / 10, 0.1)
    
    newArr := WindMouse2(xpos, ypos, x, y, 10, 3, finalSpeed * 10, finalSpeed * 12, stepArea * 11, stepArea * 7)
    SortArray(newArr, "D")
    
    half := Floor(newArr.Length / 2)
    while (newArr.Length > half)
        newArr.Pop()

    newClone := newArr.Clone()
    SortArray(newClone, "A")
    for val in newClone
        newArr.Push(val)

    WindMouse(xpos, ypos, x, y, 10, 3, finalSpeed * 10, finalSpeed * 12, stepArea * 11, stepArea * 7, newArr, wiggle)
}

goRelative(x, y, speed, wiggle := false) {
    MouseGetPos(&xpos, &ypos)
    targetX := xpos + x
    targetY := ypos + y
    distance := (Sqrt(Hypot(targetX - xpos, targetY - ypos))) * speed
    dynamicSpeed := (1 / Max(distance, 1)) * 60
    finalSpeed := Random(dynamicSpeed, dynamicSpeed + 0.8)
    stepArea := Max((finalSpeed / 2 + distance) / 10, 0.1)

    newArr := WindMouse2(xpos, ypos, targetX, targetY, 10, 3, finalSpeed * 10, finalSpeed * 12, stepArea * 11, stepArea * 7)
    SortArray(newArr, "D")
    
    half := Floor(newArr.Length / 2)
    while (newArr.Length > half)
        newArr.Pop()

    newClone := newArr.Clone()
    SortArray(newClone, "A")
    for val in newClone
        newArr.Push(val)

    WindMouse(xpos, ypos, targetX, targetY, 10, 3, finalSpeed * 10, finalSpeed * 12, stepArea * 11, stepArea * 7, newArr, wiggle)
}

; ------------------------------------------------------------------
; END OF Human-like Mouse Movements Module
; ------------------------------------------------------------------

; END OF FILE Humanoid.ahk