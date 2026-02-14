/**
 * Spaced Repetition Service - Optimized for Learning
 * 
 * Based on proven flashcard research (Anki, SuperMemo)
 * 
 * Button System:
 * - Again (0): Failed - Need to review again soon
 * - Hard (1): Difficult but correct - Short interval
 * - Good (2): Normal recall - Standard interval
 * - Easy (3): Perfect recall - Long interval
 * 
 * Interval Progression (research-based):
 * - Again: Same day (relearning mode)
 * - Hard: Same day initially, then short intervals
 * - Good: 1 day → 3 days → 7 days → 16 days → 35 days...
 * - Easy: 2 days → 5 days → 14 days → 35 days...
 */

export interface CardReview {
  cardId: string;
  quality: 0 | 1 | 2 | 3; // Again, Hard, Good, Easy
}

export interface ReviewResult {
  interval: number; // Days until next review
  easeFactor: number; // New ease factor
  dueDate: Date; // When card is due next
  cardState: 'new' | 'learning' | 'review' | 'relearning';
}

export const spacedRepetitionService = {
  /**
   * Calculate next review using optimized intervals
   * @param quality - Rating quality (0=Again, 1=Hard, 2=Good, 3=Easy)
   * @param currentInterval - Current interval in days
   * @param currentEaseFactor - Current ease factor (default 2.5)
   * @param reviews - Number of times card has been reviewed
   * @param cardState - Current state of the card
   * @returns ReviewResult with new interval, ease factor, due date, and state
   */
  calculateNextReview(
    quality: 0 | 1 | 2 | 3,
    currentInterval: number,
    currentEaseFactor: number,
    reviews: number,
    cardState: 'new' | 'learning' | 'review' | 'relearning'
  ): ReviewResult {
    let interval = currentInterval;
    let easeFactor = currentEaseFactor;
    let state = cardState;

    // AGAIN - Failed, need to relearn IMMEDIATELY
    if (quality === 0) {
      interval = 0; // Show again in same session (0 = requeue immediately)
      easeFactor = Math.max(1.3, easeFactor - 0.2); // Decrease ease factor
      state = reviews === 0 ? 'learning' : 'relearning';
    } 
    // HARD - Difficult but correct - review SAME DAY
    else if (quality === 1) {
      // Show again same day (1 hour later for first reviews, then longer)
      if (reviews === 0) {
        interval = 0.04; // ~1 hour later (0.04 days = 1 hour)
        state = 'learning';
      } else if (reviews === 1) {
        interval = 0.5; // Half a day later (12 hours)
        state = 'learning';
      } else {
        // Subsequent: 1 day, then multiply by 1.2
        interval = Math.max(1, Math.round(interval * 1.2));
        state = 'review';
      }
      easeFactor = Math.max(1.3, easeFactor - 0.15);
    }
    // GOOD - Normal recall
    else if (quality === 2) {
      if (reviews === 0) {
        // First time: 1 day
        interval = 1;
        state = 'learning';
      } else if (reviews === 1) {
        // Second time: 3 days
        interval = 3;
        state = 'review';
      } else {
        // Subsequent: multiply by ease factor
        interval = Math.round(interval * easeFactor);
        state = 'review';
      }
      // Maintain ease factor (no change for "good")
    }
    // EASY - Perfect recall
    else if (quality === 3) {
      if (reviews === 0) {
        // First time: 2 days (skip learning phase)
        interval = 2;
        state = 'review';
      } else if (reviews === 1) {
        // Second time: 5 days
        interval = 5;
        state = 'review';
      } else {
        // Subsequent: multiply by ease factor * 1.3 (longer interval)
        interval = Math.round(interval * easeFactor * 1.3);
        state = 'review';
      }
      easeFactor = Math.min(2.5, easeFactor + 0.15); // Increase ease factor
    }

    // Ensure minimum interval is 1 (except for "again" which is 0 = same day)
    if (quality !== 0) {
      interval = Math.max(1, interval);
    }

    // Calculate due date
    const dueDate = new Date();
    if (interval === 0) {
      // Again: Immediate - requeue in same session (due in 1 minute)
      dueDate.setMinutes(dueDate.getMinutes() + 1);
    } else if (interval < 1) {
      // Hard: Same day - due in hours
      const hours = Math.round(interval * 24);
      dueDate.setHours(dueDate.getHours() + hours);
    } else {
      // Standard: Due in days
      dueDate.setDate(dueDate.getDate() + Math.round(interval));
    }

    return {
      interval,
      easeFactor: Math.round(easeFactor * 100) / 100, // Round to 2 decimal places
      dueDate,
      cardState: state,
    };
  },

  /**
   * Check if a card is due for review
   * @param dueDate - The card's due date
   * @returns true if card is due (due date is today or earlier)
   */
  isCardDue(dueDate: Date | string): boolean {
    const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const now = new Date();
    return due <= now;
  },

  /**
   * Get days until card is due
   * @param dueDate - The card's due date
   * @returns Number of days until due (negative if overdue)
   */
  getDaysUntilDue(dueDate: Date | string): number {
    const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Format interval as human-readable string
   * @param interval - Interval in days
   * @returns Formatted string (e.g., "2 days", "1 month")
   */
  formatInterval(interval: number): string {
    if (interval === 0) {
      return 'same day';
    } else if (interval === 1) {
      return '1 day';
    } else if (interval < 30) {
      return `${interval} days`;
    } else if (interval < 365) {
      const months = Math.round(interval / 30);
      return months === 1 ? '1 month' : `${months} months`;
    } else {
      const years = Math.round(interval / 365);
      return years === 1 ? '1 year' : `${years} years`;
    }
  },
};
