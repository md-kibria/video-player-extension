const params = new URLSearchParams(window.location.search);
const source = params.get("src");
const playerShell = document.querySelector(".player-shell");
const video = document.getElementById("video");
const toastEl = document.getElementById("toast");
const playPauseBtn = document.getElementById("playPauseBtn");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const seekBar = document.getElementById("seekBar");
const muteBtn = document.getElementById("muteBtn");
const volumeBar = document.getElementById("volumeBar");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const speedBtn = document.getElementById("speedBtn");
const speedMenu = document.getElementById("speedMenu");
const speedOptions = document.querySelectorAll(".speed-option");
const hoverToggleBtn = document.getElementById("hoverToggleBtn");
const fileNameOverlay = document.getElementById("fileNameOverlay");
const seekTooltip = document.getElementById("seekTooltip");
const VOLUME_STORAGE_KEY = "videoPopupPlayerVolume";

let metadataTimer = null;
let toastTimer = null;
let hoverUiTimer = null;

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "00:00";
  }
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getFileName(rawUrl) {
  if (!rawUrl) {
    return "Unknown file";
  }
  try {
    const parsed = new URL(rawUrl);
    const name = decodeURIComponent(parsed.pathname.split("/").pop() || "");
    return name || "Unknown file";
  } catch (_) {
    return "Unknown file";
  }
}

function showToast(message) {
  if (!message) {
    toastEl.classList.remove("visible");
    toastEl.textContent = "";
    return;
  }
  toastEl.textContent = message;
  toastEl.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("visible");
  }, 1400);
}

function clearTimer() {
  if (metadataTimer) {
    clearTimeout(metadataTimer);
    metadataTimer = null;
  }
}

function showHoverUiTemporarily() {
  playerShell.classList.add("hover-ui-visible");
  clearTimeout(hoverUiTimer);
  hoverUiTimer = setTimeout(() => {
    playerShell.classList.remove("hover-ui-visible");
  }, 5000);
}

function hideHoverUi() {
  clearTimeout(hoverUiTimer);
  playerShell.classList.remove("hover-ui-visible");
}

function clampVolume(value) {
  return Math.min(1, Math.max(0, value));
}

function getSavedVolume() {
  const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return clampVolume(parsed);
}

function saveVolume(volume) {
  localStorage.setItem(VOLUME_STORAGE_KEY, String(clampVolume(volume)));
}

async function toggleFullscreen() {
  if (document.fullscreenElement === video) {
    await document.exitFullscreen().catch(() => {});
    return;
  }
  if (video.requestFullscreen) {
    await video.requestFullscreen().catch(() => {});
  }
}

function togglePlayback() {
  if (video.paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}

function getSeekRatioFromClientX(clientX) {
  const seekRect = seekBar.getBoundingClientRect();
  return Math.min(1, Math.max(0, (clientX - seekRect.left) / seekRect.width));
}

function seekFromClientX(clientX) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return;
  }
  const ratio = getSeekRatioFromClientX(clientX);
  const nextTime = ratio * video.duration;
  video.currentTime = nextTime;
  seekBar.value = String(ratio * 100);
}

function updatePlayButton() {
  const centerIconName = video.paused ? "play_arrow" : "pause";
  playPauseBtn.textContent = video.paused ? "▶" : "❚❚";
  hoverToggleBtn.innerHTML = `<span class="material-symbols-rounded center-hover-icon">${centerIconName}</span>`;
}

function updateMuteButton() {
  muteBtn.textContent = video.muted || video.volume === 0 ? "🔇" : "🔊";
}

function syncProgress() {
  currentTimeEl.textContent = formatTime(video.currentTime);
  if (Number.isFinite(video.duration) && video.duration > 0) {
    seekBar.value = String((video.currentTime / video.duration) * 100);
  } else {
    seekBar.value = "0";
  }
}

function formatVTTTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const secs = String(totalSeconds % 60).padStart(2, "0");
  const millis = String(Math.floor(ms % 1000)).padStart(3, "0");
  return `${hours}:${mins}:${secs}.${millis}`;
}

