import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {cardService, Card} from '../services/cardService';
import {spacedRepetitionService} from '../services/spacedRepetitionService';
import {RootStackParamList} from '../types';

type ReviewSessionRouteProp = RouteProp<RootStackParamList, 'ReviewSession'>;

export default function ReviewSessionScreen() {
  const navigation = useNavigation();
  const route = useRoute<ReviewSessionRouteProp>();
  const {deckId, deckName} = route.params;

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    reviewed: 0,
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  // Animation for card flip
  const [flipAnim] = useState(new Animated.Value(0));

  const loadCards = async () => {
    try {
      setLoading(true);
      const dueCards = await cardService.getDueCards(deckId);
      const newCards = await cardService.getNewCards(deckId, 10);
      
      // Combine due cards and new cards
      const allCards = [...dueCards, ...newCards];
      
      if (allCards.length === 0) {
        Alert.alert('No Cards Due', 'Great job! No cards are due for review right now.', [
          {text: 'OK', onPress: () => navigation.goBack()}
        ]);
        return;
      }

      setCards(allCards);
      setSessionStats(prev => ({...prev, total: allCards.length}));
    } catch (error: any) {
      console.error('Failed to load cards:', error);
      Alert.alert('Error', 'Failed to load cards for review.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [deckId])
  );

  const currentCard = cards[currentIndex];

  const flipCard = () => {
    if (showAnswer) {
      // Flip back to front
      Animated.timing(flipAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowAnswer(false));
    } else {
      // Flip to back
      setShowAnswer(true);
      Animated.timing(flipAnim, {
        toValue: 180,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleReview = async (quality: 0 | 1 | 2 | 3) => {
    if (!currentCard || reviewing) return;

    try {
      setReviewing(true);

      // Calculate next review using optimized algorithm
      const result = spacedRepetitionService.calculateNextReview(
        quality,
        currentCard.interval || 0,
        currentCard.ease_factor || 2.5,
        currentCard.reviews || 0,
        currentCard.card_state || 'new'
      );

      // Update card in database
      await cardService.updateCardReview(
        currentCard.id,
        result.interval,
        result.easeFactor,
        result.dueDate,
        result.cardState,
        quality
      );

      // Update session stats
      const statKey = ['again', 'hard', 'good', 'easy'][quality] as 'again' | 'hard' | 'good' | 'easy';
      setSessionStats(prev => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        [statKey]: prev[statKey] + 1,
      }));

      // If "Again", requeue the card to show later in session
      if (quality === 0) {
        const updatedCard = {...currentCard, interval: result.interval, ease_factor: result.easeFactor};
        // Add card back to the queue (3-5 cards later)
        const reinsertPosition = Math.min(currentIndex + 3, cards.length);
        const newCards = [...cards];
        newCards.splice(reinsertPosition, 0, updatedCard);
        setCards(newCards);
      }

      // Move to next card
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
        flipAnim.setValue(0);
      } else {
        // Session complete
        showSessionSummary();
      }
    } catch (error: any) {
      console.error('Failed to review card:', error);
      Alert.alert('Error', 'Failed to save review. Please try again.');
    } finally {
      setReviewing(false);
    }
  };

  const showSessionSummary = () => {
    Alert.alert(
      'Session Complete! 🎉',
      `You reviewed ${sessionStats.reviewed} cards!\n\n` +
      `Again: ${sessionStats.again}\n` +
      `Hard: ${sessionStats.hard}\n` +
      `Good: ${sessionStats.good}\n` +
      `Easy: ${sessionStats.easy}`,
      [{text: 'Done', onPress: () => navigation.goBack()}]
    );
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading cards...</Text>
      </View>
    );
  }

  if (!currentCard) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No cards to review</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            Alert.alert(
              'End Session?',
              'Are you sure you want to end this review session?',
              [
                {text: 'Cancel', style: 'cancel'},
                {text: 'End', style: 'destructive', onPress: () => navigation.goBack()},
              ]
            );
          }}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.deckName}>{deckName}</Text>
          <Text style={styles.progressText}>
            {currentIndex + 1} / {cards.length}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, {width: `${progress}%`}]} />
      </View>

      {/* Card */}
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={flipCard}
          activeOpacity={0.9}
          disabled={reviewing}>
          {!showAnswer ? (
            <Animated.View
              style={[
                styles.cardFace,
                {transform: [{rotateY: frontInterpolate}]},
              ]}>
              <Text style={styles.cardLabel}>FRONT</Text>
              <Text style={styles.cardText}>{currentCard.front}</Text>
              {currentCard.context && (
                <View style={styles.contextContainer}>
                  <Text style={styles.contextLabel}>CONTEXT:</Text>
                  <Text style={styles.contextText}>{currentCard.context}</Text>
                </View>
              )}
              <Text style={styles.tapHint}>👆 Tap to flip</Text>
            </Animated.View>
          ) : (
            <Animated.View
              style={[
                styles.cardFace,
                styles.cardBack,
                {transform: [{rotateY: backInterpolate}]},
              ]}>
              <Text style={styles.cardLabel}>BACK</Text>
              <Text style={styles.cardText}>{currentCard.back}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{currentCard.card_type}</Text>
              </View>
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      {/* Rating Buttons */}
      {showAnswer && !reviewing && (
        <View style={styles.ratingContainer}>
          <TouchableOpacity
            style={[styles.ratingButton, styles.againButton]}
            onPress={() => handleReview(0)}>
            <Text style={styles.ratingButtonText}>Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ratingButton, styles.hardButton]}
            onPress={() => handleReview(1)}>
            <Text style={styles.ratingButtonText}>Hard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ratingButton, styles.goodButton]}
            onPress={() => handleReview(2)}>
            <Text style={styles.ratingButtonText}>Good</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.ratingButton, styles.easyButton]}
            onPress={() => handleReview(3)}>
            <Text style={styles.ratingButtonText}>Easy</Text>
          </TouchableOpacity>
        </View>
      )}

      {reviewing && (
        <View style={styles.reviewingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  headerInfo: {
    flex: 1,
  },
  deckName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    aspectRatio: 1.5,
    perspective: 1000,
  },
  cardFace: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    backgroundColor: '#f8f9fa',
  },
  cardLabel: {
    position: 'absolute',
    top: 16,
    left: 16,
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 1,
  },
  cardText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    lineHeight: 36,
  },
  contextContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff9e6',
    borderRadius: 8,
    width: '100%',
  },
  contextLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    marginBottom: 4,
  },
  contextText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  tapHint: {
    position: 'absolute',
    bottom: 16,
    fontSize: 14,
    color: '#999',
  },
  typeBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  ratingContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  ratingButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  againButton: {
    backgroundColor: '#ffebee',
  },
  hardButton: {
    backgroundColor: '#fff3e0',
  },
  goodButton: {
    backgroundColor: '#e8f5e9',
  },
  easyButton: {
    backgroundColor: '#e3f2fd',
  },
  ratingButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  reviewingContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});
