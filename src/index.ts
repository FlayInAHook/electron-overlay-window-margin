import { BrowserWindow, BrowserWindowConstructorOptions, Rectangle, screen } from 'electron'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { throttle } from 'throttle-debounce'
const lib: AddonExports = require('node-gyp-build')(join(__dirname, '..'))

interface AddonExports {
  start(
    overlayWindowId: Buffer | undefined,
    targetWindowTitle: string,
    cb: (e: any) => void
  ): void

  activateOverlay(): void
  focusTarget(): void
  screenshot(): Buffer
  findEditControls(): EditControlsResult
  inputTextToEdit(editIndex: number, text: string): boolean
  getTextFromEdit(editIndex: number): string | null
  findButtonControls(): ButtonControlsResult
  clickButton(buttonIndex: number): boolean
  findButtonsWithImages(): ButtonControlsResult
  clickFirstButtonWithImage(): boolean
}

export interface EditControlsResult {
  found: boolean
  count: number
}

export interface ButtonControlsResult {
  found: boolean
  count: number
}

enum EventType {
  EVENT_ATTACH = 1,
  EVENT_FOCUS = 2,
  EVENT_BLUR = 3,
  EVENT_DETACH = 4,
  EVENT_FULLSCREEN = 5,
  EVENT_MOVERESIZE = 6,
}

export interface AttachEvent {
  hasAccess: boolean | undefined
  isFullscreen: boolean | undefined
  x: number
  y: number
  width: number
  height: number
}

export interface FullscreenEvent {
  isFullscreen: boolean
}

export interface MoveresizeEvent {
  x: number
  y: number
  width: number
  height: number
}

export interface PauseEvent {
  isPaused: boolean
}

export interface AttachOptions {
  // Whether the Window has a title bar. We adjust the overlay to not cover it
  hasTitleBarOnMac?: boolean
  marginPercent?: {
    top?: number,
    bottom?: number,
    left?: number,
    right?: number
  }
  selfHandleClickable?: boolean
}

const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'

export const OVERLAY_WINDOW_OPTS: BrowserWindowConstructorOptions = {
  fullscreenable: true,
  skipTaskbar: !isLinux,
  frame: false,
  show: false,
  transparent: true,
  // let Chromium to accept any size changes from OS
  resizable: true,
  // disable shadow for Mac OS
  hasShadow: !isMac,
  // float above all windows on Mac OS
  alwaysOnTop: isMac
}

class OverlayControllerGlobal {
  private isInitialized = false
  private electronWindow?: BrowserWindow
  // Exposed so that apps can get the current bounds of the target
  // NOTE: stores screen physical rect on Windows
  targetBounds: Rectangle = { x: 0, y: 0, width: 0, height: 0 }
  targetHasFocus = false
  private isPaused = false
  private focusNext: 'overlay' | 'target' | undefined
  // The height of a title bar on a standard window. Only measured on Mac
  private macTitleBarHeight = 0
  private attachOptions: AttachOptions = {}

  readonly events = new EventEmitter()

  constructor () {
    this.events.on('attach', (e: AttachEvent) => {
      this.targetHasFocus = true
      if (this.electronWindow && !this.isPaused) {
        if (!this.attachOptions.selfHandleClickable) this.electronWindow.setIgnoreMouseEvents(true)
        
        this.electronWindow.showInactive()
        this.electronWindow.setAlwaysOnTop(true, 'screen-saver')
      }
      if (e.isFullscreen !== undefined && !this.isPaused) {
        this.handleFullscreen(e.isFullscreen)
      }
      this.targetBounds = e
      if (!this.isPaused) {
        this.updateOverlayBounds()
      }
    })

    this.events.on('fullscreen', (e: FullscreenEvent) => {
      if (!this.isPaused) {
        this.handleFullscreen(e.isFullscreen)
      }
    })

    this.events.on('detach', () => {
      this.targetHasFocus = false
      if (!this.isPaused) {
        this.electronWindow?.hide()
      }
    })

    const dispatchMoveresize = throttle(34 /* 30fps */, this.updateOverlayBounds.bind(this))

    this.events.on('moveresize', (e: MoveresizeEvent) => {
      this.targetBounds = e
      if (!this.isPaused) {
        dispatchMoveresize()
      }
    })

    this.events.on('blur', () => {
      this.targetHasFocus = false

      if (this.electronWindow && !this.isPaused && (isMac ||
        this.focusNext !== 'overlay' && !this.electronWindow.isFocused()
      )) {
        this.electronWindow.hide()
      }
    })

    this.events.on('focus', () => {
      this.focusNext = undefined
      this.targetHasFocus = true

      if (this.electronWindow && !this.isPaused) {
        if (!this.attachOptions.selfHandleClickable) this.electronWindow.setIgnoreMouseEvents(true)
        if (!this.electronWindow.isVisible()) {
          this.electronWindow.showInactive()
          this.electronWindow.setAlwaysOnTop(true, 'screen-saver')
        }
      }
    })

    this.events.on('pause', (e: PauseEvent) => {
      this.isPaused = e.isPaused
      if (this.electronWindow) {
        if (e.isPaused) {
          this.electronWindow.hide()
        } else {
          this.electronWindow.show()
        }
      }
    })
  }

