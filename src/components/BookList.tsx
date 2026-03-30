import React, {useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import type {Book} from '../types';
import {themeColors} from '../contexts/ThemeContext';

interface Props {
  books: Book[];
  onBookPress: (book: Book) => void;
  onDeleteBook: (bookId: string) => void;
  onRenameBook?: (bookId: string, newTitle: string) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  colors?: (typeof themeColors)['light'];
  processingBooks?: Set<string>;
}

export const BookList: React.FC<Props> = ({
  books,
  onBookPress,
  onDeleteBook,
  onRenameBook,
  refreshing,
  onRefresh,
  colors,
  processingBooks,
}) => {
  const [renameBook, setRenameBook] = useState<Book | null>(null);
  const [renameText, setRenameText] = useState('');
  const cardBg = colors?.cardBackground ?? '#FFFFFF';
  const cardBorder = colors?.cardBorder ?? '#E8E0D6';
  const textColor = colors?.text ?? '#3D5A46';
  const textMuted = colors?.textMuted ?? '#8A8171';
  const textMuted2 = colors?.emailText ?? '#A3B5A7';
  const chevronColor = colors?.textMuted ?? '#C4B9A8';
  const handleLongPress = (book: Book) => {
    Alert.alert(
      book.title,
      'What would you like to do?',
      [
        {text: 'Open', onPress: () => onBookPress(book)},
        {
          text: 'Rename',
          onPress: () => {
            setRenameBook(book);
            setRenameText(book.title);
          },
        },
        {
          text: 'Delete',
          onPress: () => {
            Alert.alert(
              'Delete Book',
              `Are you sure you want to delete "${book.title}"?`,
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => onDeleteBook(book.id),
                },
              ],
            );
          },
          style: 'destructive',
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    );
  };

  const getFileIcon = (fileType: string) => {
    return fileType === 'pdf' ? '📄' : '📗';
  };

  const getFileColor = (fileType: string) => {
    return fileType === 'pdf' ? '#C48B6C' : '#6B8E73';
  };

  const renderBook = ({item}: {item: Book}) => {
    const isProcessing = processingBooks?.has(item.id) ?? false;

    return (
      <TouchableOpacity
        style={[styles.bookCard, {backgroundColor: cardBg, borderColor: cardBorder}]}
        onPress={() => !isProcessing && onBookPress(item)}
        onLongPress={() => !isProcessing && handleLongPress(item)}
        activeOpacity={isProcessing ? 1 : 0.7}>
        {/* Book cover placeholder */}
        <View style={[styles.bookCover, {backgroundColor: getFileColor(item.file_type) + '15'}]}>
          {isProcessing ? (
            <ActivityIndicator size="small" color={getFileColor(item.file_type)} />
          ) : (
            <Text style={styles.bookCoverIcon}>{getFileIcon(item.file_type)}</Text>
          )}
          <View style={[styles.fileTypeBadge, {backgroundColor: getFileColor(item.file_type)}]}>
            <Text style={styles.fileTypeBadgeText}>{item.file_type.toUpperCase()}</Text>
          </View>
        </View>

        {/* Book info */}
        <View style={styles.bookInfo}>
          <Text style={[styles.bookTitle, {color: isProcessing ? textMuted : textColor}]} numberOfLines={2}>
            {item.title}
          </Text>
          {isProcessing ? (
            <Text style={[styles.bookDate, {color: textMuted2}]}>Preparing for reading...</Text>
          ) : (
            <>
              {item.author && (
                <Text style={[styles.bookAuthor, {color: textMuted}]} numberOfLines={1}>
                  {item.author}
                </Text>
              )}
              <Text style={[styles.bookDate, {color: textMuted2}]}>
                Added {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </>
          )}
        </View>

        {/* Chevron or spinner */}
        {isProcessing ? (
          <ActivityIndicator size="small" color={chevronColor} />
        ) : (
          <Text style={[styles.chevron, {color: chevronColor}]}>›</Text>
        )}
      </TouchableOpacity>
    );
  };

  const handleRenameSave = () => {
    const trimmed = renameText.trim();
    if (trimmed && renameBook && onRenameBook) {
      onRenameBook(renameBook.id, trimmed);
    }
    setRenameBook(null);
  };

  if (books.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🦫</Text>
        <Text style={[styles.emptyTitle, {color: textColor}]}>Your Library is Empty</Text>
        <Text style={[styles.emptyText, {color: textMuted}]}>
          Tap the + button to add your first book.{'\n'}Supports EPUB and PDF formats.
        </Text>
      </View>
    );
  }

  return (
    <View style={{flex: 1}}>
      <FlatList
        data={books}
        renderItem={renderBook}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
      />
      <Modal
        visible={renameBook !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameBook(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, {backgroundColor: cardBg}]}>
            <Text style={[styles.modalTitle, {color: textColor}]}>Rename Book</Text>
            <TextInput
              style={[styles.modalInput, {color: textColor, borderColor: cardBorder}]}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={handleRenameSave}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setRenameBook(null)} style={styles.modalBtn}>
                <Text style={[styles.modalBtnText, {color: textMuted}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRenameSave} style={styles.modalBtn}>
                <Text style={[styles.modalBtnText, {color: '#3D5A46', fontWeight: '700'}]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    shadowColor: '#8B7355',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  bookCover: {
    width: 56,
    height: 72,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    position: 'relative',
  },
  bookCoverIcon: {
    fontSize: 28,
  },
  fileTypeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fileTypeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3D5A46',
    marginBottom: 3,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  bookAuthor: {
    fontSize: 14,
    color: '#6B7C6E',
    marginBottom: 3,
    letterSpacing: -0.1,
  },
  bookDate: {
    fontSize: 12,
    color: '#A3B5A7',
    letterSpacing: -0.1,
  },
  chevron: {
    fontSize: 22,
    color: '#C4B9A8',
    fontWeight: '300',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3D5A46',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 15,
    color: '#8A8171',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalBox: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalBtnText: {
    fontSize: 15,
  },
});
