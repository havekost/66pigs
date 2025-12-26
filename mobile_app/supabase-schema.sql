-- 66 Pigs Supabase Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Lobbies table
CREATE TABLE IF NOT EXISTS lobbies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,
  host_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  game_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lobby players table
CREATE TABLE IF NOT EXISTS lobby_players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  player_id VARCHAR(50) NOT NULL,
  nickname VARCHAR(15) NOT NULL,
  score INTEGER DEFAULT 0,
  hand JSONB DEFAULT '[]'::jsonb,
  selected_card JSONB,
  is_ready BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint to prevent duplicate players in same lobby
  UNIQUE(lobby_id, player_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_lobbies_code ON lobbies(code);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_lobby_players_lobby_id ON lobby_players(lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobby_players_player_id ON lobby_players(player_id);

-- Enable Row Level Security (RLS)
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;

-- Policies for lobbies table
-- Allow anyone to read lobbies
CREATE POLICY "Allow public read access to lobbies"
  ON lobbies
  FOR SELECT
  USING (true);

-- Allow anyone to insert lobbies
CREATE POLICY "Allow public insert access to lobbies"
  ON lobbies
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update lobbies
CREATE POLICY "Allow public update access to lobbies"
  ON lobbies
  FOR UPDATE
  USING (true);

-- Allow anyone to delete lobbies
CREATE POLICY "Allow public delete access to lobbies"
  ON lobbies
  FOR DELETE
  USING (true);

-- Policies for lobby_players table
-- Allow anyone to read lobby players
CREATE POLICY "Allow public read access to lobby_players"
  ON lobby_players
  FOR SELECT
  USING (true);

-- Allow anyone to insert lobby players
CREATE POLICY "Allow public insert access to lobby_players"
  ON lobby_players
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to update lobby players
CREATE POLICY "Allow public update access to lobby_players"
  ON lobby_players
  FOR UPDATE
  USING (true);

-- Allow anyone to delete lobby players
CREATE POLICY "Allow public delete access to lobby_players"
  ON lobby_players
  FOR DELETE
  USING (true);

-- Enable Realtime for both tables
-- You need to do this in the Supabase Dashboard:
-- 1. Go to Database -> Replication
-- 2. Enable realtime for 'lobbies' and 'lobby_players' tables

-- Alternatively, you can run these commands:
ALTER PUBLICATION supabase_realtime ADD TABLE lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE lobby_players;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_lobbies_updated_at ON lobbies;
CREATE TRIGGER update_lobbies_updated_at
  BEFORE UPDATE ON lobbies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Clean up old lobbies (optional - run periodically)
-- DELETE FROM lobbies WHERE created_at < NOW() - INTERVAL '24 hours';

-- Example data cleanup function (can be scheduled with pg_cron)
CREATE OR REPLACE FUNCTION cleanup_old_lobbies()
RETURNS void AS $$
BEGIN
  DELETE FROM lobbies
  WHERE created_at < NOW() - INTERVAL '24 hours'
    AND status = 'finished';
END;
$$ LANGUAGE plpgsql;
