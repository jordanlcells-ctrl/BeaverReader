import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
  BackHandler,
} from 'react-native';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../contexts/ThemeContext';
import {deckService, Deck} from '../services/deckService';
import {cardService, Card} from '../services/cardService';
import CardItem from '../components/CardItem';
import CreateCardModal from '../components/CreateCardModal';
import EditCardModal from '../components/EditCardModal';

// Use full device screen size (includes status/nav bar areas) so image leaves no gaps
const SCREEN = Dimensions.get('screen');

export default function DeckDetailScreen() {
  const {colors, resolvedTheme} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {deckId} = route.params as {deckId: string};

  const [deck, setDeck] = useState<Deck | null>(null);
  const [subdecks, setSubdecks] = useState<Array<Deck & {cardCount?: number}>>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  // Modals
  const [showCreateSubdeckModal, setShowCreateSubdeckModal] = useState(false);
  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [showEditCardModal, setShowEditCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [subdeckName, setSubdeckName] = useState('');

  const loadDeckData = async () => {
    const seq = ++loadSeqRef.current;
    try {
      setLoading(true);
      setLoadError(null);
      const [deckData, subdecksData, cardsData] = await Promise.all([
        deckService.getDeck(deckId),
        deckService.getSubdecks(deckId),
        cardService.getCardsByDeck(deckId),
      ]);
      if (seq !== loadSeqRef.current) return;
      setDeck(deckData);

      // Load card counts for each subdeck
      const subdecksWithCounts = await Promise.all(
        subdecksData.map(async (subdeck) => {
          const cardCount = await cardService.getCardCount(subdeck.id);
          return {...subdeck, cardCount};
        }),
      );
      if (seq !== loadSeqRef.current) return;
      setSubdecks(subdecksWithCounts);
      setCards(cardsData);

      // Load due count if this is a subdeck (has cards)
      if (deckData && deckData.parent_deck_id) {
        const count = await cardService.getDueCardCount(deckId);
        if (seq !== loadSeqRef.current) return;
        setDueCount(count);
      }
    } catch (error: any) {
      console.error('Failed to load deck:', error);
      const msg = String(error?.message ?? '');
      const isNetwork = /network request failed/i.test(msg) || error?.name === 'TypeError';
      if (isNetwork) {
        // Avoid a blocking popup on navigation; show a light inline message instead.
        setLoadError('Could not refresh deck (network). Pull to retry or check connection.');
      } else {
        Alert.alert('Error', 'Failed to load deck details.');
      }
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDeckData();
    }, [deckId]),
  );

  const handleBackToParent = useCallback(() => {
    if (deck?.parent_deck_id) {
      // Replace so we don't stack endless DeckDetail screens.
      (navigation as any).replace('DeckDetail', {deckId: deck.parent_deck_id});
      return true;
    }
    return false;
  }, [deck?.parent_deck_id, navigation]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (handleBackToParent()) return true;
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => sub.remove();
    }, [handleBackToParent]),
  );

  // Subdeck handlers
  const handleCreateSubdeck = async () => {
    if (!subdeckName.trim()) return;
    try {
      await deckService.createDeck({
        name: subdeckName.trim(),
        parent_deck_id: deckId,
      });
      setSubdeckName('');
      setShowCreateSubdeckModal(false);
      loadDeckData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteSubdeck = (subdeck: Deck) => {
    Alert.alert('Delete Subdeck', `Delete "${subdeck.name}"? All cards will be lost.`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deckService.deleteDeck(subdeck.id);
            loadDeckData();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleSubdeckPress = (subdeck: Deck) => {
    (navigation as any).navigate('DeckDetail', {deckId: subdeck.id});
  };

  // Card handlers
  const handleEditCard = (card: Card) => {
    setEditingCard(card);
    setShowEditCardModal(true);
  };

  const handleDeleteCard = (card: Card) => {
    Alert.alert('Delete Card', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await cardService.deleteCard(card.id);
            loadDeckData();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, {backgroundColor: colors.background}]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!deck) {
    return (
      <View style={[styles.centerContainer, {backgroundColor: colors.background}]}>
        <Text style={[styles.errorText, {color: colors.textMuted}]}>Deck not found</Text>
        <TouchableOpacity
          style={[styles.goBackButton, {backgroundColor: colors.accent}]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const headerPaddingTop = Math.max(insets.top, 8) + 4;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: deck.parent_deck_id ? colors.background : 'transparent'},
      ]}>
      {!!loadError && (
        <View style={[styles.inlineErrorBar, {backgroundColor: colors.signOutBg, borderColor: colors.signOutBorder}]}>
          <Text style={[styles.inlineErrorText, {color: colors.signOutText}]} numberOfLines={2}>
            {loadError}
          </Text>
        </View>
      )}
      {/* Main book deck: image + tint full screen; transparent header over image; scroll only subdecks */}
      {!deck.parent_deck_id ? (
        <View style={styles.subdeckFullscreen}>
          <Image
            source={require('../../assets/Gemini_Generated_Image_gvtc0hgvtc0hgvtc.png')}
            style={[styles.subdeckFixedImage, {width: SCREEN.width, height: SCREEN.height}]}
            resizeMode="cover"
            pointerEvents="none"
            accessibilityIgnoresInvertColors
          />
          <View style={styles.subdeckFixedTint} pointerEvents="none" />
          <View style={styles.subdeckForeground}>
            <View style={[styles.header, styles.headerTransparent, {paddingTop: headerPaddingTop}]}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  if (!handleBackToParent()) navigation.goBack();
                }}
                activeOpacity={0.6}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={[styles.backChevron, styles.headerOnImageText, {color: colors.accent}]}>‹</Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.headerTitle,
                  styles.headerTitleRow,
                  styles.headerOnImageText,
                  {color: '#fff'},
                ]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {deck.name}
              </Text>
            </View>
            <ScrollView
              style={styles.subdeckScrollView}
              contentContainerStyle={[
                styles.subdeckScrollContent,
                {paddingBottom: Math.max(48, 32 + insets.bottom)},
              ]}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              bounces>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, {color: '#fff'}]}>Subdecks ({subdecks.length})</Text>
              <TouchableOpacity
                style={[styles.addButton, {backgroundColor: colors.accent}]}
                onPress={() => setShowCreateSubdeckModal(true)}>
                <Text style={styles.addButtonText}>+ Add Subdeck</Text>
              </TouchableOpacity>
            </View>

            {subdecks.length === 0 ? (
              <View style={[styles.emptySection, {backgroundColor: colors.cardBackground, borderColor: colors.cardBorder}]}>
                <Text style={[styles.emptySectionText, {color: colors.textMuted}]}>
                  No subdecks yet. Create one to organize your cards.
                </Text>
              </View>
            ) : (
              subdecks.map((subdeck) => (
                <TouchableOpacity
                  key={subdeck.id}
                  style={[
                    styles.subdeckCard,
                    {
                      backgroundColor: colors.cardBackground,
                      borderColor: colors.cardBorder,
                      borderLeftColor: colors.accent,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSubdeckPress(subdeck)}>
                  <View style={styles.subdeckInfo}>
                    <Text style={[styles.subdeckName, {color: colors.text}]}>{subdeck.name}</Text>
                    <Text style={[styles.subdeckCount, {color: colors.textMuted}]}>
                      {subdeck.cardCount || 0} cards
                    </Text>
                  </View>
                  <View style={styles.subdeckActions}>
                    <TouchableOpacity
                      style={[styles.deleteSmallButton, {backgroundColor: colors.signOutBg, borderColor: colors.signOutBorder}]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteSubdeck(subdeck);
                      }}
                      activeOpacity={0.7}>
                      <Text style={styles.deleteSmallText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
            )}
            </ScrollView>
          </View>
        </View>
      ) : (
        <>
          <StatusBar
            backgroundColor={colors.background}
            barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
            translucent={Platform.OS === 'android' ? false : undefined}
          />
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.background,
                borderBottomColor: colors.cardBorder,
                paddingTop: headerPaddingTop,
              },
            ]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                if (!handleBackToParent()) navigation.goBack();
              }}
              activeOpacity={0.6}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={[styles.backChevron, {color: colors.accent}]}>‹</Text>
            </TouchableOpacity>
            <Text
              style={[styles.headerTitle, styles.headerTitleRow, {color: colors.text}]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {deck.name}
            </Text>
          </View>
          <ScrollView
            style={styles.cardsScrollView}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            {cards.length > 0 && (
              <View style={styles.reviewButtonsContainer}>
                <TouchableOpacity
                  style={[styles.reviewButton, {backgroundColor: colors.accent}]}
                  activeOpacity={0.7}
                  onPress={() =>
                    (navigation as any).navigate('ReviewSession', {
                      deckId: deck.id,
                      deckName: deck.name,
                    })
                  }>
                  <Text style={styles.reviewButtonText}>🎴 Review</Text>
                  {dueCount > 0 && (
                    <View style={styles.dueCountBadge}>
                      <Text style={styles.dueCountText}>{dueCount} due</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.reviewButton, styles.studyButton]}
                  activeOpacity={0.7}
                  onPress={() =>
                    (navigation as any).navigate('StudyMode', {
                      deckId: deck.id,
                      deckName: deck.name,
                    })
                  }>
                  <Text style={styles.reviewButtonText}>📚 Study</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, {color: colors.text}]}>Cards ({cards.length})</Text>
              <TouchableOpacity
                style={[styles.addButton, {backgroundColor: colors.accent}]}
                onPress={() => setShowCreateCardModal(true)}>
                <Text style={styles.addButtonText}>+ Add Card</Text>
              </TouchableOpacity>
            </View>

            {cards.length === 0 ? (
              <View style={[styles.emptySection, {backgroundColor: colors.cardBackground, borderColor: colors.cardBorder}]}>
                <Text style={[styles.emptySectionText, {color: colors.textMuted}]}>No cards yet. Add cards to study!</Text>
              </View>
            ) : (
              cards.map((card) => (
                <CardItem
                  key={card.id}
                  card={card}
                  onEdit={() => handleEditCard(card)}
                  onDelete={() => handleDeleteCard(card)}
                  colors={colors}
                />
              ))
            )}
          </View>
        </ScrollView>
        </>
      )}

      {/* Create Subdeck Modal */}
      <Modal
        visible={showCreateSubdeckModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateSubdeckModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: colors.cardBackground}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>Create Subdeck</Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.chipBg,
                  color: colors.text,
                  borderColor: colors.cardBorder,
                },
              ]}
              placeholder="Subdeck name (e.g. Vocabulary, Grammar)"
              placeholderTextColor={colors.textMuted}
              value={subdeckName}
              onChangeText={setSubdeckName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, {backgroundColor: colors.chipBg, borderColor: colors.cardBorder}]}
                onPress={() => {
                  setShowCreateSubdeckModal(false);
                  setSubdeckName('');
                }}>
                <Text style={[styles.modalCancelText, {color: colors.textMuted}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton, {backgroundColor: colors.accent}]}
                onPress={handleCreateSubdeck}>
                <Text style={styles.modalSaveText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Card Modal */}
      <CreateCardModal
        visible={showCreateCardModal}
        deckId={deckId}
        onClose={() => setShowCreateCardModal(false)}
        onSuccess={() => {
          setShowCreateCardModal(false);
          loadDeckData();
        }}
      />

      {/* Edit Card Modal */}
      {editingCard && (
        <EditCardModal
          visible={showEditCardModal}
          card={editingCard}
          onClose={() => {
            setShowEditCardModal(false);
            setEditingCard(null);
          }}
          onSuccess={() => {
            setShowEditCardModal(false);
            setEditingCard(null);
            loadDeckData();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F5F0',
  },
  errorText: {
    fontSize: 16,
    color: '#8A8171',
    marginBottom: 16,
  },
  goBackButton: {
    backgroundColor: '#6B8E73',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F7F5F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D6',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  backChevron: {
    fontSize: 34,
    color: '#6B8E73',
    fontWeight: '300',
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3D5A46',
    letterSpacing: -0.3,
  },
  headerTitleRow: {
    flex: 1,
    marginRight: 8,
  },
  /** Full-bleed image behind transparent header + scroll (main book deck only) */
  subdeckFullscreen: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    /** Fallback if image is slow to paint (edge-to-edge draws behind system bars) */
    backgroundColor: '#1a1f1c',
  },
  subdeckForeground: {
    flex: 1,
    zIndex: 1,
  },
  headerTransparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  /** Improves readability of back + title over the illustration */
  headerOnImageText: {
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 6,
  },
  /** Explicit screen dimensions so image covers behind system bars too (no black gaps) */
  subdeckFixedImage: {
    position: 'absolute',
    top: -40,
    left: 0,
  },
  subdeckFixedTint: {
    position: 'absolute',
    top: -40,
    left: 0,
    width: SCREEN.width,
    height: SCREEN.height,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  subdeckScrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  subdeckScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexGrow: 1,
  },
  cardsScrollView: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3D5A46',
    letterSpacing: -0.2,
  },
  addButton: {
    backgroundColor: '#6B8E73',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptySection: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#FAF8F3',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  emptySectionText: {
    fontSize: 15,
    color: '#8A8171',
    textAlign: 'center',
    lineHeight: 22,
  },
  subdeckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F3',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#7BA668',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    shadowColor: '#8B7355',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  subdeckInfo: {
    flex: 1,
  },
  subdeckName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3D5A46',
    marginBottom: 4,
  },
  subdeckCount: {
    fontSize: 13,
    color: '#8A8171',
  },
  subdeckActions: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteSmallButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F5E6E3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8D0CC',
  },
  deleteSmallText: {
    fontSize: 16,
  },
  reviewButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  reviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B8E73',
    padding: 16,
    borderRadius: 14,
    shadowColor: '#3D5A46',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  studyButton: {
    backgroundColor: '#C48B6C',
  },
  reviewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  inlineErrorBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 9999,
  },
  inlineErrorText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dueCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
  },
  dueCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45, 60, 48, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: '#FDFCF8',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3D5A46',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#FAF8F3',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#3D5A46',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E8E0D6',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F0EBE3',
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8171',
  },
  modalSaveButton: {
    backgroundColor: '#6B8E73',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
