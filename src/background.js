const VIDEO_EXTENSIONS = [
  "mkv",
  "mp4",
  "webm",
  "mov",
  "avi",
  "flv",
  "m4v",
  "ts",
  "3gp",
  "wmv",
  "mpeg",
  "mpg",
  "m2ts"
];

const RECENT_KEY = "recentIntercepts";
const SETTINGS_KEY = "settings";
const MAX_RECENT = 15;
const DEDUPE_WINDOW_MS = 1500;
const lastHandledByTab = new Map();

const defaultSettings = {
  enabled: true,
  allowedExtensions: VIDEO_EXTENSIONS
};

function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch (_) {
    return null;
  }
}

function getExtension(url) {
  const cleanPath = url.pathname.toLowerCase();
  const parts = cleanPath.split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1];
}

function isHttpUrl(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

function isVideoUrl(url, settings) {
  const extension = getExtension(url);
  return settings.allowedExtensions.includes(extension);
}

function shouldSkip(details, url) {
  if (details.frameId !== 0) {
    return true;
  }
  if (details.transitionQualifiers?.includes("forward_back")) {
    return true;
  }
  if (!isHttpUrl(url)) {
    return true;
  }
  if (url.protocol === "chrome-extension:") {
    return true;
  }
  return false;
}

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const existing = stored[SETTINGS_KEY] || {};
  return {
    ...defaultSettings,
    ...existing,
    allowedExtensions: Array.isArray(existing.allowedExtensions) && existing.allowedExtensions.length
      ? existing.allowedExtensions.map((ext) => String(ext).toLowerCase())
      : defaultSettings.allowedExtensions
  };
}

async function appendRecent(url) {
  const current = await chrome.storage.local.get(RECENT_KEY);
  const existing = Array.isArray(current[RECENT_KEY]) ? current[RECENT_KEY] : [];
  const now = new Date().toISOString();
  const updated = [
    { url, at: now },
    ...existing.filter((entry) => entry.url !== url)
  ].slice(0, MAX_RECENT);
  await chrome.storage.local.set({ [RECENT_KEY]: updated });
}

function isDuplicateForTab(tabId, url) {
  const now = Date.now();
  const previous = lastHandledByTab.get(tabId);
  if (!previous) {
    lastHandledByTab.set(tabId, { url, time: now });
    return false;
  }
  const duplicate = previous.url === url && now - previous.time < DEDUPE_WINDOW_MS;
  lastHandledByTab.set(tabId, { url, time: now });
  return duplicate;
}

async function routeToPlayer(details) {
  const url = parseUrl(details.url);
  if (!url || shouldSkip(details, url)) {
    return;
  }

  const settings = await getSettings();
  if (!settings.enabled || !isVideoUrl(url, settings)) {
    return;
  }

  if (isDuplicateForTab(details.tabId, details.url)) {
    return;
  }

  const playerUrl = chrome.runtime.getURL(`src/player/player.html?src=${encodeURIComponent(details.url)}`);
  await appendRecent(details.url);

  try {
    await chrome.tabs.update(details.tabId, { url: playerUrl });
  } catch (_) {
    await chrome.tabs.create({ url: playerUrl });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(SETTINGS_KEY);
  if (!current[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: defaultSettings });
  }
});

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    routeToPlayer(details).catch((error) => {
      console.error("Failed to route video link:", error);
    });
  },
  { url: [{ schemes: ["http", "https"] }] }
);
