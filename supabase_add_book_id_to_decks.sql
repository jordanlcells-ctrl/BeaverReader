-- Add book_id column to decks table
ALTER TABLE decks 
ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE CASCADE;

-- Create index on book_id for faster queries
CREATE INDEX IF NOT EXISTS idx_decks_book_id ON decks(book_id);

-- Update the existing table comment
COMMENT ON COLUMN decks.book_id IS 'Links deck to a specific book (null for manual decks)';
