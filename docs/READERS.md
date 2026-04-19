# WebView readers (PDF + EPUB)

Two separate HTML bundles run inside `react-native-webview`. They share **no** runtime code. Cross-regressions usually come from editing the wrong file, skipping the build pipeline, or shipping an old APK asset.

## Files

| Reader | Source of truth | Bundled asset (Android) |
|--------|-----------------|-------------------------|
| PDF | `src/utils/pdfReaderHtml.ts` | `android/app/src/main/assets/pdf-reader.html` (generated) |
| EPUB | `android/app/src/main/assets/epub-reader.html` | same path (hand-edited; not generated from TS) |

Supporting scripts: `scripts/generate-pdf-template.js`, `scripts/copy-epub-assets.js` (embeds PDF.js into the PDF HTML).

## Always run after changing reader code

```bash
npm run build:readers
```

This runs PDF generation, EPUB/PDF.js copy/embed, and writes **`readers-build.json`** next to the assets (timestamp + short SHA prefixes) so you can confirm which bundle is on disk. That file is **gitignored** (local stamp only); inspect it after a local build or pull it from an installed APK when debugging.

`postinstall` and `preandroid` also invoke this pipeline so local installs and `npm run android` stay in sync.

## Rules of thumb

1. **PDF-only changes** → edit `pdfReaderHtml.ts`, then `npm run build:readers`. Do not “fix PDF” inside `epub-reader.html`.
2. **EPUB-only changes** → edit `epub-reader.html` only; run `npm run build:readers` anyway (refreshes `readers-build.json` and keeps PDF pipeline consistent).
3. Avoid copy-pasting large CSS/JS blocks between the two HTML files; if you need shared helpers, extract a tiny shared snippet and document it in both places or a single shared partial (future work).
4. Prefer **scoped** CSS (`html.epub-reflow …`, reader-specific IDs) over global `!important` rules that hit both readers.

## Verify before merging

- Open a **PDF**: canvas mode + text mode, swipe/page, optional highlight/deck if you touched selection.
- Open an **EPUB**: chapter load, swipe/page, Android should use **reflow** (`reflowMode=true` in Metro logs).
- If a bug report says “fix didn’t apply”: check **`readers-build.json`** in the APK path (or `adb shell run-as …`) and compare `sha256Prefix` to a fresh `npm run build:readers` run.

## CI / PRs

Use the pull request checklist (`.github/pull_request_template.md`) when touching reader assets or `pdfReaderHtml.ts`.
