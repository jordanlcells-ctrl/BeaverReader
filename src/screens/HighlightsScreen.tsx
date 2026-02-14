import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import {highlightService} from '../services/highlightService';
import type {Highlight} from '../types';

const COLOR_NAMES: Record<string, string> = {
  '#C9B458': 'Cattail',
  '#7BA668': 'Lily Pad',
  '#8AABBF': 'Pond',
  '#C48B6C': 'Bark',
  '#ffeb3b': 'Yellow',
  '#4caf50': 'Green',
  '#2196f3': 'Blue',
  '#ff5722': 'Orange',
};

export default function HighlightsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const {bookId, bookTitle} = route.params as {bookId: string; bookTitle: string};

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHighlights = async () => {
    try {
      setLoading(true);
      const data = await highlightService.getHighlightsByBook(bookId);
      // Sort by page/position
      data.sort((a, b) => {
        const pageA = a.position?.page || 0;
        const pageB = b.position?.page || 0;
        return pageA - pageB;
      });
      setHighlights(data);
    } catch (error: any) {
      console.error('Failed to load highlights:', error);
      Alert.alert('Error', 'Failed to load highlights.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHighlights();
    }, [bookId]),
  );

  const handleDelete = (highlight: Highlight) => {
    Alert.alert('Delete Highlight', 'Are you sure you want to delete this highlight?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await highlightService.deleteHighlight(highlight.id);
            loadHighlights();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const getColorName = (color: string) => {
    return COLOR_NAMES[color] || color;
  };

  const renderHighlight = ({item}: {item: Highlight}) => (
    <View style={styles.highlightCard}>
      <View style={[styles.colorStrip, {backgroundColor: item.color || '#C9B458'}]} />
      <View style={styles.highlightContent}>
        <Text style={styles.highlightText} numberOfLines={4}>
          "{item.text}"
        </Text>
        <View style={styles.highlightMeta}>
          <Text style={styles.colorLabel}>{getColorName(item.color)}</Text>
          {item.position?.page && (
            <Text style={styles.pageLabel}>Page {item.position.page}</Text>
          )}
          {item.position?.location && (
            <Text style={styles.pageLabel}>Loc {item.position.location}</Text>
          )}
        </View>
        {item.note && (
          <View style={styles.noteContainer}>
            <Text style={styles.noteText} numberOfLines={3}>
              {item.note}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
          activeOpacity={0.7}>
          <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6B8E73" />
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
          <Text style={styles.headerTitle}>Highlights</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{bookTitle}</Text>
        </View>
      </View>

      {highlights.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyText}>No highlights yet</Text>
          <Text style={styles.emptySubtext}>
            Select text while reading to create highlights
          </Text>
        </View>
      ) : (
        <FlatList
          data={highlights}
          renderItem={renderHighlight}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
  headerSubtitle: {
    fontSize: 14,
    color: '#8A8171',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  highlightCard: {
    flexDirection: 'row',
    backgroundColor: '#FAF8F3',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    overflow: 'hidden',
    shadowColor: '#8B7355',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  colorStrip: {
    width: 6,
  },
  highlightContent: {
    flex: 1,
    padding: 16,
  },
  highlightText: {
    fontSize: 15,
    color: '#3D5A46',
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  highlightMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  colorLabel: {
    fontSize: 13,
    color: '#8A8171',
    fontWeight: '600',
  },
  pageLabel: {
    fontSize: 13,
    color: '#8A8171',
  },
  noteContainer: {
    backgroundColor: '#F0EBE3',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#C9B458',
    marginBottom: 10,
  },
  noteText: {
    fontSize: 13,
    color: '#6B7C6E',
    lineHeight: 18,
  },
  deleteButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5E6E3',
    borderWidth: 1,
    borderColor: '#E8D0CC',
  },
  deleteButtonText: {
    fontSize: 13,
    color: '#C05050',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3D5A46',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8A8171',
    textAlign: 'center',
    lineHeight: 20,
  },
});
