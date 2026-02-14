import React, {useRef, useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  StatusBar,
  Modal,
  PanResponder,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types';
import {bookService} from '../services/bookService';
import {TextActionSheet} from '../components/TextActionSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'BookReader'>;

export const EPUBReaderScreen: React.FC<Props> = ({route, navigation}) => {
  const {bookId} = route.params;
  const webViewRef = useRef<WebView>(null);
  const [book, setBook] = useState<any>(null);
  const [bookPath, setBookPath] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState<string>('Loading...');
  const [savedCfi, setSavedCfi] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const [selectedCfi, setSelectedCfi] = useState<string | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const insets = useSafeAreaInsets();

  // Load book info
  useEffect(() => {
    const loadBook = async () => {
      try {
        console.log('📚 Loading book with ID:', bookId);
        const books = await bookService.getBooks();
        const foundBook = books.find(b => b.id === bookId);
        if (foundBook) {
          console.log('✅ Book found:', foundBook.title);
          console.log('📂 File path:', foundBook.file_path);
          console.log('📍 Current position from DB:', JSON.stringify(foundBook.current_position));
          const cfi = foundBook.current_position?.cfi || null;
          console.log('📍 Extracted CFI:', cfi);
          setBook(foundBook);
          setBookPath(foundBook.file_path);
          setBookTitle(foundBook.title);
          setSavedCfi(cfi);
        } else {
          console.error('❌ Book not found with ID:', bookId);
          Alert.alert('Error', 'Book not found');
          navigation.goBack();
        }
      } catch (error) {
        console.error('❌ Error loading book:', error);
        Alert.alert('Error', 'Failed to load book');
        navigation.goBack();
      }
    };
    loadBook();
  }, [bookId, navigation]);

  // Initialize book when ready
  useEffect(() => {
    if (isReady && bookPath) {
      console.log('📖 Initializing EPUB reader...');
      console.log('📂 Book path:', bookPath);
      console.log('📍 Saved CFI to inject:', savedCfi || 'none');
      console.log('📍 Saved CFI type:', typeof savedCfi);
      
      const cfiValue = savedCfi ? `'${savedCfi}'` : 'null';
      console.log('📍 CFI value being injected:', cfiValue);
      
      const initScript = `
        console.log('🔧 Setting window.currentCfi to:', ${cfiValue});
        window.currentCfi = ${cfiValue};
        console.log('🔍 window.currentCfi is now:', window.currentCfi);
        console.log('🔍 Type of window.currentCfi:', typeof window.currentCfi);
        
        if (window.initReader) {
          console.log('📖 Calling initReader with path: file://${bookPath}');
          window.initReader('file://${bookPath}');
        } else {
          console.error('❌ window.initReader not found!');
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(initScript);
    } else {
      console.log('⏳ Waiting... isReady:', isReady, 'bookPath:', bookPath ? 'set' : 'null');
    }
  }, [isReady, bookPath, savedCfi]);

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('WebView message:', data.type);
      
      if (data.type === 'ready') {
        setIsReady(true);
      }
      
      if (data.type === 'locationChanged') {
        console.log('📍 Location changed - Progress:', data.progress, 'CFI:', data.cfi);
        setProgress(data.progress || 0);
        // Save position
        const position = {cfi: data.cfi, timestamp: new Date().toISOString()};
        console.log('💾 Saving position:', JSON.stringify(position));
        bookService.updateBook(bookId, {
          current_position: position,
        }).then(() => {
          console.log('✅ Position saved successfully');
        }).catch((error) => {
          console.error('❌ Error saving position:', error);
        });
      }
      
      if (data.type === 'textSelected') {
        setSelectedText(data.text);
        setSelectedCfi(data.cfi);
        setShowActionSheet(true);
      }
      
      if (data.type === 'error') {
        console.error('EPUB Error:', data.message);
        Alert.alert('Error', data.message);
      }
    } catch (e) {
      console.error('Message error:', e);
    }
  };

  const sendCommand = (command: string, data?: any) => {
    if (webViewRef.current) {
      const script = `
        if (window.handleCommand) {
          window.handleCommand(${JSON.stringify({command, ...data})});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    }
  };

  const goNext = () => {
    sendCommand('next');
  };

  const goPrev = () => {
    sendCommand('prev');
  };

  const addHighlight = (color: string) => {
    if (selectedCfi) {
      sendCommand('addHighlight', {cfi: selectedCfi, color});
      setSelectedText('');
      setSelectedCfi(null);
    }
  };

  // Pan responder for gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderRelease: (evt, gestureState) => {
        // Tap to toggle buttons
        if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
          setShowButtons(prev => !prev);
        }
        // Swipe up for next
        else if (gestureState.dy < -50) {
          goNext();
        }
        // Swipe down for prev
        else if (gestureState.dy > 50) {
          goPrev();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      <View style={styles.webviewContainer} {...panResponder.panHandlers}>
        <WebView
          ref={webViewRef}
          source={{uri: 'file:///android_asset/epub-reader.html'}}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
          originWhitelist={['*']}
          style={styles.webview}
          overScrollMode="never"
          bounces={false}
        />
      </View>
      
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
          onPress={() => {
            setShowMenu(true);
            setShowButtons(false);
          }}>
          <Text style={styles.menuButtonText}>≡</Text>
        </TouchableOpacity>
      )}

      {/* Text Action Sheet */}
      <TextActionSheet
        isVisible={showActionSheet}
        selectedText={selectedText}
        context="" // TODO: Add context extraction from EPUB
        bookId={bookId}
        bookTitle={bookTitle}
        position={{cfi: selectedCfi}}
        onClose={() => {
          setShowActionSheet(false);
          setSelectedText('');
          setSelectedCfi(null);
        }}
        onHighlightAdded={(color) => {
          addHighlight(color);
        }}
      />

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
              <Text style={styles.menuTitle}>{bookTitle}</Text>
              <Text style={styles.menuProgress}>
                {Math.round(progress * 100)}% complete
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
                onPress={() => setShowMenu(false)}>
                <Text style={styles.menuActionText}>📑 Table of Contents</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuAction}
                onPress={() => setShowMenu(false)}>
                <Text style={styles.menuActionText}>🔖 Bookmarks</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuAction}
                onPress={() => setShowMenu(false)}>
                <Text style={styles.menuActionText}>✨ Highlights</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuAction}
                onPress={() => setShowMenu(false)}>
                <Text style={styles.menuActionText}>⚙️ Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
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
  highlightToolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    zIndex: 1000,
  },
  highlightButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  highlightButtonText: {
    fontSize: 20,
    color: '#fff',
  },
  highlightCancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
    backgroundColor: '#666',
  },
  highlightCancelText: {
    color: '#fff',
    fontSize: 20,
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

export default EPUBReaderScreen;
