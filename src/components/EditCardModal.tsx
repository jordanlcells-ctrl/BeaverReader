import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {cardService, Card, UpdateCardInput} from '../services/cardService';
import {useTheme} from '../contexts/ThemeContext';

interface EditCardModalProps {
  visible: boolean;
  card: Card | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditCardModal({
  visible,
  card,
  onClose,
  onSuccess,
}: EditCardModalProps) {
  const {colors} = useTheme();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [context, setContext] = useState('');
  const [cardType, setCardType] = useState<'definition' | 'translation' | 'grammar' | 'custom'>('custom');
  const [loading, setLoading] = useState(false);

  const cardTypes = [
    {value: 'custom', label: '🌿 Custom', color: '#C48B6C'},
    {value: 'definition', label: '🪶 Definition', color: '#6B8E73'},
    {value: 'translation', label: '🐸 Translation', color: '#8AABBF'},
    {value: 'grammar', label: '🦫 Grammar', color: '#C9B458'},
  ];

  useEffect(() => {
    if (visible && card) {
      setFront(card.front);
      setBack(card.back);
      setContext(card.context || '');
      setCardType(card.card_type);
    }
  }, [visible, card]);

  const handleSave = async () => {
    if (!card) return;

    if (!front.trim() || !back.trim()) {
      Alert.alert('Validation Error', 'Please fill in both front and back of the card');
      return;
    }

    try {
      setLoading(true);

      const input: UpdateCardInput = {
        front: front.trim(),
        back: back.trim(),
        context: context.trim() || undefined,
        card_type: cardType,
      };

      await cardService.updateCard(card.id, input);
      Alert.alert('Success', 'Card updated successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to update card:', error);
      Alert.alert('Error', 'Failed to update card. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!card) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.modalContent, {backgroundColor: colors.cardBackground}]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: colors.text}]}>Edit Card</Text>
              <TouchableOpacity
                style={[styles.closeButton, {backgroundColor: colors.chipBg}]}
                onPress={onClose}
                disabled={loading}>
                <Text style={[styles.closeButtonText, {color: colors.textMuted}]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Card Type Selector */}
              <Text style={[styles.label, {color: colors.text}]}>Card Type</Text>
              <View style={styles.typeSelector}>
                {cardTypes.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeButton,
                      {
                        borderColor: cardType === type.value ? type.color : colors.cardBorder,
                        backgroundColor: cardType === type.value ? type.color : colors.chipBg,
                      },
                    ]}
                    onPress={() => setCardType(type.value as any)}
                    disabled={loading}>
                    <Text
                      style={[
                        styles.typeButtonText,
                        {color: cardType === type.value ? '#fff' : colors.textMuted},
                      ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, {color: colors.text}]}>
                Front <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, {borderColor: colors.cardBorder, backgroundColor: colors.background, color: colors.text}]}
                value={front}
                onChangeText={setFront}
                placeholder="What you want to learn"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />

              <Text style={[styles.label, {color: colors.text}]}>
                Back <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, {borderColor: colors.cardBorder, backgroundColor: colors.background, color: colors.text}]}
                value={back}
                onChangeText={setBack}
                placeholder="The answer"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />

              <Text style={[styles.label, {color: colors.text}]}>Context (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, {borderColor: colors.cardBorder, backgroundColor: colors.background, color: colors.text}]}
                value={context}
                onChangeText={setContext}
                placeholder="Where did you see this?"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, {backgroundColor: colors.chipBg}]}
                onPress={onClose}
                disabled={loading}>
                <Text style={[styles.cancelButtonText, {color: colors.textMuted}]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Update Card</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#d32f2f',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
