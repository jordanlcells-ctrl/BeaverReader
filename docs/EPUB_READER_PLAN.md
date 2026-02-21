# EPUB Reader – Review & Rebuild Plan

## 1. Current State (Review)

### What exists and works
- **Navigation**: Tapping an EPUB book on Home opens `BookReader` → `EPUBReaderScreen` (placeholder).
- **Book model**: `Book` has `file_type: 'epub' | 'pdf'`, `file_path`, `current_position` (generic object). DB and `bookService` already support EPUB.
- **File picker**: Android `FilePickerModule` copies picked file to `getFilesDir()/books/<timestamp>_<name>.epub` and returns `path` (absolute), `name`, `uri`, `type: 'epub'`.
- **Highlights**: `highlightService` is format-agnostic; `position` is `Record<string, any>` (PDF uses `page`, EPUB would use `cfi`).
- **TextActionSheet**: Shared component; takes `position` (e.g. `{page}` or `{cfi}`), `onHighlightAdded`, `onHighlightDeleted`, `isClickedHighlight`, etc. No EPUB-specific logic.
- **PDF reader pattern**: Loads book by path → reads file with RNFS (base64) → injects into WebView via `source={{ html: getPdfReaderHtml(), baseUrl: 'https://localhost' }}` and `window.pdfBase64Data` + `initReaderWithData()`. Position = `{ page, mode }`; saves to AsyncStorage + `bookService.updateBook(..., current_position)`.

### What was removed (old EPUB reader)
- Inline HTML reader (`epubReaderHtml.ts`) and asset `epub-reader.html`.
- WebView + epub.js, base64 vs file://, CFI position, highlights in WebView, tap-to-open menu, PanResponder vs overlay, etc.

### Constraints and decisions to make
- **Android**: File is at a real path (e.g. `/data/user/0/.../files/books/xxx.epub`). WebView can load `file://` if the reader page is also file:// (e.g. asset), or we pass content another way (e.g. base64 → blob in one origin).
- **iOS**: No native file picker in the snippet; if you add one later, path or security-scoped URL may differ. Plan should allow “load by path” or “load by base64” so both platforms can share the same reader UI.
- **Position**: EPUB standard is CFI (e.g. `epubcfi(/6/16!/4/2/1:942)`). Store `current_position: { cfi, timestamp }` and persist via `bookService.updateBook`.
- **Highlights**: Store `position: { cfi }` (and optionally `cfiRange`) for EPUB; reuse `highlightService` and `TextActionSheet`; reader must render highlights and support “tap highlight → open options”.
- **Single source of truth for reader UI**: Prefer **one** reader implementation (e.g. one HTML bundle) so we don’t maintain asset + inline and avoid the old bugs (touch handling, init order, etc.).

---

## 2. Rebuild Plan (Phased)

### Phase 1 – Minimal read-only reader (no highlights, no actions)
**Goal**: Open an EPUB and turn pages. Position saved so we can resume.

1. **Reader content (HTML + JS)**  
   - **One** reader implementation only:
     - **Option A**: Inline HTML in a new `src/utils/epubReaderHtml.ts` (like PDF), loaded with `source={{ html: getEpubReaderHtml(), baseUrl: 'https://localhost' }}`. No asset file.
     - **Option B**: Single asset file (e.g. `epub-reader.html`) and use it on Android only if you need file:// for the book; otherwise prefer Option A for consistency.
   - Use **epub.js** from CDN (or bundle it later). One entry point, e.g. `window.initEpubReader(bookUrlOrBlobUrl)`.
   - **Book loading**:  
     - **Android**: Prefer passing a **file URL** if the reader page can load it (same origin or allowed). If not, read file with RNFS as base64, create blob URL in the WebView, pass that to epub.js.  
     - **iOS**: Likely base64 → blob URL (or future security-scoped URL).  
   - **No gestures from RN**: Let the WebView own all touch (no PanResponder on the reader area). Use in-page UI or epub.js nav (e.g. next/prev) so taps and swipes are handled inside the WebView.
   - **Messages to RN**:  
     - `ready` when the reader script and epub.js are loaded.  
     - `locationChanged` with `{ cfi, percentage }` so the app can show progress and save position.  
     - `error` with message on failure.
   - **Position**: On `locationChanged`, call `bookService.updateBook(bookId, { current_position: { cfi, timestamp } })`. On init, pass saved `current_position.cfi` into the reader so it opens at that CFI.

2. **EPUBReaderScreen (React Native)**  
   - Load book by `bookId` (existing `bookService.getBooks()`).
   - Show loading until book + reader ready.
   - WebView: `source={{ html: getEpubReaderHtml(), baseUrl: '...' }}` (or asset URL if Option B), no overlay.
   - On `ready`, inject book (file URL or base64) and saved CFI; reader calls `initEpubReader(...)`.
   - On `locationChanged`, update local state and `bookService.updateBook(..., current_position)`.
   - Header: back button, title, optional progress %. No swipe-to-turn in RN – keep that inside the WebView if needed.

3. **Acceptance**: Open EPUB → see first page; next/prev works; leave and re-open → resume at saved position.

---

### Phase 2 – Text selection and action sheet (Define / Translate / Ask / Highlight / Copy)
**Goal**: Select text → bottom sheet with actions (same UX as PDF).

1. **Reader HTML**  
   - Ensure the iframe or body that shows the book allows **text selection** (no `user-select: none` on the content).
   - Use epub.js `rendition.on('selected', (cfiRange, contents) => ...)` to get selected text and CFI.
   - On selection (or on a single “selection done” event, e.g. mouseup/touchend in the content), post to RN: `{ type: 'textSelected', text, cfi }`.

