import { app, BrowserWindow, globalShortcut } from 'electron'
import { OVERLAY_WINDOW_OPTS, OverlayController } from '../'

// https://github.com/electron/electron/issues/25153
app.disableHardwareAcceleration()

let window: BrowserWindow

const toggleMouseKey = 'CmdOrCtrl + J'
const toggleShowKey = 'CmdOrCtrl + K'
const findEditKey = 'CmdOrCtrl + L'
const inputTextKey = 'CmdOrCtrl + M'
const clickButtonWithImageKey = 'CmdOrCtrl + N'
const pauseResumeKey = 'CmdOrCtrl + P'

function createWindow () {
  window = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    ...OVERLAY_WINDOW_OPTS
  })

  window.loadURL(`data:text/html;charset=utf-8,
    <head>
      <title>overlay-demo</title>
    </head>
    <body style="padding: 0; margin: 0;">
      <div style="position: absolute; width: 100%; height: 100%; border: 4px solid red; background: rgba(255,255,255,0.1); box-sizing: border-box; pointer-events: none;"></div>
      <div style="padding-top: 50vh; text-align: center;">
        <div style="padding: 16px; border-radius: 8px; background: rgb(255,255,255); border: 4px solid red; display: inline-block;">
          <span>Overlay Window</span>
          <span id="text1"></span>
          <span id="pauseStatus"></span>
          <br><span><b>${toggleMouseKey}</b> to toggle setIgnoreMouseEvents</span>
          <br><span><b>${toggleShowKey}</b> to "hide" overlay using CSS</span>
          <br><span><b>${pauseResumeKey}</b> to pause/resume attachment</span>
          <br><span><b>${findEditKey}</b> to find Edit controls (Windows only)</span>
          <br><span><b>${inputTextKey}</b> to input text to first Edit control (Windows only)</span>
          <br><span><b>${clickButtonWithImageKey}</b> to click button with image (Windows only)</span>
        </div>
      </div>
      <script>
        const electron = require('electron');

        electron.ipcRenderer.on('focus-change', (e, state) => {
          document.getElementById('text1').textContent = (state) ? ' (overlay is clickable) ' : 'clicks go through overlay'
        });

        electron.ipcRenderer.on('visibility-change', (e, state) => {
          if (document.body.style.display) {
            document.body.style.display = null
          } else {
            document.body.style.display = 'none'
          }
        });

        electron.ipcRenderer.on('pause-status-change', (e, isPaused) => {
          document.getElementById('pauseStatus').textContent = isPaused ? ' (PAUSED - Independent Mode)' : '';
          document.getElementById('pauseStatus').style.color = isPaused ? 'orange' : '';
          document.getElementById('pauseStatus').style.fontWeight = isPaused ? 'bold' : '';
        });
      </script>
    </body>
  `)

  // NOTE: if you close Dev Tools overlay window will lose transparency
  window.webContents.openDevTools({ mode: 'detach', activate: false })

  makeDemoInteractive()

  OverlayController.attachByTitle(
    window,
    process.platform === 'darwin' ? 'Untitled' : 'Riot Client',
    { hasTitleBarOnMac: true }
  )

  // Listen for pause/resume events
  OverlayController.events.on('pause', () => {
    console.log('Overlay attachment paused - window can now be used independently')
    window.webContents.send('pause-status-change', true)
  })

  OverlayController.events.on('resume', () => {
    console.log('Overlay attachment resumed - window will follow target again')
    window.webContents.send('pause-status-change', false)
  })
}

function makeDemoInteractive () {
  let isInteractable = false

  function toggleOverlayState () {
    if (isInteractable) {
      isInteractable = false
      OverlayController.focusTarget()
      window.webContents.send('focus-change', false)
    } else {
      isInteractable = true
      OverlayController.activateOverlay()
      window.webContents.send('focus-change', true)
    }
  }

  window.on('blur', () => {
    isInteractable = false
    window.webContents.send('focus-change', false)
  })

  globalShortcut.register(toggleMouseKey, toggleOverlayState)
  globalShortcut.register(toggleShowKey, () => {
    window.webContents.send('visibility-change', false)
  })
  
  // Add pause/resume functionality
  globalShortcut.register(pauseResumeKey, () => {
    if (OverlayController.paused) {
      console.log('Resuming overlay attachment...')
      OverlayController.resume()
    } else {
      console.log('Pausing overlay attachment...')
      OverlayController.pause()
    }
  })
  
  // Demo UI Automation functionality (Windows only)
  globalShortcut.register(findEditKey, () => {
    if (process.platform === 'win32') {
      try {
        console.log('Finding Edit controls (automatically focusing target window)...')
        const result = OverlayController.findEditControls()
        console.log('Edit controls found:', result)
        if (result.found) {
          console.log(`Found ${result.count} Edit control(s)`)
        } else {
          console.log('No Edit controls found in the target window')
        }
      } catch (error) {
        console.error('Error finding Edit controls:', error)
      }
    } else {
      console.log('UI Automation is only supported on Windows')
    }
  })

  globalShortcut.register(inputTextKey, () => {
    if (process.platform === 'win32') {
      try {
        console.log('Finding Edit controls and inputting text (auto-focus enabled)...')
        const result = OverlayController.findEditControls()
        if (result.found && result.count > 0) {
          const success = OverlayController.inputTextToEdit(0, 'Username_ElectronOverlay')
          const success2 = OverlayController.inputTextToEdit(1, 'Password_ElectronOverlay')
          if (success && success2) {
            console.log('Successfully inputted text to both Edit controls')
          } else {
            console.log('Failed to input text to one or both Edit controls')
          }
        } else {
          console.log('No Edit controls found. Press Ctrl+L first to find Edit controls.')
        }
      } catch (error) {
        console.error('Error inputting text to Edit control:', error)
      }
    } else {
      console.log('UI Automation is only supported on Windows')
    }
  })
  globalShortcut.register(clickButtonWithImageKey, () => {
    if (process.platform === 'win32') {
      try {
        const buttons = OverlayController.findButtonControls()
        const imageButtons = OverlayController.findButtonsWithImages()
        console.log('Buttons with images found:', buttons, imageButtons)
        const success = OverlayController.clickButton(buttons.count - 2);
        if (success) {
          console.log('Successfully clicked the first button with image')
        } else {
          console.log('Failed to click button with image - no buttons with images found')
        }
      } catch (error) {
        console.error('Error clicking button with image:', error)
      }
    } else {
      console.log('UI Automation is only supported on Windows')
    }
  })
}

app.on('ready', () => {
  setTimeout(
    createWindow,
    process.platform === 'linux' ? 1000 : 0 // https://github.com/electron/electron/issues/16809
  )
})
