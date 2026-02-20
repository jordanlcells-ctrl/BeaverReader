import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {dictionaryService, EnhancedDefinition} from '../services/dictionaryService';
import {translationService} from '../services/translationService';
import {mistralService} from '../services/mistralService';
import {highlightService} from '../services/highlightService';
import {deckService, Deck} from '../services/deckService';
import {cardService} from '../services/cardService';

interface TextActionSheetProps {
  isVisible: boolean;
  selectedText: string;
  context: string;
  bookId: string;
  bookTitle?: string;
  position: Record<string, any>;
  onClose: () => void;
  onHighlightAdded?: (color: string, dbId?: string) => void;
  onHighlightDeleted?: () => void;
  isClickedHighlight?: boolean;
  clickedColor?: string;
}

type ActionType = 'define' | 'translate' | 'grammar' | 'highlight' | 'highlightComplete' | 'addToDeck' | null;

function isLimitError(message: string): boolean {
  return /limit reached|limit for this month|daily limit/i.test(message);
}

export const TextActionSheet = ({
  isVisible,
  selectedText,
  context,
  bookId,
  bookTitle = 'Unknown Book',
  position,
  onClose,
  onHighlightAdded,
  onHighlightDeleted,
  isClickedHighlight = false,
  clickedColor,
}: TextActionSheetProps) => {
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [originalAction, setOriginalAction] = useState<ActionType>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [enhancedDefinition, setEnhancedDefinition] = useState<EnhancedDefinition | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [parentDeck, setParentDeck] = useState<Deck | null>(null);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [showCreateSubdeck, setShowCreateSubdeck] = useState(false);
  const [subdeckName, setSubdeckName] = useState('');
  const [askQuestionInput, setAskQuestionInput] = useState('');

  const handleClose = () => {
    setCurrentAction(null);
    setOriginalAction(null);
    setResult('');
    setEnhancedDefinition(null);
    setAskQuestionInput('');
    setLoading(false);
    onClose();
  };

  const handleDefine = async () => {
    setCurrentAction('define');
    setOriginalAction('define');
    setResult('');
    setEnhancedDefinition(null);
    setLoading(true);

    try {
      const definition = await mistralService.getDefinition(selectedText);
      if (definition) {
        setEnhancedDefinition(definition);
        setResult(dictionaryService.formatDefinitionEnhanced(definition));
      } else {
        setResult(
          `Word not found\n\n"${selectedText}" was not found. Try rephrasing or check your connection.`,
        );
      }
    } catch (error: any) {
      const msg = error?.message ?? 'Definition failed. Please try again.';
      setResult(isLimitError(msg) ? `Limit reached\n\n${msg}` : `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    setCurrentAction('translate');
    setOriginalAction('translate');
    setResult('');
    setLoading(true);

    try {
      const textToTranslate = selectedText.length > 500
        ? selectedText.substring(0, 500) + '...'
        : selectedText;
      const spanishIndicators = [
        'el', 'la', 'los', 'las', 'de', 'que', 'es', 'un', 'una', 'por', 'para', 'con', 'del',
      ];
      const wordsLower = textToTranslate.toLowerCase().split(/\s+/);
      const spanishWordCount = wordsLower.filter((w) =>
        spanishIndicators.includes(w),
      ).length;
      const isLikelySpanish = spanishWordCount >= 2;
      const sourceLang = isLikelySpanish ? 'es' : 'en';
      const targetLang = isLikelySpanish ? 'en' : 'es';

      const translation = await mistralService.translate(
        textToTranslate,
        sourceLang,
        targetLang,
      );
      if (translation) {
        setResult(translationService.formatTranslation(translation));
      } else {
        setResult('Translation failed.');
      }
    } catch (error: any) {
      const msg = error?.message ?? 'Translation failed.';
      setResult(isLimitError(msg) ? `Limit reached\n\n${msg}` : `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAskAIOpen = () => {
    setCurrentAction('grammar');
    setOriginalAction('grammar');
    setResult('');
    setAskQuestionInput('');
  };

  const handleAskAISubmit = async () => {
    const question = askQuestionInput.trim() || 'Explain the grammar or language of this text.';
    setLoading(true);
    try {
      const response = await mistralService.askGrammar(selectedText, question);
      if (response) {
        setResult(`**Question:** ${response.question}\n\n**Answer:**\n${response.answer}`);
      } else {
        setResult('No response. Please try again.');
      }
    } catch (error: any) {
      const msg = error?.message ?? 'Ask AI failed. Please try again.';
      setResult(isLimitError(msg) ? `Limit reached\n\n${msg}` : `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleHighlight = async (color: string) => {
    setLoading(true);
    try {
      if (clickedColor) {
        onHighlightAdded?.(color);
        setLoading(false);
      } else {
        const hl = await highlightService.createHighlight(
          bookId, selectedText, context, position, color, result || undefined,
        );
        onHighlightAdded?.(color, hl.id);
        setLoading(false);
        setCurrentAction('highlightComplete');
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to save highlight: ${error.message}`);
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Highlight', 'Are you sure?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: () => { onHighlightDeleted?.(); handleClose(); }},
    ]);
  };

  const handleCopy = () => {
    Clipboard.setString(selectedText);
    Alert.alert('Copied!', 'Text copied to clipboard');
  };

  const handleAddToDeck = async () => {
    setCurrentAction('addToDeck');
    setLoadingDecks(true);
    try {
      const bookDeck = await deckService.getOrCreateBookDeck(bookId, bookTitle);
      setParentDeck(bookDeck);
      const subdecks = await deckService.getSubdecks(bookDeck.id);
      setDecks(subdecks);
    } catch (error: any) {
      Alert.alert('Error', `Failed to load decks: ${error.message}`);
    } finally {
      setLoadingDecks(false);
    }
  };

  const handleSelectDeck = async (deck: Deck) => {
    try {
      setLoadingDecks(true);
      let front = selectedText;
      let back = '';
      let cardType: 'definition' | 'translation' | 'grammar' | 'custom' = 'custom';

      if (originalAction === 'define' && enhancedDefinition) {
        cardType = 'definition';
        front = enhancedDefinition.word;
        if (enhancedDefinition.spanishWord) back = `🇨🇴 In Spanish: ${enhancedDefinition.spanishWord}\n\n`;
        if (enhancedDefinition.language === 'en') {
          if (enhancedDefinition.spanishTranslation) back += `🇨🇴 ${enhancedDefinition.spanishTranslation}\n\n`;
        }
        back += `📖 ${enhancedDefinition.definition}`;
        if (enhancedDefinition.conjugation) back += `\n\n📝 ${enhancedDefinition.conjugation}`;
        const syns = enhancedDefinition.synonyms?.slice(0, 3) ?? [];
        if (syns.length) back += `\n\n🔄 ${syns.join(', ')}`;
      } else if (result.includes('Translation:')) {
        cardType = 'translation';
        const line = result.split('\n').find(l => l.startsWith('Translation:'));
        if (line) back = line.replace('Translation:', '').trim();
      } else if (originalAction === 'grammar') {
        cardType = 'grammar';
        back = result;
      } else {
        back = result || selectedText;
      }

      if (!back?.trim()) {
        Alert.alert('Error', 'Card back is empty.');
        return;
      }

      await cardService.createCard({deck_id: deck.id, front, back, context, card_type: cardType});
      Alert.alert('Card Saved!', `Added to "${deck.name}"`, [{text: 'OK', onPress: handleClose}]);
    } catch (error: any) {
      Alert.alert('Error', `Failed to save card: ${error.message}`);
    } finally {
      setLoadingDecks(false);
    }
  };

  const handleCreateSubdeck = async () => {
    if (!subdeckName.trim() || !parentDeck) return;
    try {
      setLoadingDecks(true);
      await deckService.createDeck({name: subdeckName.trim(), parent_deck_id: parentDeck.id});
      const subdecks = await deckService.getSubdecks(parentDeck.id);
      setDecks(subdecks);
      setShowCreateSubdeck(false);
      setSubdeckName('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoadingDecks(false);
    }
  };

  const highlightColors = ['#C9B458', '#7BA668', '#8AABBF', '#C48B6C'];

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Selected text */}
            <View style={styles.textContainer}>
              <Text style={styles.selectedText}>{selectedText}</Text>
            </View>

            {/* Action buttons */}
            {!currentAction && (
              <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionButton} onPress={handleDefine} activeOpacity={0.7}>
                  <Text style={styles.actionIcon}>🪶</Text>
                  <Text style={styles.actionText}>Define</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleTranslate} activeOpacity={0.7}>
                  <Text style={styles.actionIcon}>🐸</Text>
                  <Text style={styles.actionText}>Translate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleAskAIOpen} activeOpacity={0.7}>
                  <Text style={styles.actionIcon}>🦫</Text>
                  <Text style={styles.actionText}>Ask AI</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}
                  onPress={() => { clickedColor ? setCurrentAction('highlightComplete') : setCurrentAction('highlight'); }}>
                  <Text style={styles.actionIcon}>🪷</Text>
                  <Text style={styles.actionText}>Highlight</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleCopy} activeOpacity={0.7}>
                  <Text style={styles.actionIcon}>🍃</Text>
                  <Text style={styles.actionText}>Copy</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Ask AI: small window – grammar/language question input */}
            {currentAction === 'grammar' && result.length === 0 && !loading && (
              <View style={styles.askAIContainer}>
                <Text style={styles.askAITitle}>Grammar & language only</Text>
                <Text style={styles.askAIHint}>One short question about the text above.</Text>
                <TextInput
                  style={styles.askAIInput}
                  placeholder="e.g. Why subjunctive here?"
                  placeholderTextColor="#8A8171"
                  value={askQuestionInput}
                  onChangeText={setAskQuestionInput}
                  multiline
                  maxLength={300}
                />
                <TouchableOpacity style={styles.askAISubmitButton} onPress={handleAskAISubmit} activeOpacity={0.7}>
                  <Text style={styles.askAISubmitText}>Ask AI</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backButton} onPress={() => { setCurrentAction(null); setAskQuestionInput(''); }}>
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Loading */}
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6B8E73" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}

            {/* Result display */}
            {!loading && result.length > 0 && currentAction !== 'addToDeck' && currentAction !== 'highlight' && currentAction !== 'highlightComplete' && (
              <View style={styles.resultContainer}>
                {result.startsWith('Limit reached') ? (
                  <View style={styles.limitReachedBox}>
                    <Text style={styles.limitReachedTitle}>Limit reached</Text>
                    <Text style={styles.limitReachedText}>{result.replace(/^Limit reached\n\n/, '')}</Text>
                  </View>
                ) : (
                  <Text style={styles.resultText}>{result}</Text>
                )}
                {!result.startsWith('Limit reached') && (
                  <>
                    <TouchableOpacity style={styles.saveCardButton} onPress={handleAddToDeck} activeOpacity={0.7}>
                      <Text style={styles.saveCardIcon}>🦫</Text>
                      <Text style={styles.saveCardText}>Save Card to Deck</Text>
                    </TouchableOpacity>
                    <Text style={styles.highlightPrompt}>Save as highlight:</Text>
                    <View style={styles.highlightColors}>
                      {highlightColors.map(c => (
                        <TouchableOpacity key={c} style={[styles.colorButton, {backgroundColor: c}]} onPress={() => handleHighlight(c)}>
                          <Text style={styles.colorButtonText}>●</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <TouchableOpacity style={styles.backButton} onPress={() => { setCurrentAction(null); setResult(''); }}>
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Highlight color picker */}
            {currentAction === 'highlight' && !loading && !result && (
              <View style={styles.highlightContainer}>
                <Text style={styles.highlightTitle}>Choose highlight color:</Text>
                <View style={styles.highlightColors}>
                  {highlightColors.map(c => (
                    <TouchableOpacity key={c} style={[styles.colorButton, {backgroundColor: c}]} onPress={() => handleHighlight(c)}>
                      <Text style={styles.colorButtonText}>●</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={styles.backButton} onPress={() => setCurrentAction(null)}>
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* After highlighting */}
            {currentAction === 'highlightComplete' && !loading && (
              <View style={styles.highlightOptionsContainer}>
                <Text style={styles.successText}>
                  {isClickedHighlight ? '🎨 Highlight Options' : '✅ Highlight saved!'}
                </Text>
                <TouchableOpacity style={styles.optionButton} onPress={() => setCurrentAction('highlight')}>
                  <Text style={styles.optionIcon}>🎨</Text>
                  <Text style={styles.optionText}>Change Color</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optionButton} onPress={handleAddToDeck}>
                  <Text style={styles.optionIcon}>💾</Text>
                  <Text style={styles.optionText}>Save Card</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.optionButton, styles.deleteOptionButton]} onPress={handleDelete}>
                  <Text style={styles.optionIcon}>🗑️</Text>
                  <Text style={[styles.optionText, styles.deleteOptionText]}>Delete Highlight</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backButton} onPress={() => setCurrentAction(null)}>
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Deck Selector */}
            {currentAction === 'addToDeck' && (
              <View style={styles.deckSelectorContainer}>
                <Text style={styles.deckSelectorTitle}>Save Card to:</Text>
                <Text style={styles.deckSelectorSubtitle}>📚 {bookTitle}</Text>
                {loadingDecks ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6B8E73" />
                  </View>
                ) : showCreateSubdeck ? (
                  <View style={styles.createSubdeckContainer}>
                    <Text style={styles.createSubdeckTitle}>Create Subdeck</Text>
                    <TextInput
                      style={styles.subdeckInput}
                      placeholder="Enter subdeck name"
                      value={subdeckName}
                      onChangeText={setSubdeckName}
                      autoFocus
                    />
                    <View style={styles.createSubdeckButtons}>
                      <TouchableOpacity style={[styles.createSubdeckButton, styles.cancelBtn]}
                        onPress={() => { setShowCreateSubdeck(false); setSubdeckName(''); }}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.createSubdeckButton, styles.saveBtn]} onPress={handleCreateSubdeck}>
                        <Text style={styles.saveBtnText}>Create</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : decks.length === 0 ? (
                  <View style={styles.emptyDecksContainer}>
                    <Text style={styles.emptyDecksText}>No subdecks yet!</Text>
                    <Text style={styles.emptyDecksHint}>Create a subdeck to save cards to.</Text>
                    <TouchableOpacity style={styles.createFirstSubdeckButton} onPress={() => setShowCreateSubdeck(true)}>
                      <Text style={styles.createFirstSubdeckButtonText}>+ Create Subdeck</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.selectSubdeckPrompt}>Select a subdeck:</Text>
                    <View style={styles.deckList}>
                      {decks.map(d => (
                        <TouchableOpacity key={d.id} style={styles.deckItem} onPress={() => handleSelectDeck(d)}>
                          <Text style={styles.deckItemName}>📁 {d.name}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={[styles.deckItem, styles.createNewDeckItem]} onPress={() => setShowCreateSubdeck(true)}>
                        <Text style={styles.createNewDeckText}>+ Create New Subdeck</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                <TouchableOpacity style={styles.backButton}
                  onPress={() => { setCurrentAction(result ? 'highlightComplete' : null); setDecks([]); setShowCreateSubdeck(false); }}>
                  <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Close */}
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(45,60,48,0.4)'},
  sheetContainer: {backgroundColor: '#FDFCF8', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 40},
  handle: {width: 36, height: 4, backgroundColor: '#D9CFC0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16},
  scrollView: {paddingHorizontal: 20},
  textContainer: {backgroundColor: '#F0EBE3', padding: 16, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: '#E8E0D6'},
  selectedText: {fontSize: 16, lineHeight: 24, color: '#3D5A46'},
  actionsContainer: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20},
  actionButton: {flex: 1, minWidth: '30%', backgroundColor: '#6B8E73', padding: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#3D5A46', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2},
  actionIcon: {fontSize: 28, marginBottom: 6},
  actionText: {color: '#FFFFFF', fontSize: 13, fontWeight: '600', letterSpacing: -0.2},
  loadingContainer: {alignItems: 'center', paddingVertical: 40},
  loadingText: {marginTop: 12, fontSize: 16, color: '#6B7C6E'},
  resultContainer: {marginBottom: 20},
  resultText: {fontSize: 15, lineHeight: 22, color: '#3D5A46', marginBottom: 16},
  saveCardButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6B8E73', padding: 14, borderRadius: 14, marginBottom: 20, shadowColor: '#3D5A46', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2},
  saveCardIcon: {fontSize: 20, marginRight: 10},
  saveCardText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
  highlightPrompt: {fontSize: 14, color: '#6B7C6E', marginBottom: 12, fontWeight: '600'},
  highlightContainer: {marginBottom: 20},
  highlightTitle: {fontSize: 16, fontWeight: '600', color: '#3D5A46', marginBottom: 16},
  highlightColors: {flexDirection: 'row', gap: 12, marginBottom: 20},
  colorButton: {width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#8B7355', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3},
  colorButtonText: {fontSize: 28, color: '#fff'},
  backButton: {padding: 12, alignItems: 'center'},
  backButtonText: {fontSize: 16, color: '#6B8E73', fontWeight: '600'},
  closeButton: {backgroundColor: '#F0EBE3', padding: 14, borderRadius: 14, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E8E0D6'},
  closeButtonText: {fontSize: 16, color: '#3D5A46', fontWeight: '600'},
  highlightOptionsContainer: {marginBottom: 20},
  successText: {fontSize: 18, fontWeight: '600', color: '#6B8E73', marginBottom: 20, textAlign: 'center'},
  optionButton: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0EBE3', padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E8E0D6'},
  deleteOptionButton: {backgroundColor: '#F5E6E3', borderColor: '#E8D0CC'},
  optionIcon: {fontSize: 22, marginRight: 12},
  optionText: {fontSize: 16, color: '#3D5A46', fontWeight: '500'},
  deleteOptionText: {color: '#C05050'},
  deckSelectorContainer: {marginBottom: 20},
  deckSelectorTitle: {fontSize: 18, fontWeight: '600', color: '#3D5A46', marginBottom: 8},
  deckSelectorSubtitle: {fontSize: 14, color: '#8A8171', marginBottom: 16},
  selectSubdeckPrompt: {fontSize: 15, fontWeight: '600', color: '#3D5A46', marginBottom: 12},
  deckList: {marginBottom: 16},
  deckItem: {backgroundColor: '#F0EBE3', padding: 16, borderRadius: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#6B8E73', borderWidth: 1, borderColor: '#E8E0D6'},
  createNewDeckItem: {borderLeftColor: '#8AAD7A', backgroundColor: '#F0F5EC'},
  createNewDeckText: {fontSize: 16, fontWeight: '600', color: '#6B8E73', textAlign: 'center'},
  deckItemName: {fontSize: 16, fontWeight: '600', color: '#3D5A46'},
  emptyDecksContainer: {padding: 32, alignItems: 'center'},
  emptyDecksText: {fontSize: 15, color: '#6B7C6E', fontWeight: '600', marginBottom: 8},
  emptyDecksHint: {fontSize: 13, color: '#A3B5A7', textAlign: 'center', marginBottom: 20},
  createFirstSubdeckButton: {backgroundColor: '#6B8E73', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12},
  createFirstSubdeckButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
  createSubdeckContainer: {marginBottom: 20},
  createSubdeckTitle: {fontSize: 16, fontWeight: '600', color: '#3D5A46', marginBottom: 12},
  subdeckInput: {backgroundColor: '#FAF8F3', padding: 16, borderRadius: 12, fontSize: 16, color: '#3D5A46', marginBottom: 16, borderWidth: 1.5, borderColor: '#6B8E73'},
  createSubdeckButtons: {flexDirection: 'row', gap: 12},
  createSubdeckButton: {flex: 1, padding: 14, borderRadius: 12, alignItems: 'center'},
  cancelBtn: {backgroundColor: '#F0EBE3', borderWidth: 1, borderColor: '#E8E0D6'},
  cancelBtnText: {fontSize: 16, fontWeight: '600', color: '#8A8171'},
  saveBtn: {backgroundColor: '#6B8E73'},
  saveBtnText: {fontSize: 16, fontWeight: '600', color: '#FFFFFF'},
  askAIContainer: {marginBottom: 20},
  askAITitle: {fontSize: 17, fontWeight: '600', color: '#3D5A46', marginBottom: 8},
  askAIHint: {fontSize: 14, color: '#6B7C6E', marginBottom: 12},
  askAIInput: {backgroundColor: '#FAF8F3', padding: 14, borderRadius: 12, fontSize: 16, color: '#3D5A46', minHeight: 80, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1.5, borderColor: '#6B8E73'},
  askAISubmitButton: {backgroundColor: '#6B8E73', padding: 14, borderRadius: 14, alignItems: 'center', marginBottom: 12, shadowColor: '#3D5A46', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2},
  askAISubmitText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
  limitReachedBox: {backgroundColor: '#F5E6E3', padding: 16, borderRadius: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#C05050'},
  limitReachedTitle: {fontSize: 16, fontWeight: '700', color: '#C05050', marginBottom: 8},
  limitReachedText: {fontSize: 15, lineHeight: 22, color: '#3D5A46'},
});
