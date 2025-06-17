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

// Pause/Resume attachment
OverlayController.pause(); // Window can now be used independently
console.log(OverlayController.paused); // true

OverlayController.resume(); // Window will follow target again

// Reset overlay position
OverlayController.resetPosition(); // Force sync with target window position

// Listen for pause/resume events
OverlayController.events.on('pause', (event) => {
  console.log('Attachment paused:', event.isPaused);
});

OverlayController.events.on('resume', (event) => {
  console.log('Attachment resumed:', event.isPaused);
});
```

### Pause/Resume Functionality

The library now supports pausing and resuming the overlay attachment:

- **`pause()`** - Pauses the attachment, allowing the overlay window to be used independently. The window will stop following the target window's position, size, and focus changes.
- **`resume()`** - Resumes the attachment, restoring normal overlay behavior where the window follows the target.
- **`paused`** - Property to check if the attachment is currently paused.
- **Events** - Listen for 'pause' and 'resume' events to respond to state changes.

When paused, the overlay window:
- Becomes clickable and interactive
- No longer follows the target window's position or size
- Can be moved and resized independently
- Is no longer always on top

### Reset Position

The `resetPosition()` method allows you to manually trigger the same behavior that occurs when the target window moves:

```javascript
// Reset overlay position to match current target window position
OverlayController.resetPosition();
```

This is useful when you need to manually synchronize the overlay position with the target window, especially after programmatic changes or when dealing with specific window management scenarios.
