import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius, spacing, fontSize, fontWeight, shadows } from '../lib/theme';
import { PigIcon } from './PigIcon';

interface PlayerCardProps {
  nickname: string;
  score: number;
  isHost?: boolean;
  isReady?: boolean;
  isCurrentPlayer?: boolean;
  hasSelectedCard?: boolean;
  compact?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  nickname,
  score,
  isHost = false,
  isReady = false,
  isCurrentPlayer = false,
  hasSelectedCard = false,
  compact = false,
}) => {
  return (
    <View
      style={[
        styles.container,
        isCurrentPlayer && styles.currentPlayer,
        compact && styles.compact,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.nameContainer}>
          {isHost && <Text style={styles.hostBadge}>👑</Text>}
          <Text style={[styles.nickname, isCurrentPlayer && styles.currentNickname]} numberOfLines={1}>
            {nickname}
          </Text>
        </View>
        {hasSelectedCard && <Text style={styles.readyIcon}>✓</Text>}
      </View>
      <View style={styles.scoreContainer}>
        <PigIcon count={score} size="sm" />
      </View>
      {isReady && !hasSelectedCard && (
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>Ready</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    minWidth: 100,
    ...shadows.sm,
  },
  compact: {
    padding: spacing.sm,
    minWidth: 80,
  },
  currentPlayer: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '30',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hostBadge: {
    marginRight: spacing.xs,
  },
  nickname: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  currentNickname: {
    color: colors.primaryDark,
  },
  readyIcon: {
    fontSize: fontSize.lg,
    color: colors.success,
    marginLeft: spacing.xs,
  },
  scoreContainer: {
    marginTop: spacing.xs,
  },
  readyBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  readyText: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: fontWeight.medium,
  },
});
