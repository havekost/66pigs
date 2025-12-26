import { Card, TableRow, GameState, Player } from '../types';

// Special cards that have -11 pig value (good for players!)
const SPECIAL_DOUBLES = [11, 22, 33, 44, 55, 66, 77, 88, 99];

/**
 * Calculate the pig value of a card
 * Modified from 6 Nimmt! rules:
 * - Cards 11, 22, 33, 44, 55, 66, 77, 88, 99 = -11 pigs (beneficial!)
 * - Cards ending in 5 = 2 pigs
 * - Cards ending in 0 = 3 pigs
 * - Other cards = 1 pig
 */
export const calculatePigValue = (cardNumber: number): number => {
  if (SPECIAL_DOUBLES.includes(cardNumber)) {
    return -11;
  }
  if (cardNumber % 10 === 5) {
    return 2;
  }
  if (cardNumber % 10 === 0) {
    return 3;
  }
  return 1;
};

/**
 * Create a deck of 104 cards numbered 1-104
 */
export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (let i = 1; i <= 104; i++) {
    deck.push({
      number: i,
      pigs: calculatePigValue(i),
    });
  }
  return deck;
};

/**
 * Shuffle the deck using Fisher-Yates algorithm
 */
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Deal cards to players (10 cards each)
 */
export const dealCards = (deck: Card[], numPlayers: number): { hands: Card[][]; remainingDeck: Card[] } => {
  const hands: Card[][] = [];
  let deckIndex = 0;

  for (let p = 0; p < numPlayers; p++) {
    const hand: Card[] = [];
    for (let c = 0; c < 10; c++) {
      hand.push(deck[deckIndex]);
      deckIndex++;
    }
    // Sort hand by card number
    hand.sort((a, b) => a.number - b.number);
    hands.push(hand);
  }

  return {
    hands,
    remainingDeck: deck.slice(deckIndex),
  };
};

/**
 * Initialize the 4 table rows with one card each
 */
export const initializeTableRows = (deck: Card[]): { rows: TableRow[]; remainingDeck: Card[] } => {
  const rows: TableRow[] = [];
  for (let i = 0; i < 4; i++) {
    rows.push({ cards: [deck[i]] });
  }
  // Sort rows by the starting card number
  rows.sort((a, b) => a.cards[0].number - b.cards[0].number);

  return {
    rows,
    remainingDeck: deck.slice(4),
  };
};

/**
 * Find which row a card should be placed in
 * Returns the row index, or -1 if card is lower than all row ends
 */
export const findRowForCard = (card: Card, rows: TableRow[]): number => {
  let bestRowIndex = -1;
  let smallestDifference = Infinity;

  for (let i = 0; i < rows.length; i++) {
    const lastCard = rows[i].cards[rows[i].cards.length - 1];
    // Card must be higher than the last card in the row
    if (card.number > lastCard.number) {
      const difference = card.number - lastCard.number;
      if (difference < smallestDifference) {
        smallestDifference = difference;
        bestRowIndex = i;
      }
    }
  }

  return bestRowIndex;
};

/**
 * Calculate total pigs in a row (for when player takes the row)
 */
export const calculateRowPigs = (row: TableRow): number => {
  return row.cards.reduce((sum, card) => sum + card.pigs, 0);
};

/**
 * Place a card in a row
 * If the row already has 5 cards, the player takes all 5 cards and their pigs
 * Returns the pigs taken (0 if card was just placed)
 */
export const placeCardInRow = (
  card: Card,
  rowIndex: number,
  rows: TableRow[]
): { newRows: TableRow[]; pigsTaken: number; cardsTaken: Card[] } => {
  const newRows = rows.map((row) => ({ cards: [...row.cards] }));
  const targetRow = newRows[rowIndex];

  // If row has 5 cards, player takes them all
  if (targetRow.cards.length >= 5) {
    const pigsTaken = calculateRowPigs(targetRow);
    const cardsTaken = [...targetRow.cards];
    // Replace row with just the new card
    newRows[rowIndex] = { cards: [card] };
    return { newRows, pigsTaken, cardsTaken };
  }

  // Otherwise, just add the card to the row
  targetRow.cards.push(card);
  return { newRows, pigsTaken: 0, cardsTaken: [] };
};

/**
 * Player must take a row when their card is lower than all row ends
 * Returns the smallest row (least pigs) by default, but player can choose
 */
export const findSmallestRow = (rows: TableRow[]): number => {
  let smallestIndex = 0;
  let smallestPigs = calculateRowPigs(rows[0]);

  for (let i = 1; i < rows.length; i++) {
    const pigs = calculateRowPigs(rows[i]);
    if (pigs < smallestPigs) {
      smallestPigs = pigs;
      smallestIndex = i;
    }
  }

  return smallestIndex;
};

/**
 * Take a row and replace it with the player's card
 */
export const takeRow = (
  card: Card,
  rowIndex: number,
  rows: TableRow[]
): { newRows: TableRow[]; pigsTaken: number; cardsTaken: Card[] } => {
  const newRows = rows.map((row) => ({ cards: [...row.cards] }));
  const pigsTaken = calculateRowPigs(newRows[rowIndex]);
  const cardsTaken = [...newRows[rowIndex].cards];

  // Replace the row with just the new card
  newRows[rowIndex] = { cards: [card] };

  return { newRows, pigsTaken, cardsTaken };
};

/**
 * Sort revealed cards by number (lowest first for placement order)
 */
export const sortRevealedCards = <T extends { card: Card }>(
  revealed: T[]
): T[] => {
  return [...revealed].sort((a, b) => a.card.number - b.card.number);
};

/**
 * Check if game is over (any player reached 66 pigs)
 */
export const isGameOver = (players: Player[]): boolean => {
  return players.some((player) => player.score >= 66);
};

/**
 * Get winner (player with lowest score)
 */
export const getWinner = (players: Player[]): Player => {
  return players.reduce((winner, player) =>
    player.score < winner.score ? player : winner
  );
};

/**
 * Check if round is complete (all players have played their cards)
 */
export const isRoundComplete = (players: Player[]): boolean => {
  return players.every((player) => player.hand.length === 0);
};

/**
 * Initialize a new game state
 */
export const initializeGame = (numPlayers: number): {
  gameState: GameState;
  hands: Card[][];
} => {
  let deck = createDeck();
  deck = shuffleDeck(deck);

  // Initialize 4 rows with one card each
  const { rows, remainingDeck } = initializeTableRows(deck);

  // Deal 10 cards to each player
  const { hands } = dealCards(remainingDeck, numPlayers);

  const gameState: GameState = {
    phase: 'selecting',
    round: 1,
    tableRows: rows,
    currentPlayerIndex: 0,
    revealedCards: [],
    pendingPlacements: [],
    lastAction: null,
  };

  return { gameState, hands };
};

/**
 * Start a new round while keeping the existing table rows
 * This is called at the end of a round when all hands are empty
 */
export const startNewRound = (
  numPlayers: number,
  existingRows: TableRow[]
): {
  hands: Card[][];
  cardsOnTable: number[];
} => {
  // Get all card numbers currently on the table
  const cardsOnTable: number[] = [];
  for (const row of existingRows) {
    for (const card of row.cards) {
      cardsOnTable.push(card.number);
    }
  }

  // Create a deck excluding cards already on the table
  let deck = createDeck().filter(card => !cardsOnTable.includes(card.number));
  deck = shuffleDeck(deck);

  // Deal 10 cards to each player
  const { hands } = dealCards(deck, numPlayers);

  return { hands, cardsOnTable };
};
