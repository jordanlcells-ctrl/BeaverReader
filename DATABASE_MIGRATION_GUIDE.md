# Database Migration: Add Extracted Text Storage for PDFs

## Overview
This migration adds persistent storage for extracted PDF text, eliminating the need to re-extract text every time a PDF is opened.

## What Changed

### 1. Database Schema
- Added `extracted_text` column to `books` table (type: TEXT)
- This stores the full extracted text from PDFs

### 2. TypeScript Types
- Updated `Book` interface to include `extracted_text?: string`

### 3. Book Service
- Updated `updateBook()` to allow updating `extracted_text` field

### 4. PDF Reader Logic
- **Before opening PDF:**
  1. Check `book.extracted_text` from database (fastest)
  2. If not found, check `pdfTextCache` in memory (fast)
  3. If not found, extract text from PDF (slow - only happens once)
  
- **After extracting text:**
  1. Save to memory cache for current session
  2. Save to database for future sessions
  
## Performance Improvements

| Scenario | Old Behavior | New Behavior |
|----------|-------------|--------------|
| **First open** | Extract text (~2-5s) | Extract text (~2-5s) |
| **Second open (same session)** | Extract text (~2-5s) | Use memory cache (instant) |
| **Second open (new session)** | Extract text (~2-5s) | Use database (instant) |
| **App restart** | Extract text (~2-5s) | Use database (instant) |

**Result:** Text extraction happens **only once ever** per PDF!

## How to Apply the Migration

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase_add_extracted_text.sql`
5. Click **Run** to execute the migration

### Option 2: Using Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push supabase_add_extracted_text.sql
```

### Option 3: Manual SQL
Execute this SQL command in your database:
```sql
ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

COMMENT ON COLUMN public.books.extracted_text IS 'Extracted text content from PDF files for Reader Mode';
```

## Verification

After applying the migration, you can verify it worked by:

1. **Check the column exists:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'books' 
   AND column_name = 'extracted_text';
   ```

2. **Check your app:**
   - Open a PDF in the app
   - Check console logs - you should see: `📝 Text cache: AVAILABLE (DATABASE)` on subsequent opens

## Troubleshooting

### Issue: Migration fails with "column already exists"
**Solution:** This is safe to ignore - it means the column was already added.

### Issue: Still seeing text extraction on every open
**Possible causes:**
1. Migration wasn't applied - check the database schema
2. Books opened before migration don't have extracted text yet - open them once to extract and save
3. Check console logs to see where text is coming from (DATABASE, MEMORY, or NONE)

### Issue: Database size concerns
**Note:** Extracted text can be large (50-500KB per book). For a 100-book library:
- Average: 10-20MB
- Maximum: ~50MB

This is usually acceptable. If storage is a concern, you can:
- Delete old extracted text: `UPDATE books SET extracted_text = NULL WHERE updated_at < '2024-01-01'`
- Use text compression (future enhancement)

## Files Modified

1. `supabase_add_extracted_text.sql` - Database migration
2. `src/types/index.ts` - Added `extracted_text` to Book interface
3. `src/services/bookService.ts` - Allow updating `extracted_text`
4. `src/screens/PDFReaderScreen.tsx` - Check database first, save after extraction

## Next Steps (Optional Enhancements)

- [ ] Add text compression to reduce storage size
- [ ] Add "Clear extracted text" option in settings to free up space
- [ ] Show extraction status in book list (extracted vs not extracted)
- [ ] Pre-extract text for all PDFs in background
