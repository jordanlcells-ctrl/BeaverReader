// Database types
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author?: string;
  file_path: string;
  file_type: 'epub' | 'pdf';
  cover_url?: string;
  current_position?: Record<string, any>;
  extracted_text?: string; // Cached extracted text for PDFs
  created_at: string;
  updated_at: string;
}

export interface Deck {
  id: string;
  user_id: string;
  parent_deck_id?: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Highlight {
  id: string;
  book_id: string;
  user_id: string;
  text: string;
  context: string;
  position: Record<string, any>;
  color: string;
  note?: string;
  created_at: string;
}

export interface Card {
  id: string;
  deck_id: string;
  user_id: string;
  highlight_id?: string;
  front: string;
  back: string;
  context?: string;
  card_type: 'definition' | 'translation' | 'grammar' | 'custom';
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  card_id: string;
  user_id: string;
  rating: 'know' | 'easy' | 'medium' | 'hard';
  next_review_date: string;
  reviewed_at: string;
}

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  BookReader: {bookId: string; goToPage?: number; goToAnchor?: string; goToTitle?: string};
  PDFReader: {bookId: string; goToPage?: number};
  DeckList: undefined;
  DeckDetail: {deckId: string};
  ReviewSession: {deckId: string; deckName: string};
  StudyMode: {deckId: string; deckName: string};
  Highlights: {bookId: string; bookTitle: string};
  Bookmarks: {bookId: string; bookTitle: string};
  TableOfContents: {bookId: string; bookTitle: string; bookType: 'epub' | 'pdf'};
  CardReview: {deckId: string};
  Settings: undefined;
};