function extractMKVTitle(uint8Array) {
  for (let i = 0; i < uint8Array.length - 10; i++) {
    if (uint8Array[i] === 0x7b && uint8Array[i+1] === 0xa9) {
      const sizeByte = uint8Array[i+2];
      let titleLength = 0;
      let dataOffset = 0;
      
      if ((sizeByte & 0x80) !== 0) {
        titleLength = sizeByte & 0x7f;
        dataOffset = i + 3;
      } else if ((sizeByte & 0x40) !== 0) {
        titleLength = ((sizeByte & 0x3f) << 8) | uint8Array[i+3];
        dataOffset = i + 4;
      }
      
      if (titleLength > 0 && titleLength < 1000 && dataOffset + titleLength <= uint8Array.length) {
        const titleBytes = uint8Array.slice(dataOffset, dataOffset + titleLength);
        const titleText = new TextDecoder("utf-8").decode(titleBytes);
        // Only return if it looks like a valid string (no null terminators)
        if (titleText && !titleText.includes('\x00')) {
            return titleText;
        }
      }
    }
  }
  return null;
}

async function extractMKVSubtitles(url) {
  try {
    const response = await fetch(url);
    if (!response.body) return;

    showToast("Extracting subtitles...");

    const reader = response.body.getReader();
    const parser = new window.MKVSubtitleParser();

    const subsByTrack = new Map();
    const trackInfos = new Map();

    parser.once("tracks", (tracks) => {
      tracks.forEach(track => {
        if (track.type === "utf8" || track.type === "ass" || track.type === "ssa") {
          trackInfos.set(track.number, track);
          subsByTrack.set(track.number, []);
        }
      });
    });

    parser.on("subtitle", (subtitle, trackNumber) => {
      if (subsByTrack.has(trackNumber)) {
        subsByTrack.get(trackNumber).push(subtitle);
      }
    });

    let mkvTitleFound = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        if (!mkvTitleFound) {
          const mkvTitle = extractMKVTitle(value);
          if (mkvTitle) {
            fileNameOverlay.textContent = mkvTitle;
            mkvTitleFound = true;
          }
        }
        parser.write(value);
      }
    }
    parser.end();

    let firstTrack = true;
    let trackCount = 0;
    for (const [trackNumber, subs] of subsByTrack.entries()) {
      if (subs.length === 0) continue;
      
      const trackInfo = trackInfos.get(trackNumber);
      let vttContent = "WEBVTT\n\n";

      subs.sort((a, b) => a.time - b.time);

      subs.forEach((sub, index) => {
        const start = formatVTTTime(sub.time);
        const end = formatVTTTime(sub.time + sub.duration);
        
        let text = sub.text || "";
        if (trackInfo.type === "ass" || trackInfo.type === "ssa") {
            const rawText = text.replace(/\{[^}]+\}/g, "");
            text = rawText.split("\\N").join("\n").replace(/\r\n/g, "\n");
        } else {
            text = text.replace(/\r\n/g, "\n");
        }

        vttContent += `${index + 1}\n${start} --> ${end}\n${text}\n\n`;
      });

      const blob = new Blob([vttContent], { type: "text/vtt" });
      const objectUrl = URL.createObjectURL(blob);
      const trackEl = document.createElement("track");
      trackEl.kind = "subtitles";
      trackEl.label = trackInfo.name || trackInfo.language || `Track ${trackNumber}`;
      trackEl.srclang = trackInfo.language || "en";
      trackEl.src = objectUrl;
      
      if (firstTrack) {
        trackEl.default = true;
        firstTrack = false;
      }
      video.appendChild(trackEl);
      trackCount++;
    }
    
    if (trackCount > 0) {
      showToast(`${trackCount} subtitle track(s) loaded`);
    } else {
      showToast("No text subtitles found in MKV.");
    }
  } catch (err) {
    console.error("Failed to extract MKV subtitles:", err);
  }
}

function showUnsupportedMessage() {
  showToast(
    "This video could not be played by the browser. The container or codec may be unsupported (common with some MKV files)."
  );
}

function loadVideo() {
  clearTimer();
  if (!source) {
    showToast("Missing source URL.");
    return;
  }

  showToast("Loading video...");
  video.src = source;
  video.load();

  if (source.toLowerCase().split('?')[0].endsWith(".mkv") && window.MKVSubtitleParser) {
    extractMKVSubtitles(source);
  }

  metadataTimer = setTimeout(() => {
    if (video.readyState < 1) {
      showUnsupportedMessage();
    }
  }, 5000);
}

video.addEventListener("loadedmetadata", () => {
  clearTimer();
  showToast("");
  durationEl.textContent = formatTime(video.duration);
  syncProgress();
  updatePlayButton();
  video.play().catch(() => {
    showToast("Press play to start the video.");
    updatePlayButton();
  });
});

