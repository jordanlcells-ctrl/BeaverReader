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
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [context, setContext] = useState('');
  const [cardType, setCardType] = useState<'definition' | 'translation' | 'grammar' | 'custom'>('custom');
  const [loading, setLoading] = useState(false);

  const cardTypes = [
    {value: 'custom', label: '💭 Custom', color: '#9C27B0'},
    {value: 'definition', label: '📖 Definition', color: '#4CAF50'},
    {value: 'translation', label: '🌐 Translation', color: '#2196F3'},
    {value: 'grammar', label: '✏️ Grammar', color: '#FF9800'},
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

        <View style={styles.modalContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Card</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                disabled={loading}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Card Type Selector */}
              <Text style={styles.label}>Card Type</Text>
              <View style={styles.typeSelector}>
                {cardTypes.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeButton,
                      cardType === type.value && {
                        backgroundColor: type.color,
                        borderColor: type.color,
                      },
                    ]}
                    onPress={() => setCardType(type.value as any)}
                    disabled={loading}>
                    <Text
                      style={[
                        styles.typeButtonText,
                        cardType === type.value && styles.typeButtonTextActive,
                      ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>
                Front <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={front}
                onChangeText={setFront}
                placeholder="What you want to learn"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />

              <Text style={styles.label}>
                Back <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={back}
                onChangeText={setBack}
                placeholder="The answer"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />

              <Text style={styles.label}>Context (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={context}
                onChangeText={setContext}
                placeholder="Where did you see this?"
                placeholderTextColor="#999"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={loading}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
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
