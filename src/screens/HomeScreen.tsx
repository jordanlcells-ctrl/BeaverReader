import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
  FlatList,
  RefreshControl,
  ScrollView,
  Dimensions,
  DeviceEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '../contexts/AuthContext';
import {useTheme} from '../contexts/ThemeContext';
import {bookService} from '../services/bookService';
import {BookList} from '../components/BookList';
import {deckService, Deck} from '../services/deckService';
import {cardService} from '../services/cardService';
import CreateDeckModal from '../components/CreateDeckModal';
import {SettingsContent} from '../components/SettingsContent';
import type {Book, RootStackParamList} from '../types';
import {PDF_PREP_DONE, pdfFirstTextOpenKey} from '../services/pdfPrepEvents';
import {PdfBackgroundPrep, PdfPrepTask} from '../components/PdfBackgroundPrep';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type TabType = 'books' | 'decks' | 'settings';

interface DeckWithCount extends Deck {
  cardCount?: number;
}

export const HomeScreen: React.FC<Props> = ({navigation}) => {
  const {user} = useAuth();
  const {resolvedTheme, colors} = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('books');

  // ─── Books state ───
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksRefreshing, setBooksRefreshing] = useState(false);
  const [processingBooks, setProcessingBooks] = useState<Set<string>>(new Set());
  const [prepQueue, setPrepQueue] = useState<PdfPrepTask[]>([]);

  // ─── Decks state ───
  const [allDecks, setAllDecks] = useState<DeckWithCount[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [decksRefreshing, setDecksRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);

  // ═══════════════════════════════════════
  // Books logic
  // ═══════════════════════════════════════
  const loadBooks = useCallback(async () => {
    try {
      const data = await bookService.getBooks();
      setBooks(data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load books: ' + error.message);
    } finally {
      setBooksLoading(false);
      setBooksRefreshing(false);
    }
  }, []);

  const handleAddBook = async () => {
    try {
      const book = await bookService.uploadBook();
      if (book) {
        await loadBooks();
        const isPdf = String(book.file_type || '').toLowerCase() === 'pdf';
        if (isPdf) {
          setProcessingBooks(prev => new Set(prev).add(book.id));
          setPrepQueue(q => [...q, {bookId: book.id, filePath: book.file_path}]);
        } else {
          navigation.navigate('BookReader', {bookId: book.id});
        }
      }
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to upload book');
    }
  };

  const handleBookPress = async (book: Book) => {
    if (processingBooks.has(book.id)) {
      return;
    }
    if (book.file_type === 'epub') {
      navigation.navigate('BookReader', {bookId: book.id});
      return;
    }
    if (String(book.file_type).toLowerCase() === 'pdf') {
      const firstText = await AsyncStorage.getItem(pdfFirstTextOpenKey(book.id));
      navigation.navigate('PDFReader', {
        bookId: book.id,
        preferTextMode: firstText === '1',
      });
      if (firstText === '1') {
        await AsyncStorage.removeItem(pdfFirstTextOpenKey(book.id));
      }
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    try {
      await bookService.deleteBook(bookId);
      Alert.alert('Success', 'Book deleted');
      loadBooks();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to delete book: ' + error.message);
    }
  };

  const handleRenameBook = async (bookId: string, newTitle: string) => {
    try {
      await bookService.updateBook(bookId, {title: newTitle});
      loadBooks();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to rename book: ' + error.message);
    }
  };

  const handleBooksRefresh = () => {
    setBooksRefreshing(true);
    loadBooks();
  };

  // ═══════════════════════════════════════
  // Decks logic
  // ═══════════════════════════════════════
  const loadDecks = async () => {
    try {
      setDecksLoading(true);
      const data = await deckService.getTopLevelDecks();
      const decksWithCounts = await Promise.all(
        data.map(async (deck) => {
          const cardCount = await cardService.getCardCount(deck.id);
          return {...deck, cardCount};
        }),
      );
      setAllDecks(decksWithCounts);
    } catch (error: any) {
      console.error('Failed to load decks:', error);
      Alert.alert('Error', 'Failed to load decks.');
    } finally {
      setDecksLoading(false);
      setDecksRefreshing(false);
    }
  };

  const handleDecksRefresh = async () => {
    setDecksRefreshing(true);
    await loadDecks();
  };

  const handleCreateDeck = () => {
    setEditingDeck(null);
    setShowCreateModal(true);
  };

  const handleEditDeck = (deck: Deck) => {
    setEditingDeck(deck);
    setShowCreateModal(true);
  };

  const handleDeleteDeck = (deck: Deck) => {
    Alert.alert(
      'Delete Deck',
      `Are you sure you want to delete "${deck.name}"? This will also delete all subdecks and cards.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deckService.deleteDeck(deck.id);
              await loadDecks();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete deck.');
            }
          },
        },
      ],
    );
  };

  const handleDeckPress = (deck: DeckWithCount) => {
    (navigation as any).navigate('DeckDetail', {deckId: deck.id});
  };

  // ═══════════════════════════════════════
  // Load on focus
  // ═══════════════════════════════════════
  useFocusEffect(
    useCallback(() => {
      loadBooks();
      loadDecks();
    }, []),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PDF_PREP_DONE, (bookId: string) => {
      if (!bookId) return;
      setProcessingBooks(prev => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
    });
    return () => sub.remove();
  }, []);

  const onPrepFinished = useCallback(() => {
    setPrepQueue(q => q.slice(1));
  }, []);

  // ═══════════════════════════════════════
  // Render: Decks tab content
  // ═══════════════════════════════════════
  const renderDeckItem = ({item}: {item: DeckWithCount}) => {
    const isBookDeck = item.book_id !== null;
    return (
      <TouchableOpacity
        style={[styles.deckCard, {backgroundColor: colors.cardBackground, borderColor: colors.cardBorder}]}
        activeOpacity={0.7}
        onPress={() => handleDeckPress(item)}>
        <View style={styles.deckInfo}>
          <View style={styles.deckNameRow}>
            <Text style={styles.deckIcon}>{isBookDeck ? '📖' : '📁'}</Text>
            <Text style={[styles.deckName, {color: colors.text}]} numberOfLines={1}>{item.name}</Text>
          </View>
          <Text style={[styles.deckMeta, {color: colors.textMuted}]}>
            {item.cardCount !== undefined && item.cardCount > 0
              ? `${item.cardCount} cards`
              : 'No cards yet'}
            {isBookDeck ? '  ·  Book Deck' : ''}
          </Text>
        </View>
        <View style={styles.deckActions}>
          <TouchableOpacity
            style={[styles.deckActionBtn, {backgroundColor: colors.chipBg}]}
            onPress={() => handleEditDeck(item)}
            activeOpacity={0.7}>
            <Text style={[styles.deckActionText, {color: colors.accent}]}>Edit</Text>
          </TouchableOpacity>
          {!isBookDeck && (
            <TouchableOpacity
              style={[styles.deckActionBtn, styles.deckDeleteBtn, {backgroundColor: colors.signOutBg}]}
              onPress={() => handleDeleteDeck(item)}
              activeOpacity={0.7}>
              <Text style={[styles.deckDeleteText, {color: colors.signOutText}]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDecksTab = () => {
    if (decksLoading && !decksRefreshing) {
      return (
        <View style={styles.tabCenterContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {/* Decks header row */}
        <View style={styles.tabSectionHeader}>
          <Text style={[styles.tabSectionTitle, {color: colors.textMuted}]}>
            {allDecks.length} {allDecks.length === 1 ? 'deck' : 'decks'}
          </Text>
          <TouchableOpacity
            style={[styles.newDeckButton, {backgroundColor: colors.accent}]}
            onPress={handleCreateDeck}
            activeOpacity={0.7}>
            <Text style={styles.newDeckButtonText}>+ New Deck</Text>
          </TouchableOpacity>
        </View>

        {allDecks.length === 0 ? (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyTabIcon}>🗂️</Text>
            <Text style={[styles.emptyTabTitle, {color: colors.text}]}>No Decks Yet</Text>
            <Text style={[styles.emptyTabText, {color: colors.textMuted}]}>
              Upload a book to auto-create a deck,{'\n'}or create one manually.
            </Text>
            <TouchableOpacity
              style={[styles.emptyTabButton, {backgroundColor: colors.accent}]}
              onPress={handleCreateDeck}
              activeOpacity={0.7}>
              <Text style={styles.emptyTabButtonText}>Create Deck</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={allDecks}
            renderItem={renderDeckItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.deckListContent}
            refreshControl={
              <RefreshControl
                refreshing={decksRefreshing}
                onRefresh={handleDecksRefresh}
                tintColor={colors.accent}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <CreateDeckModal
            visible={showCreateModal}
            deck={editingDeck}
            onClose={() => {
              setShowCreateModal(false);
              setEditingDeck(null);
            }}
            onSuccess={() => {
              setShowCreateModal(false);
              setEditingDeck(null);
              loadDecks();
            }}
          />
        )}
      </View>
    );
  };

  // ═══════════════════════════════════════
  // Render: Settings tab content
  // ═══════════════════════════════════════
  const renderSettingsTab = () => (
    <View style={[styles.tabContent, {flex: 1}]}>
      <SettingsContent />
    </View>
  );

  // ═══════════════════════════════════════
  // Render: Books tab content
  // ═══════════════════════════════════════
  const renderBooksTab = () => {
    if (booksLoading) {
      return (
        <View style={styles.tabCenterContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.tabSectionHeader}>
          <Text style={[styles.tabSectionTitle, {color: colors.textMuted}]}>
            {books.length} {books.length === 1 ? 'book' : 'books'}
          </Text>
        </View>
        <BookList
          books={books}
          onBookPress={handleBookPress}
          onDeleteBook={handleDeleteBook}
          onRenameBook={handleRenameBook}
          refreshing={booksRefreshing}
          onRefresh={handleBooksRefresh}
          colors={colors}
          processingBooks={processingBooks}
        />
      </View>
    );
  };

  // ═══════════════════════════════════════
  // Main render
  // ═══════════════════════════════════════
  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Header: text on top, beaver below (bigger) */}
      <View style={[styles.header, {backgroundColor: colors.background}]}>
        <Text style={[styles.title, {color: colors.text}]} includeFontPadding={false}>BeaverReader</Text>
        <View style={styles.headerLogoWrap}>
          <Image
            source={require('../../assets/beaverswim.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Segmented Control */}
      <View style={[styles.segmentedContainer, {backgroundColor: colors.background}]}>
        <View style={[styles.segmentedControl, {backgroundColor: colors.segmentBg}]}>
          {(['books', 'decks', 'settings'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.segment,
                activeTab === tab && {backgroundColor: colors.segmentActive},
              ]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.segmentText,
                  {color: activeTab === tab ? colors.segmentTextActive : colors.segmentText},
                ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab content */}
      {activeTab === 'books' && renderBooksTab()}
      {activeTab === 'decks' && renderDecksTab()}
      {activeTab === 'settings' && renderSettingsTab()}

      {/* FAB - only on Books tab */}
      {activeTab === 'books' && (
        <TouchableOpacity
          style={[styles.fab, {backgroundColor: colors.accent, bottom: insets.bottom + 24}]}
          onPress={handleAddBook}
          activeOpacity={0.8}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      <PdfBackgroundPrep task={prepQueue[0] ?? null} onFinished={onPrepFinished} />
    </View>
  );
};

// ═══════════════════════════════════════
// Styles
// ═══════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },

  // Header: title and tabs higher – less top/bottom padding, smaller logo
  header: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 50,
    paddingBottom: 0,
    paddingHorizontal: 20,
    backgroundColor: '#F7F5F0',
  },
  headerLogoWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: -75,
    marginBottom: -15,
  },
  headerLogo: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
  },
  title: {
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '800',
    color: '#3D5A46',
    letterSpacing: -0.5,
  },

  // Segmented control – higher up, less gap below header
  segmentedContainer: {
    paddingHorizontal: 20,
    paddingTop: 0,
    marginTop: -8,
    paddingBottom: 10,
    backgroundColor: '#F7F5F0',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F0EBE3',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#6B8E73',
    shadowColor: '#3D5A46',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8A8171',
    letterSpacing: -0.1,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Tab content
  tabContent: {
    flex: 1,
  },
  tabCenterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 2,
  },
  tabSectionTitle: {
    fontSize: 14,
    color: '#8A8171',
    fontWeight: '500',
    letterSpacing: -0.1,
  },

  // Empty tab
  emptyTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTabIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTabTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3D5A46',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyTabText: {
    fontSize: 15,
    color: '#8A8171',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  emptyTabButton: {
    backgroundColor: '#6B8E73',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyTabButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Decks tab
  newDeckButton: {
    backgroundColor: '#6B8E73',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newDeckButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deckListContent: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  deckCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    shadowColor: '#8B7355',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  deckInfo: {
    marginBottom: 10,
  },
  deckNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  deckIcon: {
    fontSize: 18,
  },
  deckName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3D5A46',
    flex: 1,
    letterSpacing: -0.2,
  },
  deckMeta: {
    fontSize: 13,
    color: '#A3B5A7',
    marginLeft: 26,
  },
  deckActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  deckActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F0EBE3',
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  deckActionText: {
    fontSize: 13,
    color: '#6B8E73',
    fontWeight: '600',
  },
  deckDeleteBtn: {
    backgroundColor: '#F5E6E3',
    borderColor: '#E8D0CC',
  },
  deckDeleteText: {
    fontSize: 13,
    color: '#C05050',
    fontWeight: '600',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#6B8E73',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3D5A46',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '300',
    marginTop: -1,
  },
});
