# PLAN. BeaverReader (React Native)
MVP Spec + Spaced Learning Rules + Build-by-Parts Workflow

Project root (Windows):
E:\FOR FUN APPS\BeaverReader5

This file is the single source of truth for the MVP build.

The app is built using VANILLA React Native CLI (NO EXPO) with TypeScript.

---

## A) RULES FOR AI (Cursor / Assistant)

1. Always reference and follow this plan file when making implementation decisions.
2. Stay within scope. Do not add features, refactors, or architecture outside this plan unless explicitly requested.
3. Work only inside: E:\FOR FUN APPS\BeaverReader5 unless asked otherwise.
4. Build in parts. Implement only the current part.
5. Do not jump ahead. Complete one part, then stop.
6. At the end of each part:
   - Summarize what was completed
   - Provide exact Android testing steps
   - List files added or changed
   - Ask: "Move to Part X?" and wait

---

## B) PRODUCT GOAL

Android-first app where users upload EPUB or PDF files, read and highlight text, view definitions and translations (EN ⇄ ES), optionally ask AI grammar questions, and save highlights as flashcards organized into decks and subdecks.

---

## C) SPACED LEARNING RULES

- Active recall
- Immediate feedback
- Atomic cards
- Workload control

Scheduling:
- Know: archived
- Easy: +7 days
- Medium: +2 days
- Hard: +1 day

---

## D) MVP FEATURE SET

- EPUB + PDF reading
- Highlighting
- Define / Translate / Grammar
- Decks and subdecks
- Flashcards
- Reviews

---

## E) TECH STACK

- React Native CLI
- TypeScript
- Android-first
- Supabase
- React Navigation (native-stack)
- WebView + epub.js
- WebView + pdf.js
- AsyncStorage
- react-native-keychain
- react-native-fs
- react-native-document-picker
- react-native-config
- react-native-gesture-handler
- react-native-reanimated

---

## F) EXTERNAL APIS

