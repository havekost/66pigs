import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, borderRadius, spacing, fontSize, shadows } from '../lib/theme';
import { GameCard } from './GameCard';
import { TableRow as TableRowType } from '../types';
import { calculateRowPigs } from '../utils/gameLogic';

interface TableRowProps {
  row: TableRowType;
  rowIndex: number;
  onPress?: () => void;
  selectable?: boolean;
  highlighted?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  row,
  rowIndex,
  onPress,
  selectable = false,
  highlighted = false,
}) => {
  const totalPigs = calculateRowPigs(row);
  const isFull = row.cards.length >= 5;

  const RowWrapper = selectable ? TouchableOpacity : View;

  return (
    <RowWrapper
      onPress={selectable ? onPress : undefined}
      activeOpacity={0.8}
      style={[
        styles.container,
        highlighted && styles.highlighted,
        selectable && styles.selectable,
        isFull && styles.fullRow,
      ]}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.rowNumber}>Row {rowIndex + 1}</Text>
        <View style={styles.pigCount}>
          <Text style={styles.pigEmoji}>🐷</Text>
          <Text style={[styles.pigCountText, totalPigs < 0 && styles.negativePigs]}>
            {totalPigs}
          </Text>
        </View>
      </View>
      <View style={styles.cardsContainer}>
        {row.cards.map((card, index) => (
          <View key={`${card.number}-${index}`} style={styles.cardWrapper}>
            <GameCard card={card} size="sm" />
          </View>
        ))}
        {/* Show empty slots */}
        {Array.from({ length: 5 - row.cards.length }).map((_, index) => (
          <View key={`empty-${index}`} style={styles.emptySlot}>
            <Text style={styles.emptySlotText}>•</Text>
          </View>
        ))}
      </View>
      {isFull && (
        <View style={styles.fullWarning}>
          <Text style={styles.fullWarningText}>⚠️ Full!</Text>
        </View>
      )}
    </RowWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  highlighted: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryLight + '20',
  },
  selectable: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  fullRow: {
    borderColor: colors.warning,
    backgroundColor: colors.warning + '10',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  rowNumber: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pigCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pigEmoji: {
    fontSize: fontSize.sm,
    marginRight: 2,
  },
  pigCountText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  negativePigs: {
    color: colors.success,
  },
  cardsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardWrapper: {
    marginRight: spacing.xs,
  },
  emptySlot: {
    width: 45,
    height: 65,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    backgroundColor: colors.background,
  },
  emptySlotText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
  },
  fullWarning: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  fullWarningText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
