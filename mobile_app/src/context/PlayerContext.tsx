import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generatePlayerId } from '../lib/supabase';

interface PlayerContextType {
  playerId: string;
  nickname: string;
  setNickname: (name: string) => Promise<void>;
  isLoading: boolean;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const PLAYER_ID_KEY = '@66pigs_player_id';
const NICKNAME_KEY = '@66pigs_nickname';

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [playerId, setPlayerId] = useState<string>('');
  const [nickname, setNicknameState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPlayerData();
  }, []);

  const loadPlayerData = async () => {
    try {
      // Load or create player ID
      let storedPlayerId = await AsyncStorage.getItem(PLAYER_ID_KEY);
      if (!storedPlayerId) {
        storedPlayerId = generatePlayerId();
        await AsyncStorage.setItem(PLAYER_ID_KEY, storedPlayerId);
      }
      setPlayerId(storedPlayerId);

      // Load nickname
      const storedNickname = await AsyncStorage.getItem(NICKNAME_KEY);
      if (storedNickname) {
        setNicknameState(storedNickname);
      }
    } catch (error) {
      console.error('Error loading player data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setNickname = async (name: string) => {
    try {
      await AsyncStorage.setItem(NICKNAME_KEY, name);
      setNicknameState(name);
    } catch (error) {
      console.error('Error saving nickname:', error);
      throw error;
    }
  };

  return (
    <PlayerContext.Provider value={{ playerId, nickname, setNickname, isLoading }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
