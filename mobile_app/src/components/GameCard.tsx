import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../lib/theme';
import { Card } from '../types';

interface GameCardProps {
  card: Card;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({
  card,
  onPress,
  selected = false,
  disabled = false,
  size = 'md',
  faceDown = false,
}) => {
  const isSpecialCard = card.pigs === -11;
  const isMultiplePigs = card.pigs > 1 && card.pigs !== -11;

  const sizeStyles = {
    sm: { width: 45, height: 65 },
    md: { width: 60, height: 85 },
    lg: { width: 80, height: 110 },
  };

  const fontSizes = {
    sm: { number: 14, pig: 8 },
    md: { number: 18, pig: 10 },
    lg: { number: 24, pig: 14 },
  };

  const renderPigs = () => {
    if (isSpecialCard) {
      // Special negative pig card - show golden pig
      return (
        <View style={styles.pigsContainer}>
          <Text style={[styles.pigEmoji, { fontSize: fontSizes[size].pig }]}>
            🐷✨
          </Text>
          <Text style={[styles.specialPigText, { fontSize: fontSizes[size].pig - 2 }]}>
            -11
          </Text>
        </View>
      );
    }

    const pigs = [];
    for (let i = 0; i < Math.min(card.pigs, 7); i++) {
      pigs.push(
        <Text key={i} style={[styles.pigEmoji, { fontSize: fontSizes[size].pig }]}>
          🐷
        </Text>
      );
    }

    return <View style={styles.pigsContainer}>{pigs}</View>;
  };

  if (faceDown) {
    return (
      <View
        style={[
          styles.card,
          styles.faceDown,
          sizeStyles[size],
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.faceDownText, { fontSize: fontSizes[size].number }]}>
          🐽
        </Text>
      </View>
    );
  }

  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.card,
        sizeStyles[size],
        selected && styles.selected,
        isSpecialCard && styles.specialCard,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.cardNumber,
          { fontSize: fontSizes[size].number },
          isSpecialCard && styles.specialNumber,
        ]}
      >
        {card.number}
      </Text>
      {renderPigs()}
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    ...shadows.md,
  },
  faceDown: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  faceDownText: {
    color: colors.textOnPrimary,
  },
  selected: {
    borderColor: colors.primary,
    borderWidth: 3,
    transform: [{ translateY: -8 }],
    ...shadows.lg,
  },
  specialCard: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDark,
  },
  disabled: {
    opacity: 0.5,
  },
  cardNumber: {
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  specialNumber: {
    color: colors.primaryDark,
  },
  pigsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  pigEmoji: {
    marginHorizontal: 1,
  },
  specialPigText: {
    color: colors.success,
    fontWeight: fontWeight.bold,
  },
});
