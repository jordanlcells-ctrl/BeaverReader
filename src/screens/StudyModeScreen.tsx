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
import {RootStackParamList} from '../types';

type StudyModeRouteProp = RouteProp<RootStackParamList, 'StudyMode'>;

export default function StudyModeScreen() {
  const navigation = useNavigation();
  const route = useRoute<StudyModeRouteProp>();
  const {deckId, deckName} = route.params;

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);

  // Animation for card flip
  const [flipAnim] = useState(new Animated.Value(0));

  const loadCards = async () => {
    try {
      setLoading(true);
      const allCards = await cardService.getCardsByDeck(deckId);
      
      if (allCards.length === 0) {
        Alert.alert('No Cards', 'This deck has no cards to study.', [
          {text: 'OK', onPress: () => navigation.goBack()}
        ]);
        return;
      }

      setCards(allCards);
    } catch (error: any) {
      console.error('Failed to load cards:', error);
      Alert.alert('Error', 'Failed to load cards for study.');
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

  const handleNext = () => {
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      flipAnim.setValue(0);
    } else {
      Alert.alert(
        'Study Complete! 📚',
        `You've reviewed all ${cards.length} cards in this deck.`,
        [{text: 'Done', onPress: () => navigation.goBack()}]
      );
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
      flipAnim.setValue(0);
    }
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
        <Text style={styles.emptyText}>No cards to study</Text>
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
          onPress={() => navigation.goBack()}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.deckName}>{deckName}</Text>
          <Text style={styles.modeLabel}>Study Mode (No Ratings)</Text>
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
          activeOpacity={0.9}>
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

      {/* Navigation Buttons */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrevious}
          disabled={currentIndex === 0}>
          <Text style={styles.navButtonText}>← Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, styles.navButtonNext]}
          onPress={handleNext}>
          <Text style={styles.navButtonText}>
            {currentIndex + 1 === cards.length ? 'Finish' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
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
  modeLabel: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 2,
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
    backgroundColor: '#007AFF',
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
  navigationContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  navButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  navButtonNext: {
    backgroundColor: '#007AFF',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
});
