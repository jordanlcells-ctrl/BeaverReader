import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {deckService, Deck} from '../services/deckService';
import {cardService} from '../services/cardService';
import CreateDeckModal from '../components/CreateDeckModal';

interface DeckWithCount extends Deck {
  cardCount?: number;
}

export default function DecksScreen() {
  const navigation = useNavigation();
  const [allDecks, setAllDecks] = useState<DeckWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [parentDeck, setParentDeck] = useState<Deck | null>(null);

  const loadDecks = async () => {
    try {
      setLoading(true);
      // Load ALL top-level decks (both manual and book-linked)
      const data = await deckService.getTopLevelDecks();
      
      // Load card counts for each deck
      const decksWithCounts = await Promise.all(
        data.map(async (deck) => {
          const cardCount = await cardService.getCardCount(deck.id);
          return {...deck, cardCount};
        })
      );
      
      setAllDecks(decksWithCounts);
    } catch (error: any) {
      console.error('Failed to load decks:', error);
      Alert.alert('Error', 'Failed to load decks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDecks();
    setRefreshing(false);
  };

  // Reload decks when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDecks();
    }, [])
  );

  const handleCreateDeck = () => {
    setEditingDeck(null);
    setParentDeck(null);
    setShowCreateModal(true);
  };

  const handleCreateSubdeck = (parentDeck: Deck) => {
    setEditingDeck(null);
    setParentDeck(parentDeck);
    setShowCreateModal(true);
  };

  const handleEditDeck = (deck: Deck) => {
    setEditingDeck(deck);
    setParentDeck(null);
    setShowCreateModal(true);
  };

  const handleDeleteDeck = (deck: Deck) => {
    Alert.alert(
      'Delete Deck',
      `Are you sure you want to delete "${deck.name}"? This will also delete all subdecks and cards inside it.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deckService.deleteDeck(deck.id);
              await loadDecks();
              Alert.alert('Success', 'Deck deleted successfully');
            } catch (error: any) {
              console.error('Failed to delete deck:', error);
              Alert.alert('Error', 'Failed to delete deck. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderDeck = ({item}: {item: DeckWithCount}) => {
    // Check if this is a book-linked deck
    const isBookDeck = item.book_id !== null;
    
    return (
      <View style={styles.deckCard}>
        <TouchableOpacity
          style={styles.deckContent}
          onPress={() => navigation.navigate('DeckDetail' as never, {deckId: item.id} as never)}>
          <View style={styles.deckInfo}>
            <View style={styles.deckNameRow}>
              <Text style={styles.deckName}>
                {isBookDeck ? '📖' : '📁'} {item.name}
              </Text>
              {(item.cardCount !== undefined && item.cardCount > 0) && (
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>{item.cardCount} 🃏</Text>
                </View>
              )}
            </View>
            <Text style={styles.deckMeta}>
              {isBookDeck ? '📚 Book Deck • ' : ''}Created {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.deckActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditDeck(item)}>
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          {!isBookDeck && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteDeck(item)}>
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                Delete
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading decks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Decks</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateDeck}>
          <Text style={styles.createButtonText}>+ New Deck</Text>
        </TouchableOpacity>
      </View>

      {/* Decks List */}
      {allDecks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No decks yet</Text>
          <Text style={styles.emptyText}>
            Upload a book to auto-create a deck, or create a manual deck here!
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={handleCreateDeck}>
            <Text style={styles.emptyButtonText}>Create Deck</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={allDecks}
          renderItem={renderDeck}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreateDeckModal
          visible={showCreateModal}
          deck={editingDeck}
          parentDeck={parentDeck}
          onClose={() => {
            setShowCreateModal(false);
            setEditingDeck(null);
            setParentDeck(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingDeck(null);
            setParentDeck(null);
            loadDecks();
          }}
        />
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deckContent: {
    marginBottom: 12,
  },
  deckInfo: {
    flex: 1,
  },
  deckNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deckName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  cardBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  cardBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976d2',
  },
  deckDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  deckMeta: {
    fontSize: 12,
    color: '#999',
  },
  deckActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  deleteButtonText: {
    color: '#d32f2f',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
