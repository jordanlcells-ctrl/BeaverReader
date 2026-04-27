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
import {RootStackParamList} from '../types';
import {useTheme} from '../contexts/ThemeContext';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  getCardTypography,
  getAdaptiveCardMainStyle,
  cardBodyMargins,
} from '../utils/cardTypography';
import {computeFlashCardLayout} from '../utils/flashCardLayout';
import {compactCardBackDisplay} from '../utils/compactCardBack';

type StudyModeRouteProp = RouteProp<RootStackParamList, 'StudyMode'>;

export default function StudyModeScreen() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const route = useRoute<StudyModeRouteProp>();
  const {deckId, deckName} = route.params;
  const {width: winW, height: winH} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Laid-out size of `cardMainBody` so adaptive type uses real space on the card. */
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

  const s = useMemo(() => getStyles(colors), [colors]);

  const cardLayout = useMemo(
    () =>
      computeFlashCardLayout(winW, winH, insets, 'study', currentCard ?? undefined),
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
      <SafeAreaView edges={['top']} style={s.headerSafeArea}>
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
      </SafeAreaView>

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
          activeOpacity={0.9}>
          <Animated.View style={[s.cardShadow, {transform: [{scale: flipScale}]}]}>
            <View style={s.cardInner}>
              <Animated.View
                style={[
                  s.cardFace,
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

      {/* Navigation Buttons */}
      <SafeAreaView edges={['bottom']} style={s.navSafeArea}>
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
      </SafeAreaView>
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
    headerSafeArea: {
      backgroundColor: colors.cardBackground,
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
      minHeight: 0,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 10,
    },
    card: {
      width: '100%',
      alignSelf: 'center',
    },
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
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 0,
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      backfaceVisibility: 'hidden',
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
    cardBack: {
      backgroundColor: colors.segmentBg,
    },
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
    cardLabel: {
      position: 'absolute',
      top: 8,
      left: 8,
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
    },
    cardText: {
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      width: '100%',
    },
    cardTextBack: {
      textAlign: 'left',
      alignSelf: 'stretch',
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
      bottom: 8,
      fontSize: 14,
      color: colors.textMuted,
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
    navSafeArea: {
      backgroundColor: colors.cardBackground,
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
