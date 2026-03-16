-- Add optional anchor column for EPUB TOC (enables jumping to specific heading within a section)
ALTER TABLE table_of_contents ADD COLUMN IF NOT EXISTS anchor TEXT;
