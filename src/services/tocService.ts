import {supabase} from './supabase';

export interface TOCItem {
  id: string;
  book_id: string;
  title: string;
  page: number;
  level: number; // 0 = top level, 1 = subsection, 2 = subsubsection
  order_index: number;
  created_at: string;
}

export interface CreateTOCItemInput {
  book_id: string;
  title: string;
  page: number;
  level: number;
  order_index: number;
}

export const tocService = {
  /**
   * Get all TOC items for a book
   */
  async getTOCByBook(bookId: string): Promise<TOCItem[]> {
    try {
      const {data, error} = await supabase
        .from('table_of_contents')
        .select('*')
        .eq('book_id', bookId)
        .order('order_index', {ascending: true});

      if (error) {
        console.error('❌ Error fetching TOC:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to fetch TOC:', error);
      throw error;
    }
  },

  /**
   * Create TOC items (batch insert)
   */
  async createTOCItems(items: CreateTOCItemInput[]): Promise<TOCItem[]> {
    try {
      const {data: {user}} = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const {data, error} = await supabase
        .from('table_of_contents')
        .insert(items)
        .select();

      if (error) {
        console.error('❌ Error creating TOC items:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('❌ Failed to create TOC items:', error);
      throw error;
    }
  },

  /**
   * Delete all TOC items for a book
   */
  async deleteTOCByBook(bookId: string): Promise<void> {
    try {
      const {error} = await supabase
        .from('table_of_contents')
        .delete()
        .eq('book_id', bookId);

      if (error) {
        console.error('❌ Error deleting TOC:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ Failed to delete TOC:', error);
      throw error;
    }
  },

  /**
   * Check if TOC exists for a book
   */
  async hasTOC(bookId: string): Promise<boolean> {
    try {
      const {data, error} = await supabase
        .from('table_of_contents')
        .select('id')
        .eq('book_id', bookId)
        .limit(1);

      if (error) {
        console.error('❌ Error checking TOC:', error);
        return false;
      }

      return (data || []).length > 0;
    } catch (error) {
      return false;
    }
  },
};
