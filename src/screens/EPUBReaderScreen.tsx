import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types';
import {bookService} from '../services/bookService';
import {highlightService} from '../services/highlightService';
import RNFS from 'react-native-fs';
import {getEpubReaderHtml} from '../utils/epubReaderHtml';
import {TextActionSheet} from '../components/TextActionSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'BookReader'>;

export const EPUBReaderScreen: React.FC<Props> = ({route, navigation}) => {
  const {bookId} = route.params;
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

  const highlightsRestoredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const books = await bookService.getBooks();
        const b = books.find(x => x.id === bookId);
        if (!cancelled && b) setBook(b);
        else if (!cancelled && !b) setError('Book not found');
      } catch (e) {
        if (!cancelled) setError('Failed to load book');
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  useEffect(() => {
    if (!book?.file_path) return;
    let cancelled = false;
    (async () => {
      try {
        const exists = await RNFS.exists(book.file_path);
        if (!cancelled && !exists) {
          setError('Book file not found');
          return;
        }
        const base64 = await RNFS.readFile(book.file_path, 'base64');
        if (!cancelled) setEpubBase64(base64);
      } catch (e) {
        if (!cancelled) setError('Failed to read book file');
      }
    })();
    return () => { cancelled = true; };
  }, [book?.file_path]);

  useEffect(() => {
    if (!isReady || !epubBase64 || !book) return;
    const savedCfi = book.current_position?.cfi ?? null;
    const script = `
      window.epubBase64 = ${JSON.stringify(epubBase64)};
      window.savedCfi = ${savedCfi != null ? JSON.stringify(savedCfi) : 'null'};
      if (window.startReader) window.startReader();
      true;
    `;
    const t = setTimeout(() => webViewRef.current?.injectJavaScript(script), 150);
    return () => clearTimeout(t);
  }, [isReady, epubBase64, book]);

  useEffect(() => {
    if (!isReady || !book || highlightsRestoredRef.current) return;
    highlightsRestoredRef.current = true;
    (async () => {
      try {
        const list = await highlightService.getHighlightsByBook(bookId);
        if (list.length === 0) return;
        const payload = list.map(h => ({
          cfi: h.position?.cfi ?? h.position?.cfiRange,
          text: h.text,
          color: h.color,
          dbId: h.id,
        })).filter(h => h.cfi);
        if (payload.length === 0) return;
        const script = `if(window.handleEpubCommand){window.handleEpubCommand(${JSON.stringify({ command: 'restoreHighlights', highlights: payload })});} true;`;
        setTimeout(() => webViewRef.current?.injectJavaScript(script), 800);
      } catch (_) {}
    })();
  }, [isReady, book, bookId]);

  const sendCommand = (cmd: Record<string, unknown>) => {
    webViewRef.current?.injectJavaScript(
      `if(window.handleEpubCommand){window.handleEpubCommand(${JSON.stringify(cmd)});} true;`
    );
  };

  const handleMessage = (event: {nativeEvent: {data: string}}) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'ready':
          setIsReady(true);
          break;
        case 'locationChanged':
          setProgress(data.percentage ?? 0);
          if (data.cfi && bookId) {
            bookService.updateBook(bookId, {
              current_position: { cfi: data.cfi, timestamp: new Date().toISOString() },
            }).catch(() => {});
          }
          break;
        case 'textSelected':
          setClickedHighlightCfi(null);
          setClickedHighlightColor(null);
          setClickedHighlightDbId(null);
          setSelectedText(data.text ?? '');
          setSelectedCfi(data.cfi ?? null);
          setShowActionSheet(true);
          break;
        case 'highlightClicked':
          setSelectedText(data.text ?? '');
          setSelectedCfi(data.cfi ?? null);
          setClickedHighlightCfi(data.cfi ?? null);
          setClickedHighlightColor(data.color ?? null);
          setClickedHighlightDbId(data.dbId ?? null);
          setShowActionSheet(true);
          break;
        case 'error':
          setError(data.message ?? 'Error in EPUB reader');
          break;
      }
    } catch (_) {}
  };

  const addHighlight = (color: string, dbId?: string) => {
    if (clickedHighlightCfi) {
      sendCommand({ command: 'updateHighlightColor', cfi: clickedHighlightCfi, color });
      setClickedHighlightCfi(null);
      setClickedHighlightColor(null);
      setClickedHighlightDbId(null);
    } else if (selectedCfi) {
      sendCommand({
        command: 'addHighlight',
        cfi: selectedCfi,
        color,
        text: selectedText,
        dbId: dbId ?? undefined,
      });
      setSelectedText('');
      setSelectedCfi(null);
    }
  };

  const removeClickedHighlight = async () => {
    if (clickedHighlightCfi) {
      sendCommand({ command: 'removeHighlight', cfi: clickedHighlightCfi });
      if (clickedHighlightDbId) {
        try {
          await highlightService.deleteHighlight(clickedHighlightDbId);
        } catch (_) {}
      }
      setClickedHighlightCfi(null);
      setClickedHighlightColor(null);
      setClickedHighlightDbId(null);
    }
  };

  if (error) {
    return (
      <View style={[styles.centered, {paddingTop: insets.top + 20}]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#333" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{book.title}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.progress}>{Math.round(progress * 100)}%</Text>
            <TouchableOpacity onPress={() => sendCommand({ command: 'prev' })} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => sendCommand({ command: 'next' })} style={styles.navBtn}>
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

      <WebView
        ref={webViewRef}
        source={{ html: getEpubReaderHtml(), baseUrl: 'https://localhost' }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        originWhitelist={['*']}
        style={styles.webview}
        scrollEnabled={false}
      />

      <TextActionSheet
        isVisible={showActionSheet}
        selectedText={selectedText}
        context=""
        bookId={bookId}
        bookTitle={book.title}
        position={{ cfi: selectedCfi }}
        isClickedHighlight={!!clickedHighlightCfi}
        clickedColor={clickedHighlightColor ?? undefined}
        onClose={() => {
          setShowActionSheet(false);
          setSelectedText('');
          setSelectedCfi(null);
          setClickedHighlightCfi(null);
          setClickedHighlightColor(null);
          setClickedHighlightDbId(null);
        }}
        onHighlightAdded={(color, dbId) => addHighlight(color, dbId)}
        onHighlightDeleted={removeClickedHighlight}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#333', marginBottom: 16, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  headerBtn: { paddingVertical: 8, paddingRight: 8 },
  backText: { fontSize: 17, color: '#007AFF' },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333', marginHorizontal: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  progress: { fontSize: 12, color: '#666', marginRight: 8 },
  navBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  navBtnText: { fontSize: 24, color: '#333' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});

export default EPUBReaderScreen;
