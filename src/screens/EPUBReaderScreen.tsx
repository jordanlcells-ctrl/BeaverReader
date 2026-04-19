import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Animated,
  Image,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
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
import {isTabletSize} from '../utils/responsiveLayout';
import {normalizeLocalFilePath} from '../utils/localFilePath';
import {supabase} from '../services/supabase';
import {uploadBookToStorage, downloadBookFromStorage, localBookPath} from '../services/bookStorageService';

type Props = NativeStackScreenProps<RootStackParamList, 'BookReader'>;

// Static source — never changes, so WebView never reloads
const ASSET_SOURCE = {uri: 'file:///android_asset/epub-reader.html'};

// Module-level cache: survives native-stack unmount/remount cycles
// (Android native stack may unmount screens behind new pushes on low-memory devices).
const epubBase64Cache = new Map<string, string>();

export const EPUBReaderScreen: React.FC<Props> = ({route, navigation}) => {
  const {bookId} = route.params;
  const {colors, resolvedTheme} = useTheme();
  const isDark = resolvedTheme === 'dark';
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const {fontScale, width: windowWidth, height: windowHeight} = useWindowDimensions();
  /**
   * RN `edgeToEdgeEnabled` + WebView: `useSafeAreaInsets().top` is often 0 while the document still
   * paints under the status bar. Reserve at least StatusBar.currentHeight on Android so HTML is not
   * laid out in the system bar band (tablet landscape clipping).
   */
  const readerWebTopInset = React.useMemo(() => {
    const landscape = windowWidth > windowHeight;
    if (Platform.OS === 'android') {
      const base = Math.max(insets.top, StatusBar.currentHeight ?? 28);
      const tablet = isTabletSize(windowWidth, windowHeight);
      return base + (landscape ? (tablet ? 20 : 14) : 0);
    }
    return insets.top + (landscape ? 8 : 0);
  }, [insets.top, windowWidth, windowHeight]);
  const overlayTop = readerWebTopInset + 12;

  // When BookReader mounts fresh from a TOC chapter selection, goToPage is present.
  // Skip the book-cover overlay and show the chapter overlay from the start instead.
  const initialGoToPage = !!(route.params as any).goToPage;

  const [book, setBook] = useState<{id: string; title: string; file_path: string; current_position?: {cfi?: string}} | null>(null);
  const [epubBase64, setEpubBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relinking, setRelinking] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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

  const [isBookLoading, setIsBookLoading] = useState(!initialGoToPage);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const bookReadyRef = useRef(false);

  const [isChapterLoading, setIsChapterLoading] = useState(initialGoToPage);
  const chapterLoadingOpacity = useRef(new Animated.Value(initialGoToPage ? 1 : 0)).current;
  const chapterLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highlightsRestoredRef = useRef(false);
  const lastCfiRef = useRef<string | null>(null);
  const pendingGoToRef = useRef<{sectionIndex: number; anchor?: string; title?: string} | null>(null);
  const selectedTextRef = useRef('');
  const selectedCfiRef = useRef<string | null>(null);

  // Load cached cover instantly on mount
  useEffect(() => {
    const coverPath = `${RNFS.DocumentDirectoryPath}/epub-covers/${bookId}.jpg`;
    RNFS.exists(coverPath).then(exists => {
      if (exists) setCoverDataUrl(`file://${coverPath}`);
    }).catch(() => {});
  }, [bookId]);

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

  // Read EPUB file as base64 (or restore from module-level cache on remount)
  useEffect(() => {
    if (!book?.file_path) return;
    let cancelled = false;
    (async () => {
      try {
        // Fast path: module-level cache survives native-stack remounts
        const cached = epubBase64Cache.get(bookId);
        if (cached) {
          if (!cancelled) setEpubBase64(cached);
          return;
        }

        const path = normalizeLocalFilePath(book.file_path);
        if (!path) {
          if (!cancelled) setError('Book file not found');
          return;
        }
        let filePath = path;
        const exists = await RNFS.exists(filePath);
        if (!exists) {
          console.warn('📖 EPUB: file missing at path:', filePath);
          // Try to download from Supabase Storage
          try {
            if (!cancelled) { setDownloading(true); setDownloadPct(0); }
            const {data: {user}} = await supabase.auth.getUser();
            if (!user) throw new Error('Not signed in');
            const dest = localBookPath(bookId, 'epub');
            await downloadBookFromStorage(user.id, bookId, 'epub', dest, pct => {
              if (!cancelled) setDownloadPct(pct);
            });
            // Update DB so future opens on this device work without re-downloading
            await bookService.updateBook(bookId, {file_path: dest});
            filePath = dest;
          } catch (dlErr: any) {
            console.warn('📖 EPUB: cloud download failed:', dlErr?.message);
            if (!cancelled) {
              setDownloading(false);
              setCloudError(dlErr?.message ?? 'Download failed');
              setError('Book file not found');
            }
            return;
          } finally {
            if (!cancelled) setDownloading(false);
          }
        } else {
          // File exists locally — upload to cloud in background if not already synced
          const syncKey = `cloud_synced_${bookId}`;
          const alreadySynced = await AsyncStorage.getItem(syncKey).catch(() => null);
          if (!alreadySynced) {
            supabase.auth.getUser().then(({data: {user}}) => {
              if (user) {
                uploadBookToStorage(filePath, user.id, bookId, 'epub')
                  .then(() => { console.log('✅ EPUB synced to cloud:', bookId); return AsyncStorage.setItem(syncKey, '1'); })
                  .catch(err => console.error('❌ EPUB cloud sync FAILED:', err?.message ?? err));
              }
            }).catch(() => {});
          }
        }
        const base64 = await RNFS.readFile(filePath, 'base64');
        if (!cancelled) {
          epubBase64Cache.set(bookId, base64);
          setEpubBase64(base64);
        }
      } catch (e) {
        console.error('📖 EPUB: readFile failed:', e);
        if (!cancelled) setError('Failed to read book file');
      }
    })();
    return () => { cancelled = true; };
  }, [book?.file_path, bookId, retryCount]);

  // Once WebView is ready AND we have EPUB data, inject it in chunks and call startReader
  useEffect(() => {
    if (!isReady || !epubBase64 || !book) return;
    const wv = webViewRef.current;
    if (!wv) return;

    const pending = pendingGoToRef.current;
    let savedCfi: string | null;
    let startAnchor: string | null = null;
    let startTitle: string | null = null;
    let positionFromToc = false;
    if (pending) {
      pendingGoToRef.current = null;
      positionFromToc = true;
      savedCfi = `section-${pending.sectionIndex}`;
      startAnchor = pending.anchor ?? null;
      startTitle = pending.title ?? null;
      // Safety fallback: if locationChanged never fires for this fresh-mount chapter nav,
      // dismiss the chapter overlay so the reader doesn't stay stuck.
      if (chapterLoadTimerRef.current) clearTimeout(chapterLoadTimerRef.current);
      chapterLoadTimerRef.current = setTimeout(() => hideChapterLoading(), 10000);
    } else {
      savedCfi = book.current_position?.cfi ?? null;
    }

    /* Cover spine often saves as section-0 — reopening restores a black screen (not TOC "chapter 1"). */
    if (!positionFromToc && savedCfi && /^section-0(-page-0)?$/i.test(String(savedCfi).trim())) {
      console.log('📖 EPUB: Dropping saved cover position', savedCfi);
      savedCfi = null;
      AsyncStorage.removeItem(`epub_position_${bookId}`).catch(() => {});
      bookService.updateBook(bookId, {current_position: null as never}).catch(() => {});
    }

    console.log('📖 EPUB: Sending EPUB data, savedCfi:', savedCfi);
    if (savedCfi) lastCfiRef.current = savedCfi;

    bookReadyRef.current = false;

    /* Smaller chunks avoid Android WebView bridge size limits that corrupt base64 and break parsing. */
    const CHUNK = 192 * 1024;
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
            ${Platform.OS === 'android' ? 'window.__epubReflowOverride = true;' : ''}
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

    const safetyTimeout = setTimeout(() => {
      if (!bookReadyRef.current) {
        console.warn('📖 EPUB: bookReady never received — force-dismissing loading overlay');
        bookReadyRef.current = true;
        Animated.timing(loadingOpacity, {toValue: 0, duration: 300, useNativeDriver: true})
          .start(() => setIsBookLoading(false));
      }
    }, 15000);

    return () => { cancelled = true; clearTimeout(t); clearTimeout(safetyTimeout); };
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

  /**
   * Light in-WebView margins. Native `readerWebTopInset` clears the status bar; keep HTML top
   * modest so #page-window does not collapse on short viewports after clamping.
   */
  const pushReaderChrome = React.useCallback(() => {
    if (!webViewRef.current) return;
    const tablet = isTabletSize(windowWidth, windowHeight);
    const landscape = windowWidth > windowHeight;
    const baseTop = tablet ? 26 : 20;
    const padTop = Math.round(baseTop + Math.max(0, fontScale - 1) * 10);
    /*
     * Android landscape: safe-area bottom is often 0 while the 3-button / gesture bar still
     * eats space — match WebView inset guidance (developer.android.com/develop/ui/views/layout/webapps/understand-window-insets).
     */
    const androidLandChrome =
      Platform.OS === 'android' && landscape ? (tablet ? 44 : 32) : 0;
    const padBot = Math.max(52, Math.round(insets.bottom + 44 + androidLandChrome));
    const sidePad = tablet ? 48 : 41;
    sendCommand({
      command: 'setReaderChrome',
      paddingTopPx: padTop,
      paddingBottomPx: padBot,
      paddingLeftPx: sidePad,
      paddingRightPx: sidePad,
    });
    sendCommand({
      command: 'setSafeInsets',
      top: readerWebTopInset,
      bottom: insets.bottom,
      left: insets.left,
      right: insets.right,
    });
  }, [fontScale, insets.bottom, insets.left, insets.right, readerWebTopInset, windowWidth, windowHeight]);

  const pushReaderChromeLatestRef = React.useRef(pushReaderChrome);
  pushReaderChromeLatestRef.current = pushReaderChrome;

  const showChapterLoading = () => {
    if (chapterLoadTimerRef.current) clearTimeout(chapterLoadTimerRef.current);
    // Force-dismiss book cover overlay (works even with native driver animation)
    setIsBookLoading(false);
    bookReadyRef.current = true;
    // Show chapter overlay instantly at full opacity — no fade-in
    chapterLoadingOpacity.setValue(1);
    setIsChapterLoading(true);
  };

  const hideChapterLoading = () => {
    if (chapterLoadTimerRef.current) clearTimeout(chapterLoadTimerRef.current);
    Animated.timing(chapterLoadingOpacity, {toValue: 0, duration: 300, useNativeDriver: true})
      .start(() => setIsChapterLoading(false));
  };

  useFocusEffect(
    React.useCallback(() => {
      if (!isReady || !webViewRef.current) return;
      readingPreferencesService.getEpubFontSizePx().then((size) => {
        sendCommand({command: 'setFontSize', size});
      });
      sendCommand({command: 'setTheme', dark: isDark});
      pushReaderChrome();
    }, [isReady, isDark, pushReaderChrome]),
  );

  /* WebView layout / orientation: reflow must re-pin #page-window (native safe area is on the RN wrapper, not env()). */
  useEffect(() => {
    if (!isReady || !webViewRef.current) return;
    pushReaderChrome();
    sendCommand({command: 'remeasureReflow'});
  }, [isReady, insets.bottom, insets.left, insets.right, readerWebTopInset, pushReaderChrome]);

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
          showChapterLoading();
          chapterLoadTimerRef.current = setTimeout(() => {
            sendCommand({command: 'goToSection', sectionIndex: p.sectionIndex, anchor: p.anchor, title: p.title});
            // Safety fallback — hide if locationChanged never fires
            chapterLoadTimerRef.current = setTimeout(() => hideChapterLoading(), 6000);
          }, 300);
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
          setTimeout(() => {
            webViewRef.current?.injectJavaScript(
              `if(window.handleEpubCommand){window.handleEpubCommand(${JSON.stringify({command:'setTheme', dark: isDark})});} true;`
            );
          }, 50);
          break;
        case 'toggleButtons':
          setShowButtons(prev => !prev);
          break;
        case 'locationChanged':
          hideChapterLoading();
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
        case 'coverImage':
          if (data.dataUrl) {
            setCoverDataUrl(data.dataUrl);
            const coverDir = `${RNFS.DocumentDirectoryPath}/epub-covers`;
            const coverPath = `${coverDir}/${bookId}.jpg`;
            RNFS.mkdir(coverDir).catch(() => {}).finally(() => {
              const base64Data = data.dataUrl.replace(/^data:image\/\w+;base64,/, '');
              RNFS.writeFile(coverPath, base64Data, 'base64').catch(() => {});
            });
          }
          break;
        case 'bookReady':
          if (!bookReadyRef.current) {
            bookReadyRef.current = true;
            Animated.timing(loadingOpacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }).start(() => setIsBookLoading(false));
          }
          setTimeout(() => pushReaderChromeLatestRef.current(), 160);
          break;
        case 'error':
          console.error('📖 EPUB error:', data.message);
          setError(data.message ?? 'Error in EPUB reader');
          setIsBookLoading(false);
          break;
      }
    } catch (_) {}
  };

  const addHighlight = (color: string, dbId?: string, explicitText?: string) => {
    if (clickedHighlightCfi) {
      console.log('📖 EPUB: updateHighlightColor', clickedHighlightCfi, color);
      sendCommand({command: 'updateHighlightColor', cfi: clickedHighlightCfi, color});
      setClickedHighlightCfi(null); setClickedHighlightColor(null); setClickedHighlightDbId(null);
    } else {
      const cfi = selectedCfi || selectedCfiRef.current;
      const text = (explicitText ?? selectedText ?? selectedTextRef.current ?? '').trim();
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

  const canRelinkFile =
    error === 'Book file not found' || error === 'Failed to read book file';

  const handleRelinkEpub = async () => {
    try {
      setRelinking(true);
      const path = await bookService.relinkBookFile(bookId, 'epub');
      if (!path) {
        return;
      }
      const books = await bookService.getBooks();
      const b = books.find(x => x.id === bookId);
      if (!b) {
        Alert.alert('Error', 'Book not found in your library.');
        return;
      }
      let merged: typeof b = b;
      const localPos = await AsyncStorage.getItem(`epub_position_${bookId}`);
      if (localPos) {
        try {
          const parsed = JSON.parse(localPos);
          if (parsed?.cfi) {
            merged = {...b, current_position: {cfi: parsed.cfi, timestamp: parsed.timestamp}};
          }
        } catch (_) {}
      }
      epubBase64Cache.delete(bookId);
      setError(null);
      setEpubBase64(null);
      setIsReady(false);
      setBook({
        id: merged.id,
        title: merged.title,
        file_path: merged.file_path,
        current_position: merged.current_position as {cfi?: string} | undefined,
      });
    } catch (e: any) {
      Alert.alert('Could not update book', e?.message || 'Something went wrong');
    } finally {
      setRelinking(false);
    }
  };

  if (downloading) {
    return (
      <View style={[styles.centered, {paddingTop: insets.top + 20, backgroundColor: colors.background, paddingHorizontal: 28}]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.errorText, {color: colors.text, marginTop: 16}]}>Downloading from cloud…</Text>
        <Text style={[styles.errorHint, {color: colors.textMuted}]}>{downloadPct}%</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, {paddingTop: insets.top + 20, backgroundColor: colors.background, paddingHorizontal: 28}]}>
        <Text style={[styles.errorText, {color: colors.text}]}>{error}</Text>
        {canRelinkFile ? (
          <>
            {cloudError ? (
              <>
                <Text style={[styles.errorHint, {color: colors.textMuted}]}>
                  {'Open this book on the device where it was imported. That will upload it to the cloud. Then come back here and tap Retry.'}
                </Text>
                <TouchableOpacity
                  style={[styles.relinkBtn, {backgroundColor: colors.accent}]}
                  onPress={() => { setError(null); setCloudError(null); setRetryCount(c => c + 1); }}
                  activeOpacity={0.85}>
                  <Text style={styles.relinkBtnText}>Retry Download</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <Text style={[styles.errorHint, {color: colors.textMuted, marginTop: cloudError ? 16 : 0}]}>
              {'Or, if you have the EPUB file on this device, import it directly:'}
            </Text>
            <TouchableOpacity
              style={[styles.relinkBtn, {backgroundColor: colors.accent}]}
              onPress={handleRelinkEpub}
              disabled={relinking}
              activeOpacity={0.85}>
              {relinking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.relinkBtnText}>Choose EPUB file</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, {color: colors.accent}]}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /** EPUB HTML uses white / near-black page bg — not app shell `colors.background` (#F7F5F0 cream). */
  const readerPageBg = isDark ? '#1a1a1a' : '#ffffff';

  if (!book) {
    return <View style={[styles.container, {backgroundColor: colors.background}]} />;
  }

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}
      edges={['bottom', 'left', 'right']}>
      <StatusBar
        translucent={Platform.OS === 'android' ? false : undefined}
        backgroundColor={Platform.OS === 'android' ? readerPageBg : undefined}
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
      />
      <View
        collapsable={false}
        style={[styles.webviewHost, {paddingTop: readerWebTopInset, backgroundColor: readerPageBg}]}>
        <WebView
          ref={webViewRef}
          allowFileAccess
          allowUniversalAccessFromFileURLs={Platform.OS === 'android'}
          source={ASSET_SOURCE}
          onMessage={handleMessage}
          onLayout={() => {
            if (!isReady) return;
            pushReaderChrome();
            sendCommand({command: 'remeasureReflow'});
          }}
          onLoadEnd={() => {
            console.log('📖 EPUB: WebView onLoadEnd fired, isReady:', isReady);
            if (!isReady) {
              setTimeout(() => {
                if (!isReady) {
                  console.log('📖 EPUB: Retrying ready check via injectJavaScript');
                  webViewRef.current?.injectJavaScript(
                    `if(typeof ePub !== 'undefined' && window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'})); } true;`
                  );
                }
              }, 1000);
            }
          }}
          onError={(e) => {
            console.error('📖 EPUB WebView load error:', e.nativeEvent);
            setError('Failed to load reader');
          }}
          onHttpError={(e) => {
            console.error('📖 EPUB WebView HTTP error:', e.nativeEvent.statusCode);
          }}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          originWhitelist={['*']}
          overScrollMode="never"
          style={[styles.webview, {backgroundColor: readerPageBg}]}
          scrollEnabled={false}
        />
      </View>

      {showButtons && (
        <TouchableOpacity style={[styles.exitButton, {top: overlayTop}]} onPress={() => navigation.goBack()}>
          <Text style={styles.exitButtonText}>✕</Text>
        </TouchableOpacity>
      )}

      {showButtons && (
        <TouchableOpacity
          style={[styles.menuButton, {bottom: Math.max(16, insets.bottom + 12)}]}
          onPress={() => setShowMenu(true)}>
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

      {isBookLoading && !isChapterLoading && (
        <Animated.View
          style={[styles.loadingOverlay, {backgroundColor: colors.background, opacity: loadingOpacity}]}
          pointerEvents="none">
          {coverDataUrl ? (
            <Image source={{uri: coverDataUrl}} style={styles.loadingCoverImage} resizeMode="contain" />
          ) : (
            <ActivityIndicator size="large" color={colors.accent} />
          )}
        </Animated.View>
      )}

      {isChapterLoading && (
        <Animated.View
          style={[styles.loadingOverlay, styles.chapterOverlay, {backgroundColor: colors.background, opacity: chapterLoadingOpacity}]}
          pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.chapterLoadingText, {color: colors.textMuted}]}>Loading chapter...</Text>
        </Animated.View>
      )}

      <TextActionSheet
        isVisible={showActionSheet}
        selectedText={selectedText}
        context=""
        bookId={bookId}
        bookTitle={book.title}
        position={{cfi: selectedCfi}}
        isClickedHighlight={!!clickedHighlightCfi}
        existingHighlightDbId={clickedHighlightDbId}
        clickedColor={clickedHighlightColor ?? undefined}
        onClose={() => { setShowActionSheet(false); setSelectedText(''); setSelectedCfi(null); setClickedHighlightCfi(null); setClickedHighlightColor(null); setClickedHighlightDbId(null); selectedTextRef.current = ''; selectedCfiRef.current = null; sendCommand({command: 'clearSelection'}); }}
        onHighlightAdded={(color, dbId, highlightText) => addHighlight(color, dbId, highlightText)}
        onHighlightDeleted={removeClickedHighlight}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  loadingOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 999},
  loadingCoverImage: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%'},
  chapterOverlay: {zIndex: 1000},
  chapterLoadingText: {marginTop: 16, fontSize: 16, fontWeight: '500'},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  errorText: {fontSize: 16, color: '#333', marginBottom: 16, textAlign: 'center'},
  errorHint: {fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 22},
  relinkBtn: {paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, minWidth: 220, alignItems: 'center', marginBottom: 20},
  relinkBtnText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  backBtn: {paddingVertical: 8, paddingHorizontal: 12},
  backText: {fontSize: 17, color: '#007AFF'},
  webviewHost: {flex: 1},
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