video.addEventListener("error", () => {
  clearTimer();
  showUnsupportedMessage();
});

video.addEventListener("timeupdate", syncProgress);
video.addEventListener("play", updatePlayButton);
video.addEventListener("pause", updatePlayButton);
video.addEventListener("volumechange", () => {
  volumeBar.value = String(video.muted ? 0 : video.volume);
  if (!video.muted) {
    saveVolume(video.volume);
  }
  updateMuteButton();
});

playPauseBtn.addEventListener("click", () => {
  togglePlayback();
});

seekBar.addEventListener("input", () => {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return;
  }
  const percent = Number(seekBar.value) / 100;
  video.currentTime = percent * video.duration;
});

seekBar.addEventListener("mousemove", (event) => {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return;
  }
  const seekRect = seekBar.getBoundingClientRect();
  const shellRect = video.getBoundingClientRect();
  const ratio = getSeekRatioFromClientX(event.clientX);
  const timeAtPointer = ratio * video.duration;
  seekTooltip.textContent = formatTime(timeAtPointer);
  seekTooltip.classList.add("visible");

  const padding = 48;
  const minLeft = shellRect.left + padding;
  const maxLeft = shellRect.right - padding;
  const clampedX = Math.min(maxLeft, Math.max(minLeft, event.clientX));
  seekTooltip.style.left = `${clampedX - shellRect.left}px`;
});

seekBar.addEventListener("click", (event) => {
  event.preventDefault();
  seekFromClientX(event.clientX);
});

seekBar.addEventListener("mouseleave", () => {
  seekTooltip.classList.remove("visible");
});

muteBtn.addEventListener("click", () => {
  video.muted = !video.muted;
  updateMuteButton();
});

speedBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  speedMenu.classList.toggle("visible");
});

speedOptions.forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const speed = parseFloat(btn.dataset.speed);
    video.playbackRate = speed;
    // speedBtn.textContent = btn.textContent;
    
    speedOptions.forEach(opt => opt.classList.remove("active"));
    btn.classList.add("active");
    speedMenu.classList.remove("visible");
    showToast(`Speed: ${btn.textContent}`);
  });
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".speed-container")) {
    speedMenu.classList.remove("visible");
  }
});

volumeBar.addEventListener("input", () => {
  const nextVolume = Number(volumeBar.value);
  video.volume = nextVolume;
  video.muted = nextVolume === 0;
  saveVolume(nextVolume);
  updateMuteButton();
});

fullscreenBtn.addEventListener("click", async () => {
  await toggleFullscreen();
});

hoverToggleBtn.addEventListener("click", () => {
  togglePlayback();
});

video.addEventListener("click", () => {
  togglePlayback();
});

playerShell.addEventListener("mouseenter", () => {
  showHoverUiTemporarily();
});

playerShell.addEventListener("mousemove", () => {
  showHoverUiTemporarily();
});

playerShell.addEventListener("mouseleave", () => {
  hideHoverUi();
});

document.addEventListener("keydown", (event) => {
  if (!video.src) {
    return;
  }

  const activeTag = document.activeElement?.tagName?.toLowerCase();
  if (activeTag === "input" || activeTag === "textarea") {
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    const targetTime = video.currentTime + 10;
    video.currentTime = Number.isFinite(video.duration)
      ? Math.min(video.duration, targetTime)
      : targetTime;
    showToast(`+10s (${formatTime(video.currentTime)})`);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    video.currentTime = Math.max(0, video.currentTime - 10);
    showToast(`-10s (${formatTime(video.currentTime)})`);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    video.volume = Math.min(1, Number((video.volume + 0.05).toFixed(2)));
    if (video.muted && video.volume > 0) {
      video.muted = false;
    }
    showToast(`Volume ${Math.round(video.volume * 100)}%`);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    video.volume = Math.max(0, Number((video.volume - 0.05).toFixed(2)));
    showToast(`Volume ${Math.round(video.volume * 100)}%`);
  } else if (event.key === " ") {
    event.preventDefault();
    togglePlayback();
  } else if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleFullscreen().catch(() => {});
  } else if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    video.muted = !video.muted;
    updateMuteButton();
  }
});

updatePlayButton();
updateMuteButton();
const initialVolume = getSavedVolume();
video.volume = initialVolume;
video.muted = initialVolume === 0;
volumeBar.value = String(initialVolume);
currentTimeEl.textContent = "00:00";
durationEl.textContent = "00:00";
fileNameOverlay.textContent = getFileName(source);
loadVideo();
