# Driving Gemini in the browser

Gemini web (user's Gemini Plus account) generates all art. It is driven through **Claude in Chrome** on the
user's Brave browser (`mcp__claude-in-chrome__*`). The user approved generating and saving sprite images; never
change browser settings yourself.

## If the extension is not connected
`list_connected_browsers` returns `[]` even while Brave is running when the extension's background is asleep:
ask the user to open Brave and click the Claude icon (side panel), then retry. You can open the chat in Brave
yourself (`Start-Process "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" <url>`), but
launching Brave does not wake the extension: the user still has to open the side panel. Fallback: the app's built-in
browser pane can open Gemini, but it is not signed in — the user must sign in to Google there themselves
(never type credentials for them); its chats are the same account, so the old chat URL then works.

## Session setup
- `tabs_context_mcp` (with `createIfEmpty: true` if the group is gone) → use a tab in the Claude group.
  Tabs outside the group cannot be targeted; old tab ids die between sessions.
- One chat per fighter (or effect set). Write the chat URL into memory/roster.md so it can be resumed.

## Sending a prompt
Preferred (fast, never froze the tab):
```js
const t = <prompt as a JSON string>;              // pj.py prints it
const ed = document.querySelector('rich-textarea .ql-editor');
const p = document.createElement('p'); p.textContent = t; ed.replaceChildren(p);
ed.dispatchEvent(new InputEvent('input', {bubbles: true}));
await new Promise(r => setTimeout(r, 1000));
document.querySelector('button[aria-label*="Send" i]').click();
```
Older method (`ed.focus(); document.execCommand('insertText', false, t)`) also works but can freeze the tab
for a minute on long prompts (see below).
Then `({q: document.querySelectorAll('user-query').length})` — the count must have gone up.
On a **brand-new chat** page the JS click on the send button often does nothing (the text stays in the box):
take a screenshot and click the round arrow button with a standalone `computer` click instead.
The tab can freeze for ~30–60 s right after `insertText` of a long prompt (the JS call times out, screenshots
fail with "page is busy"; a writing-assistant extension in the input box is the likely cause). Do NOT re-insert:
wait, then read `ql-editor.innerText.length` and the `user-query` count. If the text is still there, press
`Return` with `computer key` (it may take a few seconds to register) — the count goes up when it is sent.
If the tab stays frozen, reload the chat URL; a prompt that was already sent keeps generating server-side. If the extension
disconnected mid-call, check the count / editor text before re-sending (avoid double prompts).

## Waiting
Generation takes ~40–60 s. Use batches of `computer wait 10` × 3 (≤ 30 s per batch); longer batches tend to drop
the extension. A dimmed image is still rendering — copying it gives an empty clipboard.

## Copying the image (downloads are blocked after the first file)
1. Scroll the last response's image into view. The first lookup right after generation often reports width 0:
   run the lookup twice (scroll, then filter `img` with `getBoundingClientRect().width > 100`).
2. Hover the image centre, then read the rect of the **last visible** `button[aria-label="Copy image"]`.
3. **Scale CSS px to screenshot px:** the screenshot frame can differ from CSS pixels
   (e.g. frame 1568 wide vs `innerWidth` 1920). Multiply by `frameWidth / innerWidth` before clicking.
4. Click the button in a **standalone** `computer` call (a click inside `browser_batch` may return
   `permission_required`; a standalone call lets the user approve the site).
5. `scripts/clip.ps1 <manifest> <action>` saves the clipboard PNG (1024×559/572 for sheets, 1024×1024 portraits)
   into `raw/` and clears the clipboard.
**If the clipboard cannot be read** (clip.ps1 says "Requested Clipboard operation did not succeed"; Win32
`OpenClipboard` → error 5 access denied — happened after a session resume, even outside the sandbox): click
`button[aria-label="Download full size image"]` instead (same hover/scale steps), wait ~10 s, then
`scripts/dl.py <manifest> <action>`: it takes the newest Gemini download (2816 px wide), scales it to 1024 px
like the copy button, saves it to raw/ and deletes the download. Posting the image to a localhost receiver does
NOT work (Gemini's CSP blocks it), and `fetch(blob:)` is broken by an extension: use a canvas if ever needed.
If the copy button sits off-screen (tall portrait), scroll the image to the top and nudge the scroll container
up ~120 px. If a click opens Gemini's image editor, its toolbar copy button works too; press back afterwards.

## Most reliable path (2026-10-08): canvas save + paste into a new chat
- **Save:** in the page, define `window.__saveLast` and call it. It draws the last `model-response` image
  (naturalWidth ≥ 1000) to a canvas, then `toBlob`, then saves it with `<a download="Gemini_Generated_Image_canvas…">`.
  Then run `.claude/skills/vibe-fighter-dev/scripts/grab.ps1 <manifest> <action>`.
  - No hover, no button coordinates, and no "Downloading full size…" wait.
  - The image is 1024 px wide, the same as dl.py produces.
  - Brave must allow gemini.google.com to download multiple files. Only the user can grant that.
- **Reference into a new chat:**
  1. While in the chat that shows the reference, draw it to a canvas and keep the blob in `window`.
  2. Click the sidebar "New chat" link. It is an SPA navigation, so `window` survives.
  3. Run `dt = new DataTransfer(); dt.items.add(new File([blob], 'ref.png', {type: 'image/png'}))`.
  4. Dispatch `new ClipboardEvent('paste', {clipboardData: dt, bubbles: true})` on `rich-textarea .ql-editor`.
  5. The thumbnail appears in the input box. Send with Return; the JS click does not send on a fresh chat page.
- Clicking near the image's top edge can open Gemini's image editor. Its toolbar download button (top right)
  works; the back arrow returns to the chat.

## Known Gemini behaviours
- Returns 7–8 frames instead of 6, or 4+3 rows: fine with `autoSlice`.
- Mixes in poses from earlier sheets of the same chat: say so in the prompt; drop them with `dropFrames`.
- Ignores "faces LEFT": follow the reference's facing (`drawFacing`).
- Adds a small white ✦ watermark ~87 px from the bottom-right corner (1024 px images), sometimes over the art:
  `effect.py` fills it; for fighters it is usually on magenta and keyed away.
- Brand names (Thor, etc.) can be refused — describe the archetype.
- The image model behind the "Flash" picker has worked fine; no need to switch.
