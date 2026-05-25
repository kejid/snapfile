// Snapfile onboarding. The only thing we can't do for the user is flip Chrome's
// global download prompt — so we just open the settings page for them.
document.getElementById("openSettings").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://settings/downloads" });
});

document.getElementById("openShortcuts").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// Capture mode toggle: refine-before-saving (default off = instant).
const editBox = document.getElementById("editMode");
const status = document.getElementById("status");
chrome.storage.sync.get({ editMode: false }, (c) => {
  editBox.checked = !!c.editMode;
});
editBox.addEventListener("change", () => {
  chrome.storage.sync.set({ editMode: editBox.checked }, () => {
    status.textContent = "Saved";
    setTimeout(() => (status.textContent = ""), 1200);
  });
});
