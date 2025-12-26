# 66 Pigs 🐷

A fun multiplayer card game app based on 6 Nimmt! Built with React Native and Expo.

## Game Overview

66 Pigs is a multiplayer card game for 2-10 players. The game uses 104 cards numbered 1-104. Each card has a pig value:

- **Regular cards**: 1 pig
- **Cards ending in 5**: 2 pigs (5, 15, 25, etc.)
- **Cards ending in 0**: 3 pigs (10, 20, 30, etc.)
- **Special doubles (11, 22, 33, 44, 55, 66, 77, 88, 99)**: -11 pigs! ✨

The goal is to avoid collecting pigs. First player to reach 66 pigs loses!

## How to Play

1. **Setup**: Each player gets 10 cards. 4 cards are placed on the table to start 4 rows.
2. **Selection**: All players secretly select one card from their hand.
3. **Reveal & Place**: Cards are revealed and placed in order from lowest to highest:
   - Each card goes to the row where it's closest above the last card
   - If a card is the 6th in a row, the player takes all 5 previous cards and their pigs!
   - If a card is lower than all row ends, the player must take one complete row
4. **Win/Lose**: When someone reaches 66 pigs, the game ends. Lowest score wins!

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo Go app on your iOS/Android device
- Supabase account

### 1. Install Dependencies

```bash
cd mobile_app
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Enable Realtime for the `lobbies` and `lobby_players` tables:
   - Go to Database → Replication
   - Enable realtime for both tables

### 3. Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 4. Run the App

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone.

## Project Structure

```
mobile_app/
├── App.tsx              # Main app entry point with navigation
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── GameCard.tsx
│   │   ├── PlayerCard.tsx
│   │   ├── TableRow.tsx
│   │   └── PigIcon.tsx
│   ├── screens/         # App screens
│   │   ├── HomeScreen.tsx    # Nickname & lobby join/create
│   │   ├── LobbyScreen.tsx   # Waiting room
│   │   └── GameScreen.tsx    # Main game
│   ├── context/         # React context providers
│   │   └── PlayerContext.tsx
│   ├── lib/             # Library configurations
│   │   ├── supabase.ts  # Supabase client
│   │   └── theme.ts     # App theme/colors
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts
│   └── utils/           # Utility functions
│       └── gameLogic.ts # Game rules implementation
├── supabase-schema.sql  # Database schema
└── .env.example         # Environment template
```

## Features

- ✅ Set nickname and persist locally
- ✅ Create game lobbies with unique 6-character codes
- ✅ Join lobbies using shared codes
- ✅ Real-time multiplayer using Supabase Realtime
- ✅ Full 6 Nimmt! game logic with modified pig values
- ✅ Beautiful, kid-friendly UI
- ✅ Game over detection and winner announcement

## Tech Stack

- **React Native** with Expo
- **TypeScript**
- **React Navigation** for screen navigation
- **Supabase** for backend:
  - PostgreSQL database
  - Realtime subscriptions for multiplayer
- **AsyncStorage** for local persistence

## License

MIT
