import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import {deckService, Deck} from '../services/deckService';
import {cardService, Card} from '../services/cardService';
import CardItem from '../components/CardItem';
import CreateCardModal from '../components/CreateCardModal';
import EditCardModal from '../components/EditCardModal';

export default function DeckDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const {deckId} = route.params as {deckId: string};

  const [deck, setDeck] = useState<Deck | null>(null);
  const [subdecks, setSubdecks] = useState<Array<Deck & {cardCount?: number}>>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateSubdeckModal, setShowCreateSubdeckModal] = useState(false);
  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [showEditCardModal, setShowEditCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [subdeckName, setSubdeckName] = useState('');

  const loadDeckData = async () => {
    try {
      setLoading(true);
      const [deckData, subdecksData, cardsData] = await Promise.all([
        deckService.getDeck(deckId),
        deckService.getSubdecks(deckId),
        cardService.getCardsByDeck(deckId),
      ]);
      setDeck(deckData);

      // Load card counts for each subdeck
      const subdecksWithCounts = await Promise.all(
        subdecksData.map(async (subdeck) => {
          const cardCount = await cardService.getCardCount(subdeck.id);
          return {...subdeck, cardCount};
        }),
      );
      setSubdecks(subdecksWithCounts);
      setCards(cardsData);

      // Load due count if this is a subdeck (has cards)
      if (deckData && deckData.parent_deck_id) {
        const count = await cardService.getDueCardCount(deckId);
        setDueCount(count);
      }
    } catch (error: any) {
      console.error('Failed to load deck:', error);
      Alert.alert('Error', 'Failed to load deck details.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDeckData();
    }, [deckId]),
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6B8E73" />
      </View>
    );
  }

  if (!deck) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Deck not found</Text>
        <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.6}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>{deck.name}</Text>
        </View>
      </View>

      {/* Content */}
      <FlatList
        data={[] as any[]}
        renderItem={() => null}
        ListHeaderComponent={
          <>
            {/* Subdecks Section - Only show for main book decks */}
            {!deck.parent_deck_id && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Subdecks ({subdecks.length})</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowCreateSubdeckModal(true)}>
                    <Text style={styles.addButtonText}>+ Add Subdeck</Text>
                  </TouchableOpacity>
                </View>

                {subdecks.length === 0 ? (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>
                      No subdecks yet. Create one to organize your cards.
                    </Text>
                  </View>
                ) : (
                  subdecks.map((subdeck) => (
                    <TouchableOpacity
                      key={subdeck.id}
                      style={styles.subdeckCard}
                      activeOpacity={0.7}
                      onPress={() => handleSubdeckPress(subdeck)}>
                      <View style={styles.subdeckInfo}>
                        <Text style={styles.subdeckName}>{subdeck.name}</Text>
                        <Text style={styles.subdeckCount}>
                          {subdeck.cardCount || 0} cards
                        </Text>
                      </View>
                      <View style={styles.subdeckActions}>
                        <TouchableOpacity
                          style={styles.deleteSmallButton}
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
              </View>
            )}

            {/* Cards Section - Only show for subdecks */}
            {deck.parent_deck_id && (
              <View style={styles.section}>
                {/* Review/Study Buttons */}
                {cards.length > 0 && (
                  <View style={styles.reviewButtonsContainer}>
                    <TouchableOpacity
                      style={styles.reviewButton}
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
                  <Text style={styles.sectionTitle}>Cards ({cards.length})</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowCreateCardModal(true)}>
                    <Text style={styles.addButtonText}>+ Add Card</Text>
                  </TouchableOpacity>
                </View>

                {cards.length === 0 ? (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>
                      No cards yet. Add cards to study!
                    </Text>
                  </View>
                ) : (
                  cards.map((card) => (
                    <CardItem
                      key={card.id}
                      card={card}
                      onEdit={() => handleEditCard(card)}
                      onDelete={() => handleDeleteCard(card)}
                    />
                  ))
                )}
              </View>
            )}
          </>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Create Subdeck Modal */}
      <Modal
        visible={showCreateSubdeckModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateSubdeckModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Subdeck</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Subdeck name (e.g. Vocabulary, Grammar)"
              placeholderTextColor="#A3B5A7"
              value={subdeckName}
              onChangeText={setSubdeckName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowCreateSubdeckModal(false);
                  setSubdeckName('');
                }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
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
    paddingTop: 52,
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
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3D5A46',
    letterSpacing: -0.3,
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
