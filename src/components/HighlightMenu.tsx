import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';

interface HighlightMenuProps {
  isVisible: boolean;
  highlightText: string;
  highlightColor: string;
  onClose: () => void;
  onDelete: () => void;
  onChangeColor: () => void;
}

export const HighlightMenu = ({
  isVisible,
  highlightText,
  highlightColor,
  onClose,
  onDelete,
  onChangeColor,
}: HighlightMenuProps) => {
  const getColorName = (hex: string) => {
    const colors: Record<string, string> = {
      '#ffeb3b': 'Yellow',
      '#4caf50': 'Green',
      '#2196f3': 'Blue',
      '#ff5722': 'Red',
    };
    return colors[hex] || 'Unknown';
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <View style={styles.menuContainer}>
          <View style={styles.handle} />
          
          {/* Highlighted text preview */}
          <View style={[styles.textPreview, {backgroundColor: highlightColor + '40'}]}>
            <Text style={styles.previewText} numberOfLines={3}>
              {highlightText}
            </Text>
          </View>

          {/* Current color indicator */}
          <View style={styles.colorIndicator}>
            <View style={[styles.colorDot, {backgroundColor: highlightColor}]} />
            <Text style={styles.colorText}>{getColorName(highlightColor)}</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={onChangeColor}>
              <Text style={styles.actionIcon}>🎨</Text>
              <Text style={styles.actionText}>Change Color</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.deleteButton]} 
              onPress={() => {
                Alert.alert(
                  'Delete Highlight',
                  'Are you sure you want to delete this highlight?',
                  [
                    {text: 'Cancel', style: 'cancel'},
                    {text: 'Delete', style: 'destructive', onPress: onDelete},
                  ]
                );
              }}>
              <Text style={styles.actionIcon}>🗑️</Text>
              <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  textPreview: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  previewText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  colorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  colorText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  deleteText: {
    color: '#d32f2f',
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
});
