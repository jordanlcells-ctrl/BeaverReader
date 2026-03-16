# BeaverReader – Settings Recommendations

After reviewing the app (EPUB/PDF reading, decks, highlights, Define/Translate/Ask via Mistral, review sessions), here are **settings that make sense**, ordered by impact and fit.

---

## 1. **Reading**

| Setting | Why | Current state |
|--------|-----|----------------|
| **EPUB text size** | Users expect to set “default” size once; now it’s per-session only. | EPUB reader has `setFontSize` in WebView but no app-level default or persistence. |
| **PDF default view** | So the preferred mode (text vs page) is visible without opening a book. | Already stored as `pdf_reader_mode` in AsyncStorage; only toggled inside PDF reader. |

**Suggestions:**  
- Add **“Default EPUB text size”** (e.g. Small / Medium / Large → 16 / 18 / 22px), persist in AsyncStorage, pass into EPUB reader on open so every book starts with that size.  
- Add **“Default PDF view”** in Settings: “Text view” vs “Page view”, and use it as the initial `pdf_reader_mode` when loading the PDF reader (you already load it in `PDFReaderScreen`).

---

## 2. **Appearance**

| Setting | Why | Current state |
|--------|-----|----------------|
| **App theme** | Reading at night; many users prefer dark. | App is light-only (e.g. `#F7F5F0`, `#F9F7F1`). |
| **Reader background (optional)** | Sepia/dark in EPUB/PDF reduces glare. | Not implemented; could be a later addition. |

**Suggestion:**  
- **Theme: Light / Dark / System** – One global choice, drive StatusBar and main screens (Home, Settings, list screens). Readers can stay light for now or follow theme in a second phase.

---

## 3. **Learning / language**

| Setting | Why | Current state |
|--------|-----|----------------|
| **“I’m learning” language** | Sets default direction for Translate/Define (e.g. Spanish ↔ English). | Currently inferred from selected text (e.g. Spanish indicators). |
| **Auto-show translation (optional)** | When selecting a word, show translation by default in the action sheet. | User must tap “Translate” every time. |

**Suggestion:**  
- **Primary language: Spanish / English / Auto** – “Auto” = current behavior. Spanish/English could pre-fill or prioritize that direction in the action sheet. Lower priority than Reading and Appearance.

---

## 4. **Data & privacy**

| Setting | Why | Current state |
|--------|-----|----------------|
| **Clear caches** | Frees space; resets “limit” feeling for definition/translation cache. | Mistral and dictionary caches in AsyncStorage; no UI to clear. |
| **Delete account** | Privacy / GDPR; some users expect it. | Only Sign out exists. |

**Suggestions:**  
- **“Clear definition & translation cache”** – Clear Mistral definition cache and dictionary cache keys; show a short confirmation.  
- **“Delete my account”** – Optional; would need Supabase auth + any user-data cleanup (highlights, decks, books metadata). Can be added later.

---

## 5. **Account (already in Settings tab)**

- **Sign out** – Keep.  
- **Email** – Keep (shows who is signed in).

---

## 6. **About & support**

| Setting | Why | Current state |
|--------|-----|----------------|
| **App version** | Support and bug reports. | “BeaverReader v1.0” is static. |
| **Privacy / Terms** | Expected for published apps. | Not present. |
| **Contact / feedback** | Low-friction way to get feedback. | Not present. |

**Suggestions:**  
- **About** – Keep; add **app version** from `Application.nativeApplicationVersion` (or equivalent) so it’s dynamic.  
- **Privacy policy** / **Terms of use** – Links if you have URLs.  
- **Send feedback** – `mailto:` or link to a form.

---

## 7. **Optional / later**

- **Review reminders** – “Remind me to review cards” (e.g. daily at 9:00). Requires notification permission and a small scheduler.  
- **Default deck** – When adding a card from a book, preselect this deck.  
- **Haptics** – Toggle for tap feedback if you add it.

---

## Suggested order on the Settings tab

1. **Reading** – Default EPUB text size, Default PDF view.  
2. **Appearance** – Theme (Light / Dark / System).  
3. **Data** – Clear caches.  
4. **Account** – Sign out, email (current).  
5. **About** – App name, version, tagline; Privacy / Terms / Feedback links if you have them.

This keeps the most impactful and expected options (reading defaults, theme, cache, account, about) in one place without clutter.
