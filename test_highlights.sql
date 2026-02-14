-- Run this in Supabase SQL Editor to check if highlights are being saved

-- 1. Check if any highlights exist
SELECT COUNT(*) as total_highlights FROM public.highlights;

-- 2. View all highlights with details
SELECT 
    id,
    text,
    color,
    position,
    created_at,
    book_id,
    user_id
FROM public.highlights
ORDER BY created_at DESC
LIMIT 10;

-- 3. If you want to manually delete all highlights for testing:
-- DELETE FROM public.highlights;
