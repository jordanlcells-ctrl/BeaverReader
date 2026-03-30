import {supabase} from './supabase';

export interface Bookmark {
  id: string;
  book_id: string;
  user_id: string;
  page: number;
  note: string | null;
  created_at: string;
}

export interface CreateBookmarkInput {
  book_id: string;
  page: number;
  note?: string;
}

export const bookmarkService = {
  /**
   * Get all bookmarks for a book
   */
  async getBookmarksByBook(bookId: string): Promise<Bookmark[]> {
    try {
      const {data, error} = await supabase
        .from('bookmarks')
        .select('*')
        .eq('book_id', bookId)
        .order('page', {ascending: true});

      if (error) {
        console.error('❌ Error fetching bookmarks:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch bookmarks:', error);
      throw error;
    }
  },

  /**
   * Create a bookmark
   */
  async createBookmark(input: CreateBookmarkInput): Promise<Bookmark> {
    try {
      const {data: {user}} = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const {data, error} = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          book_id: input.book_id,
          page: input.page,
          note: input.note || null,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating bookmark:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ Failed to create bookmark:', error);
      throw error;
    }
  },

  /**
   * Update a bookmark
   */
  async updateBookmark(bookmarkId: string, note: string): Promise<Bookmark> {
    try {
      const {data, error} = await supabase
        .from('bookmarks')
        .update({note})
        .eq('id', bookmarkId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating bookmark:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('❌ Failed to update bookmark:', error);
      throw error;
    }
  },

  /**
   * Delete a bookmark
   */
  async deleteBookmark(bookmarkId: string): Promise<void> {
    try {
      const {error} = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId);

      if (error) {
        console.error('❌ Error deleting bookmark:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ Failed to delete bookmark:', error);
      throw error;
    }
  },

  /**
   * Check if a page is bookmarked
   */
  async isPageBookmarked(bookId: string, page: number): Promise<boolean> {
    try {
      const {data, error} = await supabase
        .from('bookmarks')
        .select('id')
        .eq('book_id', bookId)
        .eq('page', page)
        .single();

      if (error && error.code !== 'PGRST116') {
        return false;
      }

      return !!data;
    } catch {
      return false;
    }
  },
};
