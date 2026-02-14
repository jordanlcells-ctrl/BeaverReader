-- Add extracted_text column to books table
-- This will store the extracted text from PDFs for faster loading

ALTER TABLE public.books 
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.books.extracted_text IS 'Extracted text content from PDF files for Reader Mode';
