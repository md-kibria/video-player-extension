# Video Popup Player Extension

A Chrome/Brave Manifest V3 extension that intercepts direct video file links and opens them in a modern extension player instead of triggering normal file download behavior (when browser playback is supported).

## Chrome Web Store

- Link: Coming soon

## What It Does

- Detects direct video URL navigations (main frame only) such as `.mkv`, `.mp4`, `.webm`, `.mov`, etc.
- Redirects supported matches to the extension player page.
- Keeps non-video links and normal browsing behavior untouched.
- Supports native browser playback with graceful fallback messaging when codecs are unsupported.

## Player Features

- Modern custom player UI with:
  - custom play/pause button
  - seek bar with hover time tooltip
  - current time and duration display
  - playback speed dropdown menu (0.5x to 2x)
  - mute/unmute and custom volume slider
  - fullscreen button (video-only fullscreen)
- Center hover overlay:
  - large professional play/pause icon (Material Symbols)
  - click to toggle playback
- Hover metadata:
  - filename overlay shown at the bottom of the player
  - embedded MKV Title extracted automatically if available
- Keyboard shortcuts:
  - `ArrowRight`: forward 10s
  - `ArrowLeft`: backward 10s
  - `ArrowUp`: volume up
  - `ArrowDown`: volume down
  - `Space`: play/pause
  - `F`: toggle fullscreen
- Volume persistence:
  - last selected volume is saved to `localStorage`
  - new videos start with the same previous volume

## Extension Popup Features

- Toggle interception on/off.
- Configure allowed video extensions.
- See recent intercepted video links.

## Supported Formats (Extension-Based Detection)

Current detection list includes:

`mkv`, `mp4`, `webm`, `mov`, `avi`, `flv`, `m4v`, `ts`, `3gp`, `wmv`, `mpeg`, `mpg`, `m2ts`

Note: Detection is extension-based, but playback depends on browser codec support.

## Installation (Developer Mode)

1. Open `chrome://extensions` (or `brave://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project root folder.

## Usage

1. Open a website containing a direct video file URL.
2. Click the direct video link.
3. Extension routes it to the player page automatically.
4. Use custom controls, keyboard shortcuts, and hover interactions.

## MKV and Codec Notes

- `.mkv` is only a container format.
- If underlying codec is not supported by Chrome/Brave, playback may fail.
- In that case, the player shows a clear unsupported-format message.

## MKV Subtitle & Metadata Extraction

- **Subtitles**: The player natively parses `.mkv` streams on-the-fly to extract embedded text subtitles (SRT, ASS) and injects them as standard WebVTT tracks, allowing native browser playback with subtitles!
- **Title Metadata**: The parser also reads the internal `Segment Title` metadata of the MKV file and automatically updates the player UI to show the real video title (if present) instead of just the URL filename.

## Manual Test Checklist

- Direct `.mp4` link opens in extension player and plays.
- Direct `.webm` link opens in extension player and plays.
- Direct `.mkv` link opens in extension player; unsupported codecs show fallback message.
- Seek hover tooltip time matches clicked seek position.
- `ArrowLeft/ArrowRight` seek and toast time display in `mm:ss`.
- `F` key toggles video-only fullscreen.
- Volume value persists across opening new videos.
- Disabling interception in popup restores normal direct-link navigation.

