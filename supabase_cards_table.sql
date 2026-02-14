-- Create cards table
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  highlight_id UUID REFERENCES highlights(id) ON DELETE SET NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  context TEXT,
  card_type TEXT NOT NULL CHECK (card_type IN ('definition', 'translation', 'grammar', 'custom')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_highlight_id ON cards(highlight_id);

-- Enable Row Level Security
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own cards" ON cards;
DROP POLICY IF EXISTS "Users can create their own cards" ON cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON cards;

-- RLS Policies
CREATE POLICY "Users can view their own cards"
  ON cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cards"
  ON cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards"
  ON cards FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS update_cards_updated_at_trigger ON cards;

-- Create trigger for updated_at
CREATE TRIGGER update_cards_updated_at_trigger
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION update_cards_updated_at();
