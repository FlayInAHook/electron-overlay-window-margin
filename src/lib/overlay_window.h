#ifndef ADDON_SRC_OVERLAY_WINDOW_H_
#define ADDON_SRC_OVERLAY_WINDOW_H_

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <uv.h>

enum ow_event_type {
  // target window is found
  OW_ATTACH = 1,
  // target window is active/foreground
  OW_FOCUS,
  // target window lost focus
  OW_BLUR,
  // target window is destroyed
  OW_DETACH,
  // target window fullscreen changed
  // only emitted on X11 and Mac backend
  OW_FULLSCREEN,
  // target window changed position or resized
  OW_MOVERESIZE,
};

struct ow_window_bounds {
  int32_t x;
  int32_t y;
  uint32_t width;
  uint32_t height;
};

struct ow_event_attach {
  // defined only on Windows
  int has_access;
  // defined only on Linux, only if changed
  int is_fullscreen;
  //
  struct ow_window_bounds bounds;
};

struct ow_event_fullscreen {
  bool is_fullscreen;
};

struct ow_event_moveresize {
  struct ow_window_bounds bounds;
};

struct ow_event {
  enum ow_event_type type;
  union {
    struct ow_event_attach attach;
    struct ow_event_fullscreen fullscreen;
    struct ow_event_moveresize moveresize;
  } data;
};

static uv_thread_t hook_tid;

// Passed the title and a pointer to the platform-specific window ID.
// Window ID format depends on platform, see
// https://www.electronjs.org/docs/api/browser-window#wingetnativewindowhandle
void ow_start_hook(char* target_window_title, void* overlay_window_id);

void ow_activate_overlay();

void ow_focus_target();

void ow_emit_event(struct ow_event* event);

void ow_screenshot(uint8_t* out, uint32_t width, uint32_t height);

// UI Automation functions for finding and interacting with Edit controls
typedef struct {
  int found;
  int count;
} ow_edit_controls_result;

// UI Automation functions for finding and interacting with Button controls
typedef struct {
  int found;
  int count;
} ow_button_controls_result;

// Find Edit controls (ControlType 50004) in the target window
ow_edit_controls_result ow_find_edit_controls();

// Input text into a specific Edit control by index (0-based)
int ow_input_text_to_edit(int edit_index, const char* text);

// Get text from a specific Edit control by index (0-based)
int ow_get_text_from_edit(int edit_index, char* buffer, int buffer_size);

// Find Button controls (ControlType 50000) in the target window
ow_button_controls_result ow_find_button_controls();

// Click a specific Button control by index (0-based)
int ow_click_button(int button_index);

// Find Button controls that have Image children (ControlType 50006) in the target window
ow_button_controls_result ow_find_buttons_with_images();

// Click the first Button control that has an Image child
int ow_click_first_button_with_image();

#ifdef __cplusplus
}
#endif

#endif
