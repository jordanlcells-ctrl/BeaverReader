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
  TextInput,
  Linking,
  Dimensions,
} from 'react-native';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useAuth} from '../contexts/AuthContext';
import {bookService} from '../services/bookService';
import {BookList} from '../components/BookList';
import {deckService, Deck} from '../services/deckService';
import {cardService} from '../services/cardService';
import {apiKeyService} from '../services/apiKeyService';
import {grammarService} from '../services/grammarService';
import CreateDeckModal from '../components/CreateDeckModal';
import type {Book, RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type TabType = 'books' | 'decks' | 'settings';

interface DeckWithCount extends Deck {
  cardCount?: number;
}

export const HomeScreen: React.FC<Props> = ({navigation}) => {
  const {user, signOut} = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('books');

  // ─── Books state ───
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksRefreshing, setBooksRefreshing] = useState(false);

  // ─── Decks state ───
  const [allDecks, setAllDecks] = useState<DeckWithCount[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [decksRefreshing, setDecksRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);

  // ─── Settings state ───
  const [translateKey, setTranslateKey] = useState('');
  const [translateSaved, setTranslateSaved] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiSaved, setOpenaiSaved] = useState(false);

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
        Alert.alert('Success', `"${book.title}" added to your library!`);
        loadBooks();
      }
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to upload book');
    }
  };

  const handleBookPress = (book: Book) => {
    if (book.file_type === 'epub') {
      navigation.navigate('BookReader', {bookId: book.id});
    } else if (book.file_type === 'pdf') {
      navigation.navigate('PDFReader', {bookId: book.id});
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
  // Settings logic
  // ═══════════════════════════════════════
  const loadApiKeys = async () => {
    try {
      const savedTranslateKey = await apiKeyService.getLibreTranslateKey();
      if (savedTranslateKey) {
        setTranslateKey(savedTranslateKey);
        setTranslateSaved(true);
      }
      const savedOpenaiKey = await grammarService.getApiKey();
      if (savedOpenaiKey) {
        setOpenaiKey(savedOpenaiKey);
        setOpenaiSaved(true);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  const handleSaveTranslateKey = async () => {
    if (!translateKey.trim()) { Alert.alert('Error', 'Please enter an API key'); return; }
    try {
      await apiKeyService.saveLibreTranslateKey(translateKey.trim());
      setTranslateSaved(true);
      Alert.alert('Saved!', 'Translation API key saved.');
    } catch (error: any) { Alert.alert('Error', error.message); }
  };

  const handleRemoveTranslateKey = async () => {
    try {
      await apiKeyService.removeLibreTranslateKey();
      setTranslateKey('');
      setTranslateSaved(false);
      Alert.alert('Removed', 'Translation API key removed.');
    } catch (error: any) { Alert.alert('Error', error.message); }
  };

  const handleSaveOpenAIKey = async () => {
    if (!openaiKey.trim()) { Alert.alert('Error', 'Please enter an API key'); return; }
    try {
      await grammarService.saveApiKey(openaiKey.trim());
      setOpenaiSaved(true);
      Alert.alert('Saved!', 'OpenAI API key saved.');
    } catch (error: any) { Alert.alert('Error', error.message); }
  };

  const handleRemoveOpenAIKey = async () => {
    try {
      await grammarService.clearApiKey();
      setOpenaiKey('');
      setOpenaiSaved(false);
      Alert.alert('Removed', 'OpenAI API key removed.');
    } catch (error: any) { Alert.alert('Error', error.message); }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Sign Out', style: 'destructive', onPress: signOut},
    ]);
  };

  // ═══════════════════════════════════════
  // Load on focus
  // ═══════════════════════════════════════
  useFocusEffect(
    useCallback(() => {
      loadBooks();
      loadDecks();
      loadApiKeys();
    }, []),
  );

  // ═══════════════════════════════════════
  // Render: Decks tab content
  // ═══════════════════════════════════════
  const renderDeckItem = ({item}: {item: DeckWithCount}) => {
    const isBookDeck = item.book_id !== null;
    return (
      <TouchableOpacity
        style={styles.deckCard}
        activeOpacity={0.7}
        onPress={() => handleDeckPress(item)}>
        <View style={styles.deckInfo}>
          <View style={styles.deckNameRow}>
            <Text style={styles.deckIcon}>{isBookDeck ? '📖' : '📁'}</Text>
            <Text style={styles.deckName} numberOfLines={1}>{item.name}</Text>
          </View>
          <Text style={styles.deckMeta}>
            {item.cardCount !== undefined && item.cardCount > 0
              ? `${item.cardCount} cards`
              : 'No cards yet'}
            {isBookDeck ? '  ·  Book Deck' : ''}
          </Text>
        </View>
        <View style={styles.deckActions}>
          <TouchableOpacity
            style={styles.deckActionBtn}
            onPress={() => handleEditDeck(item)}
            activeOpacity={0.7}>
            <Text style={styles.deckActionText}>Edit</Text>
          </TouchableOpacity>
          {!isBookDeck && (
            <TouchableOpacity
              style={[styles.deckActionBtn, styles.deckDeleteBtn]}
              onPress={() => handleDeleteDeck(item)}
              activeOpacity={0.7}>
              <Text style={styles.deckDeleteText}>Delete</Text>
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
          <ActivityIndicator size="large" color="#6B8E73" />
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {/* Decks header row */}
        <View style={styles.tabSectionHeader}>
          <Text style={styles.tabSectionTitle}>
            {allDecks.length} {allDecks.length === 1 ? 'deck' : 'decks'}
          </Text>
          <TouchableOpacity
            style={styles.newDeckButton}
            onPress={handleCreateDeck}
            activeOpacity={0.7}>
            <Text style={styles.newDeckButtonText}>+ New Deck</Text>
          </TouchableOpacity>
        </View>

        {allDecks.length === 0 ? (
          <View style={styles.emptyTab}>
            <Text style={styles.emptyTabIcon}>🗂️</Text>
            <Text style={styles.emptyTabTitle}>No Decks Yet</Text>
            <Text style={styles.emptyTabText}>
              Upload a book to auto-create a deck,{'\n'}or create one manually.
            </Text>
            <TouchableOpacity
              style={styles.emptyTabButton}
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
                tintColor="#6B8E73"
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
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.settingsContent}
      showsVerticalScrollIndicator={false}>
      {/* OpenAI API */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>OpenAI API</Text>
        <Text style={styles.settingsCardDesc}>
          Required for AI features: definitions, conjugations, grammar.
        </Text>
        <TextInput
          style={styles.settingsInput}
          placeholder="Enter OpenAI API key"
          placeholderTextColor="#A3B5A7"
          value={openaiKey}
          onChangeText={setOpenaiKey}
          autoCapitalize="none"
          secureTextEntry={openaiSaved}
        />
        <View style={styles.settingsBtnRow}>
          {openaiSaved ? (
            <TouchableOpacity style={styles.settingsRemoveBtn} onPress={handleRemoveOpenAIKey} activeOpacity={0.7}>
              <Text style={styles.settingsRemoveBtnText}>Remove Key</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.settingsSaveBtn} onPress={handleSaveOpenAIKey} activeOpacity={0.7}>
              <Text style={styles.settingsSaveBtnText}>Save Key</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}>
          <Text style={styles.settingsLink}>Get OpenAI API key</Text>
        </TouchableOpacity>
      </View>

      {/* Translation API */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>Translation API (Optional)</Text>
        <Text style={styles.settingsCardDesc}>
          Works without a key (1,000 words/day). Add a key for 10,000/day.
        </Text>
        <TextInput
          style={styles.settingsInput}
          placeholder="Enter MyMemory API key"
          placeholderTextColor="#A3B5A7"
          value={translateKey}
          onChangeText={setTranslateKey}
          autoCapitalize="none"
          secureTextEntry={translateSaved}
        />
        <View style={styles.settingsBtnRow}>
          {translateSaved ? (
            <TouchableOpacity style={styles.settingsRemoveBtn} onPress={handleRemoveTranslateKey} activeOpacity={0.7}>
              <Text style={styles.settingsRemoveBtnText}>Remove Key</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.settingsSaveBtn} onPress={handleSaveTranslateKey} activeOpacity={0.7}>
              <Text style={styles.settingsSaveBtnText}>Save Key</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => Linking.openURL('https://mymemory.translated.net/doc/keygen.php')}>
          <Text style={styles.settingsLink}>Get free API key</Text>
        </TouchableOpacity>
      </View>

      {/* About & Sign Out */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>About</Text>
        <Text style={styles.settingsAbout}>BeaverReader v1.0</Text>
        <Text style={styles.settingsAboutSub}>Language learning through reading</Text>
      </View>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.7}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.emailText}>{user?.email}</Text>
    </ScrollView>
  );

  // ═══════════════════════════════════════
  // Render: Books tab content
  // ═══════════════════════════════════════
  const renderBooksTab = () => {
    if (booksLoading) {
      return (
        <View style={styles.tabCenterContainer}>
          <ActivityIndicator size="large" color="#6B8E73" />
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.tabSectionHeader}>
          <Text style={styles.tabSectionTitle}>
            {books.length} {books.length === 1 ? 'book' : 'books'}
          </Text>
        </View>
        <BookList
          books={books}
          onBookPress={handleBookPress}
          onDeleteBook={handleDeleteBook}
          refreshing={booksRefreshing}
          onRefresh={handleBooksRefresh}
        />
      </View>
    );
  };

  // ═══════════════════════════════════════
  // Main render
  // ═══════════════════════════════════════
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F5F0" />

      {/* Header: text on top, beaver below (bigger) */}
      <View style={styles.header}>
        <Text style={styles.title} includeFontPadding={false}>BeaverReader</Text>
        <View style={styles.headerLogoWrap}>
          <Image
            source={require('../../assets/beaverswim.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedContainer}>
        <View style={styles.segmentedControl}>
          {(['books', 'decks', 'settings'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.segment,
                activeTab === tab && styles.segmentActive,
              ]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}>
              <Text
                style={[
                  styles.segmentText,
                  activeTab === tab && styles.segmentTextActive,
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
          style={styles.fab}
          onPress={handleAddBook}
          activeOpacity={0.8}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
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
    paddingTop: 36,
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

  // Settings tab
  settingsContent: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 60,
  },
  settingsCard: {
    backgroundColor: '#FAF8F3',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8DDD0',
    shadowColor: '#8B7355',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  settingsCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3D5A46',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  settingsCardDesc: {
    fontSize: 14,
    color: '#8A8171',
    lineHeight: 20,
    marginBottom: 14,
  },
  settingsInput: {
    backgroundColor: '#F7F5F0',
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    color: '#3D5A46',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  settingsBtnRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  settingsSaveBtn: {
    flex: 1,
    backgroundColor: '#6B8E73',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  settingsSaveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  settingsRemoveBtn: {
    flex: 1,
    backgroundColor: '#C48B6C',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  settingsRemoveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  settingsLink: {
    fontSize: 14,
    color: '#6B8E73',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  settingsAbout: {
    fontSize: 16,
    color: '#3D5A46',
    fontWeight: '600',
    marginBottom: 3,
  },
  settingsAboutSub: {
    fontSize: 14,
    color: '#8A8171',
  },
  signOutButton: {
    backgroundColor: '#F5E6E3',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8D0CC',
    marginBottom: 12,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C05050',
  },
  emailText: {
    fontSize: 13,
    color: '#A3B5A7',
    textAlign: 'center',
    marginBottom: 20,
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
