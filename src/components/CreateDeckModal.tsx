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
import {deckService, Deck, CreateDeckInput, UpdateDeckInput} from '../services/deckService';

interface CreateDeckModalProps {
  visible: boolean;
  deck?: Deck | null; // If provided, we're editing
  parentDeck?: Deck | null; // If provided, creating a subdeck
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateDeckModal({
  visible,
  deck,
  parentDeck,
  onClose,
  onSuccess,
}: CreateDeckModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = !!deck;
  const isSubdeck = !!parentDeck;

  useEffect(() => {
    if (visible) {
      // Reset or populate form
      if (deck) {
        setName(deck.name);
      } else {
        setName('');
      }
    }
  }, [visible, deck]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a deck name');
      return;
    }

    try {
      setLoading(true);

      if (isEditing && deck) {
        // Update existing deck
        const updateData: UpdateDeckInput = {
          name: name.trim(),
        };
        await deckService.updateDeck(deck.id, updateData);
        Alert.alert('Success', 'Deck updated successfully');
      } else {
        // Create new deck
        const createData: CreateDeckInput = {
          name: name.trim(),
          parent_deck_id: parentDeck?.id,
        };
        await deckService.createDeck(createData);
        Alert.alert(
          'Success',
          isSubdeck
            ? `Subdeck created under "${parentDeck?.name}"`
            : 'Deck created successfully'
        );
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to save deck:', error);
      Alert.alert('Error', 'Failed to save deck. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (isEditing) return 'Edit Deck';
    if (isSubdeck) return `Create Subdeck under "${parentDeck?.name}"`;
    return 'Create New Deck';
  };

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
              <Text style={styles.modalTitle}>{getTitle()}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                disabled={loading}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.label}>
                Deck Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Spanish Vocabulary"
                placeholderTextColor="#999"
                editable={!loading}
                autoFocus
              />

              {isSubdeck && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    This subdeck will be created under: <Text style={styles.infoTextBold}>{parentDeck?.name}</Text>
                  </Text>
                </View>
              )}
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
                  <Text style={styles.saveButtonText}>
                    {isEditing ? 'Update' : 'Create'}
                  </Text>
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
    maxHeight: '80%',
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
    height: 100,
    paddingTop: 12,
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
  },
  infoTextBold: {
    fontWeight: 'bold',
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
