import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import type {Card} from '../services/cardService';

interface CardItemProps {
  card: Card;
  onEdit: () => void;
  onDelete: () => void;
}

const getCardTypeLabel = (type: string) => {
  switch (type) {
    case 'definition':
      return '🪶 Definition';
    case 'translation':
      return '🐸 Translation';
    case 'grammar':
      return '🦫 Grammar';
    default:
      return '🌿 Custom';
  }
};

const getCardTypeColor = (type: string) => {
  switch (type) {
    case 'definition':
      return '#6B8E73';
    case 'translation':
      return '#8AABBF';
    case 'grammar':
      return '#C9B458';
    default:
      return '#C48B6C';
  }
};

export default function CardItem({card, onEdit, onDelete}: CardItemProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <View style={styles.container}>
      {/* Type Badge */}
      <View style={[styles.typeBadge, {backgroundColor: getCardTypeColor(card.card_type)}]}>
        <Text style={styles.typeBadgeText}>{getCardTypeLabel(card.card_type)}</Text>
      </View>

      {/* Card Content - Tap to flip */}
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.7}
        onPress={() => setIsFlipped(!isFlipped)}>
        <Text style={styles.cardLabel}>{isFlipped ? 'BACK' : 'FRONT'}</Text>
        <Text style={styles.cardText} numberOfLines={6}>
          {isFlipped ? card.back : card.front}
        </Text>
        <Text style={styles.flipHint}>Tap to {isFlipped ? 'see front' : 'flip'}</Text>
      </TouchableOpacity>

      {/* Context */}
      {card.context && (
        <View style={styles.contextContainer}>
          <Text style={styles.contextText} numberOfLines={2}>
            {card.context}
          </Text>
        </View>
      )}

      {/* Meta & Actions */}
      <View style={styles.footer}>
        <Text style={styles.metaText}>
          {new Date(card.created_at).toLocaleDateString()}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.editButton} onPress={onEdit} activeOpacity={0.7}>
            <Text style={styles.editButtonText}>✏️ Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={onDelete} activeOpacity={0.7}>
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF8F3',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    shadowColor: '#8B7355',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardContent: {
    backgroundColor: '#F7F5F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A8171',
    letterSpacing: 1,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    color: '#3D5A46',
    lineHeight: 22,
    marginBottom: 8,
  },
  flipHint: {
    fontSize: 12,
    color: '#A3B5A7',
    fontStyle: 'italic',
  },
  contextContainer: {
    backgroundColor: '#F0EBE3',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#C9B458',
    marginBottom: 12,
  },
  contextText: {
    fontSize: 13,
    color: '#6B7C6E',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#A3B5A7',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F0EBE3',
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  editButtonText: {
    fontSize: 13,
    color: '#3D5A46',
    fontWeight: '500',
  },
  deleteButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F5E6E3',
    borderWidth: 1,
    borderColor: '#E8D0CC',
  },
  deleteButtonText: {
    fontSize: 14,
  },
});