  private async handleFullscreen(isFullscreen: boolean) {
    if (!this.electronWindow) return

    if (isMac) {
      // On Mac, only a single app can be fullscreen, so we can't go
      // fullscreen. We get around it by making it display on all workspaces,
      // based on code from:
      // https://github.com/electron/electron/issues/10078#issuecomment-754105005
      this.electronWindow.setVisibleOnAllWorkspaces(isFullscreen, { visibleOnFullScreen: true })
      if (isFullscreen) {
        const display = screen.getPrimaryDisplay()
        this.electronWindow.setBounds(display.bounds)
      } else {
        // Set it back to `lastBounds` as set before fullscreen
        this.updateOverlayBounds();
      }
    } else {
      this.electronWindow.setFullScreen(isFullscreen)
    }
  }

  private updateToMarginBounds(lastBounds: Electron.Rectangle): Electron.Rectangle {
    let newBounds: Electron.Rectangle = {x: lastBounds.x, y: lastBounds.y, width: lastBounds.width, height: lastBounds.height}
    let marginPercent = this.attachOptions.marginPercent;
    if (!marginPercent) return newBounds;

    if (marginPercent.top){
      let reduce = Math.round(lastBounds.height / 100.0 * marginPercent.top);
      newBounds = {x: newBounds.x, y: newBounds.y + reduce, width: newBounds.width, height: newBounds.height - reduce}
    }

    if (marginPercent.bottom){
      let reduce = Math.round(lastBounds.height / 100.0 * marginPercent.bottom);
      newBounds = {x: newBounds.x, y: newBounds.y, width: newBounds.width, height: newBounds.height - reduce}
    }

    if (marginPercent.left){
      let reduce = Math.round(lastBounds.width / 100.0 * marginPercent.left);
      newBounds = {x: newBounds.x + reduce, y: newBounds.y, width: newBounds.width - reduce, height: newBounds.height}
    }

    if (marginPercent.right){
      let reduce = Math.round(lastBounds.width / 100.0 * marginPercent.right);
      newBounds = {x: newBounds.x, y: newBounds.y, width: newBounds.width - reduce, height: newBounds.height}
    }

    return newBounds;
  } 

  private updateOverlayBounds () {
    if (this.isPaused) return
    
    let lastBounds = this.adjustBoundsForMacTitleBar(this.targetBounds)
    if (lastBounds.width === 0 || lastBounds.height === 0) return
    if (!this.electronWindow) return

    if (process.platform === 'win32') {
      lastBounds = screen.screenToDipRect(this.electronWindow, this.targetBounds)
    }
    this.electronWindow.setBounds(this.updateToMarginBounds(lastBounds))

    // if moved to screen with different DPI, 2nd call to setBounds will correctly resize window
    // dipRect must be recalculated as well
    if (process.platform === 'win32') {
      lastBounds = screen.screenToDipRect(this.electronWindow, this.targetBounds)
      this.electronWindow.setBounds(this.updateToMarginBounds(lastBounds))
    }
  }

  private handler (e: unknown) {
    switch ((e as { type: EventType }).type) {
      case EventType.EVENT_ATTACH:
        this.events.emit('attach', e)
        break
      case EventType.EVENT_FOCUS:
        this.events.emit('focus', e)
        break
      case EventType.EVENT_BLUR:
        this.events.emit('blur', e)
        break
      case EventType.EVENT_DETACH:
        this.events.emit('detach', e)
        break
      case EventType.EVENT_FULLSCREEN:
        this.events.emit('fullscreen', e)
        break
      case EventType.EVENT_MOVERESIZE:
        this.events.emit('moveresize', e)
        break
    }
  }

