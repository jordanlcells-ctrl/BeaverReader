import {supabase} from './supabase';

export interface Deck {
  id: string;
  user_id: string;
  parent_deck_id: string | null;
  book_id: string | null;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDeckInput {
  name: string;
  description?: string;
  parent_deck_id?: string;
  book_id?: string;
}

export interface UpdateDeckInput {
  name?: string;
  description?: string;
  parent_deck_id?: string;
}

export const deckService = {
  /**
   * Get all decks for the current user
   */
  async getDecks(): Promise<Deck[]> {
    try {
      console.log('📚 Fetching decks...');
      
      const {data, error} = await supabase
        .from('decks')
        .select('*')
        .order('created_at', {ascending: false});

      if (error) {
        console.error('❌ Error fetching decks:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} decks`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch decks:', error);
      throw error;
    }
  },

  /**
   * Get top-level decks (no parent)
   */
  async getTopLevelDecks(): Promise<Deck[]> {
    try {
      console.log('📚 Fetching top-level decks...');
      
      const {data, error} = await supabase
        .from('decks')
        .select('*')
        .is('parent_deck_id', null)
        .order('created_at', {ascending: false});

      if (error) {
        console.error('❌ Error fetching top-level decks:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} top-level decks`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch top-level decks:', error);
      throw error;
    }
  },

  /**
   * Get subdecks of a parent deck
   */
  async getSubdecks(parentDeckId: string): Promise<Deck[]> {
    try {
      console.log('📚 Fetching subdecks for:', parentDeckId);
      
      const {data, error} = await supabase
        .from('decks')
        .select('*')
        .eq('parent_deck_id', parentDeckId)
        .order('created_at', {ascending: false});

      if (error) {
        console.error('❌ Error fetching subdecks:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} subdecks`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch subdecks:', error);
      throw error;
    }
  },

  /**
   * Get a single deck by ID
   */
  async getDeck(deckId: string): Promise<Deck | null> {
    try {
      console.log('📚 Fetching deck:', deckId);
      
      const {data, error} = await supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching deck:', error);
        throw error;
      }

      console.log('✅ Fetched deck:', data?.name);
      return data;
    } catch (error) {
      console.error('❌ Failed to fetch deck:', error);
      throw error;
    }
  },

  /**
   * Create a new deck
   */
  async createDeck(input: CreateDeckInput): Promise<Deck> {
    try {
      console.log('➕ Creating deck:', input.name);
      
      const {data: {user}} = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const {data, error} = await supabase
        .from('decks')
        .insert({
          user_id: user.id,
          name: input.name,
          description: input.description || null,
          parent_deck_id: input.parent_deck_id || null,
          book_id: input.book_id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating deck:', error);
        throw error;
      }

      console.log('✅ Deck created:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Failed to create deck:', error);
      throw error;
    }
  },

  /**
   * Update an existing deck
   */
  async updateDeck(deckId: string, input: UpdateDeckInput): Promise<Deck> {
    try {
      console.log('✏️ Updating deck:', deckId);
      
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.parent_deck_id !== undefined) updateData.parent_deck_id = input.parent_deck_id;

      const {data, error} = await supabase
        .from('decks')
        .update(updateData)
        .eq('id', deckId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating deck:', error);
        throw error;
      }

      console.log('✅ Deck updated');
      return data;
    } catch (error) {
      console.error('❌ Failed to update deck:', error);
      throw error;
    }
  },

  /**
   * Get deck for a specific book (create if doesn't exist)
   */
  async getOrCreateBookDeck(bookId: string, bookTitle: string): Promise<Deck> {
    try {
      console.log('📚 Getting or creating deck for book:', bookId);
      
      // Check if deck already exists for this book
      const {data: existingDeck, error: fetchError} = await supabase
        .from('decks')
        .select('*')
        .eq('book_id', bookId)
        .is('parent_deck_id', null) // Only get the main book deck
        .single();

      if (existingDeck) {
        console.log('✅ Found existing book deck:', existingDeck.id);
        return existingDeck;
      }

      // Create new deck for this book
      const {data: {user}} = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const {data: newDeck, error: createError} = await supabase
        .from('decks')
        .insert({
          user_id: user.id,
          book_id: bookId,
          name: bookTitle,
          description: `Flashcards from "${bookTitle}"`,
          parent_deck_id: null,
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating book deck:', createError);
        throw createError;
      }

      console.log('✅ Created new book deck:', newDeck.id);
      return newDeck;
    } catch (error) {
      console.error('❌ Failed to get or create book deck:', error);
      throw error;
    }
  },

  /**
   * Get all decks for a book (including subdecks)
   */
  async getBookDecks(bookId: string): Promise<Deck[]> {
    try {
      console.log('📚 Fetching decks for book:', bookId);
      
      const {data, error} = await supabase
        .from('decks')
        .select('*')
        .eq('book_id', bookId)
        .order('created_at', {ascending: true});

      if (error) {
        console.error('❌ Error fetching book decks:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} book decks`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch book decks:', error);
      throw error;
    }
  },

  /**
   * Get manual decks (not linked to any book)
   */
  async getManualDecks(): Promise<Deck[]> {
    try {
      console.log('📚 Fetching manual decks...');
      
      const {data, error} = await supabase
        .from('decks')
        .select('*')
        .is('book_id', null)
        .is('parent_deck_id', null)
        .order('created_at', {ascending: false});

      if (error) {
        console.error('❌ Error fetching manual decks:', error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} manual decks`);
      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch manual decks:', error);
      throw error;
    }
  },

  /**
   * Delete a deck (and all its subdecks due to CASCADE)
   */
  async deleteDeck(deckId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting deck:', deckId);
      
      const {error} = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId);

      if (error) {
        console.error('❌ Error deleting deck:', error);
        throw error;
      }

      console.log('✅ Deck deleted');
    } catch (error) {
      console.error('❌ Failed to delete deck:', error);
      throw error;
    }
  },

  /**
   * Get deck hierarchy (parent chain)
   */
  async getDeckHierarchy(deckId: string): Promise<Deck[]> {
    try {
      console.log('🔗 Fetching deck hierarchy for:', deckId);
      
      const hierarchy: Deck[] = [];
      let currentDeck = await this.getDeck(deckId);
      
      while (currentDeck) {
        hierarchy.unshift(currentDeck);
        
        if (currentDeck.parent_deck_id) {
          currentDeck = await this.getDeck(currentDeck.parent_deck_id);
        } else {
          currentDeck = null;
        }
      }
      
      console.log(`✅ Found ${hierarchy.length} levels in hierarchy`);
      return hierarchy;
    } catch (error) {
      console.error('❌ Failed to fetch deck hierarchy:', error);
      throw error;
    }
  },
};
