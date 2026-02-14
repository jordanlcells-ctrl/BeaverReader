-- Create table_of_contents table
CREATE TABLE IF NOT EXISTS table_of_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  page INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_toc_book_id ON table_of_contents(book_id);
CREATE INDEX IF NOT EXISTS idx_toc_order_index ON table_of_contents(order_index);

-- Enable Row Level Security
ALTER TABLE table_of_contents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view TOC for their books" ON table_of_contents;
DROP POLICY IF EXISTS "Users can create TOC for their books" ON table_of_contents;
DROP POLICY IF EXISTS "Users can update TOC for their books" ON table_of_contents;
DROP POLICY IF EXISTS "Users can delete TOC for their books" ON table_of_contents;

-- RLS Policies (TOC is tied to books, so we check book ownership)
CREATE POLICY "Users can view TOC for their books"
  ON table_of_contents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM books 
      WHERE books.id = table_of_contents.book_id 
      AND books.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create TOC for their books"
  ON table_of_contents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM books 
      WHERE books.id = table_of_contents.book_id 
      AND books.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update TOC for their books"
  ON table_of_contents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM books 
      WHERE books.id = table_of_contents.book_id 
      AND books.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete TOC for their books"
  ON table_of_contents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM books 
      WHERE books.id = table_of_contents.book_id 
      AND books.user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE table_of_contents IS 'Stores table of contents for books';
COMMENT ON COLUMN table_of_contents.level IS 'Hierarchical level: 0=chapter, 1=section, 2=subsection';
COMMENT ON COLUMN table_of_contents.order_index IS 'Order in which items appear in the book';
