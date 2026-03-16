import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types';
import {bookService} from '../services/bookService';
import {highlightService} from '../services/highlightService';
import {bookmarkService} from '../services/bookmarkService';
import {tocService} from '../services/tocService';
import {readingPreferencesService} from '../services/readingPreferencesService';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {TextActionSheet} from '../components/TextActionSheet';
import {useTheme} from '../contexts/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'BookReader'>;

// Static source — never changes, so WebView never reloads
const ASSET_SOURCE = {uri: 'file:///android_asset/epub-reader.html'};

export const EPUBReaderScreen: React.FC<Props> = ({route, navigation}) => {
  const {bookId} = route.params;
  const {colors} = useTheme();
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();

  const [book, setBook] = useState<{id: string; title: string; file_path: string; current_position?: {cfi?: string}} | null>(null);
  const [epubBase64, setEpubBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);

  const [selectedText, setSelectedText] = useState('');
  const [selectedCfi, setSelectedCfi] = useState<string | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [clickedHighlightCfi, setClickedHighlightCfi] = useState<string | null>(null);
  const [clickedHighlightColor, setClickedHighlightColor] = useState<string | null>(null);
  const [clickedHighlightDbId, setClickedHighlightDbId] = useState<string | null>(null);
  const [showButtons, setShowButtons] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentEpubPage, setCurrentEpubPage] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const highlightsRestoredRef = useRef(false);
  const lastCfiRef = useRef<string | null>(null);
  const pendingGoToRef = useRef<{sectionIndex: number; anchor?: string; title?: string} | null>(null);
  const selectedTextRef = useRef('');
  const selectedCfiRef = useRef<string | null>(null);

  // Load book metadata + saved position
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const books = await bookService.getBooks();
        const b = books.find(x => x.id === bookId);
        if (!cancelled && b) {
          const localPos = await AsyncStorage.getItem(`epub_position_${bookId}`);
          if (localPos) {
            try {
              const parsed = JSON.parse(localPos);
              if (parsed?.cfi) {
                b.current_position = {cfi: parsed.cfi, timestamp: parsed.timestamp};
                console.log('📖 EPUB: Restoring position:', parsed.cfi);
              }
            } catch (_) {}
          }
          setBook(b);
        } else if (!cancelled && !b) {
          setError('Book not found');
        }
      } catch {
        if (!cancelled) setError('Failed to load book');
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  // Read EPUB file as base64
  useEffect(() => {
    if (!book?.file_path) return;
    let cancelled = false;
    (async () => {
      try {
        const exists = await RNFS.exists(book.file_path);
        if (!cancelled && !exists) { setError('Book file not found'); return; }
        const base64 = await RNFS.readFile(book.file_path, 'base64');
        if (!cancelled) setEpubBase64(base64);
      } catch {
        if (!cancelled) setError('Failed to read book file');
      }
    })();
    return () => { cancelled = true; };
  }, [book?.file_path]);

  // Once WebView is ready AND we have EPUB data, inject it in chunks and call startReader
  useEffect(() => {
    if (!isReady || !epubBase64 || !book) return;
    const wv = webViewRef.current;
    if (!wv) return;

    const pending = pendingGoToRef.current;
    let savedCfi: string | null;
    let startAnchor: string | null = null;
    let startTitle: string | null = null;
    if (pending) {
      pendingGoToRef.current = null;
      savedCfi = `section-${pending.sectionIndex}`;
      startAnchor = pending.anchor ?? null;
      startTitle = pending.title ?? null;
    } else {
      savedCfi = book.current_position?.cfi ?? null;
    }

    console.log('📖 EPUB: Sending EPUB data, savedCfi:', savedCfi);
    if (savedCfi) lastCfiRef.current = savedCfi;

    const CHUNK = 512 * 1024;
    const total = epubBase64.length;
    let cancelled = false;

    const t = setTimeout(() => {
      if (cancelled) return;
      wv.injectJavaScript('window._epubChunks = []; true;');

      let i = 0;
      const sendChunk = async () => {
        if (cancelled) return;
        if (i >= total) {
          const fontSizePx = await readingPreferencesService.getEpubFontSizePx();
          const startScript = `
            window.epubBase64 = window._epubChunks.join('');
            delete window._epubChunks;
            window.savedCfi = ${savedCfi != null ? JSON.stringify(savedCfi) : 'null'};
            window.startAnchor = ${startAnchor != null ? JSON.stringify(startAnchor) : 'null'};
            window.startTitle = ${startTitle != null ? JSON.stringify(startTitle) : 'null'};
            window.initialFontSize = ${fontSizePx};
            if (window.startReader) window.startReader();
            true;
          `;
          wv.injectJavaScript(startScript);
          return;
        }
        const chunk = epubBase64.slice(i, i + CHUNK);
        i += CHUNK;
        wv.injectJavaScript(`window._epubChunks.push(${JSON.stringify(chunk)}); true;`);
        setTimeout(sendChunk, 16);
      };
      sendChunk();
    }, 100);

    return () => { cancelled = true; clearTimeout(t); };
  }, [isReady, epubBase64, book]);

  // Restore highlights after first locationChanged
  const restoreHighlights = React.useCallback(async () => {
    if (highlightsRestoredRef.current || !bookId) return;
    highlightsRestoredRef.current = true;
    try {
      const list = await highlightService.getHighlightsByBook(bookId);
      console.log('📖 EPUB: Fetched highlights:', list.length);
      if (list.length === 0) return;
      const payload = list.map((h, idx) => ({
        cfi: (h.position?.cfi ?? h.position?.cfiRange) || ('epub-hl-' + idx),
        text: h.text, color: h.color, dbId: h.id,
      })).filter(h => h.text);
      console.log('📖 EPUB: Highlight payload:', payload.length, 'items');
      if (payload.length === 0) return;
      const cmd = JSON.stringify({command: 'restoreHighlights', highlights: payload});
      const script = `
        if(window.handleEpubCommand) {
          window.handleEpubCommand(${cmd});
        }
        true;
      `;
      setTimeout(() => {
        console.log('📖 EPUB: Injecting restoreHighlights script');
        webViewRef.current?.injectJavaScript(script);
      }, 500);
    } catch (err) {
      console.error('📖 EPUB: Failed to restore highlights:', err);
    }
  }, [bookId]);

  // Bookmark check
  useEffect(() => {
    if (bookId && currentEpubPage > 0) {
      bookmarkService.isPageBookmarked(bookId, currentEpubPage).then(setIsBookmarked).catch(() => {});
    }
  }, [bookId, currentEpubPage]);

  const handleToggleBookmark = async () => {
    try {
      if (isBookmarked) {
        const bookmarks = await bookmarkService.getBookmarksByBook(bookId);
        const b = bookmarks.find(x => x.page === currentEpubPage);
        if (b) { await bookmarkService.deleteBookmark(b.id); setIsBookmarked(false); Alert.alert('Bookmark Removed', 'Bookmark removed'); }
      } else {
        await bookmarkService.createBookmark({book_id: bookId, page: currentEpubPage});
        setIsBookmarked(true);
        Alert.alert('Bookmark Added', 'Page bookmarked!');
      }
    } catch { Alert.alert('Error', 'Failed to toggle bookmark'); }
  };

  // Save position on exit
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      const cfi = lastCfiRef.current;
      if (!cfi || !bookId) return;
      e.preventDefault();
      const pos = {cfi, timestamp: new Date().toISOString()};
      Promise.all([
        AsyncStorage.setItem(`epub_position_${bookId}`, JSON.stringify(pos)),
        bookService.updateBook(bookId, {current_position: pos}),
      ]).then(() => navigation.dispatch(e.data.action))
        .catch(() => navigation.dispatch(e.data.action));
    });
    return unsubscribe;
  }, [navigation, bookId]);

  const sendCommand = (cmd: Record<string, unknown>) => {
    webViewRef.current?.injectJavaScript(
      `if(window.handleEpubCommand){window.handleEpubCommand(${JSON.stringify(cmd)});} true;`,
    );
  };

  useFocusEffect(
    React.useCallback(() => {
      if (!isReady || !webViewRef.current) return;
      readingPreferencesService.getEpubFontSizePx().then((size) => {
        sendCommand({command: 'setFontSize', size});
      });
    }, [isReady]),
  );

  useFocusEffect(
    React.useCallback(() => {
      const params = route.params as {goToPage?: number; goToAnchor?: string; goToTitle?: string};
      const page = params?.goToPage;
      if (page != null && page > 0) {
        navigation.setParams({goToPage: undefined, goToAnchor: undefined, goToTitle: undefined} as never);
        pendingGoToRef.current = {
          sectionIndex: page - 1,
          anchor: params?.goToAnchor,
          title: params?.goToTitle,
        };
        if (isReady && webViewRef.current) {
          const p = pendingGoToRef.current;
          pendingGoToRef.current = null;
          setTimeout(() => sendCommand({command: 'goToSection', sectionIndex: p.sectionIndex, anchor: p.anchor, title: p.title}), 300);
        }
      }
    }, [route.params, isReady, navigation]),
  );

  const handleMessage = (event: {nativeEvent: {data: string}}) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'ready':
          console.log('📖 EPUB: WebView ready');
          setIsReady(true);
          break;
        case 'toggleButtons':
          setShowButtons(prev => !prev);
          break;
        case 'locationChanged':
          setProgress(data.percentage ?? 0);
          restoreHighlights();
          if (data.cfi && bookId) {
            lastCfiRef.current = data.cfi;
            const m = String(data.cfi).match(/^section-([0-9]+)-page-([0-9]+)$/);
            if (m) setCurrentEpubPage(parseInt(m[1], 10) * 1000 + parseInt(m[2], 10));
            const pos = {cfi: data.cfi, timestamp: new Date().toISOString()};
            AsyncStorage.setItem(`epub_position_${bookId}`, JSON.stringify(pos)).catch(() => {});
            bookService.updateBook(bookId, {current_position: pos}).catch(() => {});
          }
          break;
        case 'textSelected':
          setClickedHighlightCfi(null);
          setClickedHighlightColor(null);
          setClickedHighlightDbId(null);
          selectedTextRef.current = data.text ?? '';
          selectedCfiRef.current = data.cfi ?? null;
          setSelectedText(data.text ?? '');
          setSelectedCfi(data.cfi ?? null);
          setShowActionSheet(true);
          break;
        case 'highlightClicked':
          selectedTextRef.current = data.text ?? '';
          selectedCfiRef.current = data.cfi ?? null;
          setSelectedText(data.text ?? '');
          setSelectedCfi(data.cfi ?? null);
          setClickedHighlightCfi(data.cfi ?? null);
          setClickedHighlightColor(data.color ?? null);
          setClickedHighlightDbId(data.dbId ?? null);
          setShowActionSheet(true);
          break;
        case 'debug':
          console.log('[EPUB WebView]', data.msg);
          break;
        case 'tocExtracted':
          if (data.items?.length > 0 && bookId) {
            (async () => {
              try {
                const hasAnchors = data.items.some((i: {anchor?: string}) => i.anchor);
                const existing = await tocService.getTOCByBook(bookId);
                const needsUpgrade = existing.length > 0 && hasAnchors && !existing.some(i => i.anchor);
                if (existing.length === 0 || needsUpgrade) {
                  if (existing.length > 0) await tocService.deleteTOCByBook(bookId);
                  await tocService.createTOCItems(data.items.map((item: any) => ({
                    book_id: bookId, title: item.title, page: item.page,
                    level: item.level, order_index: item.order_index, anchor: item.anchor ?? null,
                  })));
                }
              } catch (err) { console.error('Failed to save EPUB TOC:', err); }
            })();
          }
          break;
        case 'error':
          console.error('📖 EPUB error:', data.message);
          setError(data.message ?? 'Error in EPUB reader');
          break;
      }
    } catch (_) {}
  };

  const addHighlight = (color: string, dbId?: string) => {
    if (clickedHighlightCfi) {
      console.log('📖 EPUB: updateHighlightColor', clickedHighlightCfi, color);
      sendCommand({command: 'updateHighlightColor', cfi: clickedHighlightCfi, color});
      setClickedHighlightCfi(null); setClickedHighlightColor(null); setClickedHighlightDbId(null);
    } else {
      const cfi = selectedCfi || selectedCfiRef.current;
      const text = selectedText || selectedTextRef.current;
      if (cfi && text) {
        console.log('📖 EPUB: addHighlight', cfi, text.substring(0, 30), color, dbId);
        sendCommand({command: 'addHighlight', cfi, color, text, dbId: dbId ?? undefined});
        setSelectedText(''); setSelectedCfi(null);
        selectedTextRef.current = ''; selectedCfiRef.current = null;
      } else {
        console.log('📖 EPUB: addHighlight called but no selectedCfi or clickedHighlightCfi');
      }
    }
  };

  const removeClickedHighlight = async () => {
    if (clickedHighlightCfi) {
      sendCommand({command: 'removeHighlight', cfi: clickedHighlightCfi});
      if (clickedHighlightDbId) { try { await highlightService.deleteHighlight(clickedHighlightDbId); } catch (_) {} }
      setClickedHighlightCfi(null); setClickedHighlightColor(null); setClickedHighlightDbId(null);
    }
  };

  if (error) {
    return (
      <View style={[styles.centered, {paddingTop: insets.top + 20, backgroundColor: colors.background}]}>
        <Text style={[styles.errorText, {color: colors.text}]}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, {color: colors.accent}]}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={[styles.centered, {backgroundColor: colors.background}]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <WebView
        ref={webViewRef}
        allowFileAccess
        source={ASSET_SOURCE}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        originWhitelist={['*']}
        overScrollMode="never"
        style={styles.webview}
        scrollEnabled={false}
      />

      {showButtons && (
        <TouchableOpacity style={[styles.exitButton, {top: insets.top + 10}]} onPress={() => navigation.goBack()}>
          <Text style={styles.exitButtonText}>✕</Text>
        </TouchableOpacity>
      )}

      {showButtons && (
        <TouchableOpacity style={[styles.menuButton, {bottom: insets.bottom + 20}]} onPress={() => setShowMenu(true)}>
          <Text style={styles.menuButtonText}>≡</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setShowMenu(false)} />
          <View style={[styles.menuPopup, {backgroundColor: colors.cardBackground}]}>
            <View style={[styles.menuHandle, {backgroundColor: colors.cardBorder}]} />
            <View style={[styles.menuHeader, {borderBottomColor: colors.cardBorder}]}>
              <Text style={[styles.menuTitle, {color: colors.text}]}>{book?.title || 'Loading...'}</Text>
              <Text style={[styles.menuProgress, {color: colors.textMuted}]}>{Math.round(progress * 100)}% complete</Text>
              <TouchableOpacity style={styles.menuCloseButton} onPress={() => setShowMenu(false)}>
                <Text style={[styles.menuCloseButtonText, {color: colors.textMuted}]}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.menuActions}>
              <TouchableOpacity style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]} onPress={() => { setShowMenu(false); navigation.navigate('TableOfContents' as never, {bookId, bookTitle: book?.title, bookType: 'epub'} as never); }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>📑 Table of Contents</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]} onPress={() => { setShowMenu(false); navigation.navigate('Highlights' as never, {bookId, bookTitle: book?.title} as never); }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>✨ Highlights</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]} onPress={() => { setShowMenu(false); navigation.navigate('Bookmarks' as never, {bookId, bookTitle: book?.title} as never); }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>🔖 View All Bookmarks</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]} onPress={async () => { setShowMenu(false); await handleToggleBookmark(); }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>{isBookmarked ? '🔖 Remove Bookmark' : '📑 Bookmark This Page'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]} onPress={() => { setShowMenu(false); navigation.navigate('Settings'); }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>⚙️ Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TextActionSheet
        isVisible={showActionSheet}
        selectedText={selectedText}
        context=""
        bookId={bookId}
        bookTitle={book.title}
        position={{cfi: selectedCfi}}
        isClickedHighlight={!!clickedHighlightCfi}
        clickedColor={clickedHighlightColor ?? undefined}
        onClose={() => { setShowActionSheet(false); setSelectedText(''); setSelectedCfi(null); setClickedHighlightCfi(null); setClickedHighlightColor(null); setClickedHighlightDbId(null); selectedTextRef.current = ''; selectedCfiRef.current = null; sendCommand({command: 'clearSelection'}); }}
        onHighlightAdded={(color, dbId) => addHighlight(color, dbId)}
        onHighlightDeleted={removeClickedHighlight}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  errorText: {fontSize: 16, color: '#333', marginBottom: 16, textAlign: 'center'},
  backBtn: {paddingVertical: 8, paddingHorizontal: 12},
  backText: {fontSize: 17, color: '#007AFF'},
  webview: {flex: 1, backgroundColor: 'transparent'},
  exitButton: {position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000},
  exitButtonText: {color: '#fff', fontSize: 24, fontWeight: '300'},
  menuButton: {position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000},
  menuButtonText: {color: '#fff', fontSize: 24, fontWeight: '300'},
  menuContainer: {flex: 1, justifyContent: 'flex-end'},
  menuBackdrop: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)'},
  menuPopup: {backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '80%'},
  menuHandle: {width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20},
  menuHeader: {paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1},
  menuTitle: {fontSize: 20, fontWeight: 'bold', marginBottom: 8},
  menuProgress: {fontSize: 14},
  menuCloseButton: {position: 'absolute', top: 0, right: 20, width: 32, height: 32, justifyContent: 'center', alignItems: 'center'},
  menuCloseButtonText: {fontSize: 24},
  menuActions: {paddingTop: 10},
  menuAction: {paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1},
  menuActionText: {fontSize: 16},
});

export default EPUBReaderScreen;
