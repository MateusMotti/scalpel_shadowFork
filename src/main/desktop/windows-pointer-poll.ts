// Polls the OS cursor position and mouse button state on Windows.
//
// Fallback for the overlay's hover/click-outside tracking when uiohook's
// low-level mouse hook delivers nothing (issue #648): Windows can silently
// drop a WH_MOUSE_LL hook, after which no mouse events ever arrive while the
// keyboard hook keeps working. GetCursorPos returns physical pixels for our
// per-monitor DPI-aware process, matching the uiohook coordinate space.
import koffi from 'koffi'

export interface PointerSnapshot {
  x: number
  y: number
  /** uiohook button numbering: 1 left, 2 right, 3 middle. */
  buttons: { 1: boolean; 2: boolean; 3: boolean }
}

type GetCursorPos = (pt: { x?: number; y?: number }) => boolean
type GetAsyncKeyState = (vKey: number) => number

let getCursorPos: GetCursorPos | null = null
let getAsyncKeyState: GetAsyncKeyState | null = null

if (process.platform === 'win32') {
  try {
    const user32 = koffi.load('user32.dll')
    const POINT = koffi.struct('SCALPEL_POINT', { x: 'long', y: 'long' })
    getCursorPos = user32.func('bool GetCursorPos(_Out_ SCALPEL_POINT *pt)') as GetCursorPos
    void POINT
    getAsyncKeyState = user32.func('int16 GetAsyncKeyState(int vKey)') as GetAsyncKeyState
  } catch {
    getCursorPos = null
    getAsyncKeyState = null
  }
}

const VK_LBUTTON = 0x01
const VK_RBUTTON = 0x02
const VK_MBUTTON = 0x04

export function windowsPointerPollAvailable(): boolean {
  return getCursorPos !== null && getAsyncKeyState !== null
}

export function readWindowsPointer(): PointerSnapshot | null {
  if (!getCursorPos || !getAsyncKeyState) return null
  try {
    const pt: { x?: number; y?: number } = {}
    if (!getCursorPos(pt) || typeof pt.x !== 'number' || typeof pt.y !== 'number') return null
    const down = (vk: number): boolean => (getAsyncKeyState as GetAsyncKeyState)(vk) < 0
    return { x: pt.x, y: pt.y, buttons: { 1: down(VK_LBUTTON), 2: down(VK_RBUTTON), 3: down(VK_MBUTTON) } }
  } catch {
    return null
  }
}
