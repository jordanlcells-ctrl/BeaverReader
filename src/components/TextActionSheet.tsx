import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Keyboard,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {useTheme} from '../contexts/ThemeContext';
import {
  dictionaryService,
  formatDefinitionHeadwordDisplay,
  getTargetDefinitionDisplayBody,
  type EnhancedDefinition,
} from '../services/dictionaryService';
import {translationService} from '../services/translationService';
import {mistralService} from '../services/mistralService';
import {highlightService} from '../services/highlightService';
import {deckService, Deck} from '../services/deckService';
import {cardService} from '../services/cardService';
import {readingPreferencesService, getLangMeta, type LanguageCode} from '../services/readingPreferencesService';

/** Colores fijos del mockup (definición) — legibles en tema claro */
const MOCK_CACHED = '#4A6FA8';
const MOCK_DEF_BODY = '#3D4A55';

interface TextActionSheetProps {
  isVisible: boolean;
  selectedText: string;
  context: string;
  bookId: string;
  bookTitle?: string;
  position: Record<string, any>;
  onClose: () => void;
  /** highlightText: texto exacto a pintar (evita cierres obsoletos tras await al guardar en mazo) */
  onHighlightAdded?: (color: string, dbId?: string, highlightText?: string) => void;
  onHighlightDeleted?: () => void;
  isClickedHighlight?: boolean;
  clickedColor?: string;
  /** Si ya hay highlight en BD (tap en resaltado o color elegido antes), no duplicar al guardar carta */
  existingHighlightDbId?: string | null;
}

type ActionType = 'define' | 'translate' | 'grammar' | 'highlight' | 'highlightComplete' | 'addToDeck' | null;

type ThemedDialogState =
  | {
      kind: 'alert';
      title: string;
      message: string;
      variant: 'success' | 'error' | 'info';
      onDismiss?: () => void;
    }
  | {
      kind: 'confirm';
      title: string;
      message: string;
      onConfirm: () => void;
      onCancel: () => void;
    };

function isLimitError(message: string): boolean {
  return /limit reached|limit for this month|daily limit/i.test(message);
}

type LangMeta = {flag: string; name: string};

type SheetStyles = ReturnType<typeof getStyles>;

/**
 * Orden fijo según Ajustes (nativo → objetivo):
 * 1) Definición idioma nativo  2) Conjugaciones  3) Definición idioma objetivo  4) Sinónimos (idioma objetivo)
 */
