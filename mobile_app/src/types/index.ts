// Player types
export interface Player {
  id: string;
  nickname: string;
  score: number;
  hand: Card[];
  isHost: boolean;
  isReady: boolean;
  selectedCard: Card | null;
}

// Card types
export interface Card {
  number: number;
  pigs: number;
}

// Row on the table
export interface TableRow {
  cards: Card[];
}

// Game state
export type GamePhase = 'waiting' | 'selecting' | 'revealing' | 'placing' | 'row_selection' | 'finished';

export interface RevealedCard {
  playerId: string;
  playerName: string;
  card: Card;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  tableRows: TableRow[];
  currentPlayerIndex: number;
  revealedCards: RevealedCard[];
  pendingPlacements: { playerId: string; card: Card }[];
  lastAction: string | null;
  // For row selection when a player's card is lower than all rows
  pendingRowSelection?: {
    playerId: string;
    playerName: string;
    card: Card;
  } | null;
}

// Lobby types
export type LobbyStatus = 'waiting' | 'playing' | 'finished';

export interface Lobby {
  id: string;
  code: string;
  host_id: string;
  status: LobbyStatus;
  created_at: string;
  game_state: GameState | null;
}

export interface LobbyPlayer {
  id: string;
  lobby_id: string;
  player_id: string;
  nickname: string;
  score: number;
  hand: Card[];
  selected_card: Card | null;
  is_ready: boolean;
  joined_at: string;
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Lobby: { lobbyCode: string; isHost: boolean };
  Game: { lobbyCode: string };
};
