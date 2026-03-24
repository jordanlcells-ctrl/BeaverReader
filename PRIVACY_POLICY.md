# Privacy Policy — BeaverReader

**Last updated: February 2026**

## 1. Who We Are
BeaverReader ("the App", "we", "us") is a reading and flashcard application for Android. This policy explains what data we collect, how we use it, and your rights.

## 2. Data We Collect

| Data | Why | Stored Where |
|---|---|---|
| Email address | Account creation and sign-in | Supabase (cloud) |
| Password (hashed) | Authentication | Supabase Auth — never stored in plain text |
| Book files (EPUB/PDF) | Reading within the app | Supabase Storage, tied to your account |
| Reading position | Resuming where you left off | Supabase Database |
| Highlights & bookmarks | Your annotations | Supabase Database |
| Flashcard decks & cards | Spaced-repetition study | Supabase Database |
| App preferences (theme, font size) | Personalisation | Device only (AsyncStorage) |
| AI usage count | Monthly/daily usage cap | Supabase Database |

We do **not** collect: location, contacts, camera, microphone, device identifiers, or advertising IDs.

## 3. How We Use Your Data
- **Authentication** — to sign you in and keep your session secure.
- **Sync** — to make your books, highlights, decks, and reading progress available across sessions.
- **AI features** — when you use Define, Translate, or Ask AI, the selected text is sent to our backend (Supabase Edge Function) which calls the Mistral AI API. We do not store this text beyond the API call.
- **Usage limits** — we track AI request counts per user to enforce fair-use caps.

## 4. Third-Party Services

| Service | Purpose | Policy |
|---|---|---|
| Supabase | Database, Auth, Storage, Edge Functions | https://supabase.com/privacy |
| Mistral AI | AI definitions, translation, Q&A | https://mistral.ai/privacy |

We do not use advertising networks, analytics SDKs, or crash-reporting SDKs.

## 5. Data Retention
Your data is kept for as long as your account is active. When you delete your account (Settings → Delete Account), all your data — books, highlights, bookmarks, flashcards, and your auth account — is permanently deleted within seconds.

## 6. Data Security
All data is transmitted over HTTPS/TLS. Passwords are hashed by Supabase Auth (bcrypt). Book files are stored in a private Supabase Storage bucket accessible only to your account.

## 7. Your Rights
You have the right to:
- **Access** your data — contact us and we will provide an export.
- **Delete** your data — use **Settings → Delete Account** in the app, or contact us.
- **Correct** your data — contact us.

## 8. Children
BeaverReader is not directed at children under 13. We do not knowingly collect data from children under 13.

## 9. Changes to This Policy
We may update this policy. We will notify you by updating the "Last updated" date above. Continued use of the app after changes constitutes acceptance.

## 10. Contact
For privacy questions or data requests, contact us at:
**[YOUR SUPPORT EMAIL HERE]**

---
*This policy applies to the BeaverReader Android application.*
