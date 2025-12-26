import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '../lib/theme';

interface PigIconProps {
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export const PigIcon: React.FC<PigIconProps> = ({
  count = 0,
  size = 'md',
  showCount = true,
}) => {
  const sizes = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.emoji, { fontSize: sizes[size] }]}>🐷</Text>
      {showCount && (
        <Text
          style={[
            styles.count,
            { fontSize: sizes[size] * 0.6 },
            count < 0 && styles.negativeCount,
          ]}
        >
          {count >= 0 ? count : count}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {},
  count: {
    marginLeft: 4,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  negativeCount: {
    color: colors.success,
  },
});
