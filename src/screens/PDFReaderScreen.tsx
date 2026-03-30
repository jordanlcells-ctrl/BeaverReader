import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Text,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types';
import {bookService} from '../services/bookService';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {pdfCache, pdfTextCache} from '../services/pdfCache';
import {TextActionSheet} from '../components/TextActionSheet';
import {highlightService} from '../services/highlightService';
import {bookmarkService} from '../services/bookmarkService';
import {tocService} from '../services/tocService';
import {mistralService} from '../services/mistralService';
import {getPdfReaderHtml} from '../utils/pdfReaderHtml';
import {readingPreferencesService} from '../services/readingPreferencesService';
import {emitPdfPrepDone} from '../services/pdfPrepEvents';
import {useTheme} from '../contexts/ThemeContext';
import type {Highlight} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PDFReader'>;

export const PDFReaderScreen = ({route, navigation}: Props) => {
  const {bookId} = route.params;
  const {resolvedTheme, colors} = useTheme();
  const darkMode = resolvedTheme === 'dark';
  const webViewRef = useRef<WebView>(null);
  const hasLoadedPDF = useRef(false);
  const isInitialLoad = useRef(true);
  const positionRef = useRef({page: 1, mode: 'pdf' as const, bookId, progress: 0 as number | undefined});
  const targetRestorePageRef = useRef<number | null>(null);
  const insets = useSafeAreaInsets();
  
  const [book, setBook] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showButtons, setShowButtons] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [readerMode, setReaderMode] = useState<'pdf' | 'text'>('pdf');
  const [pdfLoaded, setPdfLoaded] = useState(false); // Track when PDF is fully loaded
  const [isRestoringPosition, setIsRestoringPosition] = useState(true); // Hide WebView until position is restored
  const [selectedText, setSelectedText] = useState('');
  const selectedTextRef = useRef('');
  const isRestoringOverlayRef = useRef(true);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissLoadingOverlay = useCallback(() => {
    isRestoringOverlayRef.current = false;
    if (safetyTimerRef.current != null) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    loadingOpacity.setValue(0);
    setIsRestoringPosition(false);
  }, [loadingOpacity]);

  // Safety timeout only if overlay still showing (ref avoids stale closure from [])
  useEffect(() => {
    safetyTimerRef.current = setTimeout(() => {
      if (isRestoringOverlayRef.current) {
        console.log('🚨 SAFETY TIMEOUT: Force dismissing overlay after 6 seconds');
        targetRestorePageRef.current = null;
        dismissLoadingOverlay();
      }
    }, 6000);
    return () => {
      if (safetyTimerRef.current != null) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
    };
  }, []);
  const [selectedPage, setSelectedPage] = useState(1);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [clickedHighlightColor, setClickedHighlightColor] = useState<string | null>(null);
  const [clickedHighlightId, setClickedHighlightId] = useState<string | null>(null);
  const [clickedHighlightDbId, setClickedHighlightDbId] = useState<string | null>(null); // Database ID
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Load cached cover instantly on mount
  useEffect(() => {
    const coverPath = `${RNFS.DocumentDirectoryPath}/pdf-covers/${bookId}.jpg`;
    RNFS.exists(coverPath).then(exists => {
      if (exists) setCoverDataUrl(`file://${coverPath}`);
    }).catch(() => {});
  }, [bookId]);

  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      emitPdfPrepDone(bookId);
    });
    return unsub;
  }, [navigation, bookId]);

  // Load book info - merge position from AsyncStorage (most recent) with DB
  useEffect(() => {
    const loadBook = async () => {
      try {
        const books = await bookService.getBooks();
        const foundBook = books.find(b => b.id === bookId);
        if (foundBook) {
          // Check AsyncStorage for more recent position (saved when we left)
          const localPos = await AsyncStorage.getItem(`pdf_position_${bookId}`);
          if (localPos) {
            try {
              const parsed = JSON.parse(localPos);
              if (parsed?.page != null && parsed?.page !== '') {
                foundBook.current_position = {
                  ...foundBook.current_position,
                  page: String(parsed.page),
                  mode:
                    parsed.mode === 'text' || parsed.mode === 'pdf'
                      ? parsed.mode
                      : (foundBook.current_position?.mode as string) || 'pdf',
                  // Critical: progress ratio for text-mode restore (was missing → always 0)
                  progress:
                    typeof parsed.progress === 'number' && !Number.isNaN(parsed.progress)
                      ? parsed.progress
                      : (foundBook.current_position as {progress?: number})?.progress,
                  timestamp: parsed.timestamp,
                };
                console.log('📍 Using position from AsyncStorage:', parsed.page, 'mode:', parsed.mode, 'progress:', parsed.progress);
              }
            } catch (_) {}
          }
          // Reader mode: route flag (first open after prep) > saved position > global preference
          const preferText = !!(route.params as {preferTextMode?: boolean}).preferTextMode;
          const posMode = foundBook.current_position?.mode;
          if (preferText) {
            setReaderMode('text');
          } else if (posMode === 'text' || posMode === 'pdf') {
            setReaderMode(posMode);
          } else {
            try {
              const globalMode = await AsyncStorage.getItem('pdf_reader_mode');
              if (globalMode === 'text' || globalMode === 'pdf') {
                setReaderMode(globalMode);
              }
            } catch (_) {}
          }
          setBook(foundBook);
        } else {
          console.error('❌ PDF Book not found');
          Alert.alert('Error', 'Book not found');
          navigation.goBack();
        }
      } catch (error) {
        console.error('❌ Error loading PDF book:', error);
        Alert.alert('Error', 'Failed to load book');
        navigation.goBack();
      }
    };
    loadBook();
  }, [bookId, navigation]);

  // Initialize PDF reader (runs once when WebView is ready AND book is loaded)
  useEffect(() => {
    // Only proceed if all conditions are met and we haven't loaded yet
    if (!isReady || !book || !book.file_path) return;
    if (hasLoadedPDF.current) return;
    
    hasLoadedPDF.current = true;

    const loadPDF = async () => {
      try {
        console.log('=== PDF Loading Start ===');

        let filePath = book.file_path;
        if (filePath.startsWith('file://')) {
          filePath = filePath.substring(7);
        }

        // Check cache first
        let base64Data = pdfCache.get(bookId);

        if (!base64Data) {
          const exists = await RNFS.exists(filePath);
          if (!exists) throw new Error('File does not exist: ' + filePath);
          const startTime = Date.now();
          base64Data = await RNFS.readFile(filePath, 'base64');
          console.log('✅ PDF read from disk in', Date.now() - startTime, 'ms');
          pdfCache.set(bookId, base64Data);
        }

        // Use cached extracted text if available (avoids re-extraction)
        const cachedText = pdfTextCache.get(bookId);
        const pdfTextFontSizePx = await readingPreferencesService.getPdfTextFontSizePx();

        const jsCode = `
          window.pdfBase64Data = "${base64Data}";
          window.cachedExtractedText = ${cachedText ? JSON.stringify(cachedText) : 'null'};
          window.__pdfTextFontSize = ${pdfTextFontSizePx};
          if (window.initReaderWithData) {
            window.initReaderWithData();
          } else {
            setTimeout(function() {
              if (window.initReaderWithData) window.initReaderWithData();
            }, 500);
          }
          true;
        `;
        webViewRef.current?.injectJavaScript(jsCode);
        console.log('✅ PDF injected, size:', Math.round(base64Data.length / 1024), 'KB, text cache:', cachedText ? 'YES' : 'NO');

        // Capture page 1 as cover if not already cached (after PDF renders)
        setTimeout(() => {
          const coverPath = `${RNFS.DocumentDirectoryPath}/pdf-covers/${bookId}.jpg`;
          RNFS.exists(coverPath).then(exists => {
            if (!exists) {
              webViewRef.current?.injectJavaScript(`
                (function() {
                  try {
                    var canvas = document.querySelector('canvas');
                    if (canvas) {
                      var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                      window.ReactNativeWebView.postMessage(JSON.stringify({type:'coverImage', dataUrl: dataUrl}));
                    }
                  } catch(e) {}
                })();
                true;
              `);
            }
          }).catch(() => {});
        }, 2000);
      } catch (error: any) {
        console.error('PDF Loading Error:', error.message);
        Alert.alert('Error Loading PDF', error.message || 'Failed to load PDF file');
      }
    };

    loadPDF();
  }, [isReady, book, bookId]); // Add full 'book' dependency to catch when it loads

  // Handle position restoration after PDF is loaded (runs once when pdfLoaded becomes true)
  const hasRestoredPosition = useRef(false);
  useEffect(() => {
    if (!pdfLoaded || hasRestoredPosition.current) return;
    hasRestoredPosition.current = true;

    console.log('🔄 Position restoration logic triggered, pdfLoaded:', pdfLoaded);
    const savedPage = book?.current_position?.page ? parseInt(String(book.current_position.page), 10) : 0;
    const savedMode = (book?.current_position?.mode || 'pdf') as 'pdf' | 'text';
    const rawProg = (book?.current_position as {progress?: number})?.progress;
    const savedProgress = typeof rawProg === 'number' && !Number.isNaN(rawProg) ? rawProg : undefined;
    const preferTextMode = !!(route.params as {preferTextMode?: boolean}).preferTextMode;
    console.log('📍 Saved position - page:', savedPage, 'mode:', savedMode, 'progress:', savedProgress);

    if (savedPage > 0 || savedMode === 'text') {
      // For text mode use -1 sentinel (any locationChanged from text mode clears the overlay)
      // For PDF mode use the exact page number for matching
      targetRestorePageRef.current = savedMode === 'text' ? -1 : savedPage;
      console.log('⏳ Set targetRestore:', targetRestorePageRef.current, 'for mode:', savedMode);
      if (savedMode !== readerMode) setReaderMode(savedMode);

      setTimeout(() => {
        if (savedMode === 'text') {
          console.log('📖 Switching to text mode, progress:', savedProgress);
          // Prefer progress ratio; if missing (old saves), use saved text page number
          const js =
            savedProgress !== undefined
              ? `if (window.switchMode) { window.switchMode('text', null, ${savedProgress}); }`
              : savedPage > 0
                ? `if (window.switchMode) { window.switchMode('text', ${savedPage}, null); }`
                : `if (window.switchMode) { window.switchMode('text', null, 0); }`;
          webViewRef.current?.injectJavaScript(`${js}
            true;
          `);
        } else {
          console.log('📄 Going to PDF page:', savedPage);
          webViewRef.current?.injectJavaScript(`
            if (window.goToPage) { window.goToPage(${savedPage}); }
            true;
          `);
        }
        // Fallback: dismiss overlay after timeout if locationChanged never fires
        setTimeout(() => {
          if (targetRestorePageRef.current !== null) {
            console.log('⚠️ Fallback timeout: dismissing overlay without locationChanged');
            targetRestorePageRef.current = null;
            dismissLoadingOverlay();
          }
        }, 5000);
      }, 300);
    } else if (preferTextMode) {
      navigation.setParams({preferTextMode: undefined} as never);
      console.log('📖 First open: switching to reader (text) mode');
      targetRestorePageRef.current = -1;
      setReaderMode('text');
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(`
          if (window.switchMode) { window.switchMode('text', null, 0); }
          true;
        `);
        setTimeout(() => {
          if (targetRestorePageRef.current !== null) {
            targetRestorePageRef.current = null;
            dismissLoadingOverlay();
          }
        }, 5000);
      }, 300);
    } else {
      console.log('✅ No saved position, dismissing overlay immediately');
      // No saved position — sync RN readerMode with WebView (starts in PDF canvas mode).
      if (readerMode !== 'pdf') {
        console.log('🔄 Resetting readerMode from', readerMode, 'to pdf (no saved position)');
        setReaderMode('pdf');
      }
      targetRestorePageRef.current = null;
      dismissLoadingOverlay();
    }
  }, [pdfLoaded, book, readerMode, dismissLoadingOverlay, navigation, route.params]);

  // Handle "Go to page" from Table of Contents – run when screen gains focus with goToPage param
  useFocusEffect(
    React.useCallback(() => {
      const page = (route.params as {goToPage?: number})?.goToPage;
      if (page != null && page > 0 && pdfLoaded && webViewRef.current) {
        navigation.setParams({goToPage: undefined} as never);
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(`
            if (window.switchMode) { window.switchMode('pdf'); }
            setTimeout(function() {
              if (window.goToPage) { window.goToPage(${page}); }
            }, 100);
            true;
          `);
        }, 200);
      }
    }, [route.params, pdfLoaded, navigation]),
  );

  // Keep position ref updated for unmount save (include progress for text mode)
  useEffect(() => {
    positionRef.current = {page: currentPage, mode: readerMode, bookId, progress};
  }, [currentPage, readerMode, bookId, progress]);

  // Save reading position when page changes (debounced)
  useEffect(() => {
    const waitingForRestore = targetRestorePageRef.current !== null || isRestoringOverlayRef.current;
    if (currentPage > 0 && bookId && !waitingForRestore) {
      const savePosition = async () => {
        const pos = {
          page: currentPage.toString(),
          mode: readerMode,
          // Save progress ratio so text-mode restore is stable across repagination
          progress: progress,
          timestamp: new Date().toISOString(),
        };
        try {
          await AsyncStorage.setItem(`pdf_position_${bookId}`, JSON.stringify(pos));
          await bookService.updateBook(bookId, {current_position: pos});
        } catch (error) {
          console.error('Error saving position:', error);
        }
      };

      const timer = setTimeout(savePosition, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPage, readerMode, bookId, progress]);

  // Block navigation until position is saved (ensures save completes before we leave)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isRestoringOverlayRef.current) return;
      const {page, mode, bookId: id, progress: prog} = positionRef.current;
      if (page > 0 && id) {
        e.preventDefault();
        const pos = {
          page: page.toString(),
          mode,
          ...(typeof prog === 'number' && !Number.isNaN(prog) ? {progress: prog} : {}),
          timestamp: new Date().toISOString(),
        };
        AsyncStorage.setItem(`pdf_position_${id}`, JSON.stringify({...pos, page: Number(pos.page)})).catch(() => {});
        bookService.updateBook(id, {current_position: pos})
          .then(() => navigation.dispatch(e.data.action))
          .catch(() => navigation.dispatch(e.data.action));
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Mark initial load as complete after position is restored
  useEffect(() => {
    if (!isRestoringPosition && isInitialLoad.current) {
      const timer = setTimeout(() => {
        isInitialLoad.current = false;
        const {page, mode, bookId: id, progress: prog} = positionRef.current;
        if (page > 0 && id && book?.id === id) {
          const pos = {
            page: page.toString(),
            mode,
            ...(typeof prog === 'number' && !Number.isNaN(prog) ? {progress: prog} : {}),
            timestamp: new Date().toISOString(),
          };
          AsyncStorage.setItem(
            `pdf_position_${id}`,
            JSON.stringify({
              page,
              mode,
              ...(typeof prog === 'number' && !Number.isNaN(prog) ? {progress: prog} : {}),
              timestamp: pos.timestamp,
            }),
          ).catch(() => {});
          bookService.updateBook(id, {current_position: pos}).catch(() => {});
        }
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isRestoringPosition, book?.id]);

  // Check if current page is bookmarked
  useEffect(() => {
    const checkBookmark = async () => {
      if (bookId && currentPage > 0) {
        const isMarked = await bookmarkService.isPageBookmarked(bookId, currentPage);
        setIsBookmarked(isMarked);
      }
    };
    checkBookmark();
  }, [bookId, currentPage]);

  // Restore highlights from database (only once per session)
  const highlightsRestoredRef = useRef(false);
  const restoreHighlights = async () => {
    if (!bookId || highlightsRestoredRef.current) return;
    highlightsRestoredRef.current = true;
    
    try {
      const highlights = await highlightService.getHighlightsByBook(bookId);
      if (highlights.length > 0) {
        const highlightsJson = JSON.stringify(highlights.map(h => ({
          dbId: h.id,
          text: h.text,
          color: h.color,
          page: h.position?.page || 1,
        })));
        webViewRef.current?.injectJavaScript(`
          if (window.restoreHighlights) { window.restoreHighlights(${highlightsJson}); }
          true;
        `);
      }
    } catch (error: any) {
      console.error('Error restoring highlights:', error);
    }
  };

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'coverImage':
          if (data.dataUrl) {
            setCoverDataUrl(data.dataUrl);
            const coverDir = `${RNFS.DocumentDirectoryPath}/pdf-covers`;
            const coverPath = `${coverDir}/${bookId}.jpg`;
            RNFS.mkdir(coverDir).catch(() => {}).finally(() => {
              const base64Data = data.dataUrl.replace(/^data:image\/\w+;base64,/, '');
              RNFS.writeFile(coverPath, base64Data, 'base64').catch(() => {});
            });
          }
          break;
        case 'webviewReady':
          setIsReady(true);
          break;
        case 'ready':
          console.log('📄 PDF ready event received, totalPages:', data.totalPages);
          setTotalPages(data.totalPages);
          setPdfLoaded(true);
          emitPdfPrepDone(bookId);
          // Restore highlights once PDF is loaded (ref prevents duplicates)
          setTimeout(() => restoreHighlights(), 500);
          // Also send a locationChanged to trigger the normal flow
          if (data.totalPages > 0) {
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(`
                if (window.currentPage && window.pdfDoc) {
                  var progress = (window.currentPage - 1) / (window.pdfDoc.numPages - 1);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'locationChanged',
                    page: window.currentPage,
                    totalPages: window.pdfDoc.numPages,
                    progress: progress
                  }));
                }
                true;
              `);
            }, 500);
          }
          break;
        case 'locationChanged': {
          const page = data.page;
          const isTextLocationChange = data.mode === 'text';
          const target = targetRestorePageRef.current;
          // -1 sentinel: dismiss overlay on FIRST text-mode locationChanged (any page)
          // positive: dismiss when exact PDF page matches
          if (target !== null && (target === -1 ? isTextLocationChange : page === target)) {
            targetRestorePageRef.current = null;
            setTimeout(() => {
              dismissLoadingOverlay();
            }, 250);
          }
          setCurrentPage(page);
          setTotalPages(data.totalPages);
          setProgress(data.progress || 0);
          break;
        }
        case 'toggleButtons':
          setShowButtons(prev => !prev);
          break;
        case 'textSelected':
          selectedTextRef.current = data.text ?? '';
          setSelectedText(data.text);
          setSelectedPage(data.page || currentPage);
          setClickedHighlightId(null);
          setClickedHighlightDbId(null);
          setClickedHighlightColor(null);
          setShowActionSheet(true);
          break;
        case 'highlightClicked':
          selectedTextRef.current = data.text ?? '';
          setSelectedText(data.text);
          setClickedHighlightColor(data.color);
          setClickedHighlightId(data.id);
          setClickedHighlightDbId(data.dbId || null); // Store database ID
          setShowActionSheet(true);
          // Go directly to highlightComplete state to show change/delete options
          break;
        case 'error':
          console.error('❌ PDF Error:', data.message);
          Alert.alert('PDF Error', data.message);
          break;
        case 'modeChanged':
          if (data.mode === 'text' || data.mode === 'pdf') {
            setReaderMode(data.mode);
          }
          break;
        case 'textExtracted':
          // Cache the extracted text for future visits
          if (data.text && bookId) {
            pdfTextCache.set(bookId, data.text);
            emitPdfPrepDone(bookId);
            console.log('📝 Text cached:', data.text.length, 'chars');
            // Save to DB in background (don't setBook - avoids re-render cascade)
            bookService.updateBook(bookId, {extracted_text: data.text}).catch(() => {});
            // Restore highlights after text mode renders
            setTimeout(() => restoreHighlights(), 300);
          }
          break;
        case 'tocExtracted':
          // Save extracted TOC (embedded outline or page list fallback)
          if (data.items && data.items.length > 0 && bookId) {
            const src = (data as {source?: string}).source || 'outline';
            console.log('📑 TOC items received:', data.items.length, `(${src})`);
            tocService.hasTOC(bookId).then(async (exists) => {
              if (!exists) {
                try {
                  const tocItems = data.items.map((item: any) => ({
                    book_id: bookId,
                    title: item.title,
                    page: item.page,
                    level: item.level,
                    order_index: item.order_index,
                  }));
                  const CHUNK = 80;
                  for (let i = 0; i < tocItems.length; i += CHUNK) {
                    await tocService.createTOCItems(tocItems.slice(i, i + CHUNK));
                  }
                  console.log('✅ TOC saved to database');
                } catch (error) {
                  console.error('❌ Failed to save TOC:', error);
                }
              } else {
                console.log('📑 TOC already in database, skipping');
              }
            });
          }
          break;

        case 'earlyPagesText': {
          // No embedded outline — try AI TOC extraction from early pages text, then page fallback
          if (!bookId || !data.text) break;
          const totalPages: number = data.totalPages ?? 0;
          (async () => {
            try {
              // Fetch whatever is currently in the DB for this book
              const existing = await tocService.getTOCByBook(bookId);

              // Check if it's just a dumb page list (all titles match "Page N")
              const isPageFallback =
                existing.length > 0 &&
                existing.every(item => /^Page \d+$/.test(item.title));

              if (existing.length > 0 && !isPageFallback) {
                // Real TOC already exists — nothing to do
                console.log('📑 Real TOC already in database, skipping AI extraction');
                return;
              }

              // Either empty or just a page list — try AI
              console.log('🤖 Calling AI to extract TOC from early pages text…');
              const aiItems = await mistralService.extractTOC(data.text, totalPages);

              let rowsToSave: Array<{book_id: string; title: string; page: number; level: number; order_index: number}>;

              if (aiItems && aiItems.length > 0) {
                console.log('📑 AI found', aiItems.length, 'TOC entries — replacing page list');
                rowsToSave = aiItems.map((item, idx) => ({
                  book_id: bookId,
                  title: item.title,
                  page: item.page,
                  level: 0,
                  order_index: idx,
                }));
              } else {
                if (isPageFallback) {
                  // Already have page list, no need to re-save
                  console.log('📑 AI TOC empty — keeping existing page list');
                  return;
                }
                // Nothing saved yet and AI failed — build page list as fallback
                console.log('📑 AI TOC empty/failed — saving page list fallback');
                const maxPages = Math.min(totalPages, 2000);
                rowsToSave = Array.from({length: maxPages}, (_, i) => ({
                  book_id: bookId,
                  title: `Page ${i + 1}`,
                  page: i + 1,
                  level: 0,
                  order_index: i,
                }));
              }

              // Delete stale page list before inserting real TOC
              if (isPageFallback) {
                await tocService.deleteTOCByBook(bookId);
              }

              const CHUNK = 80;
              for (let i = 0; i < rowsToSave.length; i += CHUNK) {
                await tocService.createTOCItems(rowsToSave.slice(i, i + CHUNK));
              }
              console.log('✅ TOC saved to database:', rowsToSave.length, 'items');
            } catch (err) {
              console.error('❌ earlyPagesText handler error:', err);
            }
          })();
          break;
        }
      }
    } catch (error) {
      console.error('❌ Error parsing WebView message:', error);
    }
  };

  // Regenerate TOC: delete existing (including page-list fallback) then re-extract via WebView
  const handleRegenerateTOC = async () => {
    setShowMenu(false);
    try {
      await tocService.deleteTOCByBook(bookId);
      console.log('🗑️ Existing TOC deleted');
    } catch (e) {
      console.warn('Could not delete TOC:', e);
    }
    webViewRef.current?.injectJavaScript('if (window.triggerTOCExtraction) { window.triggerTOCExtraction(); } true;');
    Alert.alert('Generating Table of Contents', 'AI is reading the book pages now. Open Table of Contents in a few seconds.');
  };

  // Toggle Reader Mode
  const toggleReaderMode = async () => {
    const newMode = readerMode === 'pdf' ? 'text' : 'pdf';
    
    setReaderMode(newMode);
    setShowMenu(false);
    
    // Save preference
    try {
      await AsyncStorage.setItem('pdf_reader_mode', newMode);
    } catch (error) {
      console.error('Error saving reader mode:', error);
    }
    
    // Tell WebView to switch mode
    webViewRef.current?.injectJavaScript(`
      if (window.switchMode) { 
        window.switchMode('${newMode}'); 
      }
      true;
    `);
  };

  // Toggle bookmark for current page
  const handleToggleBookmark = async () => {
    try {
      if (isBookmarked) {
        // Find and delete existing bookmark
        const bookmarks = await bookmarkService.getBookmarksByBook(bookId);
        const bookmark = bookmarks.find(b => b.page === currentPage);
        if (bookmark) {
          await bookmarkService.deleteBookmark(bookmark.id);
          setIsBookmarked(false);
          Alert.alert('Bookmark Removed', `Page ${currentPage} bookmark removed`);
        }
      } else {
        // Create new bookmark
        await bookmarkService.createBookmark({
          book_id: bookId,
          page: currentPage,
        });
        setIsBookmarked(true);
        Alert.alert('Bookmark Added', `Page ${currentPage} bookmarked!`);
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
      Alert.alert('Error', 'Failed to toggle bookmark');
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (!webViewRef.current || !pdfLoaded) return;
      readingPreferencesService.getPdfTextFontSizePx().then((size) => {
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({command:'setFontSize',size:${size}})})); true;`
        );
      });
    }, [pdfLoaded]),
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <StatusBar hidden />

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{html: getPdfReaderHtml(darkMode), baseUrl: 'https://localhost'}}
        onMessage={handleMessage}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        bounces={false}
        overScrollMode="never"
        scrollEnabled={true}
      />

      {/* Loading overlay - shows cover if cached, otherwise spinner */}
      {isRestoringPosition && (
        <Animated.View
          pointerEvents="none"
          style={[styles.loadingOverlay, {backgroundColor: colors.background, opacity: loadingOpacity}]}>
          {coverDataUrl ? (
            <Image source={{uri: coverDataUrl}} style={styles.loadingCoverImage} resizeMode="contain" />
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, {color: colors.textMuted}]}>Opening book...</Text>
            </>
          )}
        </Animated.View>
      )}

      {/* Exit button (X) - top right */}
      {showButtons && (
        <TouchableOpacity
          style={[styles.exitButton, {top: insets.top + 10}]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.exitButtonText}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Menu button (≡) - bottom right */}
      {showButtons && (
        <TouchableOpacity
          style={[styles.menuButton, {bottom: insets.bottom + 20}]}
          onPress={() => setShowMenu(true)}>
          <Text style={styles.menuButtonText}>≡</Text>
        </TouchableOpacity>
      )}

      {/* Menu popup */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}>
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          />

          <View style={[styles.menuPopup, {backgroundColor: colors.cardBackground}]}>
            <View style={[styles.menuHandle, {backgroundColor: colors.cardBorder}]} />

            <View style={[styles.menuHeader, {borderBottomColor: colors.cardBorder}]}>
              <Text style={[styles.menuTitle, {color: colors.text}]}>{book?.title || 'Loading...'}</Text>
              <Text style={[styles.menuProgress, {color: colors.textMuted}]}>
                Page {currentPage} of {totalPages} • {Math.round(progress * 100)}
                % complete
              </Text>
              <TouchableOpacity
                style={styles.menuCloseButton}
                onPress={() => setShowMenu(false)}>
                <Text style={[styles.menuCloseButtonText, {color: colors.textMuted}]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuActions}>
              <TouchableOpacity 
                style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]}
                onPress={toggleReaderMode}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>
                  {readerMode === 'pdf' ? '📖 Reader Mode' : '📄 Original PDF'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('TableOfContents' as never, {bookId, bookTitle: book?.title, bookType: 'pdf'} as never);
                }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>📑 Table of Contents</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]}
                onPress={handleRegenerateTOC}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>🔄 Regenerate Table of Contents</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('Highlights' as never, {bookId, bookTitle: book?.title} as never);
                }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>✨ Highlights</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('Bookmarks' as never, {bookId, bookTitle: book?.title} as never);
                }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>🔖 View All Bookmarks</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]}
                onPress={async () => {
                  setShowMenu(false);
                  await handleToggleBookmark();
                }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>
                  {isBookmarked ? '🔖 Remove Bookmark' : '📑 Bookmark This Page'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.menuAction, {borderBottomColor: colors.cardBorder}]}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('Settings');
                }}>
                <Text style={[styles.menuActionText, {color: colors.text}]}>⚙️ Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Text Action Sheet */}
      <TextActionSheet
        isVisible={showActionSheet}
        selectedText={selectedText}
        context="" // TODO: Add context extraction
        bookId={bookId}
        bookTitle={book?.title}
        position={{page: selectedPage}}
        isClickedHighlight={!!clickedHighlightId}
        existingHighlightDbId={clickedHighlightDbId}
        clickedColor={clickedHighlightColor || undefined}
        onClose={() => {
          setShowActionSheet(false);
          selectedTextRef.current = '';
          setSelectedText('');
          setClickedHighlightColor(null);
          setClickedHighlightId(null);
          setClickedHighlightDbId(null); // Clear database ID too
        }}
        onHighlightAdded={(color, dbId, highlightText) => {
          const textToPaint = (highlightText ?? selectedTextRef.current ?? selectedText).trim();
          console.log('✅ Highlight color:', color, 'DB ID:', dbId);
          console.log('🎨 Highlight ID:', clickedHighlightId);
          console.log('🎨 Old color:', clickedHighlightColor);
          console.log('📝 Selected text:', textToPaint);
          
          // Apply visual highlight in WebView
          if (clickedHighlightId) {
            // Changing existing highlight color
            console.log('🔄 Changing highlight color to:', color);
            
            webViewRef.current?.injectJavaScript(`
              if (window.updateHighlightColor) {
                window.updateHighlightColor('${clickedHighlightId}', '${color}');
                console.log('✅ Color change command sent');
              }
              true;
            `);
            
            // Update state with new color but DON'T close menu
            setClickedHighlightColor(color);
            // Stay in the menu so user can try different colors
          } else {
            // New highlight - apply it with database ID and KEEP menu open
            console.log('✨ Creating new highlight with text:', textToPaint, 'DB ID:', dbId);
            const escapedText = textToPaint.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
            webViewRef.current?.injectJavaScript(`
              if (window.applyHighlight) {
                window.applyHighlight('${escapedText}', '${color}', '${dbId || ''}');
              }
              true;
            `);
            // Store the dbId for future operations
            if (dbId) {
              setClickedHighlightDbId(dbId);
            }
            // Keep menu open!
          }
        }}
        onHighlightDeleted={async () => {
          console.log('🗑️🗑️🗑️ DELETE CALLED 🗑️🗑️🗑️');
          console.log('Highlight WebView ID:', clickedHighlightId);
          console.log('Highlight Database ID:', clickedHighlightDbId);
          console.log('Selected text:', selectedText);
          
          // Delete from database if we have a database ID
          if (clickedHighlightDbId) {
            try {
              console.log('🔄 Attempting to delete from database, ID:', clickedHighlightDbId);
              await highlightService.deleteHighlight(clickedHighlightDbId);
              console.log('✅✅✅ Highlight deleted from database successfully! ✅✅✅');
            } catch (error: any) {
              console.error('❌❌❌ Failed to delete from database:', error);
              console.error('Error message:', error.message);
              console.error('Error stack:', error.stack);
              Alert.alert('Error', `Failed to delete highlight: ${error.message}`);
              return;
            }
          } else {
            console.warn('⚠️⚠️⚠️ NO DATABASE ID - Cannot delete from database! ⚠️⚠️⚠️');
            console.log('This means the highlight was not properly saved or restored');
          }
          
          // Remove visual highlight from WebView using the new delete function
          console.log('🔄 Removing visual highlight from WebView, ID:', clickedHighlightId);
          webViewRef.current?.injectJavaScript(`
            if (window.deleteHighlight) {
              console.log('WebView: Calling deleteHighlight with ID:', '${clickedHighlightId}');
              window.deleteHighlight('${clickedHighlightId}');
              console.log('✅ Delete command sent');
            } else {
              console.error('❌ window.deleteHighlight not found!');
            }
            true;
          `);
          
          Alert.alert('Deleted', 'Highlight removed');
          setShowActionSheet(false);
          setSelectedText('');
          setClickedHighlightColor(null);
          setClickedHighlightId(null);
          setClickedHighlightDbId(null);
        }}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    elevation: 10,
  },
  loadingCoverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  exitButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  exitButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  menuButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '300',
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuPopup: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  menuHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  menuHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  menuProgress: {
    fontSize: 14,
    color: '#666',
  },
  menuCloseButton: {
    position: 'absolute',
    top: 0,
    right: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCloseButtonText: {
    fontSize: 24,
    color: '#666',
  },
  menuActions: {
    paddingTop: 10,
  },
  menuAction: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  menuActionText: {
    fontSize: 16,
    color: '#333',
  },
});
