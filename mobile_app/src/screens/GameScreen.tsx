import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  Animated,
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
  RevealedCard,
} from '../types';
import {
  findRowForCard,
  placeCardInRow,
  takeRow,
  sortRevealedCards,
  isGameOver,
  getWinner,
  initializeGame,
  startNewRound,
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
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const [localRevealedCards, setLocalRevealedCards] = useState<RevealedCard[]>([]);

  // Animation values for revealed cards
  const cardAnimations = useRef<Animated.Value[]>([]).current;

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

      if (lobbyError) {
        console.error('Error fetching lobby:', lobbyError);
        // Don't immediately navigate away on error - could be temporary network issue
        if (lobbyError.code === 'PGRST116') {
          // No rows found - lobby actually doesn't exist
          Alert.alert('Game Not Found', 'This game no longer exists.');
          navigation.goBack();
        } else {
          // Network or other error - show message but don't navigate away
          Alert.alert('Connection Error', 'Unable to connect to the game. Please check your connection and try again.');
        }
        return;
      }

      if (!lobbyData) {
        Alert.alert('Game Not Found', 'This game no longer exists.');
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
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      // First fetch initial data
      await fetchGameData();

      // Get lobby ID for filtering
      const { data: lobbyData } = await supabase
        .from('lobbies')
        .select('id')
        .eq('code', lobbyCode)
        .single();

      if (!lobbyData) return;

      // Set up subscription with proper filters
      channel = supabase
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
            filter: `lobby_id=eq.${lobbyData.id}`,
          },
          () => {
            fetchGameData();
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [lobbyCode, fetchGameData]);

  // Check if all players have selected cards
  useEffect(() => {
    const checkAllSelected = async () => {
      // Guard: Need valid state and at least 2 players loaded
      if (!gameState || !lobby || gameState.phase !== 'selecting') return;
      if (players.length < 2) return; // Prevent processing before players are loaded

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

  // Start the reveal phase - show all cards first, then place them after 5 seconds
  const processRevealAndPlace = async () => {
    if (!lobby || !gameState || isProcessing) return;

    // Additional guard: ensure we have valid players data
    if (players.length < 2) {
      console.warn('processRevealAndPlace called with insufficient players');
      return;
    }

    setIsProcessing(true);

    try {
      // Get all selected cards with player names
      const revealed: RevealedCard[] = players
        .filter((p) => p.selected_card)
        .map((p) => ({
          playerId: p.player_id,
          playerName: p.nickname,
          card: p.selected_card as Card,
        }));

      // Sort by card number (lowest first)
      const sorted = sortRevealedCards(revealed) as RevealedCard[];

      // Update game state to revealing phase with the revealed cards
      const revealingState: GameState = {
        ...gameState,
        phase: 'revealing',
        revealedCards: sorted,
      };

      await supabase
        .from('lobbies')
        .update({ game_state: revealingState })
        .eq('id', lobby.id);

      // Store revealed cards locally for display
      setLocalRevealedCards(sorted);

      // Start countdown
      setRevealCountdown(5);

      // Wait 5 seconds before placing cards
      await new Promise<void>((resolve) => {
        let countdown = 5;
        const interval = setInterval(() => {
          countdown--;
          setRevealCountdown(countdown);
          if (countdown <= 0) {
            clearInterval(interval);
            setRevealCountdown(null);
            resolve();
          }
        }, 1000);
      });

      // Now process the card placements
      await processCardPlacements(sorted);

    } catch (error) {
      console.error('Error processing cards:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process card placements after reveal phase
  const processCardPlacements = async (sorted: RevealedCard[]) => {
    if (!lobby || !gameState) return;

    let currentRows = [...gameState.tableRows];
    const playerScoreUpdates: { [playerId: string]: number } = {};
    const cardsNeedingRowSelection: RevealedCard[] = [];

    // First pass: identify cards that need row selection and place normal cards
    for (const revealedCard of sorted) {
      const { playerId: pid, card } = revealedCard;
      const rowIndex = findRowForCard(card, currentRows);

      if (rowIndex === -1) {
        // Card is lower than all rows - player must choose a row
        cardsNeedingRowSelection.push(revealedCard);
      } else {
        // Place card in the appropriate row
        const { newRows, pigsTaken } = placeCardInRow(card, rowIndex, currentRows);
        currentRows = newRows;
        if (pigsTaken !== 0) {
          playerScoreUpdates[pid] = (playerScoreUpdates[pid] || 0) + pigsTaken;
        }
      }
    }

    // Handle cards that need row selection one by one
    for (const revealedCard of cardsNeedingRowSelection) {
      const { playerId: pid, playerName, card } = revealedCard;

      if (pid === playerId) {
        // Current player needs to select a row
        setPendingCard(card);

        // Update game state to row_selection phase
        const rowSelectionState: GameState = {
          ...gameState,
          phase: 'row_selection',
          tableRows: currentRows,
          pendingRowSelection: { playerId: pid, playerName, card },
        };

        await supabase
          .from('lobbies')
          .update({ game_state: rowSelectionState })
          .eq('id', lobby.id);

        setShowRowSelection(true);

        // Wait for player to select a row
        const selectedRowIndex = await waitForRowSelection();

        const { newRows, pigsTaken } = takeRow(card, selectedRowIndex, currentRows);
        currentRows = newRows;
        playerScoreUpdates[pid] = (playerScoreUpdates[pid] || 0) + pigsTaken;

        setShowRowSelection(false);
        setPendingCard(null);
      } else {
        // Another player needs to select - for now, auto-select smallest row
        // In a full implementation, you'd wait for that player's selection via realtime
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
    const allHandsEmpty = players.length > 0 && players.every(
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
        pendingRowSelection: null,
      };
    } else if (allHandsEmpty) {
      // Start a new round - KEEP THE EXISTING TABLE ROWS
      const { hands } = startNewRound(players.length, currentRows);

      newGameState = {
        phase: 'selecting',
        round: gameState.round + 1,
        tableRows: currentRows, // Keep existing rows!
        currentPlayerIndex: 0,
        revealedCards: [],
        pendingPlacements: [],
        lastAction: null,
        pendingRowSelection: null,
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
        pendingRowSelection: null,
      };
    }

    // Update game state
    await supabase
      .from('lobbies')
      .update({ game_state: newGameState })
      .eq('id', lobby.id);

    setSelectedCard(null);
    setLocalRevealedCards([]);
  };

  // Helper to wait for row selection
  const rowSelectionResolver = useRef<((index: number) => void) | null>(null);

  const waitForRowSelection = (): Promise<number> => {
    return new Promise((resolve) => {
      rowSelectionResolver.current = resolve;
    });
  };

  const handleSelectRow = (rowIndex: number) => {
    if (!pendingCard) return;

    // If we have a resolver waiting, use it (new flow)
    if (rowSelectionResolver.current) {
      rowSelectionResolver.current(rowIndex);
      rowSelectionResolver.current = null;
      return;
    }

    // Fallback for legacy flow (shouldn't be needed but kept for safety)
    console.warn('handleSelectRow called without resolver');
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

      {/* Revealed Cards Display - Show during revealing phase */}
      {(gameState?.phase === 'revealing' || localRevealedCards.length > 0) && (
        <View style={styles.revealedCardsContainer}>
          <View style={styles.revealedCardsHeader}>
            <Text style={styles.revealedCardsTitle}>Cards Revealed!</Text>
            {revealCountdown !== null && (
              <Text style={styles.countdownText}>
                Placing in {revealCountdown}...
              </Text>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.revealedCardsContent}
          >
            {(localRevealedCards.length > 0 ? localRevealedCards : gameState?.revealedCards || []).map((revealed, index) => (
              <View key={revealed.card.number} style={styles.revealedCardWrapper}>
                <GameCard
                  card={revealed.card}
                  size="md"
                  disabled
                />
                <Text style={styles.revealedCardPlayerName}>
                  {revealed.playerName}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

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
          {gameState?.phase === 'revealing' && (
            <Text style={styles.statusText}>
              Cards are being revealed! Watch the cards above...
            </Text>
          )}
          {gameState?.phase === 'row_selection' && gameState.pendingRowSelection && (
            <Text style={styles.statusText}>
              {gameState.pendingRowSelection.playerId === playerId
                ? 'Choose a row to take!'
                : `${gameState.pendingRowSelection.playerName} is choosing a row...`}
            </Text>
          )}
          {gameState?.phase === 'selecting' && (
            <Text style={styles.selectedCount}>
              {playersWhoSelected}/{players.length} players ready
            </Text>
          )}
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
  revealedCardsContainer: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.accentDark,
  },
  revealedCardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  revealedCardsTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
  },
  countdownText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  revealedCardsContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  revealedCardWrapper: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  revealedCardPlayerName: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    textAlign: 'center',
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
