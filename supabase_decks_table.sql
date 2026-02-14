-- Create decks table
CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);

-- Create index on parent_deck_id for subdeck queries
CREATE INDEX IF NOT EXISTS idx_decks_parent_deck_id ON decks(parent_deck_id);

-- Enable Row Level Security
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own decks" ON decks;
DROP POLICY IF EXISTS "Users can create their own decks" ON decks;
DROP POLICY IF EXISTS "Users can update their own decks" ON decks;
DROP POLICY IF EXISTS "Users can delete their own decks" ON decks;

-- RLS Policies
CREATE POLICY "Users can view their own decks"
  ON decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own decks"
  ON decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks"
  ON decks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks"
  ON decks FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_decks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS update_decks_updated_at_trigger ON decks;

-- Create trigger for updated_at
CREATE TRIGGER update_decks_updated_at_trigger
  BEFORE UPDATE ON decks
  FOR EACH ROW
  EXECUTE FUNCTION update_decks_updated_at();
