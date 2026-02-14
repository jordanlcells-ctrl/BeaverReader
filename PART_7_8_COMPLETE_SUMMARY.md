# Part 7 & 8: Deck & Card System - Complete Implementation

## Overview
Implemented a complete deck and flashcard system with automatic book-to-deck linking and manual deck creation.

## The System Architecture

### 1. Two Types of Decks

**Book Decks (Automatic):**
- Auto-created when a book is uploaded
- Named after the book title
- Linked to book via `book_id`
- Used to save highlights/translations from reading
- Can have subdecks for organization

**Manual Decks (User-Created):**
- Created by user in Decks screen
- Not linked to any book (`book_id = null`)
- For general flashcards not from books
- Can have subdecks

### 2. Card Creation Flow

**From Book Reading:**
1. Read book → Highlight text
2. Tap "Translate" or "Define"
3. See result → Tap "Highlight" (saves highlight)
4. Tap "Save Card"
5. See book's deck + subdecks
6. Select deck/subdeck
7. Card auto-created with:
   - **Front** = Text from book (language you're learning)
   - **Back** = Translation/Definition (language you know)
   - **Context** = Surrounding text
   - **Type** = Auto-detected (definition, translation, grammar)

**Manual Creation:**
1. Go to Decks → Tap deck → "+ Add Card"
2. Fill in Front, Back, Context
3. Choose card type
4. Save

## Database Schema

### Updated `decks` Table
```sql
- id (UUID)
- user_id (UUID)
- parent_deck_id (UUID, nullable) -- For subdecks
- book_id (UUID, nullable) -- Links to book (null for manual decks)
- name (TEXT)
- description (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### `cards` Table
```sql
- id (UUID)
- deck_id (UUID)
- user_id (UUID)
- highlight_id (UUID, nullable) -- Links to highlight if from book
- front (TEXT) -- Question/Word
- back (TEXT) -- Answer/Translation
- context (TEXT) -- Where it came from
- card_type (TEXT) -- 'definition' | 'translation' | 'grammar' | 'custom'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## Files Created/Modified

### New Files:
1. **SQL Scripts:**
   - `supabase_decks_table.sql` - Original decks table
   - `supabase_add_book_id_to_decks.sql` - Add book_id column
   - `supabase_cards_table.sql` - Cards table

2. **Services:**
   - `src/services/deckService.ts` - Full deck CRUD
   - `src/services/cardService.ts` - Full card CRUD

3. **Screens:**
   - `src/screens/DecksScreen.tsx` - Manual decks list
   - `src/screens/DeckDetailScreen.tsx` - View deck's subdecks & cards

4. **Components:**
   - `src/components/CreateDeckModal.tsx` - Create/edit decks
   - `src/components/CreateCardModal.tsx` - Create manual cards
   - `src/components/EditCardModal.tsx` - Edit existing cards
   - `src/components/CardItem.tsx` - Flashcard preview with flip

### Modified Files:
- `src/services/bookService.ts` - Auto-create deck on upload
- `src/components/TextActionSheet.tsx` - "Save Card" with deck selector
- `src/screens/HomeScreen.tsx` - "📚 Decks" button
- `src/screens/PDFReaderScreen.tsx` - Pass bookTitle
- `src/screens/EPUBReaderScreen.tsx` - Pass bookTitle
- `src/navigation/AppNavigator.tsx` - Deck routes

## Key Features

### Auto Book-to-Deck Linking ✅
- Upload book → Deck auto-created
- Deck named after book
- All cards from that book saved to its deck
- Organized with subdecks

### Smart Card Creation ✅
- **Translation Cards:**
  - Front = Original text (book language)
  - Back = Translation (your language)
- **Definition Cards:**
  - Front = Word
  - Back = Definition
- **Grammar Cards:**
  - Front = Text/Question
  - Back = AI explanation

### Hierarchical Organization ✅
- Book Deck → Subdecks → Cards
- Manual Deck → Subdecks → Cards
- Unlimited nesting depth
- Visual hierarchy with icons (📚 📁 🃏)

### Card Management ✅
- Tap to flip (front ↔ back)
- Color-coded by type
- Context display
- Edit any card
- Delete cards
- Card count badges

## Testing Instructions

### Step 1: Run SQL Scripts (In Order!)
```sql
-- 1. Run if you haven't already
supabase_decks_table.sql

-- 2. Add book_id column
supabase_add_book_id_to_decks.sql

-- 3. Create cards table
supabase_cards_table.sql
```

### Step 2: Test Book → Deck Flow
1. **Upload a new book** (to test auto-deck creation)
2. **Open the book** and read
3. **Select text** → Tap "Translate"
4. See translation → **Tap color to highlight**
5. **Tap "Save Card"**
6. See book's deck displayed
7. Tap main deck to save
8. Card created! ✅

### Step 3: Verify Card in Deck
1. Go to **📚 Decks** from home
2. Should see "Manual Decks" screen
3. Go back → Open your **book again**
4. Tap **📚 icon** in reader menu
5. You'll see book's deck with card! (Coming: direct book deck access)

### Step 4: Create Subdeck for Organization
1. In book deck, tap **"+ Add Subdeck"**
2. Name it (e.g., "Chapter 1 Vocabulary")
3. Now when you save cards, you can choose the subdeck!

### Step 5: Test Manual Decks
1. Go to Decks screen
2. Create a manual deck (not linked to book)
3. Add cards manually
4. Create subdecks

## Card Types & Colors

- 📖 **Definition** (Green) - Word definitions
- 🌐 **Translation** (Blue) - Language translations
- ✏️ **Grammar** (Orange) - Grammar explanations
- 💭 **Custom** (Purple) - User-created cards

## User Experience Highlights

### Reading Experience:
1. Select text
2. Get instant translation/definition
3. One-tap save to flashcard
4. Continue reading!

### Organization:
- Book → Main Deck (auto)
- Add subdecks as needed (e.g., by chapter)
- Manual decks for non-book content
- Clear visual hierarchy

### Card Display:
- Interactive flip animation
- Clean typography
- Context reference
- Quick edit/delete

## What's Next: Part 9

**Review Flow (Spaced Repetition):**
- Due cards system
- Flashcard review interface
- Rating buttons (Know, Easy, Medium, Hard)
- Scheduling algorithm
- Progress tracking

---

**Status:** Parts 7 & 8 Complete ✅  
**Ready for:** Part 9 - Review Flow & Spaced Repetition
