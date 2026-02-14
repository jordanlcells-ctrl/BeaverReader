-- Create books table
CREATE TABLE IF NOT EXISTS public.books (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('epub', 'pdf')),
    cover_url TEXT,
    current_position JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own books"
    ON public.books FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books"
    ON public.books FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books"
    ON public.books FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books"
    ON public.books FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS books_user_id_idx ON public.books(user_id);
CREATE INDEX IF NOT EXISTS books_created_at_idx ON public.books(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.books
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
