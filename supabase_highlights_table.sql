-- Create highlights table
CREATE TABLE IF NOT EXISTS public.highlights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    context TEXT,
    position JSONB NOT NULL,
    color TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own highlights"
    ON public.highlights FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own highlights"
    ON public.highlights FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights"
    ON public.highlights FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
    ON public.highlights FOR DELETE
    USING (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS highlights_book_id_idx ON public.highlights(book_id);
CREATE INDEX IF NOT EXISTS highlights_user_id_idx ON public.highlights(user_id);
CREATE INDEX IF NOT EXISTS highlights_created_at_idx ON public.highlights(created_at DESC);