  /**
   * Create a dummy window to calculate the title bar height on Mac. We use
   * the title bar height to adjust the size of the overlay to not overlap
   * the title bar. This helps Mac match the behaviour on Windows/Linux.
   */
  private calculateMacTitleBarHeight () {
    const testWindow = new BrowserWindow({
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: true
      },
      show: false,
    })
    const fullHeight = testWindow.getSize()[1]
    const contentHeight = testWindow.getContentSize()[1]
    this.macTitleBarHeight = fullHeight - contentHeight
    testWindow.close()
  }

  /** If we're on a Mac, adjust the bounds to not overlap the title bar */
  private adjustBoundsForMacTitleBar (bounds: Rectangle) {
    if (!isMac || !this.attachOptions.hasTitleBarOnMac) {
      return bounds
    }

    const newBounds: Rectangle = {
      ...bounds,
      y: bounds.y + this.macTitleBarHeight,
      height: bounds.height - this.macTitleBarHeight
    }
    return newBounds
  }

  activateOverlay () {
    if (!this.electronWindow) {
      throw new Error('You are using the library in tracking mode')
    }
    if (this.isPaused) {
      throw new Error('Cannot activate overlay while paused. Resume attachment first.')
    }
    this.focusNext = 'overlay'
    if (!this.attachOptions.selfHandleClickable) this.electronWindow.setIgnoreMouseEvents(false)
    this.electronWindow.focus()
  }

  focusTarget () {
    if (this.isPaused) {
      throw new Error('Cannot focus target while paused. Resume attachment first.')
    }
    this.focusNext = 'target'
    if (!this.attachOptions.selfHandleClickable) this.electronWindow?.setIgnoreMouseEvents(true)
    lib.focusTarget()
  }

  /**
   * Pause the attachment, allowing the overlay window to be used independently
   * When paused, the overlay window will not follow the target window's position, size, or focus changes
   */
  pause () {
    if (!this.isInitialized) {
      throw new Error('Cannot pause before attachment is initialized')
    }
    if (this.isPaused) {
      return // Already paused
    }
    
    this.isPaused = true
    
    // Allow the overlay window to be used independently
    if (this.electronWindow) {
      this.electronWindow.setIgnoreMouseEvents(false)
      this.electronWindow.setAlwaysOnTop(false)
    }
    
    // Emit pause event
    this.events.emit('pause', { isPaused: true } as PauseEvent)
  }

  /**
   * Resume the attachment, restoring overlay behavior
   * The overlay window will resume following the target window's position, size, and focus changes
   */
  resume () {
    if (!this.isInitialized) {
      throw new Error('Cannot resume before attachment is initialized')
    }
    if (!this.isPaused) {
      return // Already resumed
    }
    
    this.isPaused = false
    
    // Restore overlay behavior if target has focus
    if (this.electronWindow && this.targetHasFocus) {
      if (!this.attachOptions.selfHandleClickable) this.electronWindow.setIgnoreMouseEvents(true)
      this.electronWindow.showInactive()
      this.electronWindow.setAlwaysOnTop(true, 'screen-saver')
      this.updateOverlayBounds()
    }
    
    // Emit resume event
    this.events.emit('resume', { isPaused: false } as PauseEvent)
  }

  /**
   * Check if the attachment is currently paused
   */
  get paused (): boolean {
    return this.isPaused
  }
  attachByTitle (electronWindow: BrowserWindow | undefined, targetWindowTitle: string, options: AttachOptions = {}) {
    if (this.isInitialized) {
      throw new Error('Library can be initialized only once.')
    } else {
      this.isInitialized = true
    }
    this.electronWindow = electronWindow

    this.electronWindow?.on('blur', () => {
      if (!this.targetHasFocus && this.focusNext !== 'target' && !this.isPaused) {
        this.electronWindow!.hide()
      }
    })

    this.electronWindow?.on('focus', () => {
      this.focusNext = undefined
    })

    this.attachOptions = options
    if (isMac) {
      this.calculateMacTitleBarHeight()
    }

    lib.start(
      this.electronWindow?.getNativeWindowHandle(),
      targetWindowTitle,
      this.handler.bind(this))
  }
  // buffer suitable for use in `nativeImage.createFromBitmap`
  screenshot (): Buffer {
    if (process.platform !== 'win32') {
      throw new Error('Not implemented on your platform.')
    }
    return lib.screenshot()
  }

  // Find Edit controls (ControlType 50004) in the target window
  findEditControls (): EditControlsResult {
    if (process.platform !== 'win32') {
      throw new Error('UI Automation is only supported on Windows.')
    }
    return lib.findEditControls()
  }
  // Input text into a specific Edit control by index (0-based)
  inputTextToEdit (editIndex: number, text: string): boolean {
    if (process.platform !== 'win32') {
      throw new Error('UI Automation is only supported on Windows.')
    }
    return lib.inputTextToEdit(editIndex, text)
  }
  // Get text from a specific Edit control by index (0-based)
  getTextFromEdit (editIndex: number): string | null {
    if (process.platform !== 'win32') {
      throw new Error('UI Automation is only supported on Windows.')
    }
    return lib.getTextFromEdit(editIndex)
  }
  findButtonControls (): ButtonControlsResult {
    if (process.platform !== 'win32') {
      throw new Error('UI Automation is only supported on Windows.')
    }
    return lib.findButtonControls()
  }

  // Click a specific Button control by index (0-based)
  clickButton (buttonIndex: number): boolean {
    if (process.platform !== 'win32') {
      throw new Error('UI Automation is only supported on Windows.')
    }
    return lib.clickButton(buttonIndex)
  }

  // Find Button controls that have Image children (ControlType 50006) in the target window
  findButtonsWithImages (): ButtonControlsResult {
    if (process.platform !== 'win32') {
      throw new Error('UI Automation is only supported on Windows.')
    }
    return lib.findButtonsWithImages()
  }

  // Click the first Button control that has an Image child
  clickFirstButtonWithImage (): boolean {
    if (process.platform !== 'win32') {
      throw new Error('UI Automation is only supported on Windows.')
    }
    return lib.clickFirstButtonWithImage()
  }
}

export const OverlayController = new OverlayControllerGlobal()
