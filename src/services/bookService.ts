import {supabase} from './supabase';
import {pickFile} from './filePicker';
import {deckService} from './deckService';
import {uploadBookToStorage} from './bookStorageService';
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
      }

      // Upload to Supabase Storage for cross-device sync (fire-and-forget — don't block navigation)
      uploadBookToStorage(file.path, user.id, data.id, file.type)
        .then(() => console.log('✅ Book synced to cloud storage:', data.id))
        .catch(err => console.error('❌ Cloud sync FAILED:', err?.message ?? err));

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
    updates: Partial<Pick<Book, 'title' | 'author' | 'current_position' | 'extracted_text' | 'file_path' | 'file_type'>>,
  ): Promise<void> {
    const {error} = await supabase
      .from('books')
      .update(updates)
      .eq('id', bookId);

    if (error) throw error;
  },

  /**
   * Pick a file from disk and point an existing book row at the new copy in app storage.
   * Use after reinstall / emulator reset when the old internal path no longer exists.
   */
  async relinkBookFile(bookId: string, expectedType: 'epub' | 'pdf'): Promise<string | null> {
    try {
      const file = await pickFile();
      if (file.type !== expectedType) {
        throw new Error(expectedType === 'epub' ? 'Please select an EPUB file' : 'Please select a PDF file');
      }
      await bookService.updateBook(bookId, {file_path: file.path, file_type: file.type});

      // Re-upload to cloud so other devices can download it
      const {data: {user}} = await supabase.auth.getUser();
      if (user) {
        uploadBookToStorage(file.path, user.id, bookId, file.type)
          .then(() => console.log('✅ Re-linked book synced to cloud'))
          .catch(err => console.warn('⚠️ Cloud sync after relink failed:', err));
      }

      return file.path;
    } catch (e: any) {
      if (e?.message === 'E_PICKER_CANCELLED') {
        return null;
      }
      throw e;
    }
  },
};
