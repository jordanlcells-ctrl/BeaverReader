/**
 * In-memory cache for extracted PDF text.
 * Prevents re-extracting text on every navigation within a session.
 * PDFs are now loaded directly from disk via file:// URL by pdf.js,
 * so there is no longer a base64 cache.
 */
class PDFTextCache {
  private cache: Map<string, string> = new Map();

  get(bookId: string): string | null {
    const text = this.cache.get(bookId);
    if (text) {
      console.log('📝 Text Cache HIT for book:', bookId, '- Length:', text.length, 'chars');
      return text;
    }
    console.log('❌ Text Cache MISS for book:', bookId);
    return null;
  }

  set(bookId: string, text: string): void {
    console.log('💾 Caching extracted text for book:', bookId, '- Length:', text.length, 'chars');
    this.cache.set(bookId, text);
  }

  has(bookId: string): boolean {
    return this.cache.has(bookId);
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log('🧹 Cleared text cache - Removed', size, 'items');
  }
}

export const pdfTextCache = new PDFTextCache();
