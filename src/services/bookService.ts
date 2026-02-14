import {supabase} from './supabase';
import {pickFile} from './filePicker';
import {deckService} from './deckService';
import type {Book} from '../types';

export const bookService = {
  /**
   * Pick a file and upload it
   */
  async uploadBook(): Promise<Book | null> {
    try {
      // Pick file from device
      const file = await pickFile();
      
      // Extract title from filename (remove extension and timestamp)
      const title = file.name
        .replace(/^\d+_/, '') // Remove timestamp prefix
        .replace(/\.(epub|pdf)$/i, '') // Remove extension
        .replace(/_/g, ' '); // Replace underscores with spaces
      
      // Get current user
      const {data: {user}} = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save book metadata to Supabase
      const {data, error} = await supabase
        .from('books')
        .insert({
          user_id: user.id,
          title,
          author: null,
          file_path: file.path,
          file_type: file.type,
          current_position: {},
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-create deck for this book
      try {
        await deckService.getOrCreateBookDeck(data.id, data.title);
        console.log('✅ Auto-created deck for book:', data.title);
      } catch (deckError) {
        console.error('⚠️ Failed to create deck for book:', deckError);
        // Don't throw - book was created successfully, deck creation is optional
      }

      return data;
    } catch (error: any) {
      if (error.message === 'E_PICKER_CANCELLED') {
        return null; // User cancelled, not an error
      }
      throw error;
    }
  },

  /**
   * Get all books for current user
   */
  async getBooks(): Promise<Book[]> {
    const {data, error} = await supabase
      .from('books')
      .select('*')
      .order('created_at', {ascending: false});

    if (error) throw error;
    return data || [];
  },

  /**
   * Delete a book
   */
  async deleteBook(bookId: string): Promise<void> {
    const {error} = await supabase.from('books').delete().eq('id', bookId);

    if (error) throw error;
  },

  /**
   * Update book metadata
   */
  async updateBook(
    bookId: string,
    updates: Partial<Pick<Book, 'title' | 'author' | 'current_position' | 'extracted_text'>>,
  ): Promise<void> {
    const {error} = await supabase
      .from('books')
      .update(updates)
      .eq('id', bookId);

    if (error) throw error;
  },
};
