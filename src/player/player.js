const params = new URLSearchParams(window.location.search);
const source = params.get("src");
const video = document.getElementById("video");
const toastEl = document.getElementById("toast");
const playPauseBtn = document.getElementById("playPauseBtn");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const seekBar = document.getElementById("seekBar");
const muteBtn = document.getElementById("muteBtn");
const volumeBar = document.getElementById("volumeBar");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const hoverToggleBtn = document.getElementById("hoverToggleBtn");
const fileNameOverlay = document.getElementById("fileNameOverlay");
const seekTooltip = document.getElementById("seekTooltip");
const VOLUME_STORAGE_KEY = "videoPopupPlayerVolume";

let metadataTimer = null;
let toastTimer = null;

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
