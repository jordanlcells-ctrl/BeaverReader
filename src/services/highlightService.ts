import {supabase} from './supabase';
import type {Highlight} from '../types';

export const highlightService = {
  /**
   * Create a new highlight
   */
  async createHighlight(
    bookId: string,
    text: string,
    context: string,
    position: Record<string, any>,
    color: string,
    note?: string
  ): Promise<Highlight> {
    console.log('💾 Creating highlight...');
    
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const {data, error} = await supabase
      .from('highlights')
      .insert({
        book_id: bookId,
        user_id: user.id,
        text,
        context,
        position,
        color,
        note,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create highlight:', error);
      throw error;
    }

    console.log('✅ Highlight created:', data.id);
    return data;
  },

  /**
   * Get all highlights for a book
   */
  async getHighlightsByBook(bookId: string): Promise<Highlight[]> {
    console.log('📚 Fetching highlights for book:', bookId);
    
    const {data, error} = await supabase
      .from('highlights')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', {ascending: true});

    if (error) {
      console.error('❌ Failed to fetch highlights:', error);
      throw error;
    }

    console.log('✅ Found', data?.length || 0, 'highlights');
    return data || [];
  },

  /**
   * Get all highlights for current user
   */
  async getAllHighlights(): Promise<Highlight[]> {
    console.log('📚 Fetching all highlights...');
    
    const {data, error} = await supabase
      .from('highlights')
      .select('*')
      .order('created_at', {ascending: false});

    if (error) {
      console.error('❌ Failed to fetch highlights:', error);
      throw error;
    }

    console.log('✅ Found', data?.length || 0, 'highlights');
    return data || [];
  },

  /**
   * Update highlight note
   */
  async updateHighlightNote(highlightId: string, note: string): Promise<void> {
    console.log('📝 Updating highlight note:', highlightId);
    
    const {error} = await supabase
      .from('highlights')
      .update({note})
      .eq('id', highlightId);

    if (error) {
      console.error('❌ Failed to update highlight:', error);
      throw error;
    }

    console.log('✅ Highlight note updated');
  },

  /**
   * Delete a highlight
   */
  async deleteHighlight(highlightId: string): Promise<void> {
    console.log('🗑️ Deleting highlight:', highlightId);
    
    const {error} = await supabase
      .from('highlights')
      .delete()
      .eq('id', highlightId);

    if (error) {
      console.error('❌ Failed to delete highlight:', error);
      throw error;
    }

    console.log('✅ Highlight deleted');
  },
};
