import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {bookmarkService, Bookmark} from '../services/bookmarkService';
import {RootStackParamList} from '../types';

type BookmarksScreenRouteProp = RouteProp<RootStackParamList, 'Bookmarks'>;

export default function BookmarksScreen() {
  const navigation = useNavigation();
  const route = useRoute<BookmarksScreenRouteProp>();
  const {bookId, bookTitle} = route.params;

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [noteText, setNoteText] = useState('');

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const data = await bookmarkService.getBookmarksByBook(bookId);
      setBookmarks(data);
    } catch (error: any) {
      console.error('Failed to load bookmarks:', error);
      Alert.alert('Error', 'Failed to load bookmarks.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBookmarks();
    }, [bookId])
  );

  const handleDelete = (bookmark: Bookmark) => {
    Alert.alert(
      'Delete Bookmark',
      'Are you sure you want to delete this bookmark?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await bookmarkService.deleteBookmark(bookmark.id);
              await loadBookmarks();
              Alert.alert('Success', 'Bookmark deleted');
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete bookmark');
            }
          },
        },
      ]
    );
  };

  const handleEditNote = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setNoteText(bookmark.note || '');
  };

  const handleSaveNote = async () => {
    if (!editingBookmark) return;

    try {
      await bookmarkService.updateBookmark(editingBookmark.id, noteText);
      await loadBookmarks();
      setEditingBookmark(null);
      setNoteText('');
      Alert.alert('Success', 'Note updated');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update note');
    }
  };

  const handleGoToPage = (bookmark: Bookmark) => {
    // TODO: Navigate back to reader and jump to page
    Alert.alert('Go to Page', `This will jump to page ${bookmark.page} (feature coming soon)`);
  };

  const renderBookmark = ({item}: {item: Bookmark}) => (
    <View style={styles.bookmarkCard}>
      <TouchableOpacity
        style={styles.bookmarkContent}
        onPress={() => handleGoToPage(item)}>
        <View style={styles.bookmarkHeader}>
          <Text style={styles.pageLabel}>📑 Page {item.page}</Text>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        {item.note && (
          <Text style={styles.bookmarkNote} numberOfLines={2}>
            {item.note}
          </Text>
        )}
      </TouchableOpacity>
      <View style={styles.bookmarkActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditNote(item)}>
          <Text style={styles.actionButtonText}>✏️ Note</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}>
          <Text style={[styles.actionButtonText, styles.deleteText]}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading bookmarks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Bookmarks</Text>
          <Text style={styles.headerSubtitle}>{bookTitle}</Text>
        </View>
      </View>

      {/* Bookmarks List */}
      {bookmarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No bookmarks yet</Text>
          <Text style={styles.emptyText}>
            Tap the bookmark icon while reading to save pages!
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          renderItem={renderBookmark}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Edit Note Modal */}
      {editingBookmark && (
        <Modal
          visible={!!editingBookmark}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingBookmark(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Note</Text>
              <Text style={styles.modalSubtitle}>Page {editingBookmark.page}</Text>
              <TextInput
                style={styles.noteInput}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add a note for this bookmark..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setEditingBookmark(null);
                    setNoteText('');
                  }}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveNote}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: '#007AFF',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
  },
  bookmarkCard: {
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
  bookmarkContent: {
    marginBottom: 12,
  },
  bookmarkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pageLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  bookmarkNote: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  bookmarkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
    flex: 0,
  },
  deleteText: {
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
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    height: 100,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
