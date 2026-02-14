import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/core';
import {tocService, TOCItem} from '../services/tocService';
import {RootStackParamList} from '../types';

type TableOfContentsScreenRouteProp = RouteProp<RootStackParamList, 'TableOfContents'>;

export default function TableOfContentsScreen() {
  const navigation = useNavigation();
  const route = useRoute<TableOfContentsScreenRouteProp>();
  const {bookId, bookTitle} = route.params;

  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTOC = async () => {
    try {
      setLoading(true);
      const data = await tocService.getTOCByBook(bookId);
      setTocItems(data);
    } catch (error: any) {
      console.error('Failed to load TOC:', error);
      Alert.alert('Error', 'Failed to load table of contents.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTOC();
    }, [bookId])
  );

  const handleGoToPage = (item: TOCItem) => {
    // TODO: Navigate back to reader and jump to page
    Alert.alert('Go to Page', `This will jump to page ${item.page} (feature coming soon)`);
  };

  const renderTOCItem = ({item}: {item: TOCItem}) => {
    const indentLevel = item.level * 20;
    
    return (
      <TouchableOpacity
        style={[styles.tocItem, {paddingLeft: 16 + indentLevel}]}
        onPress={() => handleGoToPage(item)}>
        <View style={styles.tocContent}>
          <Text 
            style={[
              styles.tocTitle,
              item.level === 0 && styles.tocTitleLevel0,
              item.level === 1 && styles.tocTitleLevel1,
              item.level === 2 && styles.tocTitleLevel2,
            ]}
            numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.tocPage}>{item.page}</Text>
        </View>
        {item.level === 0 && <View style={styles.tocDivider} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading table of contents...</Text>
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
          <Text style={styles.headerTitle}>Table of Contents</Text>
          <Text style={styles.headerSubtitle}>{bookTitle}</Text>
        </View>
      </View>

      {/* TOC List */}
      {tocItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No table of contents</Text>
          <Text style={styles.emptyText}>
            This book doesn't have a table of contents, or it hasn't been extracted yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={tocItems}
          renderItem={renderTOCItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
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
    paddingVertical: 8,
  },
  tocItem: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingRight: 16,
  },
  tocContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tocTitle: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginRight: 12,
  },
  tocTitleLevel0: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  tocTitleLevel1: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tocTitleLevel2: {
    fontSize: 15,
    color: '#666',
  },
  tocPage: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  tocDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginTop: 12,
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
});
