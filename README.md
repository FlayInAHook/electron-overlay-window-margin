# electron-overlay-window

[![](https://img.shields.io/npm/v/electron-overlay-window/latest?color=CC3534&label=electron-overlay-window&logo=npm&labelColor=212121)](https://www.npmjs.com/package/electron-overlay-window)

Library for creating overlay windows, intended to complement Electron.

Responsible for:
  - Finding target window by title
  - Keeping position and size of overlay window with target in sync
  - Emits lifecycle events

![yarn demo:electron](https://i.imgur.com/Ej190zc.gif)

Important notes:
  - You can initialize library only once (Electron window must never die, and title by which target window is searched cannot be changed)
  - You can have only one overlay window
  - Found target window remains "valid" even if its title has changed
  - Correct behavior is guaranteed only for top-level windows *(A top-level window is a window that is not a child window, or has no parent window (which is the same as having the "desktop window" as a parent))*
  - X11: library relies on EWHM, more specifically `_NET_ACTIVE_WINDOW`, `_NET_WM_STATE_FULLSCREEN`, `_NET_WM_NAME`

Supported backends:
  - Windows (7 - 10)
  - Linux (X11)

Recommended dev utils
- Windows: AccEvent (accevent.exe) and Inspect Object (inspect.exe) from Windows SDK
- X11: xwininfo, xprop, xev

## Installation and Usage

### Installation

```bash
npm install electron-overlay-window
```

### Import Options

The package supports both CommonJS and ES6 imports with full TypeScript support:

```javascript
// CommonJS
const { OverlayController } = require('electron-overlay-window');

// ES6 imports
import { OverlayController, ButtonControlsResult, EditControlsResult } from 'electron-overlay-window';
```

### UI Automation Features (Windows Only)

The library includes UI automation capabilities for interacting with controls in the target window:

#### Edit Controls
- `findEditControls()` - Find all Edit controls (text input fields)
- `inputTextToEdit(index, text)` - Input text into a specific Edit control
- `getTextFromEdit(index)` - Get text from a specific Edit control

#### Button Controls
- `findButtonControls()` - Find all Button controls
- `clickButton(index)` - Click a specific Button control
- `findButtonsWithImages()` - Find Button controls that contain Image children
- `clickFirstButtonWithImage()` - Click the first Button that contains an Image

### Example Usage

```javascript
import { OverlayController } from 'electron-overlay-window';

// Find and interact with Edit controls
const editResult = OverlayController.findEditControls();
if (editResult.found) {
  OverlayController.inputTextToEdit(0, 'Username');
  OverlayController.inputTextToEdit(1, 'Password');
}

// Find and click buttons
const buttonResult = OverlayController.findButtonControls();
if (buttonResult.found) {
  OverlayController.clickButton(0); // Click first button
}

// Click button with image
OverlayController.clickFirstButtonWithImage();
```
