import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Button, GameCard, TableRow, PlayerCard } from '../components';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/theme';
import { usePlayer } from '../context/PlayerContext';
import { supabase } from '../lib/supabase';
import {
  RootStackParamList,
  LobbyPlayer,
  Lobby,
  GameState,
  Card,
  TableRow as TableRowType,
} from '../types';
import {
  findRowForCard,
  placeCardInRow,
  takeRow,
  sortRevealedCards,
  isGameOver,
  getWinner,
  initializeGame,
} from '../utils/gameLogic';

type GameScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Game'>;
type GameScreenRouteProp = RouteProp<RootStackParamList, 'Game'>;

interface GameScreenProps {
  navigation: GameScreenNavigationProp;
  route: GameScreenRouteProp;
}

export const GameScreen: React.FC<GameScreenProps> = ({ navigation, route }) => {
  const { lobbyCode } = route.params;
  const { playerId } = usePlayer();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRowSelection, setShowRowSelection] = useState(false);
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [winner, setWinner] = useState<LobbyPlayer | null>(null);

  const currentPlayer = players.find((p) => p.player_id === playerId);
  const isHost = lobby?.host_id === playerId;

  // Fetch game data
  const fetchGameData = useCallback(async () => {
    try {
      const { data: lobbyData, error: lobbyError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', lobbyCode)
        .single();

      if (lobbyError || !lobbyData) {
        Alert.alert('Error', 'Game not found.');
        navigation.goBack();
        return;
      }

      setLobby(lobbyData);
      setGameState(lobbyData.game_state);

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

      // Check for game over
      if (lobbyData.game_state?.phase === 'finished') {
        const playerList = playersData?.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          score: p.score,
          hand: p.hand,
          isHost: lobbyData.host_id === p.player_id,
          isReady: p.is_ready,
          selectedCard: p.selected_card,
        }));
        if (playerList) {
          const winnerData = playersData?.reduce((prev, curr) =>
            prev.score < curr.score ? prev : curr
          );
          setWinner(winnerData || null);
          setShowGameOver(true);
        }
      }
    } catch (error) {
      console.error('Error fetching game data:', error);
    }
  }, [lobbyCode, navigation]);

  // Set up real-time subscription
  useEffect(() => {
    fetchGameData();

    const channel = supabase
      .channel(`game:${lobbyCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
          filter: `code=eq.${lobbyCode}`,
        },
        () => {
          fetchGameData();
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
          fetchGameData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyCode, fetchGameData]);

  // Check if all players have selected cards
  useEffect(() => {
    const checkAllSelected = async () => {
      if (!gameState || !lobby || gameState.phase !== 'selecting') return;

      const allSelected = players.every((p) => p.selected_card !== null);

      if (allSelected && isHost && !isProcessing) {
        // Move to revealing phase
        await processRevealAndPlace();
      }
    };

    checkAllSelected();
  }, [players, gameState, isHost, isProcessing, lobby]);

  const handleSelectCard = async (card: Card) => {
    if (!currentPlayer || !lobby || gameState?.phase !== 'selecting') return;

    // Toggle selection
    const newSelection = selectedCard?.number === card.number ? null : card;
    setSelectedCard(newSelection);

    try {
      await supabase
        .from('lobby_players')
        .update({ selected_card: newSelection })
        .eq('id', currentPlayer.id);
    } catch (error) {
      console.error('Error selecting card:', error);
    }
  };

  const processRevealAndPlace = async () => {
    if (!lobby || !gameState || isProcessing) return;

    setIsProcessing(true);

    try {
      // Get all selected cards
      const revealed = players
        .filter((p) => p.selected_card)
        .map((p) => ({
          playerId: p.player_id,
          card: p.selected_card as Card,
        }));

      // Sort by card number (lowest first)
      const sorted = sortRevealedCards(revealed);
      let currentRows = [...gameState.tableRows];
      const playerScoreUpdates: { [playerId: string]: number } = {};

      // Process each card
      for (const { playerId: pid, card } of sorted) {
        const player = players.find((p) => p.player_id === pid);
        if (!player) continue;

        const rowIndex = findRowForCard(card, currentRows);

        if (rowIndex === -1) {
          // Card is lower than all rows - player must take a row
          // For now, automatically take the row with fewest pigs
          let minPigs = Infinity;
          let minIndex = 0;
          for (let i = 0; i < currentRows.length; i++) {
            const pigs = currentRows[i].cards.reduce((sum, c) => sum + c.pigs, 0);
            if (pigs < minPigs) {
              minPigs = pigs;
              minIndex = i;
            }
          }

          const { newRows, pigsTaken } = takeRow(card, minIndex, currentRows);
          currentRows = newRows;
          playerScoreUpdates[pid] = (playerScoreUpdates[pid] || 0) + pigsTaken;
        } else {
          // Place card in the appropriate row
          const { newRows, pigsTaken } = placeCardInRow(card, rowIndex, currentRows);
          currentRows = newRows;
          if (pigsTaken !== 0) {
            playerScoreUpdates[pid] = (playerScoreUpdates[pid] || 0) + pigsTaken;
          }
        }
      }

      // Update player scores and remove selected cards from hands
      for (const player of players) {
        const scoreUpdate = playerScoreUpdates[player.player_id] || 0;
        const newHand = player.hand.filter(
          (c) => c.number !== player.selected_card?.number
        );

        await supabase
          .from('lobby_players')
          .update({
            score: player.score + scoreUpdate,
            hand: newHand,
            selected_card: null,
          })
          .eq('id', player.id);
      }

      // Check if round is over (all hands empty)
      const allHandsEmpty = players.every(
        (p) => p.hand.filter((c) => c.number !== p.selected_card?.number).length === 0
      );

      // Check for game over
      const updatedPlayers = players.map((p) => ({
        ...p,
        score: p.score + (playerScoreUpdates[p.player_id] || 0),
      }));

      const gameOver = updatedPlayers.some((p) => p.score >= 66);

      let newGameState: GameState;

      if (gameOver) {
        newGameState = {
          ...gameState,
          phase: 'finished',
          tableRows: currentRows,
          revealedCards: [],
          pendingPlacements: [],
        };
      } else if (allHandsEmpty) {
        // Start a new round
        const { gameState: freshState, hands } = initializeGame(players.length);
        newGameState = {
          ...freshState,
          round: gameState.round + 1,
        };

        // Deal new cards
        for (let i = 0; i < players.length; i++) {
          await supabase
            .from('lobby_players')
            .update({
              hand: hands[i],
              selected_card: null,
            })
            .eq('id', players[i].id);
        }
      } else {
        newGameState = {
          ...gameState,
          phase: 'selecting',
          tableRows: currentRows,
          revealedCards: [],
          pendingPlacements: [],
        };
      }

      // Update game state
      await supabase
        .from('lobbies')
        .update({ game_state: newGameState })
        .eq('id', lobby.id);

      setSelectedCard(null);
    } catch (error) {
      console.error('Error processing cards:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectRow = async (rowIndex: number) => {
    if (!pendingCard || !lobby || !gameState || !currentPlayer) return;

    try {
      const { newRows, pigsTaken } = takeRow(pendingCard, rowIndex, gameState.tableRows);

      // Update player score
      await supabase
        .from('lobby_players')
        .update({
          score: currentPlayer.score + pigsTaken,
          hand: currentPlayer.hand.filter((c) => c.number !== pendingCard.number),
          selected_card: null,
        })
        .eq('id', currentPlayer.id);

      // Update game state
      await supabase
        .from('lobbies')
        .update({
          game_state: {
            ...gameState,
            tableRows: newRows,
          },
        })
        .eq('id', lobby.id);

      setShowRowSelection(false);
      setPendingCard(null);
    } catch (error) {
      console.error('Error selecting row:', error);
    }
  };

  const handleReturnToLobby = async () => {
    if (!lobby) return;

    try {
      // Reset game state
      await supabase
        .from('lobbies')
        .update({
          status: 'waiting',
          game_state: null,
        })
        .eq('id', lobby.id);

      // Reset player scores and hands
      for (const player of players) {
        await supabase
          .from('lobby_players')
          .update({
            score: 0,
            hand: [],
            selected_card: null,
            is_ready: player.player_id === lobby.host_id,
          })
          .eq('id', player.id);
      }

      navigation.replace('Lobby', { lobbyCode, isHost });
    } catch (error) {
      console.error('Error returning to lobby:', error);
    }
  };

  const playersWhoSelected = players.filter((p) => p.selected_card !== null).length;
  const allSelected = playersWhoSelected === players.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🐷 66 Pigs</Text>
        <Text style={styles.roundText}>Round {gameState?.round || 1}</Text>
      </View>

      {/* Players Score Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.playersBar}
        contentContainerStyle={styles.playersBarContent}
      >
        {players.map((player) => (
          <View key={player.id} style={styles.playerBarItem}>
            <PlayerCard
              nickname={player.nickname}
              score={player.score}
              isCurrentPlayer={player.player_id === playerId}
              hasSelectedCard={player.selected_card !== null}
              compact
            />
          </View>
        ))}
      </ScrollView>

      {/* Game Table */}
      <ScrollView style={styles.gameTable} contentContainerStyle={styles.gameTableContent}>
        <Text style={styles.tableLabel}>Table</Text>
        {gameState?.tableRows.map((row, index) => (
          <TableRow
            key={index}
            row={row}
            rowIndex={index}
            selectable={showRowSelection}
            onPress={() => handleSelectRow(index)}
          />
        ))}

        {/* Status Message */}
        <View style={styles.statusContainer}>
          {gameState?.phase === 'selecting' && !allSelected && (
            <Text style={styles.statusText}>
              {selectedCard
                ? `You selected card ${selectedCard.number}. Waiting for others...`
                : 'Select a card from your hand'}
            </Text>
          )}
          {gameState?.phase === 'selecting' && allSelected && (
            <Text style={styles.statusText}>All cards selected! Processing...</Text>
          )}
          <Text style={styles.selectedCount}>
            {playersWhoSelected}/{players.length} players ready
          </Text>
        </View>
      </ScrollView>

      {/* Player's Hand */}
      <View style={styles.handContainer}>
        <Text style={styles.handLabel}>Your Hand</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hand}
        >
          {currentPlayer?.hand
            .slice()
            .sort((a, b) => a.number - b.number)
            .map((card) => (
              <View key={card.number} style={styles.cardWrapper}>
                <GameCard
                  card={card}
                  onPress={() => handleSelectCard(card)}
                  selected={selectedCard?.number === card.number}
                  disabled={gameState?.phase !== 'selecting' || isProcessing}
                  size="md"
                />
              </View>
            ))}
        </ScrollView>
      </View>

      {/* Row Selection Modal */}
      <Modal visible={showRowSelection} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose a Row to Take</Text>
            <Text style={styles.modalSubtitle}>
              Your card {pendingCard?.number} is lower than all rows
            </Text>
            {gameState?.tableRows.map((row, index) => (
              <TableRow
                key={index}
                row={row}
                rowIndex={index}
                selectable
                onPress={() => handleSelectRow(index)}
              />
            ))}
          </View>
        </View>
      </Modal>

      {/* Game Over Modal */}
      <Modal visible={showGameOver} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.gameOverTitle}>🎉 Game Over! 🎉</Text>
            {winner && (
              <Text style={styles.winnerText}>
                {winner.nickname} wins with {winner.score} pigs!
              </Text>
            )}
            <View style={styles.finalScores}>
              <Text style={styles.finalScoresTitle}>Final Scores:</Text>
              {players
                .slice()
                .sort((a, b) => a.score - b.score)
                .map((player, index) => (
                  <Text
                    key={player.id}
                    style={[
                      styles.scoreRow,
                      index === 0 && styles.winnerScore,
                    ]}
                  >
                    {index + 1}. {player.nickname}: {player.score} 🐷
                  </Text>
                ))}
            </View>
            {isHost && (
              <Button
                title="Return to Lobby"
                onPress={handleReturnToLobby}
                variant="primary"
                size="lg"
              />
            )}
            {!isHost && (
              <Text style={styles.waitingText}>
                Waiting for host to return to lobby...
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.tableGreen,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primaryDark,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textOnPrimary,
  },
  roundText: {
    fontSize: fontSize.md,
    color: colors.textOnPrimary,
    fontWeight: fontWeight.medium,
  },
  playersBar: {
    maxHeight: 100,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  playersBarContent: {
    padding: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  playerBarItem: {
    marginRight: spacing.sm,
  },
  gameTable: {
    flex: 1,
  },
  gameTableContent: {
    padding: spacing.md,
  },
  tableLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textOnPrimary,
    marginBottom: spacing.md,
  },
  statusContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statusText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  selectedCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  handContainer: {
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderTopColor: colors.cardBorder,
    paddingVertical: spacing.md,
  },
  handLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  hand: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  cardWrapper: {
    marginRight: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  gameOverTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  winnerText: {
    fontSize: fontSize.lg,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  finalScores: {
    marginBottom: spacing.lg,
  },
  finalScoresTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  scoreRow: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
  },
  winnerScore: {
    color: colors.success,
    fontWeight: fontWeight.bold,
  },
  waitingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