2. **EPUBReaderScreen**  
   - On `textSelected`, set `selectedText`, `selectedCfi`, open `TextActionSheet` (same as PDF).
   - Pass `position={{ cfi: selectedCfi }}` so highlights and cards can store CFI.
   - **Highlight (save)**: When user picks a color, call `highlightService.createHighlight(bookId, text, context, { cfi }, color)` then tell the reader to **draw** the highlight (see Phase 3).

3. **Define / Translate / Ask / Copy**  
   - Use existing services; no change to TextActionSheet contract. Only the `position` shape differs (cfi instead of page).

4. **Acceptance**: Select text → action sheet opens; Define, Translate, Ask, Copy work; Highlight saves to DB with `position: { cfi }`.

---

### Phase 3 – Highlights in the book (show and tap)
**Goal**: Persisted highlights appear in the reader; tapping one opens the same action sheet (e.g. change color, delete).

1. **Restore highlights on load**  
   - After the book is displayed, call `highlightService.getHighlightsByBook(bookId)`.
   - Send to reader: e.g. `{ command: 'restoreHighlights', highlights: [{ id, cfi, text, color }] }`.
   - Reader uses epub.js annotations (or equivalent) to render each CFI range with the given color.

2. **Apply new highlight in reader**  
   - When user chooses a color in TextActionSheet, send `{ command: 'addHighlight', cfi, color }`; reader adds the annotation and stores mapping (cfi → id/color) for later tap.

3. **Tap on existing highlight**  
   - **Inside the WebView**: Use epub.js annotation **click callback** (if available) or a single **delegated** listener on the reader document (e.g. on the iframe’s document) that:
     - On tap, finds the element under the pointer (e.g. `elementFromPoint`), walks up to find a highlight marker, reads a `data-cfi` or similar.
     - Sends to RN: `{ type: 'highlightClicked', cfi, text, color, dbId }`.
   - **No RN overlay blocking the WebView**: So that touch events reliably reach the reader. Swipe-to-turn can be handled inside the reader (epub.js) or with a lightweight RN gesture that only captures clear swipes (e.g. move > 30px) so taps still go to the WebView.
   - **EPUBReaderScreen**: On `highlightClicked`, set `clickedHighlightCfi`, `clickedHighlightDbId`, etc., and open TextActionSheet in “highlight options” mode (reuse existing `isClickedHighlight` / `highlightComplete`).

4. **Change color / Delete**  
   - Commands to reader: `updateHighlightColor(cfi, color)`, `removeHighlight(cfi)`.  
   - App: `highlightService.deleteHighlight(dbId)` and/or update; reader removes/updates the annotation.

5. **Acceptance**: Highlights show in book; tap highlight → action sheet; change color and delete work.

---

### Phase 4 – Polish and parity
**Goal**: Match PDF reader where it makes sense (menu, progress, bookmarks if you have them for PDF).

- **Tap to show/hide UI** (back, menu, progress): Implement **inside the reader HTML** (e.g. tap on content area toggles a toolbar) and/or send a simple `readerTap` message to RN to toggle overlay buttons, **without** capturing all touches in RN (so selection and highlight tap still work).
- **Progress**: Use `locationChanged.percentage` for a progress bar or “X% read”.
- **Optional**: Table of contents, bookmarks, theme (font size, background) – same pattern as PDF if you already have them.

---

## 3. Technical Decisions (Summary)

| Topic | Recommendation |
|------|----------------|
| **Reader HTML** | Single implementation: inline in `epubReaderHtml.ts` with `source={{ html, baseUrl }}` (like PDF). Avoid maintaining both asset and inline. |
| **Loading the book** | Android: try file URL first if reader is same-origin; else base64 → blob. iOS: base64 → blob. Prefer one code path (blob) for both if it’s simpler. |
| **Touch** | No full-screen overlay or “capture all” PanResponder over the WebView. Let the WebView receive taps; handle swipe (if needed) only when movement is large so taps and selection still work. |
| **Position** | `current_position: { cfi, timestamp }`; save on `locationChanged`; restore on init. |
| **Highlights** | Store `position: { cfi }`; restore via command; draw with epub.js annotations; tap via delegated listener + `data-cfi` or equivalent. |
| **TextActionSheet** | Reuse as-is; pass `position: { cfi }` for EPUB. |

---

## 4. File Checklist (New / Touched)

- **New**: `src/utils/epubReaderHtml.ts` – single HTML/JS reader (epub.js, init, locationChanged, textSelected, highlight commands, tap handling).
- **Replace**: `src/screens/EPUBReaderScreen.tsx` – load book, WebView, message handlers (ready, locationChanged, textSelected, highlightClicked, error), TextActionSheet, position save/restore.
- **Unchanged**: `bookService`, `highlightService`, `TextActionSheet`, types, navigation, file picker, HomeScreen (already navigates to BookReader for EPUB).

---

## 5. Order of Implementation

1. Phase 1 (read-only + position) – get one EPUB opening and resuming.
2. Phase 2 (selection + action sheet) – get Define/Translate/Highlight/Ask/Copy.
3. Phase 3 (highlights in book + tap) – get visual highlights and highlight options.
4. Phase 4 (polish) – tap-to-show UI, progress, etc.

This keeps each phase testable and avoids re-introducing the old touch/overlay/init-order issues by design.
