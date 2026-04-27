import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {cardService, Card} from '../services/cardService';
import {spacedRepetitionService} from '../services/spacedRepetitionService';
import {RootStackParamList} from '../types';
import {useTheme} from '../contexts/ThemeContext';
import {
  getCardTypography,
  getAdaptiveCardMainStyle,
  cardBodyMargins,
} from '../utils/cardTypography';
import {computeFlashCardLayout} from '../utils/flashCardLayout';
import {compactCardBackDisplay} from '../utils/compactCardBack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type ReviewSessionRouteProp = RouteProp<RootStackParamList, 'ReviewSession'>;

export default function ReviewSessionScreen() {
  const navigation = useNavigation();
  const route = useRoute<ReviewSessionRouteProp>();
  const {deckId, deckName} = route.params;
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const {width: winW, height: winH} = useWindowDimensions();
  const s = useMemo(() => getStyles(colors), [colors]);

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
  const [cardMainBodyLayout, setCardMainBodyLayout] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Animation for card flip
  const [flipAnim] = useState(new Animated.Value(0));

  const onCardMainBodyLayout = useCallback((e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout;
    if (width < 8 || height < 8) {
      return;
    }
    setCardMainBodyLayout(prev =>
      prev &&
      Math.abs(prev.width - width) < 0.5 &&
      Math.abs(prev.height - height) < 0.5
        ? prev
        : {width, height},
    );
  }, []);

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

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 89, 90, 180],
    outputRange: [1, 1, 0, 0],
    extrapolate: 'clamp',
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 89, 90, 180],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const flipScale = flipAnim.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [1, 0.985, 1],
    extrapolate: 'clamp',
  });

  const cardLayout = useMemo(
    () =>
      computeFlashCardLayout(winW, winH, insets, 'review', currentCard ?? undefined),
    [
      winW,
      winH,
      insets.top,
      insets.bottom,
      currentCard?.id,
      currentCard?.front,
      currentCard?.back,
      currentCard?.context,
    ],
  );

  const cardTypography = useMemo(
    () => getCardTypography(cardLayout.maxW, cardLayout.maxH),
    [cardLayout.maxW, cardLayout.maxH],
  );

  const adaptiveFrontMainStyle = useMemo(
    () =>
      getAdaptiveCardMainStyle(
        'front',
        cardLayout.maxW,
        cardLayout.maxH,
        cardLayout.aspect,
        currentCard?.front ?? '',
        {
          reservedBottom: currentCard?.context
            ? cardBodyMargins.contextReserve
            : 0,
          measuredBodyWidth: cardMainBodyLayout?.width,
          measuredBodyHeight: cardMainBodyLayout?.height,
        },
      ),
    [
      cardLayout.maxW,
      cardLayout.maxH,
      cardLayout.aspect,
      currentCard?.front,
      currentCard?.context,
      cardMainBodyLayout?.width,
      cardMainBodyLayout?.height,
    ],
  );

  const backDisplayText = useMemo(
    () => compactCardBackDisplay(currentCard?.back ?? ''),
    [currentCard?.back],
  );

  const adaptiveBackMainStyle = useMemo(
    () =>
      getAdaptiveCardMainStyle(
        'back',
        cardLayout.maxW,
        cardLayout.maxH,
        cardLayout.aspect,
        backDisplayText,
        {
          measuredBodyWidth: cardMainBodyLayout?.width,
          measuredBodyHeight: cardMainBodyLayout?.height,
          bodyPaddingBottom: 7,
        },
      ),
    [
      cardLayout.maxW,
      cardLayout.maxH,
      cardLayout.aspect,
      backDisplayText,
      cardMainBodyLayout?.width,
      cardMainBodyLayout?.height,
    ],
  );

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
        <Text style={s.emptyText}>No cards to review</Text>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Text style={s.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = ((currentIndex + 1) / cards.length) * 100;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, {paddingTop: 16 + insets.top}]}>
        <TouchableOpacity
          style={s.closeButton}
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
          <Text style={s.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.deckName}>{deckName}</Text>
          <Text style={s.progressText}>{currentIndex + 1} / {cards.length}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, {width: `${progress}%`}]} />
      </View>

      {/* Card */}
      <View style={s.cardContainer}>
        <TouchableOpacity
          style={[
            s.card,
            {
              maxWidth: cardLayout.maxW,
              aspectRatio: cardLayout.aspect,
              ...(cardLayout.maxH != null ? {maxHeight: cardLayout.maxH} : {}),
            },
          ]}
          onPress={flipCard}
          activeOpacity={0.9}
          disabled={reviewing}>
          <Animated.View style={[s.cardShadow, {transform: [{scale: flipScale}]}]}>
            <View style={s.cardInner}>
              <Animated.View
                style={[
                  s.cardFace,
                  s.cardFrontFace,
                  {
                    opacity: frontOpacity,
                    transform: [{perspective: 1000}, {rotateY: frontInterpolate}],
                  },
                ]}
                renderToHardwareTextureAndroid
                shouldRasterizeIOS>
                <Text style={[s.cardLabel, cardTypography.cardLabel]}>FRONT</Text>
                <View
                  onLayout={onCardMainBodyLayout}
                  style={[
                    s.cardMainBody,
                    {
                      paddingHorizontal: cardTypography.facePad,
                      marginTop: cardBodyMargins.marginTop,
                      marginBottom: cardBodyMargins.marginBottom,
                    },
                  ]}>
                  <View style={s.cardMainInner}>
                    <Text style={[s.cardText, adaptiveFrontMainStyle]}>{currentCard.front}</Text>
                    {currentCard.context ? (
                      <View style={[s.contextContainer, cardTypography.contextContainer]}>
                        <Text style={[s.contextLabel, cardTypography.contextLabel]}>CONTEXT:</Text>
                        <Text style={[s.contextText, cardTypography.contextText]}>{currentCard.context}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={[s.tapHint, cardTypography.tapHint]}>👆 Tap to flip</Text>
              </Animated.View>

              <Animated.View
                style={[
                  s.cardFace,
                  s.cardBack,
                  {
                    opacity: backOpacity,
                    transform: [{perspective: 1000}, {rotateY: backInterpolate}],
                  },
                ]}
                renderToHardwareTextureAndroid
                shouldRasterizeIOS>
                <View style={s.cardBackHeader}>
                  <Text style={[s.cardBackHeaderLabel, cardTypography.cardLabel]}>BACK</Text>
                  <View style={s.cardBackHeaderSpacer} />
                  <View style={s.typeBadgeInline}>
                    <Text style={[s.typeBadgeText, cardTypography.typeBadgeText]}>
                      {currentCard.card_type}
                    </Text>
                  </View>
                </View>
                <View
                  onLayout={onCardMainBodyLayout}
                  style={[
                    s.cardMainBody,
                    {
                      paddingHorizontal: cardTypography.facePad,
                      paddingBottom: 7,
                      marginTop: 4,
                      marginBottom: cardBodyMargins.marginBottom,
                    },
                  ]}>
                  <Text style={[s.cardText, s.cardTextBack, adaptiveBackMainStyle]}>
                    {backDisplayText}
                  </Text>
                </View>
              </Animated.View>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Rating Buttons */}
      <View
        style={[
          s.ratingContainer,
          {
            paddingBottom: 16 + insets.bottom,
            opacity: showAnswer && !reviewing ? 1 : 0.45,
          },
        ]}
        pointerEvents={showAnswer && !reviewing ? 'auto' : 'none'}>
        <TouchableOpacity style={[s.ratingButton, s.againButton]} onPress={() => handleReview(0)}>
          <Text style={s.ratingButtonText}>Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.ratingButton, s.hardButton]} onPress={() => handleReview(1)}>
          <Text style={s.ratingButtonText}>Hard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.ratingButton, s.goodButton]} onPress={() => handleReview(2)}>
          <Text style={s.ratingButtonText}>Good</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.ratingButton, s.easyButton]} onPress={() => handleReview(3)}>
          <Text style={s.ratingButtonText}>Easy</Text>
        </TouchableOpacity>
      </View>

      {reviewing && (
        <View style={s.reviewingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </View>
  );
}

function getStyles(colors: {background: string; cardBackground: string; cardBorder: string; text: string; textMuted: string; accent: string; segmentBg: string}) {
  const isDark = colors.background === '#1a1a1a';
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    centerContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24},
    loadingText: {marginTop: 16, fontSize: 16, color: colors.textMuted},
    emptyText: {fontSize: 18, color: colors.textMuted, marginBottom: 16},
    backButton: {backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8},
    backButtonText: {color: '#fff', fontSize: 16, fontWeight: '600'},
    header: {flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.cardBackground, borderBottomWidth: 1, borderBottomColor: colors.cardBorder},
    closeButton: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 8},
    closeButtonText: {fontSize: 24, color: colors.textMuted},
    headerInfo: {flex: 1},
    deckName: {fontSize: 18, fontWeight: 'bold', color: colors.text},
    progressText: {fontSize: 14, color: colors.textMuted, marginTop: 2},
    progressBar: {height: 4, backgroundColor: colors.cardBorder},
    progressFill: {height: '100%', backgroundColor: '#4caf50'},
    cardContainer: {
      flex: 1,
      minHeight: 0,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 10,
    },
    card: {width: '100%', alignSelf: 'center'},
    cardShadow: {
      flex: 1,
      borderRadius: 16,
      backgroundColor: colors.cardBackground,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 10,
    },
    cardInner: {flex: 1, position: 'relative'},
    cardFace: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 16,
      padding: 0,
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      backfaceVisibility: 'hidden',
    },
    cardFrontFace: {},
    cardBack: {backgroundColor: colors.segmentBg},
    cardBackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingTop: 8,
      flexShrink: 0,
      gap: 8,
    },
    cardBackHeaderSpacer: {
      flex: 1,
      minWidth: 0,
    },
    cardBackHeaderLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
    },
    typeBadgeInline: {
      flexShrink: 0,
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    cardMainBody: {
      flex: 1,
      width: '100%',
      minHeight: 0,
      justifyContent: 'center',
      alignItems: 'stretch',
    },
    cardMainInner: {
      width: '100%',
      alignItems: 'center',
    },
    cardLabel: {position: 'absolute', top: 8, left: 8, fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1},
    cardText: {fontWeight: '600', color: colors.text, textAlign: 'center', width: '100%'},
    cardTextBack: {textAlign: 'left', alignSelf: 'stretch'},
    contextContainer: {marginTop: 24, padding: 16, backgroundColor: colors.background, borderRadius: 8, width: '100%', borderWidth: 1, borderColor: colors.cardBorder},
    contextLabel: {fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 4},
    contextText: {fontSize: 14, color: colors.textMuted, lineHeight: 20},
    tapHint: {position: 'absolute', bottom: 8, fontSize: 14, color: colors.textMuted},
    typeBadgeText: {fontSize: 11, fontWeight: '600', color: '#fff', textTransform: 'uppercase'},
    ratingContainer: {flexDirection: 'row', padding: 16, gap: 8, backgroundColor: colors.cardBackground, borderTopWidth: 1, borderTopColor: colors.cardBorder},
    ratingButton: {flex: 1, paddingVertical: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
    againButton: {backgroundColor: isDark ? '#5c1a1a' : '#ffebee'},
    hardButton: {backgroundColor: isDark ? '#4a3500' : '#fff3e0'},
    goodButton: {backgroundColor: isDark ? '#1a3a1a' : '#e8f5e9'},
    easyButton: {backgroundColor: isDark ? '#0d2a3d' : '#e3f2fd'},
    ratingButtonText: {fontSize: 18, fontWeight: '700', color: isDark ? '#fff' : '#333'},
    reviewingContainer: {padding: 32, alignItems: 'center', backgroundColor: colors.cardBackground, borderTopWidth: 1, borderTopColor: colors.cardBorder},
  });
}
