import { app, BrowserWindow, globalShortcut } from 'electron'
import { OVERLAY_WINDOW_OPTS, OverlayController } from '../'

// https://github.com/electron/electron/issues/25153
app.disableHardwareAcceleration()

let window: BrowserWindow

const toggleMouseKey = 'CmdOrCtrl + J'
const toggleShowKey = 'CmdOrCtrl + K'
const findEditKey = 'CmdOrCtrl + L'
const inputTextKey = 'CmdOrCtrl + M'

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
          <span id="text1"></span>          <br><span><b>${toggleMouseKey}</b> to toggle setIgnoreMouseEvents</span>
          <br><span><b>${toggleShowKey}</b> to "hide" overlay using CSS</span>
          <br><span><b>${findEditKey}</b> to find Edit controls (Windows only)</span>
          <br><span><b>${inputTextKey}</b> to input text to first Edit control (Windows only)</span>
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

  // Demo UI Automation functionality (Windows only)
  globalShortcut.register(findEditKey, () => {
    if (process.platform === 'win32') {
      try {
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
}

app.on('ready', () => {
  setTimeout(
    createWindow,
    process.platform === 'linux' ? 1000 : 0 // https://github.com/electron/electron/issues/16809
  )
})
