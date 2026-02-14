import {supabase} from './supabase';

export interface Card {
  id: string;
  deck_id: string;
  user_id: string;
  highlight_id: string | null;
  front: string;
  back: string;
  context: string | null;
  card_type: 'definition' | 'translation' | 'grammar' | 'custom';
  created_at: string;
  updated_at: string;
  // Spaced repetition fields
  due_date?: string;
  interval?: number;
  ease_factor?: number;
  reviews?: number;
  lapses?: number;
  card_state?: 'new' | 'learning' | 'review' | 'relearning';
  last_reviewed?: string;
}

export interface CreateCardInput {
  deck_id: string;
  front: string;
  back: string;
  context?: string;
  card_type: 'definition' | 'translation' | 'grammar' | 'custom';
  highlight_id?: string;
}

export interface UpdateCardInput {
  front?: string;
  back?: string;
  context?: string;
  card_type?: 'definition' | 'translation' | 'grammar' | 'custom';
}

export const cardService = {
  /**
   * Get all cards in a deck
   */
  async getCardsByDeck(deckId: string): Promise<Card[]> {
    try {
      console.log('🃏 Fetching cards for deck:', deckId);
      
      const {data, error} = await supabase
        .from('cards')
        .select('*')
        .eq('deck_id', deckId)
        .order('created_at', {ascending: false});

      if (error) {
        console.error('❌ Error fetching cards:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} cards`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch cards:', error);
      throw error;
    }
  },

  /**
   * Get a single card by ID
   */
  async getCard(cardId: string): Promise<Card | null> {
    try {
      console.log('🃏 Fetching card:', cardId);
      
      const {data, error} = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .single();

      if (error) {
        console.error('❌ Error fetching card:', error);
        throw error;
      }

      console.log('✅ Fetched card');
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch card:', error);
      throw error;
    }
  },

  /**
   * Get card count for a deck
   */
  async getCardCount(deckId: string): Promise<number> {
    try {
      const {count, error} = await supabase
        .from('cards')
        .select('*', {count: 'exact', head: true})
        .eq('deck_id', deckId);

      if (error) {
        console.error('❌ Error counting cards:', error);
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error('❌ Failed to count cards:', error);
      return 0;
    }
  },

  /**
   * Create a new card
   */
  async createCard(input: CreateCardInput): Promise<Card> {
    try {
      console.log('➕ Creating card in deck:', input.deck_id);
      
      const {data: {user}} = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const {data, error} = await supabase
        .from('cards')
        .insert({
          user_id: user.id,
          deck_id: input.deck_id,
          front: input.front,
          back: input.back,
          context: input.context || null,
          card_type: input.card_type,
          highlight_id: input.highlight_id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating card:', error);
        throw error;
      }

      console.log('✅ Card created:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Failed to create card:', error);
      throw error;
    }
  },

  /**
   * Update an existing card
   */
  async updateCard(cardId: string, input: UpdateCardInput): Promise<Card> {
    try {
      console.log('✏️ Updating card:', cardId);
      
      const updateData: any = {};
      if (input.front !== undefined) updateData.front = input.front;
      if (input.back !== undefined) updateData.back = input.back;
      if (input.context !== undefined) updateData.context = input.context;
      if (input.card_type !== undefined) updateData.card_type = input.card_type;

      const {data, error} = await supabase
        .from('cards')
        .update(updateData)
        .eq('id', cardId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating card:', error);
        throw error;
      }

      console.log('✅ Card updated');
      return data;
    } catch (error) {
      console.error('❌ Failed to update card:', error);
      throw error;
    }
  },

  /**
   * Delete a card
   */
  async deleteCard(cardId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting card:', cardId);
      
      const {error} = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId);

      if (error) {
        console.error('❌ Error deleting card:', error);
        throw error;
      }

      console.log('✅ Card deleted');
    } catch (error) {
      console.error('❌ Failed to delete card:', error);
      throw error;
    }
  },

  /**
   * Create card from highlight with definition
   */
  async createCardFromDefinition(
    deckId: string,
    highlightId: string,
    word: string,
    definition: string,
    context?: string
  ): Promise<Card> {
    return this.createCard({
      deck_id: deckId,
      front: word,
      back: definition,
      context: context,
      card_type: 'definition',
      highlight_id: highlightId,
    });
  },

  /**
   * Create card from highlight with translation
   */
  async createCardFromTranslation(
    deckId: string,
    highlightId: string,
    originalText: string,
    translatedText: string,
    context?: string
  ): Promise<Card> {
    return this.createCard({
      deck_id: deckId,
      front: originalText,
      back: translatedText,
      context: context,
      card_type: 'translation',
      highlight_id: highlightId,
    });
  },

  /**
   * Create card from highlight with grammar explanation
   */
  async createCardFromGrammar(
    deckId: string,
    highlightId: string,
    text: string,
    explanation: string,
    context?: string
  ): Promise<Card> {
    return this.createCard({
      deck_id: deckId,
      front: text,
      back: explanation,
      context: context,
      card_type: 'grammar',
      highlight_id: highlightId,
    });
  },

  /**
   * Get due cards for a deck
   */
  async getDueCards(deckId: string): Promise<Card[]> {
    try {
      console.log('⏰ Fetching due cards for deck:', deckId);
      
      const now = new Date().toISOString();
      
      const {data, error} = await supabase
        .from('cards')
        .select('*')
        .eq('deck_id', deckId)
        .lte('due_date', now)
        .order('due_date', {ascending: true});

      if (error) {
        console.error('❌ Error fetching due cards:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} due cards`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch due cards:', error);
      throw error;
    }
  },

  /**
   * Get count of due cards for a deck
   */
  async getDueCardCount(deckId: string): Promise<number> {
    try {
      const now = new Date().toISOString();
      
      const {count, error} = await supabase
        .from('cards')
        .select('*', {count: 'exact', head: true})
        .eq('deck_id', deckId)
        .lte('due_date', now);

      if (error) {
        console.error('❌ Error counting due cards:', error);
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error('❌ Failed to count due cards:', error);
      return 0;
    }
  },

  /**
   * Update card after review
   */
  async updateCardReview(
    cardId: string,
    interval: number,
    easeFactor: number,
    dueDate: Date,
    cardState: 'new' | 'learning' | 'review' | 'relearning',
    quality: 0 | 1 | 2 | 3
  ): Promise<Card> {
    try {
      console.log('📝 Updating card review:', cardId);
      
      // First, get current card to increment reviews and lapses
      const {data: currentCard, error: fetchError} = await supabase
        .from('cards')
        .select('reviews, lapses')
        .eq('id', cardId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching current card:', fetchError);
        throw fetchError;
      }

      const newReviews = (currentCard?.reviews || 0) + 1;
      const newLapses = quality === 0 ? (currentCard?.lapses || 0) + 1 : (currentCard?.lapses || 0);

      // Now update the card
      const {data, error} = await supabase
        .from('cards')
        .update({
          interval,
          ease_factor: easeFactor,
          due_date: dueDate.toISOString(),
          card_state: cardState,
          last_reviewed: new Date().toISOString(),
          reviews: newReviews,
          lapses: newLapses,
        })
        .eq('id', cardId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating card review:', error);
        throw error;
      }

      console.log('✅ Card review updated');
      return data;
    } catch (error) {
      console.error('❌ Failed to update card review:', error);
      throw error;
    }
  },

  /**
   * Get new cards (never reviewed) for a deck
   */
  async getNewCards(deckId: string, limit: number = 20): Promise<Card[]> {
    try {
      const {data, error} = await supabase
        .from('cards')
        .select('*')
        .eq('deck_id', deckId)
        .eq('card_state', 'new')
        .order('created_at', {ascending: true})
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching new cards:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch new cards:', error);
      throw error;
    }
  },
};
