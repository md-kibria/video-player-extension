const SETTINGS_KEY = "settings";
const RECENT_KEY = "recentIntercepts";
const DEFAULT_EXTENSIONS = ["mkv", "mp4", "webm", "mov", "avi", "flv", "m4v", "ts", "3gp", "wmv", "mpeg", "mpg", "m2ts"];

const enabledInput = document.getElementById("enabled");
const extInput = document.getElementById("extInput");
const saveBtn = document.getElementById("saveBtn");
const recentList = document.getElementById("recentList");
const statusEl = document.getElementById("status");

function setStatus(text) {
  statusEl.textContent = text;
}

function normalizeExtensions(raw) {
  const parsed = raw
    .split(",")
    .map((ext) => ext.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
  return parsed.length ? [...new Set(parsed)] : DEFAULT_EXTENSIONS;
}

/* THIS FUNCTION IS FROM PLAYER.JS */
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

async function loadSettings() {
  const result = await chrome.storage.local.get([SETTINGS_KEY, RECENT_KEY]);
  const settings = result[SETTINGS_KEY] || {};
  const recent = Array.isArray(result[RECENT_KEY]) ? result[RECENT_KEY] : [];

  enabledInput.checked = settings.enabled !== false;
  extInput.value = Array.isArray(settings.allowedExtensions) && settings.allowedExtensions.length
    ? settings.allowedExtensions.join(",")
    : DEFAULT_EXTENSIONS.join(",");

  recentList.innerHTML = "";
  if (!recent.length) {
    const li = document.createElement("li");
    li.textContent = "No intercepted links yet.";
    recentList.appendChild(li);
    return;
  }

  for (const item of recent) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.url || String(item);
    a.target = "_blank";
    a.textContent = getFileName(item.url || String(item));
    li.appendChild(a);
    recentList.appendChild(li);
  }
}

saveBtn.addEventListener("click", async () => {
  const payload = {
    enabled: enabledInput.checked,
    allowedExtensions: normalizeExtensions(extInput.value)
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: payload });
  setStatus("Saved.");
  setTimeout(() => setStatus(""), 1200);
});

loadSettings().catch((error) => {
  console.error(error);
  setStatus("Failed to load settings.");
});
