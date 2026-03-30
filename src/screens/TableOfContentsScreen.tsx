import React, {useState, useCallback, useMemo} from 'react';
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
import {useTheme} from '../contexts/ThemeContext';

type TableOfContentsScreenRouteProp = RouteProp<RootStackParamList, 'TableOfContents'>;

export default function TableOfContentsScreen() {
  const navigation = useNavigation();
  const route = useRoute<TableOfContentsScreenRouteProp>();
  const {bookId, bookTitle, bookType = 'pdf'} = route.params;
  const {colors} = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  // Use a fixed generous top padding to ensure header is well below status bar
  const headerPaddingTop = 60;

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
    if (bookType === 'pdf') {
      (navigation as any).navigate('PDFReader', {bookId, goToPage: item.page});
    } else {
      (navigation as any).navigate('BookReader', {
        bookId,
        goToPage: item.page,
        goToAnchor: item.anchor ?? undefined,
        goToTitle: item.title,
      });
    }
  };

  const renderTOCItem = ({item}: {item: TOCItem}) => {
    const indentLevel = item.level * 20;
    return (
      <TouchableOpacity
        style={[s.tocItem, {paddingLeft: 16 + indentLevel}]}
        onPress={() => handleGoToPage(item)}>
        <View style={s.tocContent}>
          <Text
            style={[
              s.tocTitle,
              item.level === 0 && s.tocTitleLevel0,
              item.level === 1 && s.tocTitleLevel1,
              item.level === 2 && s.tocTitleLevel2,
            ]}
            numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={s.tocPage}>{item.page}</Text>
        </View>
        {item.level === 0 && <View style={s.tocDivider} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[s.centerContainer, {paddingTop: headerPaddingTop}]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.loadingText}>Loading table of contents...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, {paddingTop: headerPaddingTop}]}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()}>
          <Text style={s.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={s.headerContent}>
          <Text style={s.headerTitle}>Table of Contents</Text>
          <Text style={s.headerSubtitle}>{bookTitle}</Text>
        </View>
      </View>

      {tocItems.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyTitle}>No table of contents</Text>
          <Text style={s.emptyText}>
            {bookType === 'pdf'
              ? 'Open this PDF in the reader once (stay on it until it finishes loading) while signed in. We save chapter bookmarks when the file has them, or a page list (Page 1, Page 2, …) when it does not. If this stays empty, check you are logged in and try opening the book again.'
              : "This book doesn't have a table of contents, or it hasn't been extracted yet."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tocItems}
          renderItem={renderTOCItem}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
        />
      )}
    </View>
  );
}

function getStyles(colors: {background: string; cardBackground: string; cardBorder: string; text: string; textMuted: string; accent: string}) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    centerContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background},
    loadingText: {marginTop: 16, fontSize: 16, color: colors.textMuted},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    backButton: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 8},
    backButtonText: {fontSize: 28, color: colors.accent},
    headerContent: {flex: 1},
    headerTitle: {fontSize: 22, fontWeight: 'bold', color: colors.text},
    headerSubtitle: {fontSize: 14, color: colors.textMuted, marginTop: 2},
    listContent: {paddingVertical: 8},
    tocItem: {backgroundColor: colors.cardBackground, paddingVertical: 12, paddingRight: 16, borderBottomWidth: 1, borderBottomColor: colors.cardBorder},
    tocContent: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    tocTitle: {flex: 1, fontSize: 16, color: colors.text, marginRight: 12},
    tocTitleLevel0: {fontSize: 18, fontWeight: 'bold', color: colors.text},
    tocTitleLevel1: {fontSize: 16, fontWeight: '600', color: colors.text},
    tocTitleLevel2: {fontSize: 15, color: colors.textMuted},
    tocPage: {fontSize: 16, color: colors.accent, fontWeight: '600', minWidth: 40, textAlign: 'right'},
    tocDivider: {height: 1, backgroundColor: colors.cardBorder, marginTop: 12},
    emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32},
    emptyTitle: {fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 8},
    emptyText: {fontSize: 16, color: colors.textMuted, textAlign: 'center'},
  });
}
