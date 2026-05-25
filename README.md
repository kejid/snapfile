# Snapfile — area screenshot straight to file

Activate → select an area → PNG lands in Downloads instantly. No editor, no preview, no extra clicks. One gesture.

This is a build-first MVP of a friction-removal angle (see the `gold_prospector` scouting log): the pain isn't validated by research (nobody googles or complains about "the extra step"), so we validate by building and shipping, then watching the reaction.

## Install (load unpacked, ~1 minute)

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. **Load unpacked** → pick the `D:\Projects\snapfile` folder
4. Done. The Snapfile icon appears in the toolbar.

## How to use

By default — **one gesture**:

- Click the Snapfile icon **or** press `Alt+Shift+S`
- Drag to select an area
- Release → the PNG **immediately** drops into `Downloads/snapfile-<timestamp>.png`
- `Esc` cancels

### Refine mode (opt-in, off by default)

Turn on **Refine before saving** in options to change the flow: after selecting, you can adjust the area (handles to resize, middle to move) and commit with the **Save** button or `Enter`. It's an "accuracy at the cost of one extra click" trade-off for those who want it. The clean one-job path stays the default.

Change the shortcut at `chrome://extensions/shortcuts`.

## Making it truly "instant"

Snapfile never forces a save dialog (`saveAs:false`). But Chrome has a **global** setting that asks where to save *every* download — if it's on, you'll get a "Save as" window on every capture.

For instant saving: `chrome://settings/downloads` → turn off **"Ask where to save each file before downloading"**.

The extension cannot change this setting (Chrome exposes no API — a safeguard against silent auto-downloads). So on first install an onboarding page (`welcome.html`) opens, explaining it with a button that opens the right Chrome settings. Reopen it anytime via the extension's **Options**.

## MVP limitations

- Capture is limited to the visible tab area (viewport).
- Doesn't work on restricted pages: `chrome://`, the Web Store, extension pages (Chrome limitation).
- No editor/annotations — by design (that's the whole point).

## What to measure after launch (demand validation)

Since research shows no clear demand, we watch the reaction:
- A post in `r/chrome` / `r/productivity`: "made a screenshot extension that just drops the selected area to a file, no editor — useful?"
- Installs and retention from the Chrome Web Store.
- Comments: do people complain about "extra steps" in other tools = confirmation of the pain.

## Future features (only if demand is confirmed)

Don't bloat now. Candidates, driven by reaction:

- **Burst / keep-open mode** — top candidate. After a capture the overlay doesn't close but resets for the next selection; `Esc` exits. Implemented as an onboarding option (in the download callback, call `reset()` instead of `cleanup()`). Add it if feedback (r/chrome, Store reviews) asks for "many shots in a row".
- Copy to clipboard AND to a file at the same time.
- Format (jpg/webp), remembering the last area, filename templates.

Folder picking is deliberately **not** included: it's covered by Chrome's global setting (downloads location / ask-where), and the onboarding points users to it.
