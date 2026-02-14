-- Add spaced repetition fields to cards table
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS interval INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ease_factor DECIMAL(3,2) DEFAULT 2.50,
ADD COLUMN IF NOT EXISTS reviews INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lapses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_state TEXT DEFAULT 'new' CHECK (card_state IN ('new', 'learning', 'review', 'relearning')),
ADD COLUMN IF NOT EXISTS last_reviewed TIMESTAMP WITH TIME ZONE;

-- Create index on due_date for faster queries
CREATE INDEX IF NOT EXISTS idx_cards_due_date ON cards(due_date);
CREATE INDEX IF NOT EXISTS idx_cards_card_state ON cards(card_state);

-- Add comments
COMMENT ON COLUMN cards.due_date IS 'When the card is due for next review';
COMMENT ON COLUMN cards.interval IS 'Number of days until next review';
COMMENT ON COLUMN cards.ease_factor IS 'Ease factor for SM-2 algorithm (default 2.5)';
COMMENT ON COLUMN cards.reviews IS 'Total number of times this card has been reviewed';
COMMENT ON COLUMN cards.lapses IS 'Number of times card was forgotten (Again button)';
COMMENT ON COLUMN cards.card_state IS 'Current learning state: new, learning, review, relearning';
COMMENT ON COLUMN cards.last_reviewed IS 'Timestamp of last review';
