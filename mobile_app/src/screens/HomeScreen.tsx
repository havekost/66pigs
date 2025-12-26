import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Button, Input } from '../components';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/theme';
import { usePlayer } from '../context/PlayerContext';
import { supabase, generateLobbyCode } from '../lib/supabase';
import { RootStackParamList } from '../types';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { playerId, nickname, setNickname, isLoading: isPlayerLoading } = usePlayer();
  const [nicknameInput, setNicknameInput] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [hasSetNickname, setHasSetNickname] = useState(false);

  useEffect(() => {
    if (nickname) {
      setNicknameInput(nickname);
      setHasSetNickname(true);
    }
  }, [nickname]);

  const handleSaveNickname = async () => {
    const trimmedNickname = nicknameInput.trim();
    if (trimmedNickname.length < 2) {
      Alert.alert('Invalid Nickname', 'Nickname must be at least 2 characters long.');
      return;
    }
    if (trimmedNickname.length > 15) {
      Alert.alert('Invalid Nickname', 'Nickname must be 15 characters or less.');
      return;
    }

    try {
      await setNickname(trimmedNickname);
      setHasSetNickname(true);
    } catch {
      Alert.alert('Error', 'Failed to save nickname. Please try again.');
    }
  };

  const handleCreateLobby = async () => {
    if (!hasSetNickname) {
      Alert.alert('Set Nickname', 'Please set your nickname first.');
      return;
    }

    setIsCreating(true);
    try {
      const code = generateLobbyCode();

      // Create lobby in Supabase
      const { error: lobbyError } = await supabase.from('lobbies').insert({
        code,
        host_id: playerId,
        status: 'waiting',
      });

      if (lobbyError) {
        throw lobbyError;
      }

      // Get the created lobby
      const { data: lobby, error: fetchError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', code)
        .single();

      if (fetchError || !lobby) {
        throw fetchError || new Error('Failed to fetch lobby');
      }

      // Add host as first player
      const { error: playerError } = await supabase.from('lobby_players').insert({
        lobby_id: lobby.id,
        player_id: playerId,
        nickname: nickname,
        score: 0,
        hand: [],
        is_ready: true,
      });

      if (playerError) {
        throw playerError;
      }

      navigation.navigate('Lobby', { lobbyCode: code, isHost: true });
    } catch (error) {
      console.error('Error creating lobby:', error);
      Alert.alert('Error', 'Failed to create lobby. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinLobby = async () => {
    if (!hasSetNickname) {
      Alert.alert('Set Nickname', 'Please set your nickname first.');
      return;
    }

    const code = lobbyCode.trim().toUpperCase();
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Lobby code must be 6 characters.');
      return;
    }

    setIsJoining(true);
    try {
      // Find the lobby
      const { data: lobby, error: lobbyError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', code)
        .single();

      if (lobbyError || !lobby) {
        Alert.alert('Not Found', 'Lobby not found. Please check the code and try again.');
        return;
      }

      if (lobby.status !== 'waiting') {
        Alert.alert('Game in Progress', 'This game has already started.');
        return;
      }

      // Check if player is already in the lobby
      const { data: existingPlayer } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', lobby.id)
        .eq('player_id', playerId)
        .single();

      if (!existingPlayer) {
        // Check player count (max 10 players for 6 Nimmt!)
        const { count } = await supabase
          .from('lobby_players')
          .select('*', { count: 'exact', head: true })
          .eq('lobby_id', lobby.id);

        if (count && count >= 10) {
          Alert.alert('Lobby Full', 'This lobby is full (max 10 players).');
          return;
        }

        // Add player to lobby
        const { error: playerError } = await supabase.from('lobby_players').insert({
          lobby_id: lobby.id,
          player_id: playerId,
          nickname: nickname,
          score: 0,
          hand: [],
          is_ready: false,
        });

        if (playerError) {
          throw playerError;
        }
      }

      navigation.navigate('Lobby', { lobbyCode: code, isHost: lobby.host_id === playerId });
    } catch (error) {
      console.error('Error joining lobby:', error);
      Alert.alert('Error', 'Failed to join lobby. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handlePasteCode = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setLobbyCode(text.toUpperCase().slice(0, 6));
      }
    } catch {
      // Clipboard access might be denied
    }
  };

  if (isPlayerLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🐷 Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🐷 66 Pigs 🐷</Text>
            <Text style={styles.subtitle}>A pig-tastic card game!</Text>
          </View>

          {/* Nickname Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Nickname</Text>
            <View style={styles.nicknameRow}>
              <View style={styles.nicknameInputContainer}>
                <Input
                  value={nicknameInput}
                  onChangeText={setNicknameInput}
                  placeholder="Enter your nickname"
                  maxLength={15}
                  autoCapitalize="words"
                />
              </View>
              <Button
                title={hasSetNickname ? '✓' : 'Save'}
                onPress={handleSaveNickname}
                variant={hasSetNickname ? 'secondary' : 'primary'}
                size="md"
                style={styles.saveButton}
              />
            </View>
            {hasSetNickname && (
              <Text style={styles.nicknameConfirm}>
                Playing as: {nickname} 🐽
              </Text>
            )}
          </View>

          {/* Create Lobby Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Create a Game</Text>
            <Button
              title="Create New Lobby"
              onPress={handleCreateLobby}
              variant="primary"
              size="lg"
              loading={isCreating}
              disabled={!hasSetNickname}
            />
            <Text style={styles.helperText}>
              Create a lobby and invite your friends!
            </Text>
          </View>

          {/* Join Lobby Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Join a Game</Text>
            <View style={styles.joinRow}>
              <View style={styles.codeInputContainer}>
                <Input
                  value={lobbyCode}
                  onChangeText={(text) => setLobbyCode(text.toUpperCase())}
                  placeholder="Enter 6-letter code"
                  maxLength={6}
                  autoCapitalize="characters"
                />
              </View>
              <Button
                title="📋"
                onPress={handlePasteCode}
                variant="outline"
                size="md"
                style={styles.pasteButton}
              />
            </View>
            <Button
              title="Join Lobby"
              onPress={handleJoinLobby}
              variant="secondary"
              size="lg"
              loading={isJoining}
              disabled={!hasSetNickname || lobbyCode.length !== 6}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              2-10 players • Based on 6 Nimmt!
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.xl,
    color: colors.primary,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  title: {
    fontSize: fontSize.giant,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
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
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nicknameInputContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.xs,
  },
  nicknameConfirm: {
    fontSize: fontSize.sm,
    color: colors.success,
    marginTop: spacing.xs,
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  codeInputContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  pasteButton: {
    marginTop: spacing.xs,
  },
  helperText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.textLight,
  },
});