**Dictionary API:**
- Free Dictionary API (https://dictionaryapi.dev/)
- Fallback: Merriam-Webster API (free tier)

**Translation API:**
- LibreTranslate (self-hosted or public instance)
- Fallback: Google Translate API (paid)

**AI Grammar API:**
- OpenAI GPT-4 (paid, cost-controlled with limits)
- User can optionally add their own API key

**Note:** API keys stored securely in react-native-keychain

---

## G) SUPABASE SCHEMA

### Tables

**users**
- id (uuid, pk)
- email (text, unique)
- created_at (timestamp)
- updated_at (timestamp)

**books**
- id (uuid, pk)
- user_id (uuid, fk → users)
- title (text)
- author (text, nullable)
- file_path (text) - local storage path
- file_type (text) - 'epub' | 'pdf'
- cover_url (text, nullable)
- current_position (jsonb) - reader position/page
- created_at (timestamp)
- updated_at (timestamp)

**decks**
- id (uuid, pk)
- user_id (uuid, fk → users)
- parent_deck_id (uuid, nullable, fk → decks) - for subdecks
- name (text)
- description (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)

**highlights**
- id (uuid, pk)
- book_id (uuid, fk → books)
- user_id (uuid, fk → users)
- text (text)
- context (text) - surrounding text
- position (jsonb) - location in book
- color (text)
- note (text, nullable)
- created_at (timestamp)

**cards**
- id (uuid, pk)
- deck_id (uuid, fk → decks)
- user_id (uuid, fk → users)
- highlight_id (uuid, nullable, fk → highlights)
- front (text)
- back (text)
- context (text, nullable)
- card_type (text) - 'definition' | 'translation' | 'grammar' | 'custom'
- created_at (timestamp)
- updated_at (timestamp)

**reviews**
- id (uuid, pk)
- card_id (uuid, fk → cards)
- user_id (uuid, fk → users)
- rating (text) - 'know' | 'easy' | 'medium' | 'hard'
- next_review_date (date)
- reviewed_at (timestamp)

### Row Level Security (RLS)

All tables have RLS enabled:
- Users can only access their own data
- Policies enforce user_id matching auth.uid()

---

## H) ANDROID TESTING

**Supported:**
- Android Studio Emulator (API 28+)
- Physical Android device via USB debugging

**Minimum Requirements:**
- Android API Level 28 (Android 9.0)
- Target API Level 34 (Android 14)

**Run:**
```
npx react-native run-android
```

**Testing Strategy:**
- Manual testing after each part
- Test on both emulator and physical device before moving to next part
- Verify offline functionality (AsyncStorage)
- Test with real EPUB and PDF files

---

## I) ERROR HANDLING & OFFLINE MODE

**Offline Support:**
- Books stored locally via react-native-fs
- Highlights cached in AsyncStorage, synced when online
- Queue failed API requests for retry
- Show offline indicator in UI

**Error States:**
- Network errors: show retry button
- File loading errors: show error message with troubleshooting
- API failures: graceful fallback (e.g., "Translation unavailable")
- Invalid files: clear error messages

**Loading States:**
- Show skeleton screens during data fetch
- Loading spinners for actions (upload, save, etc.)
- Progress indicators for file operations

---

## J) BUILD PARTS

### Part 0: Tooling sanity check
**Goal:** Verify development environment
- Node.js v18+ installed
- JDK 17 installed
- Android Studio installed
- Android SDK (API 28+) installed
- Environment variables set (ANDROID_HOME, JAVA_HOME)
- Able to run `npx react-native doctor`
- Emulator or device available

### Part 1: Project setup
**Goal:** Initialize React Native project with all dependencies
- Create new React Native project with TypeScript
- Install all dependencies from tech stack
- Configure Android build.gradle files
- Set up folder structure (screens, components, services, types)
- Configure Supabase client
- Test: App launches with "Hello World"

### Part 2: Authentication
**Goal:** Supabase email/password auth
- Auth screens (Login, Signup, Forgot Password)
- Supabase auth integration
- Secure token storage with react-native-keychain
- Auth context/provider
- Protected navigation
- Test: User can sign up, log in, log out

### Part 3: Book upload
**Goal:** Select and store EPUB/PDF files locally
- Home screen with "Add Book" button
- react-native-document-picker for file selection
- Save file to app directory with react-native-fs
- Extract metadata (title, author, cover if available)
- Save book record to Supabase
- Display books in library list
- Test: Upload EPUB and PDF, see them in library

### Part 4: EPUB reader
**Goal:** Read EPUB files with epub.js in WebView
- EPUB reader screen
- WebView with epub.js integration
- Text selection for highlighting
- Page navigation (prev/next, slider)
- Save reading position
- Highlight text (visual only, no actions yet)
- Test: Open EPUB, read, navigate, select text

### Part 5: PDF reader
**Goal:** Read PDF files with pdf.js in WebView
- PDF reader screen
- WebView with pdf.js integration
- Text selection for highlighting
- Page navigation
- Save reading position
- Highlight text (visual only)
- Test: Open PDF, read, navigate, select text

### Part 6: Bottom sheet actions
**Goal:** Define, Translate, Grammar actions on selected text
- Bottom sheet with action buttons
- "Define" → fetch definition from Dictionary API
- "Translate" (EN → ES, ES → EN) → fetch translation
- "Ask AI" → grammar question to OpenAI
- "Add to Deck" button (deck selector)
- Save highlight with action result
- Test: Select text, define, translate, ask grammar, save to deck

### Part 7: Deck system
**Goal:** Create and manage decks and subdecks
- Decks screen (list of decks)
- Create deck modal
- Create subdeck (nest under parent)
- Edit/delete decks
- CRUD operations with Supabase
- Test: Create deck, create subdeck, edit, delete

### Part 8: Card management
**Goal:** View and edit cards in decks
- Deck detail screen (list of cards in deck)
- Card preview (front/back/context)
- Edit card modal
- Delete card
- Create manual card (not from highlight)
- Test: View cards, edit, delete, create custom card

### Part 9: Review flow
**Goal:** Spaced repetition review system
- Review screen
- Fetch due cards (next_review_date <= today)
- Show card front → flip → show back
- Rating buttons (Know, Easy, Medium, Hard)
- Calculate next review date based on rating
- Save review to Supabase
- Show completion screen
- Test: Review cards, rate them, verify next review dates

### Part 10: Settings and polish
**Goal:** Final touches and user preferences
- Settings screen
- API key management (optional user OpenAI key)
- About screen
- App icon and splash screen
- Handle edge cases and error states
- Performance optimization
- Final testing pass
- Test: End-to-end user flow

---

## K) OUT OF SCOPE

Audio, analytics, gamification, advanced SRS, themes, sharing, social features, web/iOS versions.

---

## L) SUCCESS CRITERIA

MVP is complete when a user can:
1. Sign up and log in
2. Upload an EPUB or PDF
3. Read and highlight text
4. Get definitions, translations, and grammar help
5. Save highlights as flashcards in organized decks
6. Review flashcards with spaced repetition
7. Track learning progress over time

---

## M) USER STORIES

### Reading
- As a language learner, I want to upload books in EPUB or PDF format
- As a reader, I want to highlight text so I can save important passages
- As a reader, I want to see definitions of words I don't understand
- As a bilingual reader, I want to translate between English and Spanish

### Learning
- As a learner, I want to convert highlights into flashcards automatically
- As a learner, I want to organize cards into decks by topic or book
- As a learner, I want to review cards with spaced repetition
- As a learner, I want to rate my recall so the app schedules reviews appropriately

### Organization
- As a user, I want to create subdecks to organize cards hierarchically
- As a user, I want to edit or delete cards that aren't useful
- As a user, I want to see how many cards are due for review today

---

## N) NEXT STEPS

1. Run Part 0: Tooling sanity check
2. Wait for confirmation before proceeding to Part 1
