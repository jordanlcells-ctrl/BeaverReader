import React, {useState, useEffect, useCallback, useMemo} from 'react';
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
import {useTheme} from '../contexts/ThemeContext';

type StudyModeRouteProp = RouteProp<RootStackParamList, 'StudyMode'>;

export default function StudyModeScreen() {
  const navigation = useNavigation();
  const {colors} = useTheme();
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

  const s = useMemo(() => getStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.loadingText}>Loading cards...</Text>
      </View>
    );
  }

  if (!currentCard) {
    return (
      <View style={s.centerContainer}>
        <Text style={s.emptyText}>No cards to study</Text>
        <TouchableOpacity
          style={s.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={s.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.closeButton}
          onPress={() => navigation.goBack()}>
          <Text style={s.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.deckName}>{deckName}</Text>
          <Text style={s.modeLabel}>Study Mode (No Ratings)</Text>
          <Text style={s.progressText}>
            {currentIndex + 1} / {cards.length}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, {width: `${progress}%`}]} />
      </View>

      {/* Card */}
      <View style={s.cardContainer}>
        <TouchableOpacity
          style={s.card}
          onPress={flipCard}
          activeOpacity={0.9}>
          {!showAnswer ? (
            <Animated.View
              style={[
                s.cardFace,
                {transform: [{rotateY: frontInterpolate}]},
              ]}>
              <Text style={s.cardLabel}>FRONT</Text>
              <Text style={s.cardText}>{currentCard.front}</Text>
              {currentCard.context && (
                <View style={s.contextContainer}>
                  <Text style={s.contextLabel}>CONTEXT:</Text>
                  <Text style={s.contextText}>{currentCard.context}</Text>
                </View>
              )}
              <Text style={s.tapHint}>👆 Tap to flip</Text>
            </Animated.View>
          ) : (
            <Animated.View
              style={[
                s.cardFace,
                s.cardBack,
                {transform: [{rotateY: backInterpolate}]},
              ]}>
              <Text style={s.cardLabel}>BACK</Text>
              <Text style={s.cardText}>{currentCard.back}</Text>
              <View style={s.typeBadge}>
                <Text style={s.typeBadgeText}>{currentCard.card_type}</Text>
              </View>
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      {/* Navigation Buttons */}
      <View style={s.navigationContainer}>
        <TouchableOpacity
          style={[s.navButton, currentIndex === 0 && s.navButtonDisabled]}
          onPress={handlePrevious}
          disabled={currentIndex === 0}>
          <Text style={[s.navButtonText, currentIndex === 0 && s.navButtonTextDisabled]}>← Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.navButton, s.navButtonNext]}
          onPress={handleNext}>
          <Text style={s.navButtonNextText}>
            {currentIndex + 1 === cards.length ? 'Finish' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(colors: {background: string; cardBackground: string; text: string; textMuted: string; segmentBg: string; accent: string; chipBg: string; cardBorder: string}) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 24,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textMuted,
    },
    emptyText: {
      fontSize: 18,
      color: colors.textMuted,
      marginBottom: 16,
    },
    backButton: {
      backgroundColor: colors.accent,
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
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
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
      color: colors.textMuted,
    },
    headerInfo: {
      flex: 1,
    },
    deckName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    modeLabel: {
      fontSize: 13,
      color: colors.accent,
      marginTop: 2,
    },
    progressText: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.cardBorder,
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
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
      backgroundColor: colors.cardBackground,
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
      backgroundColor: colors.segmentBg,
    },
    cardLabel: {
      position: 'absolute',
      top: 16,
      left: 16,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
    },
    cardText: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      lineHeight: 36,
    },
    contextContainer: {
      marginTop: 24,
      padding: 16,
      backgroundColor: colors.chipBg,
      borderRadius: 8,
      width: '100%',
    },
    contextLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 4,
    },
    contextText: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
    tapHint: {
      position: 'absolute',
      bottom: 16,
      fontSize: 14,
      color: colors.textMuted,
    },
    typeBadge: {
      position: 'absolute',
      top: 16,
      right: 16,
      backgroundColor: colors.accent,
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
      backgroundColor: colors.cardBackground,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    navButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: colors.chipBg,
    },
    navButtonNext: {
      backgroundColor: colors.accent,
    },
    navButtonDisabled: {
      opacity: 0.4,
    },
    navButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    navButtonTextDisabled: {
      color: colors.textMuted,
    },
    navButtonNextText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