function DefineLookupBlock({
  def,
  nativeMeta,
  targetMeta,
  isDark,
  s,
}: {
  def: EnhancedDefinition;
  nativeMeta: LangMeta;
  targetMeta: LangMeta;
  isDark: boolean;
  s: SheetStyles;
}) {
  const cleanDef = dictionaryService.stripEmptyNumberedLines(
    def.definition.replace(/^\s*\*?\*?Definition:?\*?\*?\s*/i, '').trim(),
  );
  const bodyColor = isDark ? '#d1d5db' : MOCK_DEF_BODY;
  const cachedColor = isDark ? '#93c5fd' : MOCK_CACHED;
  const labelColor = isDark ? '#f3f4f6' : '#2c3e50';

  const targetLine = getTargetDefinitionDisplayBody(def);

  const nativeConj = def.nativeConjugation
    ? dictionaryService.stripEmptyNumberedLines(def.nativeConjugation.replace(/^NATIVE_CONJUGATION:\s*/i, ''))
    : '';
  const conj = def.conjugation
    ? dictionaryService.stripEmptyNumberedLines(def.conjugation.replace(/^CONJUGATION:\s*/i, ''))
    : '';

  const synText =
    def.synonyms && def.synonyms.length > 0 ? def.synonyms.slice(0, 3).join(', ') : '';

  const dash = '—';
  const displayHeadword = formatDefinitionHeadwordDisplay(
    def.nativeHeadword?.trim() || def.word,
  );

  return (
    <View style={s.defineLookupRoot}>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 16}}>
        <Text style={{fontSize: 16, fontWeight: '800', color: labelColor, letterSpacing: 0.3}}>
          📖 {displayHeadword}{' '}
        </Text>
        {def.cached ? (
          <Text style={{fontSize: 13, color: cachedColor, fontWeight: '500'}}>(cached)</Text>
        ) : null}
      </View>

      <View style={s.defineSection}>
        <Text style={s.defineStepLabel}>
          1. {nativeMeta.name} definition
        </Text>
        <Text style={[s.defineSectionBody, {color: bodyColor}]}>
          {cleanDef.trim()
            ? cleanDef
            : def.nativeHeadword?.trim() || dash}
        </Text>
      </View>

      <View style={s.defineSection}>
        <Text style={s.defineStepLabel}>2. Conjugations</Text>
        {nativeConj || conj ? (
          <View>
            {nativeConj ? (
              <Text style={[s.defineConjLine, {color: bodyColor}]}>
                {nativeMeta.flag} {nativeMeta.name}: {nativeConj}
              </Text>
            ) : null}
            {conj ? (
              <Text style={[s.defineConjLine, {color: bodyColor, marginTop: nativeConj ? 6 : 0}]}>
                {targetMeta.flag} {targetMeta.name}: {conj}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={s.defineSectionMuted}>{dash}</Text>
        )}
      </View>

      <View style={s.defineSection}>
        <Text style={s.defineStepLabel}>
          3. {targetMeta.name} definition
        </Text>
        <Text style={[s.defineSectionBody, {color: bodyColor}]}>{targetLine.trim() ? targetLine : dash}</Text>
      </View>

      <View style={s.defineSection}>
        <Text style={s.defineStepLabel}>
          4. Synonyms ({targetMeta.name})
        </Text>
        <Text style={[s.defineSectionBody, {color: bodyColor}]}>{synText.trim() ? synText : dash}</Text>
      </View>
    </View>
  );
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
  existingHighlightDbId = null,
}: TextActionSheetProps) => {
  const {colors, resolvedTheme} = useTheme();
  const isDark = resolvedTheme === 'dark';
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
  const [themedDialog, setThemedDialog] = useState<ThemedDialogState | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [nativeLang, setNativeLang] = useState<LanguageCode>('en');
  const [targetLang, setTargetLang] = useState<LanguageCode>('es');
  /** Palabra editable en la cabecera (coincide con el texto seleccionado al abrir) */
  const [editingWord, setEditingWord] = useState('');

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    Promise.all([
      readingPreferencesService.getNativeLanguage(),
      readingPreferencesService.getTargetLanguage(),
    ]).then(([native, target]) => {
      setNativeLang(native);
      setTargetLang(target);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isVisible) {
      setEditingWord(selectedText);
    }
  }, [isVisible, selectedText]);

  const effectiveWord = () => (editingWord.trim() || selectedText).trim();

  const showThemedAlert = (
    title: string,
    message: string,
    variant: 'success' | 'error' | 'info',
    onDismiss?: () => void,
  ) => setThemedDialog({kind: 'alert', title, message, variant, onDismiss});

  // When opening from a tapped highlight, show the full menu (Define, Translate, etc.) like text selection
  // User can tap "Highlight" to get Change color / Delete
  // (removed: auto-setting currentAction to 'highlightComplete' so the full menu always pops up)

  const handleClose = () => {
    setThemedDialog(null);
    setCurrentAction(null);
    setOriginalAction(null);
    setResult('');
    setEnhancedDefinition(null);
    setAskQuestionInput('');
    setEditingWord('');
    setLoading(false);
    onClose();
  };

  const handleDefine = async () => {
    const word = effectiveWord();
    if (!word) {
      showThemedAlert('No word', 'Type or select a word first.', 'info');
      return;
    }
    setCurrentAction('define');
    setOriginalAction('define');
    setResult('');
    setEnhancedDefinition(null);
    setLoading(true);

    try {
      const [nLang, tLang] = await Promise.all([
        readingPreferencesService.getNativeLanguage(),
        readingPreferencesService.getTargetLanguage(),
      ]);
      setNativeLang(nLang);
      setTargetLang(tLang);
      const definition = await mistralService.getDefinition(word, nLang, tLang);
      if (definition) {
        setEnhancedDefinition(definition);
        setResult(
          dictionaryService.formatDefinitionEnhanced(definition, getLangMeta(nLang), getLangMeta(tLang)),
        );
      } else {
        setResult(
          `Word not found\n\n"${word}" was not found. Try rephrasing or check your connection.`,
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
    const textToTranslateRaw = effectiveWord() || selectedText;
    setCurrentAction('translate');
    setOriginalAction('translate');
    setResult('');
    setLoading(true);

    try {
      const textToTranslate = textToTranslateRaw.length > 500
        ? textToTranslateRaw.substring(0, 500) + '...'
        : textToTranslateRaw;
      const [nLang, tLang] = await Promise.all([
        readingPreferencesService.getNativeLanguage(),
        readingPreferencesService.getTargetLanguage(),
      ]);
      setNativeLang(nLang);
      setTargetLang(tLang);
      const translation = await mistralService.translate(textToTranslate, tLang, nLang);
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
    const passage = effectiveWord() || selectedText;
    setLoading(true);
    try {
      const response = await mistralService.askGrammar(passage, question);
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
    const hlText = effectiveWord();
    setLoading(true);
    try {
      if (clickedColor) {
        onHighlightAdded?.(color);
        setLoading(false);
      } else {
        const hl = await highlightService.createHighlight(
          bookId, hlText, context, position, color, result || undefined,
        );
        onHighlightAdded?.(color, hl.id, hlText);
        setLoading(false);
        setCurrentAction('highlightComplete');
      }
    } catch (error: any) {
      showThemedAlert('Error', `Failed to save highlight: ${error.message}`, 'error');
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setThemedDialog({
      kind: 'confirm',
      title: 'Delete Highlight',
      message: 'Are you sure you want to remove this highlight?',
      onCancel: () => setThemedDialog(null),
      onConfirm: () => {
        setThemedDialog(null);
        onHighlightDeleted?.();
        handleClose();
      },
    });
  };

  const handleCopy = () => {
    Clipboard.setString(effectiveWord() || selectedText);
    showThemedAlert('Copied!', 'Text copied to clipboard', 'info');
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
      showThemedAlert('Error', `Failed to load decks: ${error.message}`, 'error');
    } finally {
      setLoadingDecks(false);
    }
  };

  const handleSelectDeck = async (deck: Deck) => {
    try {
      setLoadingDecks(true);
      const wordForCard = effectiveWord();
      let front = wordForCard || selectedText;
      let back = '';
      let cardType: 'definition' | 'translation' | 'grammar' | 'custom' = 'custom';

      if (originalAction === 'define' && enhancedDefinition) {
        cardType = 'definition';
        const nativeMeta = getLangMeta(nativeLang);
        const targetMeta = getLangMeta(targetLang);
        front = wordForCard || enhancedDefinition.word;
        back += `${nativeMeta.flag} ${enhancedDefinition.definition}`;
        if (enhancedDefinition.nativeConjugation) back += `\n\n📝 Past: ${enhancedDefinition.nativeConjugation}`;
        const targetBody = getTargetDefinitionDisplayBody(enhancedDefinition);
        if (targetBody) back += `\n\n${targetMeta.flag} ${targetBody}`;
        if (enhancedDefinition.conjugation) back += `\n\n📝 Conjugation: ${enhancedDefinition.conjugation}`;
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
        back = result || wordForCard || selectedText;
      }

      if (!back?.trim()) {
        showThemedAlert('Error', 'Card back is empty.', 'error');
        return;
      }

      await cardService.createCard({deck_id: deck.id, front, back, context, card_type: cardType});

      const textForHighlight = wordForCard || selectedText.trim();
      const needsAutoHighlight =
        onHighlightAdded && textForHighlight && !isClickedHighlight && !existingHighlightDbId;

      if (needsAutoHighlight) {
        const defaultColor = '#C9B458';
        try {
          const hl = await highlightService.createHighlight(
            bookId, textForHighlight, context, position, defaultColor, result || undefined,
          );
          onHighlightAdded(defaultColor, hl.id, textForHighlight);
        } catch (e: any) {
          console.warn('Auto-highlight after deck save failed:', e?.message ?? e);
        }
      }

      showThemedAlert('Card saved!', `Added to "${deck.name}"`, 'success', handleClose);
    } catch (error: any) {
      showThemedAlert('Error', `Failed to save card: ${error.message}`, 'error');
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
      showThemedAlert('Error', error.message, 'error');
    } finally {
      setLoadingDecks(false);
    }
  };

  const highlightColors = ['#C9B458', '#7BA668', '#8AABBF', '#C48B6C'];

  const s = useMemo(() => getStyles(colors), [colors]);

  const dismissThemedAlert = () => {
    if (!themedDialog || themedDialog.kind !== 'alert') return;
    if (themedDialog.onDismiss) {
      themedDialog.onDismiss();
    } else {
      setThemedDialog(null);
    }
  };

  const dialogAccent =
    themedDialog?.kind === 'alert'
      ? themedDialog.variant === 'error'
        ? colors.signOutText
        : themedDialog.variant === 'success'
          ? colors.accent
          : colors.accent
      : colors.accent;

  const showingLookupResult =
    !loading &&
    result.length > 0 &&
    currentAction !== 'addToDeck' &&
    currentAction !== 'highlight' &&
    currentAction !== 'highlightComplete';
  const hideFooterClose = showingLookupResult && !result.startsWith('Limit reached');
  const nativeMeta = getLangMeta(nativeLang);
  const targetMeta = getLangMeta(targetLang);
  const showStructuredDefine =
    originalAction === 'define' &&
    enhancedDefinition &&
    !result.startsWith('Limit reached') &&
    !result.startsWith('Word not found') &&
    !result.startsWith('Error:');

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.modalContainer}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
        {themedDialog && (
          <View style={s.themedDialogOverlay} pointerEvents="box-none">
            <TouchableOpacity
              style={s.themedDialogBackdrop}
              activeOpacity={1}
              onPress={() => {
                if (themedDialog.kind === 'confirm') themedDialog.onCancel();
                else dismissThemedAlert();
              }}
            />
            <View style={[s.themedDialogCard, {borderLeftColor: dialogAccent}]}>
              {themedDialog.kind === 'alert' ? (
                <>
                  <Text style={s.themedDialogTitle}>{themedDialog.title}</Text>
                  <Text style={s.themedDialogMessage}>{themedDialog.message}</Text>
                  <TouchableOpacity style={s.themedDialogPrimaryBtn} onPress={dismissThemedAlert} activeOpacity={0.85}>
                    <Text style={s.themedDialogPrimaryBtnText}>OK</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.themedDialogTitle}>{themedDialog.title}</Text>
                  <Text style={s.themedDialogMessage}>{themedDialog.message}</Text>
                  <View style={s.themedDialogRow}>
                    <TouchableOpacity style={s.themedDialogSecondaryBtn} onPress={themedDialog.onCancel} activeOpacity={0.85}>
                      <Text style={s.themedDialogSecondaryBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.themedDialogDeleteBtn} onPress={themedDialog.onConfirm} activeOpacity={0.85}>
                      <Text style={s.themedDialogDeleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
        <View style={[s.sheetContainer, {marginBottom: keyboardHeight}]}>
          <View style={s.handle} />
          <ScrollView
            style={s.scrollView}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* Palabra (editable, estilo caja beige como en el mockup) */}
            <View style={s.wordInputWrap}>
              <TextInput
                style={s.wordInput}
                value={editingWord}
                onChangeText={setEditingWord}
                placeholder="Word"
                placeholderTextColor={colors.textMuted}
                editable={!loading}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Action buttons */}
            {!currentAction && (
              <View style={s.actionsContainer}>
                <TouchableOpacity style={s.actionButton} onPress={handleDefine} activeOpacity={0.7}>
                  <Text style={s.actionIcon}>🪶</Text>
                  <Text style={s.actionText}>Define</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionButton} onPress={handleTranslate} activeOpacity={0.7}>
                  <Text style={s.actionIcon}>🐸</Text>
                  <Text style={s.actionText}>Translate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionButton} onPress={handleAskAIOpen} activeOpacity={0.7}>
                  <Text style={s.actionIcon}>🦫</Text>
                  <Text style={s.actionText}>Ask AI</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionButton} activeOpacity={0.7}
                  onPress={() => { clickedColor ? setCurrentAction('highlightComplete') : setCurrentAction('highlight'); }}>
                  <Text style={s.actionIcon}>🪷</Text>
                  <Text style={s.actionText}>Highlight</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionButton} onPress={handleCopy} activeOpacity={0.7}>
                  <Text style={s.actionIcon}>🍃</Text>
                  <Text style={s.actionText}>Copy</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Ask AI: small window – grammar/language question input */}
            {currentAction === 'grammar' && result.length === 0 && !loading && (
              <View style={s.askAIContainer}>
                <Text style={s.askAITitle}>Grammar & language only</Text>
                <Text style={s.askAIHint}>One short question about the text above.</Text>
                <TextInput
                  style={s.askAIInput}
                  placeholder="e.g. Why subjunctive here?"
                  placeholderTextColor={colors.textMuted}
                  value={askQuestionInput}
                  onChangeText={setAskQuestionInput}
                  multiline
                  maxLength={300}
                />
                <TouchableOpacity style={s.askAISubmitButton} onPress={handleAskAISubmit} activeOpacity={0.7}>
                  <Text style={s.askAISubmitText}>Ask AI</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.backButton} onPress={() => { setCurrentAction(null); setAskQuestionInput(''); }}>
                  <Text style={s.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Loading */}
            {loading && (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={s.loadingText}>Loading...</Text>
              </View>
            )}

            {/* Result display (definición / traducción / Ask AI): botón verde + colores como mockup */}
            {!loading && result.length > 0 && currentAction !== 'addToDeck' && currentAction !== 'highlight' && currentAction !== 'highlightComplete' && (
              <View style={s.resultContainer}>
                {result.startsWith('Limit reached') ? (
                  <View style={s.limitReachedBox}>
                    <Text style={s.limitReachedTitle}>Limit reached</Text>
                    <Text style={s.limitReachedText}>{result.replace(/^Limit reached\n\n/, '')}</Text>
                  </View>
                ) : (
                  <Text style={s.resultTextPlain}>{result}</Text>
                )}
                {!result.startsWith('Limit reached') && (
                  <>
                    <TouchableOpacity style={s.saveCardButton} onPress={handleAddToDeck} activeOpacity={0.85}>
                      <Text style={s.saveCardIcon}>🦫</Text>
                      <Text style={s.saveCardText}>Save Card to Deck</Text>
                    </TouchableOpacity>
                    <Text style={s.highlightPrompt}>Save as highlight:</Text>
                    <View style={s.highlightColorsRow}>
                      {highlightColors.map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[s.colorSwatch, {backgroundColor: c}]}
                          onPress={() => handleHighlight(c)}
                          activeOpacity={0.85}>
                          <View style={s.colorSwatchDot} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <TouchableOpacity
                  style={s.backButton}
                  onPress={() => {
                    setCurrentAction(null);
                    setResult('');
                  }}>
                  <Text style={s.resultBackText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Highlight color picker */}
            {currentAction === 'highlight' && !loading && !result && (
              <View style={s.highlightContainer}>
                <Text style={s.highlightTitle}>Choose highlight color:</Text>
                <View style={s.highlightColorsRow}>
                  {highlightColors.map(c => (
                    <TouchableOpacity key={c} style={[s.colorSwatch, {backgroundColor: c}]} onPress={() => handleHighlight(c)} activeOpacity={0.85}>
                      <View style={s.colorSwatchDot} />
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={s.backButton} onPress={() => setCurrentAction(null)}>
                  <Text style={s.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* After highlighting */}
            {currentAction === 'highlightComplete' && !loading && (
              <View style={s.highlightOptionsContainer}>
                <Text style={s.successText}>
                  {isClickedHighlight ? '🎨 Highlight Options' : '✅ Highlight saved!'}
                </Text>
                <TouchableOpacity style={s.optionButton} onPress={() => setCurrentAction('highlight')}>
                  <Text style={s.optionIcon}>🎨</Text>
                  <Text style={s.optionText}>Change Color</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.optionButton} onPress={handleAddToDeck}>
                  <Text style={s.optionIcon}>💾</Text>
                  <Text style={s.optionText}>Save Card</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.optionButton, s.deleteOptionButton]} onPress={handleDelete}>
                  <Text style={s.optionIcon}>🗑️</Text>
                  <Text style={[s.optionText, s.deleteOptionText]}>Delete Highlight</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.backButton} onPress={() => setCurrentAction(null)}>
                  <Text style={s.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Deck Selector */}
            {currentAction === 'addToDeck' && (
              <View style={s.deckSelectorContainer}>
                <Text style={s.deckSelectorTitle}>Save Card to:</Text>
                <Text style={s.deckSelectorSubtitle}>📚 {bookTitle}</Text>
                {loadingDecks ? (
                  <View style={s.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                  </View>
                ) : showCreateSubdeck ? (
                  <View style={s.createSubdeckContainer}>
                    <Text style={s.createSubdeckTitle}>Create Subdeck</Text>
                    <TextInput
                      style={s.subdeckInput}
                      placeholder="Enter subdeck name"
                      placeholderTextColor={colors.textMuted}
                      value={subdeckName}
                      onChangeText={setSubdeckName}
                      autoFocus
                    />
                    <View style={s.createSubdeckButtons}>
                      <TouchableOpacity style={[s.createSubdeckButton, s.cancelBtn]}
                        onPress={() => { setShowCreateSubdeck(false); setSubdeckName(''); }}>
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.createSubdeckButton, s.saveBtn]} onPress={handleCreateSubdeck}>
                        <Text style={s.saveBtnText}>Create</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : decks.length === 0 ? (
                  <View style={s.emptyDecksContainer}>
                    <Text style={s.emptyDecksText}>No subdecks yet!</Text>
                    <Text style={s.emptyDecksHint}>Create a subdeck to save cards to.</Text>
                    <TouchableOpacity style={s.createFirstSubdeckButton} onPress={() => setShowCreateSubdeck(true)}>
                      <Text style={s.createFirstSubdeckButtonText}>+ Create Subdeck</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={s.selectSubdeckPrompt}>Select a subdeck:</Text>
                    <View style={s.deckList}>
                      {decks.map(d => (
                        <TouchableOpacity key={d.id} style={s.deckItem} onPress={() => handleSelectDeck(d)}>
                          <Text style={s.deckItemName}>📁 {d.name}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={[s.deckItem, s.createNewDeckItem]} onPress={() => setShowCreateSubdeck(true)}>
                        <Text style={s.createNewDeckText}>+ Create New Subdeck</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                <TouchableOpacity style={s.backButton}
                  onPress={() => { setCurrentAction(result ? 'highlightComplete' : null); setDecks([]); setShowCreateSubdeck(false); }}>
                  <Text style={s.backButtonText}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Close: oculto en vista de definición (mockup solo muestra ← Back) */}
            {!hideFooterClose && (
              <TouchableOpacity style={s.closeButton} onPress={handleClose} activeOpacity={0.85}>
                <Text style={s.closeButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

function getStyles(colors: {background: string; cardBackground: string; text: string; textMuted: string; segmentBg: string; accent: string; chipBg: string; chipBgActive: string; cardBorder: string; signOutBg: string; signOutBorder: string; signOutText: string; emailText: string}) {
  return StyleSheet.create({
    modalContainer: {flex: 1, justifyContent: 'flex-end'},
    backdrop: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)'},
    sheetContainer: {
      backgroundColor: colors.cardBackground,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: '88%',
      paddingBottom: 28,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.cardBorder,
    },
    handle: {
      width: 40,
      height: 5,
      backgroundColor: colors.cardBorder,
      borderRadius: 3,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 18,
    },
    scrollView: {paddingHorizontal: 0},
    scrollContent: {paddingHorizontal: 22, paddingBottom: 8},
    wordInputWrap: {
      backgroundColor: colors.chipBg,
      borderRadius: 16,
      marginBottom: 22,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 18,
      paddingVertical: 6,
    },
    wordInput: {
      fontSize: 17,
      lineHeight: 24,
      color: colors.text,
      paddingVertical: 14,
      minHeight: 52,
    },
    actionsContainer: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20},
    actionButton: {flex: 1, minWidth: '30%', backgroundColor: colors.accent, padding: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2},
    actionIcon: {fontSize: 28, marginBottom: 6},
    actionText: {color: '#FFFFFF', fontSize: 13, fontWeight: '600', letterSpacing: -0.2},
    loadingContainer: {alignItems: 'center', paddingVertical: 40},
    loadingText: {marginTop: 12, fontSize: 16, color: colors.textMuted},
    defineLookupRoot: {marginBottom: 8},
    defineSection: {marginBottom: 18},
    defineStepLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textMuted,
      marginBottom: 8,
      letterSpacing: 0.4,
      textTransform: 'uppercase' as const,
    },
    defineSectionBody: {fontSize: 15, lineHeight: 23},
    defineSectionMuted: {fontSize: 15, lineHeight: 23, color: colors.textMuted, fontStyle: 'italic'},
    defineConjLine: {fontSize: 14, lineHeight: 22},
    resultContainer: {marginBottom: 8},
    /** Traducción / Ask AI / errores en texto plano */
    resultTextPlain: {fontSize: 15, lineHeight: 23, color: colors.text, marginBottom: 18},
    resultBackText: {fontSize: 16, color: '#5A6D7E', fontWeight: '600'},
    /** Verde bosque fijo (mockup); no depender solo del accent por tema */
    saveCardButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#6B8E73',
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderRadius: 14,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 3,
    },
    saveCardIcon: {fontSize: 20, marginRight: 10},
    saveCardText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
    highlightPrompt: {fontSize: 14, color: '#8A8171', marginBottom: 14, fontWeight: '600'},
    highlightContainer: {marginBottom: 20},
    highlightTitle: {fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 16},
    highlightColorsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    /** Chips cuadrados redondeados como en el mockup */
    colorSwatch: {
      width: 54,
      height: 54,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 3,
    },
    colorSwatchDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: '#FFFFFF',
    },
    backButton: {paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center'},
    backButtonText: {fontSize: 16, color: colors.accent, fontWeight: '600'},
    closeButton: {
      backgroundColor: colors.chipBg,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    closeButtonText: {fontSize: 16, color: colors.text, fontWeight: '600'},
    highlightOptionsContainer: {marginBottom: 20},
    successText: {fontSize: 18, fontWeight: '600', color: colors.accent, marginBottom: 20, textAlign: 'center'},
    optionButton: {flexDirection: 'row', alignItems: 'center', backgroundColor: colors.chipBg, padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.cardBorder},
    deleteOptionButton: {backgroundColor: colors.signOutBg, borderColor: colors.signOutBorder},
    optionIcon: {fontSize: 22, marginRight: 12},
    optionText: {fontSize: 16, color: colors.text, fontWeight: '500'},
    deleteOptionText: {color: colors.signOutText},
    deckSelectorContainer: {marginBottom: 20},
    deckSelectorTitle: {fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8},
    deckSelectorSubtitle: {fontSize: 14, color: colors.textMuted, marginBottom: 16},
    selectSubdeckPrompt: {fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 12},
    deckList: {marginBottom: 16},
    deckItem: {backgroundColor: colors.chipBg, padding: 16, borderRadius: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: colors.accent, borderWidth: 1, borderColor: colors.cardBorder},
    createNewDeckItem: {borderLeftColor: colors.chipBgActive, backgroundColor: colors.segmentBg},
    createNewDeckText: {fontSize: 16, fontWeight: '600', color: colors.accent, textAlign: 'center'},
    deckItemName: {fontSize: 16, fontWeight: '600', color: colors.text},
    emptyDecksContainer: {padding: 32, alignItems: 'center'},
    emptyDecksText: {fontSize: 15, color: colors.textMuted, fontWeight: '600', marginBottom: 8},
    emptyDecksHint: {fontSize: 13, color: colors.emailText, textAlign: 'center', marginBottom: 20},
    createFirstSubdeckButton: {backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12},
    createFirstSubdeckButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
    createSubdeckContainer: {marginBottom: 20},
    createSubdeckTitle: {fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12},
    subdeckInput: {backgroundColor: colors.cardBackground, padding: 16, borderRadius: 12, fontSize: 16, color: colors.text, marginBottom: 16, borderWidth: 1.5, borderColor: colors.accent},
    createSubdeckButtons: {flexDirection: 'row', gap: 12},
    createSubdeckButton: {flex: 1, padding: 14, borderRadius: 12, alignItems: 'center'},
    cancelBtn: {backgroundColor: colors.chipBg, borderWidth: 1, borderColor: colors.cardBorder},
    cancelBtnText: {fontSize: 16, fontWeight: '600', color: colors.textMuted},
    saveBtn: {backgroundColor: colors.accent},
    saveBtnText: {fontSize: 16, fontWeight: '600', color: '#FFFFFF'},
    askAIContainer: {marginBottom: 20},
    askAITitle: {fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 8},
    askAIHint: {fontSize: 14, color: colors.textMuted, marginBottom: 12},
    askAIInput: {backgroundColor: colors.cardBackground, padding: 14, borderRadius: 12, fontSize: 16, color: colors.text, minHeight: 80, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1.5, borderColor: colors.accent},
    askAISubmitButton: {backgroundColor: colors.accent, padding: 14, borderRadius: 14, alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2},
    askAISubmitText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
    limitReachedBox: {backgroundColor: colors.signOutBg, padding: 16, borderRadius: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: colors.signOutText},
    limitReachedTitle: {fontSize: 16, fontWeight: '700', color: colors.signOutText, marginBottom: 8},
    limitReachedText: {fontSize: 15, lineHeight: 22, color: colors.text},
    themedDialogOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2000,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    themedDialogBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    themedDialogCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 18,
      padding: 22,
      width: '100%',
      maxWidth: 340,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderLeftWidth: 4,
      zIndex: 2001,
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 6},
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 16,
    },
    themedDialogTitle: {fontSize: 19, fontWeight: '700', color: colors.text, marginBottom: 10},
    themedDialogMessage: {fontSize: 16, lineHeight: 24, color: colors.textMuted, marginBottom: 22},
    themedDialogPrimaryBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
    },
    themedDialogPrimaryBtnText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
    themedDialogRow: {flexDirection: 'row', gap: 12},
    themedDialogSecondaryBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: colors.chipBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    themedDialogSecondaryBtnText: {color: colors.textMuted, fontSize: 16, fontWeight: '600'},
    themedDialogDeleteBtn: {
      flex: 1,
      backgroundColor: colors.signOutBg,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.signOutBorder,
    },
    themedDialogDeleteBtnText: {color: colors.signOutText, fontSize: 16, fontWeight: '700'},
  });
}
