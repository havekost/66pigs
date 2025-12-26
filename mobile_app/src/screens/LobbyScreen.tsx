import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Button, PlayerCard } from '../components';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/theme';
import { usePlayer } from '../context/PlayerContext';
import { supabase } from '../lib/supabase';
import { RootStackParamList, LobbyPlayer, Lobby } from '../types';
import { initializeGame } from '../utils/gameLogic';

type LobbyScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Lobby'>;
type LobbyScreenRouteProp = RouteProp<RootStackParamList, 'Lobby'>;

interface LobbyScreenProps {
  navigation: LobbyScreenNavigationProp;
  route: LobbyScreenRouteProp;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ navigation, route }) => {
  const { lobbyCode, isHost: initialIsHost } = route.params;
  const { playerId, nickname } = usePlayer();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isHost, setIsHost] = useState(initialIsHost);
  const [isStarting, setIsStarting] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Fetch lobby and players
  const fetchLobbyData = useCallback(async () => {
    try {
      // Get lobby
      const { data: lobbyData, error: lobbyError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', lobbyCode)
        .single();

      if (lobbyError || !lobbyData) {
        Alert.alert('Error', 'Lobby not found.');
        navigation.goBack();
        return;
      }

      setLobby(lobbyData);
      setIsHost(lobbyData.host_id === playerId);

      // If game has started, navigate to game screen
      if (lobbyData.status === 'playing') {
        navigation.replace('Game', { lobbyCode });
        return;
      }

      // Get players
      const { data: playersData, error: playersError } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', lobbyData.id)
        .order('joined_at', { ascending: true });

      if (playersError) {
        console.error('Error fetching players:', playersError);
        return;
      }

      setPlayers(playersData || []);
    } catch (error) {
      console.error('Error fetching lobby data:', error);
    }
  }, [lobbyCode, playerId, navigation]);

  // Set up real-time subscription
  useEffect(() => {
    fetchLobbyData();

    // Subscribe to lobby changes
    const lobbyChannel = supabase
      .channel(`lobby:${lobbyCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
          filter: `code=eq.${lobbyCode}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedLobby = payload.new as Lobby;
            setLobby(updatedLobby);

            if (updatedLobby.status === 'playing') {
              navigation.replace('Game', { lobbyCode });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobby_players',
        },
        () => {
          // Refetch players when there's a change
          fetchLobbyData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lobbyChannel);
    };
  }, [lobbyCode, fetchLobbyData, navigation]);

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(lobbyCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleStartGame = async () => {
    if (!lobby || players.length < 2) {
      Alert.alert('Not Enough Players', 'You need at least 2 players to start the game.');
      return;
    }

    if (players.length > 10) {
      Alert.alert('Too Many Players', 'Maximum 10 players allowed.');
      return;
    }

    setIsStarting(true);
    try {
      // Initialize game
      const { gameState, hands } = initializeGame(players.length);

      // Update each player with their hand
      for (let i = 0; i < players.length; i++) {
        const { error } = await supabase
          .from('lobby_players')
          .update({
            hand: hands[i],
            score: 0,
            selected_card: null,
          })
          .eq('id', players[i].id);

        if (error) {
          throw error;
        }
      }

      // Update lobby status and game state
      const { error: lobbyError } = await supabase
        .from('lobbies')
        .update({
          status: 'playing',
          game_state: gameState,
        })
        .eq('id', lobby.id);

      if (lobbyError) {
        throw lobbyError;
      }

      // Navigation will happen through the subscription
    } catch (error) {
      console.error('Error starting game:', error);
      Alert.alert('Error', 'Failed to start game. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleLeaveLobby = async () => {
    Alert.alert(
      'Leave Lobby',
      'Are you sure you want to leave this lobby?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              if (lobby) {
                // Remove player from lobby
                await supabase
                  .from('lobby_players')
                  .delete()
                  .eq('lobby_id', lobby.id)
                  .eq('player_id', playerId);

                // If host is leaving and there are other players, transfer host
                if (isHost && players.length > 1) {
                  const newHost = players.find((p) => p.player_id !== playerId);
                  if (newHost) {
                    await supabase
                      .from('lobbies')
                      .update({ host_id: newHost.player_id })
                      .eq('id', lobby.id);
                  }
                }

                // If no players left, delete the lobby
                if (players.length <= 1) {
                  await supabase.from('lobbies').delete().eq('id', lobby.id);
                }
              }
              navigation.goBack();
            } catch (error) {
              console.error('Error leaving lobby:', error);
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const currentPlayer = players.find((p) => p.player_id === playerId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Button
            title="← Leave"
            onPress={handleLeaveLobby}
            variant="ghost"
            size="sm"
          />
        </View>
        <Text style={styles.headerTitle}>🐷 Lobby</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Lobby Code Section */}
        <View style={styles.codeSection}>
          <Text style={styles.codeLabel}>Lobby Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{lobbyCode}</Text>
            <Button
              title={codeCopied ? '✓ Copied!' : '📋 Copy'}
              onPress={handleCopyCode}
              variant="outline"
              size="sm"
            />
          </View>
          <Text style={styles.codeHint}>
            Share this code with your friends!
          </Text>
        </View>

        {/* Players Section */}
        <View style={styles.playersSection}>
          <Text style={styles.sectionTitle}>
            Players ({players.length}/10)
          </Text>
          <FlatList
            data={players}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.playerItem}>
                <PlayerCard
                  nickname={item.nickname}
                  score={item.score}
                  isHost={lobby?.host_id === item.player_id}
                  isReady={item.is_ready}
                  isCurrentPlayer={item.player_id === playerId}
                />
              </View>
            )}
            scrollEnabled={false}
            numColumns={2}
            columnWrapperStyle={styles.playerRow}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Waiting for players...</Text>
            }
          />
        </View>

        {/* Game Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>🎮 How to Play</Text>
          <Text style={styles.infoText}>
            • Everyone picks a card secretly{'\n'}
            • Cards are revealed and placed lowest to highest{'\n'}
            • Place your card on the row with the closest lower number{'\n'}
            • If you're the 6th card in a row, you take all 5 cards!{'\n'}
            • Collect pigs 🐷 from cards you take{'\n'}
            • First to 66 pigs loses!{'\n'}
            • Special cards (11, 22, 33...) give -11 pigs! ✨
          </Text>
        </View>
      </ScrollView>

      {/* Start Button (Host only) */}
      <View style={styles.footer}>
        {isHost ? (
          <Button
            title={`Start Game (${players.length} players)`}
            onPress={handleStartGame}
            variant="primary"
            size="lg"
            loading={isStarting}
            disabled={players.length < 2}
          />
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>
              ⏳ Waiting for host to start the game...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  headerRight: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  codeSection: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  codeLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  code: {
    fontSize: fontSize.giant,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 4,
  },
  codeHint: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  playersSection: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  playerRow: {
    justifyContent: 'flex-start',
    gap: spacing.md,
  },
  playerItem: {
    flex: 1,
    maxWidth: '48%',
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textLight,
    textAlign: 'center',
    padding: spacing.lg,
  },
  infoSection: {
    backgroundColor: colors.secondaryLight + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.secondaryDark,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  waitingContainer: {
    alignItems: 'center',
    padding: spacing.md,
  },
  waitingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});
