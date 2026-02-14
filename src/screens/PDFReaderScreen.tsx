import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Text,
  Modal,
  PanResponder,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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
import {getPdfReaderHtml} from '../utils/pdfReaderHtml';
import type {Highlight} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PDFReader'>;

export const PDFReaderScreen = ({route, navigation}: Props) => {
  const {bookId} = route.params;
  const webViewRef = useRef<WebView>(null);
  const hasLoadedPDF = useRef(false);
  const isInitialLoad = useRef(true);
  const positionRef = useRef({page: 1, mode: 'pdf' as const, bookId});
  const targetRestorePageRef = useRef<number | null>(null);
  const insets = useSafeAreaInsets();
  
  const [book, setBook] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showButtons, setShowButtons] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [readerMode, setReaderMode] = useState<'pdf' | 'text'>('pdf');
  const [pdfLoaded, setPdfLoaded] = useState(false); // Track when PDF is fully loaded
  const [isRestoringPosition, setIsRestoringPosition] = useState(true); // Hide WebView until position is restored
  const [selectedText, setSelectedText] = useState('');
  const [selectedPage, setSelectedPage] = useState(1);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [clickedHighlightColor, setClickedHighlightColor] = useState<string | null>(null);
  const [clickedHighlightId, setClickedHighlightId] = useState<string | null>(null);
  const [clickedHighlightDbId, setClickedHighlightDbId] = useState<string | null>(null); // Database ID
  const [isBookmarked, setIsBookmarked] = useState(false);

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
              if (parsed?.page) {
                foundBook.current_position = {
                  page: String(parsed.page),
                  mode: parsed.mode || 'text',
                  timestamp: parsed.timestamp,
                };
                console.log('📍 Using position from AsyncStorage:', parsed.page);
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

  // Load saved reader mode preference
  useEffect(() => {
    const loadReaderMode = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('pdf_reader_mode');
        if (savedMode === 'text' || savedMode === 'pdf') {
          setReaderMode(savedMode);
        }
      } catch (error) {
        console.error('Error loading reader mode:', error);
      }
    };
    loadReaderMode();
  }, []);

  // Initialize PDF reader (runs once when WebView is ready AND book is loaded)
  useEffect(() => {
    if (!isReady || !book || !book.file_path || hasLoadedPDF.current) return;
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

        const jsCode = `
          window.pdfBase64Data = "${base64Data}";
          window.cachedExtractedText = ${cachedText ? JSON.stringify(cachedText) : 'null'};
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

        // Mark PDF as loaded after WebView initializes
        setTimeout(() => {
          setPdfLoaded(true);
        }, 2000);
      } catch (error: any) {
        console.error('PDF Loading Error:', error.message);
        Alert.alert('Error Loading PDF', error.message || 'Failed to load PDF file');
      }
    };

    loadPDF();
  }, [isReady, book?.id]); // Only depend on book.id, not the full book object

  // Handle position restoration after PDF is loaded (runs once when pdfLoaded becomes true)
  const hasRestoredPosition = useRef(false);
  useEffect(() => {
    if (!pdfLoaded || hasRestoredPosition.current) return;
    hasRestoredPosition.current = true;

    const savedPage = book?.current_position?.page ? parseInt(book.current_position.page, 10) : 0;
    const savedMode = (book?.current_position?.mode || 'pdf') as 'pdf' | 'text';

    if (savedPage > 0) {
      targetRestorePageRef.current = savedPage;
      if (savedMode !== readerMode) setReaderMode(savedMode);

      setTimeout(() => {
        if (savedMode === 'text') {
          webViewRef.current?.injectJavaScript(`
            if (window.switchMode) { window.switchMode('text', ${savedPage}); }
            true;
          `);
        } else {
          webViewRef.current?.injectJavaScript(`
            if (window.goToPage) { window.goToPage(${savedPage}); }
            true;
          `);
        }
        // Fallback: show WebView after timeout if locationChanged never confirms
        setTimeout(() => {
          if (targetRestorePageRef.current !== null) {
            targetRestorePageRef.current = null;
            setIsRestoringPosition(false);
          }
        }, 6000);
      }, 300);
    } else {
      targetRestorePageRef.current = null;
      setTimeout(() => setIsRestoringPosition(false), 300);
    }
  }, [pdfLoaded]);

  // Keep position ref updated for unmount save
  useEffect(() => {
    positionRef.current = {page: currentPage, mode: readerMode, bookId};
  }, [currentPage, readerMode, bookId]);

  // Save reading position when page changes (debounced)
  useEffect(() => {
    const waitingForRestore = targetRestorePageRef.current !== null;
    if (currentPage > 0 && bookId && !isInitialLoad.current && !waitingForRestore) {
      const savePosition = async () => {
        const pos = {
          page: currentPage.toString(),
          mode: readerMode,
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
  }, [currentPage, readerMode, bookId]);

  // Block navigation until position is saved (ensures save completes before we leave)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isInitialLoad.current) return;
      const {page, mode, bookId: id} = positionRef.current;
      if (page > 0 && id) {
        e.preventDefault();
        const pos = {page: page.toString(), mode, timestamp: new Date().toISOString()};
        // Save to AsyncStorage immediately (so next load gets it even if Supabase is slow)
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
        const {page, mode, bookId: id} = positionRef.current;
        if (page > 0 && id && book?.id === id) {
          const pos = {page: page.toString(), mode, timestamp: new Date().toISOString()};
          AsyncStorage.setItem(`pdf_position_${id}`, JSON.stringify({page, mode, timestamp: pos.timestamp})).catch(() => {});
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
        case 'webviewReady':
          setIsReady(true);
          break;
        case 'ready':
          setTotalPages(data.totalPages);
          // Restore highlights once PDF is loaded (ref prevents duplicates)
          setTimeout(() => restoreHighlights(), 500);
          break;
        case 'locationChanged':
          const page = data.page;
          if (targetRestorePageRef.current !== null && page === targetRestorePageRef.current) {
            targetRestorePageRef.current = null;
            // Delay so WebView fully paints before overlay hides (prevents last flash)
            setTimeout(() => setIsRestoringPosition(false), 250);
          }
          setCurrentPage(page);
          setTotalPages(data.totalPages);
          setProgress(data.progress || 0);
          break;
        case 'toggleButtons':
          setShowButtons(prev => !prev);
          break;
        case 'textSelected':
          setSelectedText(data.text);
          setSelectedPage(data.page || currentPage);
          setShowActionSheet(true);
          break;
        case 'highlightClicked':
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
        case 'textExtracted':
          // Cache the extracted text for future visits
          if (data.text && bookId) {
            pdfTextCache.set(bookId, data.text);
            console.log('📝 Text cached:', data.text.length, 'chars');
            // Save to DB in background (don't setBook - avoids re-render cascade)
            bookService.updateBook(bookId, {extracted_text: data.text}).catch(() => {});
            // Restore highlights after text mode renders
            setTimeout(() => restoreHighlights(), 300);
          }
          break;
        case 'tocExtracted':
          // Save extracted TOC to database
          if (data.items && data.items.length > 0 && bookId) {
            console.log('📑 TOC extracted:', data.items.length, 'items');
            // Check if TOC already exists
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
                  await tocService.createTOCItems(tocItems);
                  console.log('✅ TOC saved to database');
                } catch (error) {
                  console.error('❌ Failed to save TOC:', error);
                }
              } else {
                console.log('📑 TOC already exists in database, skipping');
              }
            });
          }
          break;
      }
    } catch (error) {
      console.error('❌ Error parsing WebView message:', error);
    }
  };

  // Navigation functions
  const handlePrev = () => {
    webViewRef.current?.injectJavaScript('if (window.prevPage) { window.prevPage(); } true;');
  };

  const handleNext = () => {
    webViewRef.current?.injectJavaScript('if (window.nextPage) { window.nextPage(); } true;');
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

  // Pan responder for gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only capture if it's a clear vertical swipe or tap
        return Math.abs(gestureState.dy) > 10 || 
               (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10);
      },
      onPanResponderRelease: (evt, gestureState) => {
        console.log('👆 Gesture:', {dx: gestureState.dx, dy: gestureState.dy});
        
        // Check if it's a tap (minimal movement)
        if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
          // It's a tap - toggle buttons visibility
          console.log('👆 Tap detected');
          setShowButtons(prev => !prev);
          return;
        }

        // It's a swipe
        // Swipe up = next page
        if (gestureState.dy < -50) {
          console.log('⬆️ Swipe up detected');
          handleNext();
        }
        // Swipe down = previous page
        else if (gestureState.dy > 50) {
          console.log('⬇️ Swipe down detected');
          handlePrev();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{html: getPdfReaderHtml(), baseUrl: 'https://localhost'}}
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

      {/* Loading overlay - hide flashing while restoring position */}
      {isRestoringPosition && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Opening book...</Text>
        </View>
      )}

      {/* Tap zone for gestures (behind WebView) - Only active in PDF mode */}
      {readerMode === 'pdf' && (
        <View style={styles.tapZone} {...panResponder.panHandlers} />
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

          <View style={styles.menuPopup}>
            <View style={styles.menuHandle} />

            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{book?.title || 'Loading...'}</Text>
              <Text style={styles.menuProgress}>
                Page {currentPage} of {totalPages} • {Math.round(progress * 100)}
                % complete
              </Text>
              <TouchableOpacity
                style={styles.menuCloseButton}
                onPress={() => setShowMenu(false)}>
                <Text style={styles.menuCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuActions}>
              <TouchableOpacity 
                style={styles.menuAction}
                onPress={toggleReaderMode}>
                <Text style={styles.menuActionText}>
                  {readerMode === 'pdf' ? '📖 Reader Mode' : '📄 Original PDF'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuAction}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('TableOfContents' as never, {bookId, bookTitle: book?.title} as never);
                }}>
                <Text style={styles.menuActionText}>📑 Table of Contents</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuAction}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('Highlights' as never, {bookId, bookTitle: book?.title} as never);
                }}>
                <Text style={styles.menuActionText}>✨ Highlights</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuAction}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('Bookmarks' as never, {bookId, bookTitle: book?.title} as never);
                }}>
                <Text style={styles.menuActionText}>🔖 View All Bookmarks</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuAction}
                onPress={async () => {
                  setShowMenu(false);
                  await handleToggleBookmark();
                }}>
                <Text style={styles.menuActionText}>
                  {isBookmarked ? '🔖 Remove Bookmark' : '📑 Bookmark This Page'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuAction}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('Settings');
                }}>
                <Text style={styles.menuActionText}>⚙️ Settings</Text>
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
        isClickedHighlight={false} // Always show main menu first
        clickedColor={clickedHighlightColor || undefined}
        onClose={() => {
          setShowActionSheet(false);
          setSelectedText('');
          setClickedHighlightColor(null);
          setClickedHighlightId(null);
          setClickedHighlightDbId(null); // Clear database ID too
        }}
        onHighlightAdded={(color, dbId) => {
          console.log('✅ Highlight color:', color, 'DB ID:', dbId);
          console.log('🎨 Highlight ID:', clickedHighlightId);
          console.log('🎨 Old color:', clickedHighlightColor);
          console.log('📝 Selected text:', selectedText);
          
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
            console.log('✨ Creating new highlight with text:', selectedText, 'DB ID:', dbId);
            const escapedText = selectedText.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
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
    backgroundColor: '#000',
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
    backgroundColor: '#fafafa',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    elevation: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  tapZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
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
