// Snapfile — service worker. Injects the region selector, captures, and saves to Downloads.

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
    "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds())
  );
}

async function startCapture(tab) {
  if (!tab || !tab.id) return;
  // Can't inject into chrome://, the Web Store, or other restricted pages.
  if (/^(chrome|edge|about|chrome-extension):|^https?:\/\/chromewebstore\.google\.com/.test(tab.url || "")) {
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (e) {
    console.warn("Snapfile: cannot run on this page —", e.message);
  }
}

chrome.action.onClicked.addListener((tab) => startCapture(tab));

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-region") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  startCapture(tab);
});

// One-time onboarding right after install: explains the Chrome "ask where to
// save" setting that controls whether saves are instant.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: "welcome.html" });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "capture") {
    const windowId = sender.tab ? sender.tab.windowId : undefined;
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // async response
  }

  if (msg.type === "download") {
    // Drop straight to Downloads — never force a dialog. Whether Chrome shows
    // its own "Save as" prompt is governed by the user's global download
    // setting (see the onboarding page).
    const filename = "snapfile-" + ts() + ".png";
    chrome.downloads.download({ url: msg.dataUrl, filename, saveAs: false }, (downloadId) => {
      const err = chrome.runtime.lastError;
      sendResponse({ ok: !err && downloadId != null, error: err && err.message, downloadId });
    });
    return true; // async response
  }

  if (msg.type === "showFile") {
    if (typeof msg.downloadId === "number") {
      try { chrome.downloads.show(msg.downloadId); } catch (e) {}
    }
    return; // fire-and-forget
  }

  if (msg.type === "openImage") {
    // resolve the real path now — by click time the download has finished.
    // `return true` + sendResponse keeps the worker alive until the async
    // search resolves (otherwise the SW may be evicted before the tab opens).
    if (typeof msg.downloadId === "number") {
      chrome.downloads.search({ id: msg.downloadId }, (items) => {
        const p = items && items[0] && items[0].filename;
        if (p) {
          // encodeURI leaves '#' and '?' unescaped — escape them so paths
          // containing those characters resolve to the right file
          const url = "file:///" +
            encodeURI(p.replace(/\\/g, "/")).replace(/#/g, "%23").replace(/\?/g, "%3F");
          chrome.tabs.create({ url });
        }
        sendResponse({ ok: !!p });
      });
      return true; // keep SW alive for the async search
    }
    return;
  }
});
