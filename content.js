// Snapfile — area selector. Default: drag → release → file (one gesture).
// Optional "refine" mode (resize handles + Save button) is opt-in via settings.
(function () {
  if (window.__snapfileActive) return;
  window.__snapfileActive = true;

  const dpr = window.devicePixelRatio || 1;
  const Z = "2147483647";
  let mode = "idle"; // idle -> drawing -> [editing -> (resizing|moving) -> editing]
  let editMode = false; // refine before saving? read from storage below
  let x = 0, y = 0, w = 0, h = 0;
  let startX = 0, startY = 0;
  let resizeWhich = null;
  let dragStart = null;
  let destroyed = false; // set on cleanup; guards stale listeners/async callbacks
  let capturing = false; // guards against a double capture

  // Safe messaging. After the extension is reloaded/updated, an already-injected
  // content script is orphaned and sendMessage throws "Extension context
  // invalidated". Swallow that (and bail) instead of crashing the page.
  function send(msg, cb) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) return;
      chrome.runtime.sendMessage(msg, cb);
    } catch (e) {
      /* orphaned content script — extension was reloaded; nothing to do */
    }
  }

  // --- elements ---
  const overlay = document.createElement("div");
  // Transparent click-catcher. The dimming of everything *outside* the
  // selection comes from sel's huge box-shadow, so the selected region
  // itself shows true colors (accurate preview).
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:" + Z + ";cursor:crosshair;background:transparent;";

  const sel = document.createElement("div");
  sel.style.cssText =
    "position:fixed;display:none;z-index:" + Z + ";box-sizing:border-box;" +
    "border:1.5px solid #2b8cff;cursor:move;" +
    "box-shadow:0 0 0 100000px rgba(0,0,0,0.45);";

  const hint = document.createElement("div");
  hint.textContent = "Drag to capture · Esc to cancel";
  hint.style.cssText =
    "position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#111;color:#fff;" +
    "font:13px/1.2 system-ui,sans-serif;padding:6px 12px;border-radius:6px;z-index:" + Z +
    ";pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.3);";

  // live WxH readout shown while drawing/resizing
  const sizeTag = document.createElement("div");
  sizeTag.style.cssText =
    "position:fixed;display:none;z-index:" + Z + ";pointer-events:none;background:#111;color:#fff;" +
    "font:600 12px/1 ui-monospace,Consolas,monospace;padding:4px 7px;border-radius:5px;" +
    "box-shadow:0 2px 8px rgba(0,0,0,.3);";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.style.cssText =
    "position:fixed;display:none;z-index:" + Z + ";pointer-events:auto;cursor:pointer;" +
    "background:#2b8cff;color:#fff;border:none;border-radius:6px;padding:7px 16px;" +
    "font:600 13px/1 system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.35);";

  // 8 resize handles
  const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const CURSORS = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };
  const handleEls = {};
  HANDLES.forEach((k) => {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;display:none;z-index:" + Z + ";width:11px;height:11px;" +
      "background:#fff;border:1.5px solid #2b8cff;border-radius:2px;box-sizing:border-box;" +
      "pointer-events:auto;cursor:" + CURSORS[k] + ";";
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      resizeWhich = k;
      mode = "resizing";
      dragStart = { mx: e.clientX, my: e.clientY, x, y, w, h };
    });
    handleEls[k] = el;
  });

  const root = document.documentElement;
  root.appendChild(overlay);
  root.appendChild(sel);
  root.appendChild(hint);
  root.appendChild(sizeTag);
  HANDLES.forEach((k) => root.appendChild(handleEls[k]));
  root.appendChild(saveBtn);

  // Refine mode is opt-in. Default = instant capture on mouse-release.
  // storage.get resolves long before the user finishes a drag, so editMode
  // is set in time for the mouseup decision below.
  try {
    chrome.storage.sync.get({ editMode: false }, (c) => {
      if (chrome.runtime.lastError) return; // orphaned during the async read
      editMode = !!c.editMode;
      if (editMode) hint.textContent = "Drag to select";
    });
  } catch (e) {
    /* orphaned content script — keep the instant default */
  }

  // --- render positions ---
  function render() {
    sel.style.left = x + "px";
    sel.style.top = y + "px";
    sel.style.width = w + "px";
    sel.style.height = h + "px";
    sel.style.display = "block";

    const pos = {
      nw: [x, y], n: [x + w / 2, y], ne: [x + w, y],
      e: [x + w, y + h / 2], se: [x + w, y + h],
      s: [x + w / 2, y + h], sw: [x, y + h], w: [x, y + h / 2],
    };
    const editing = mode === "editing" || mode === "resizing" || mode === "moving";
    HANDLES.forEach((k) => {
      const el = handleEls[k];
      el.style.display = editing ? "block" : "none";
      el.style.left = pos[k][0] - 5.5 + "px";
      el.style.top = pos[k][1] - 5.5 + "px";
    });

    if (editing && w > 1 && h > 1) {
      saveBtn.style.display = "block";
      // anchor near the bottom-right corner of the selection
      const bw = saveBtn.offsetWidth || 64;
      const bh = saveBtn.offsetHeight || 32;
      let bx = x + w - bw;  // right edge aligns with the selection's right edge
      let by = y + h + 10;  // just below the selection (clears the SE handle)
      if (by + bh > window.innerHeight - 4) by = Math.max(y - bh - 10, 4); // flip above if no room
      bx = Math.max(4, Math.min(bx, window.innerWidth - bw - 4));
      saveBtn.style.left = bx + "px";
      saveBtn.style.top = by + "px";
    } else {
      saveBtn.style.display = "none";
    }

    // live size readout (above the top-left corner, flips inside if no room)
    if ((mode === "drawing" || editing) && w > 1 && h > 1) {
      sizeTag.style.display = "block";
      sizeTag.textContent = Math.round(w) + " × " + Math.round(h);
      let ty = y - 24;
      if (ty < 4) ty = y + 4;
      sizeTag.style.left = Math.max(4, x) + "px";
      sizeTag.style.top = ty + "px";
    } else {
      sizeTag.style.display = "none";
    }
  }

  // --- interactions ---
  overlay.addEventListener("mousedown", (e) => {
    mode = "drawing";
    startX = e.clientX;
    startY = e.clientY;
    x = startX; y = startY; w = 0; h = 0;
    overlay.style.cursor = "crosshair";
    render();
  });

  // move whole selection by dragging inside it
  sel.addEventListener("mousedown", (e) => {
    if (mode !== "editing") return;
    e.preventDefault();
    e.stopPropagation();
    mode = "moving";
    dragStart = { mx: e.clientX, my: e.clientY, x, y, w, h };
  });

  function onMove(e) {
    if (destroyed) return;
    if (mode === "drawing") {
      x = Math.min(e.clientX, startX);
      y = Math.min(e.clientY, startY);
      w = Math.abs(e.clientX - startX);
      h = Math.abs(e.clientY - startY);
      render();
    } else if (mode === "resizing") {
      const dx = e.clientX - dragStart.mx, dy = e.clientY - dragStart.my;
      let L = dragStart.x, T = dragStart.y, R = dragStart.x + dragStart.w, B = dragStart.y + dragStart.h;
      if (resizeWhich.includes("w")) L = dragStart.x + dx;
      if (resizeWhich.includes("e")) R = dragStart.x + dragStart.w + dx;
      if (resizeWhich.includes("n")) T = dragStart.y + dy;
      if (resizeWhich.includes("s")) B = dragStart.y + dragStart.h + dy;
      x = Math.min(L, R); y = Math.min(T, B); w = Math.abs(R - L); h = Math.abs(B - T);
      render();
    } else if (mode === "moving") {
      const dx = e.clientX - dragStart.mx, dy = e.clientY - dragStart.my;
      x = dragStart.x + dx; y = dragStart.y + dy;
      render();
    }
  }
  document.addEventListener("mousemove", onMove, true);

  function onUp() {
    if (destroyed) return;
    if (mode === "drawing") {
      if (w < 3 || h < 3) { cleanup(); return; }
      if (!editMode) {
        mode = "done"; // freeze immediately so the box stops following the cursor
        doCapture(); // default one-gesture path: commit on release
        return;
      }
      mode = "editing";
      overlay.style.cursor = "default";
      hint.textContent = "Resize · drag to move · Save / Enter · Esc to cancel";
      render();
    } else if (mode === "resizing" || mode === "moving") {
      mode = "editing";
      render();
    }
  }
  document.addEventListener("mouseup", onUp, true);

  saveBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); doCapture(); });

  function onKey(e) {
    if (destroyed) return;
    if (e.key === "Escape") { e.preventDefault(); cleanup(); }
    else if (e.key === "Enter" && mode === "editing") { e.preventDefault(); doCapture(); }
  }
  document.addEventListener("keydown", onKey, true);

  // --- capture flash for feedback (shown AFTER capture, so it isn't in the shot) ---
  function flash(fx, fy, fw, fh) {
    const f = document.createElement("div");
    f.setAttribute("data-snapfile-flash", "1");
    f.style.cssText =
      "position:fixed;z-index:" + Z + ";pointer-events:none;background:#fff;" +
      "left:" + fx + "px;top:" + fy + "px;width:" + fw + "px;height:" + fh + "px;";
    root.appendChild(f);
    const anim = f.animate(
      [{ opacity: 0.85 }, { opacity: 0 }],
      { duration: 340, easing: "ease-out" }
    );
    anim.onfinish = () => f.remove();
  }

  // --- "Saved" toast, shown AFTER capture (independent of cleanup).
  // Actions resolve lazily by downloadId in the background (the file path is
  // reliably available by the time the user clicks). ---
  function toast(text, downloadId) {
    // keep only one toast on screen — drop any previous one so they don't stack
    document.querySelectorAll("[data-snapfile-toast]").forEach((el) => el.remove());
    const clickable = typeof downloadId === "number";
    const t = document.createElement("div");
    t.setAttribute("data-snapfile-toast", "1");
    t.style.cssText =
      "position:fixed;left:50%;bottom:24px;z-index:" + Z + ";display:flex;align-items:center;gap:14px;" +
      "background:#111;color:#fff;font:13px/1.2 system-ui,sans-serif;padding:9px 14px;" +
      "border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.35);" +
      (clickable ? "pointer-events:auto;" : "pointer-events:none;");

    const label = document.createElement("span");
    label.textContent = text;
    t.appendChild(label);

    function mkLink(txt, fn) {
      const a = document.createElement("span");
      a.textContent = txt;
      a.style.cssText = "color:#6ab7ff;text-decoration:underline;white-space:nowrap;font-weight:600;cursor:pointer;";
      a.addEventListener("mouseenter", () => (a.style.color = "#9fd0ff"));
      a.addEventListener("mouseleave", () => (a.style.color = "#6ab7ff"));
      a.addEventListener("click", () => { fn(); t.remove(); });
      t.appendChild(a);
    }

    if (clickable) {
      mkLink("📂 Open folder", () => send({ type: "showFile", downloadId }));
      mkLink("🖼 Open image", () => send({ type: "openImage", downloadId }));
    }
    root.appendChild(t);
    t.animate(
      [{ opacity: 0, transform: "translate(-50%,8px)" }, { opacity: 1, transform: "translate(-50%,0)" }],
      { duration: 160, easing: "ease-out", fill: "forwards" }
    );
    setTimeout(() => {
      const out = t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-in", fill: "forwards" });
      out.onfinish = () => t.remove();
    }, 3500);
  }

  function doCapture() {
    if (destroyed || capturing) return;
    capturing = true;
    const cx = x, cy = y, cw = w, ch = h;
    // hide all UI so it isn't captured
    overlay.style.display = "none";
    sel.style.display = "none";
    hint.style.display = "none";
    sizeTag.style.display = "none";
    saveBtn.style.display = "none";
    HANDLES.forEach((k) => (handleEls[k].style.display = "none"));
    // also drop any toast/flash left over from a previous capture — otherwise
    // it gets baked into this screenshot (e.g. rapid successive captures)
    document.querySelectorAll("[data-snapfile-toast],[data-snapfile-flash]").forEach((el) => el.remove());

    // safety net: if no response ever arrives (orphaned context / dead worker),
    // tear down instead of leaving the page wedged with the UI hidden
    const watchdog = setTimeout(() => { if (!destroyed) cleanup(); }, 5000);

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        send({ type: "capture" }, (resp) => {
          if (destroyed) { clearTimeout(watchdog); return; } // cancelled via Esc
          if (!resp || resp.error) {
            console.warn("Snapfile capture failed:", resp && resp.error);
            clearTimeout(watchdog);
            toast("Capture failed");
            cleanup();
            return;
          }
          const img = new Image();
          img.onload = () => {
            if (destroyed) { clearTimeout(watchdog); return; } // cancelled mid-decode
            // Derive the real device-pixel scale from the captured image
            // itself. captureVisibleTab returns the viewport at physical
            // resolution, so image width / CSS viewport width is the exact
            // ratio — robust to HiDPI, OS display scaling and page zoom,
            // unlike a devicePixelRatio sampled once at injection time.
            const scale = img.naturalWidth / window.innerWidth || dpr;

            // Clamp the selection to the viewport so a region dragged
            // partly off-screen never produces blank/garbage edges.
            const vw = window.innerWidth, vh = window.innerHeight;
            const rx = Math.max(0, Math.min(cx, vw));
            const ry = Math.max(0, Math.min(cy, vh));
            const rw = Math.max(1, Math.min(cw, vw - rx));
            const rh = Math.max(1, Math.min(ch, vh - ry));

            const sw = Math.round(rw * scale);
            const sh = Math.round(rh * scale);
            const canvas = document.createElement("canvas");
            canvas.width = sw;
            canvas.height = sh;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(
              img,
              Math.round(rx * scale), Math.round(ry * scale), sw, sh,
              0, 0, sw, sh
            );
            const cropped = canvas.toDataURL("image/png");
            flash(rx, ry, rw, rh); // visual confirmation
            send({ type: "download", dataUrl: cropped }, (resp) => {
              clearTimeout(watchdog);
              if (destroyed) return;
              if (resp && resp.ok) {
                toast("Saved to Downloads", resp.downloadId);
              } else {
                toast("Save failed");
              }
              setTimeout(cleanup, 360); // let the flash finish
            });
          };
          img.onerror = () => { clearTimeout(watchdog); cleanup(); };
          img.src = resp.dataUrl;
        });
      })
    );
  }

  function cleanup() {
    destroyed = true;
    overlay.remove();
    sel.remove();
    hint.remove();
    sizeTag.remove();
    saveBtn.remove();
    HANDLES.forEach((k) => handleEls[k].remove());
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("mouseup", onUp, true);
    document.removeEventListener("keydown", onKey, true);
    window.__snapfileActive = false;
  }
})();
