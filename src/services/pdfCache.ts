/**
 * In-memory cache for PDF base64 data
 * Prevents re-reading large PDF files from disk on every navigation
 */
class PDFCache {
  private cache: Map<string, string> = new Map();

  /**
   * Get cached PDF data for a book
   * @param bookId The book's unique identifier
   * @returns base64 PDF data if cached, null otherwise
   */
  get(bookId: string): string | null {
    const data = this.cache.get(bookId);
    if (data) {
      console.log('📦 PDF Cache HIT for book:', bookId, '- Size:', data.length, 'chars');
      return data;
    }
    console.log('❌ PDF Cache MISS for book:', bookId);
    return null;
  }

  /**
   * Store PDF data in cache
   * @param bookId The book's unique identifier
   * @param base64Data The base64 encoded PDF data
   */
  set(bookId: string, base64Data: string): void {
    console.log('💾 Caching PDF for book:', bookId, '- Size:', base64Data.length, 'chars');
    this.cache.set(bookId, base64Data);
  }

  /**
   * Remove a specific book from cache
   * @param bookId The book's unique identifier
   */
  remove(bookId: string): void {
    if (this.cache.delete(bookId)) {
      console.log('🗑️ Removed PDF from cache:', bookId);
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log('🧹 Cleared PDF cache - Removed', size, 'items');
  }

  /**
   * Get cache size (number of cached PDFs)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get total memory usage estimate (in MB)
   */
  getMemoryUsageMB(): number {
    let totalChars = 0;
    this.cache.forEach(data => {
      totalChars += data.length;
    });
    // Rough estimate: 1 char ≈ 2 bytes in JavaScript
    const bytes = totalChars * 2;
    const mb = bytes / (1024 * 1024);
    return Math.round(mb * 100) / 100;
  }
}

// Singleton instance
export const pdfCache = new PDFCache();

/**
 * In-memory cache for extracted PDF text
 * Prevents re-extracting text from PDFs on every navigation
 */
class PDFTextCache {
  private cache: Map<string, string> = new Map();

  /**
   * Get cached extracted text for a book
   * @param bookId The book's unique identifier
   * @returns extracted text if cached, null otherwise
   */
  get(bookId: string): string | null {
    const text = this.cache.get(bookId);
    if (text) {
      console.log('📝 Text Cache HIT for book:', bookId, '- Length:', text.length, 'chars');
      return text;
    }
    console.log('❌ Text Cache MISS for book:', bookId);
    return null;
  }

  /**
   * Store extracted text in cache
   * @param bookId The book's unique identifier
   * @param text The extracted text content
   */
  set(bookId: string, text: string): void {
    console.log('💾 Caching extracted text for book:', bookId, '- Length:', text.length, 'chars');
    this.cache.set(bookId, text);
  }

  /**
   * Check if text is cached for a book
   */
  has(bookId: string): boolean {
    return this.cache.has(bookId);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log('🧹 Cleared Text cache - Removed', size, 'items');
  }
}

// Singleton instance
export const pdfTextCache = new PDFTextCache();
