import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Image,
  Animated,
  RefreshControl,
  StatusBar,
  SafeAreaView,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { collection, addDoc, onSnapshot, query, orderBy, where, updateDoc, doc, getDoc, getDocs, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

// Define navigation types
type MyGroupSportsNavigationProp = NativeStackNavigationProp<{
  SportsPlace: undefined;
  MyGroupSports: { groupId: string };
}>;

type MyGroupSportsRouteProp = RouteProp<{
  MyGroupSports: { groupId: string };
}, 'MyGroupSports'>;

// Firebase Console Action: 
// 1. Create Firestore collections: 'match_results', 'group_chats', 'match_stats'
// 2. Create composite indexes:
//    - Collection: 'group_chats' | Fields: groupId (Ascending), timestamp (Descending)
//    - Collection: 'match_results' | Fields: groupId (Ascending), createdAt (Descending)
// 3. Or use these direct links:
//    - https://console.firebase.google.com/v1/r/project/yogo-campus/firestore/indexes
// 4. Set Firestore rules to allow read/write access for authenticated users

const { width, height } = Dimensions.get('window');

// TypeScript Interfaces
interface SportsGroup {
  id: string;
  sport: string;
  title: string;
  description: string;
  createdBy: string;
  creatorName: string;
  maxPlayers: number;
  currentPlayers: number;
  players: Player[];
  skillLevel: 'beginner' | 'amateur' | 'intermediate' | 'professional';
  dateTime: string;
  duration: number;
  location: string;
  status: 'open' | 'full' | 'active' | 'completed';
  createdAt: number;
}

interface Player {
  id: string;
  name: string;
  avatar?: string;
  level: string;
  rating: number;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  type: 'text' | 'system';
}

interface MatchResult {
  id: string;
  groupId: string;
  sport: string;
  matchData: any; // Sport-specific data
  createdBy: string;
  createdAt: number;
  verified: boolean;
}

interface ScoreboardData {
  sport: string;
  matchData: any;
  summary: {
    winner: string;
    duration: string;
    location: string;
    players: string[];
    highlights: string[];
  };
}

const SPORTS = [
  { id: 'basketball', name: 'Basketball', icon: 'basketball', color: ['#FF6B35', '#F7931E'] as const },
  { id: 'badminton', name: 'Badminton', icon: 'badminton', color: ['#4ECDC4', '#44A08D'] as const },
  { id: 'swimming', name: 'Swimming', icon: 'swimmer', color: ['#667eea', '#764ba2'] as const },
  { id: 'tennis', name: 'Tennis', icon: 'tennis', color: ['#fdbb2d', '#22c1c3'] as const },
  { id: 'football', name: 'Football', icon: 'football', color: ['#56ab2f', '#a8e6cf'] as const },
  { id: 'hockey', name: 'Hockey', icon: 'hockey-puck', color: ['#e96443', '#904e95'] as const },
  { id: 'cricket', name: 'Cricket', icon: 'cricket', color: ['#FF8008', '#FFC837'] as const },
];

const MyGroupSports: React.FC = () => {
  const navigation = useNavigation<MyGroupSportsNavigationProp>();
  const route = useRoute<MyGroupSportsRouteProp>();
  const { groupId } = route.params;

  console.log('MyGroupSports loaded with groupId:', groupId);

  // State management
  const [group, setGroup] = useState<SportsGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'results'>('details');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showMatchResultModal, setShowMatchResultModal] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [scoreboardData, setScoreboardData] = useState<ScoreboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Match result form states
  const [matchFormData, setMatchFormData] = useState<any>({});

  useEffect(() => {
    console.log('MyGroupSports mounted with groupId:', groupId);
    loadGroupDetails();
    loadChatMessages();
    loadMatchResults();
  }, [groupId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadGroupDetails();
    loadChatMessages();
    loadMatchResults();
    setRefreshing(false);
  };

  const loadGroupDetails = async () => {
    try {
      console.log('Loading group details for groupId:', groupId);
      const groupDoc = await getDoc(doc(db, 'sports_groups', groupId));
      if (groupDoc.exists()) {
        const groupData = { id: groupDoc.id, ...groupDoc.data() } as SportsGroup;
        console.log('Group data loaded:', groupData);
        setGroup(groupData);
      } else {
        console.log('Group not found for groupId:', groupId);
        Alert.alert('Error', 'Group not found');
      }
    } catch (error) {
      console.error('Error loading group details:', error);
      Alert.alert('Error', 'Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  const loadChatMessages = () => {
    // Firebase Console Action: Create composite index for 'group_chats' collection:
    // Fields: groupId (Ascending), timestamp (Descending)
    // Or use the provided URL: https://console.firebase.google.com/v1/r/project/yogo-campus/firestore/indexes
    
    const chatQuery = query(
      collection(db, 'group_chats'),
      where('groupId', '==', groupId)
    );
    
    const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      
      // Sort messages by timestamp in JavaScript instead of Firestore
      const sortedMessages = messages.sort((a, b) => b.timestamp - a.timestamp);
      setChatMessages(sortedMessages.reverse());
    }, (error) => {
      console.error('Error loading chat messages:', error);
      Alert.alert('Error', 'Failed to load chat messages. Please check your internet connection.');
    });

    return unsubscribe;
  };

  const loadMatchResults = () => {
    // Firebase Console Action: Create composite index for 'match_results' collection:
    // Fields: groupId (Ascending), createdAt (Descending)
    // Or use the provided URL: https://console.firebase.google.com/v1/r/project/yogo-campus/firestore/indexes
    
    const resultsQuery = query(
      collection(db, 'match_results'),
      where('groupId', '==', groupId)
    );
    
    const unsubscribe = onSnapshot(resultsQuery, (snapshot) => {
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MatchResult[];
      
      // Sort results by createdAt in JavaScript instead of Firestore
      const sortedResults = results.sort((a, b) => b.createdAt - a.createdAt);
      setMatchResults(sortedResults);
    }, (error) => {
      console.error('Error loading match results:', error);
      Alert.alert('Error', 'Failed to load match results. Please check your internet connection.');
    });

    return unsubscribe;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !group) return;

    try {
      await addDoc(collection(db, 'group_chats'), {
        groupId: groupId,
        userId: 'currentUser', // Replace with actual user ID
        userName: 'Current User', // Replace with actual user name
        message: newMessage.trim(),
        timestamp: Date.now(),
        type: 'text'
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const submitMatchResult = async (resultData: any) => {
    if (!group) return;

    try {
      const matchResult = {
        groupId: groupId,
        sport: group.sport,
        matchData: resultData,
        createdBy: 'currentUser', // Replace with actual user ID
        createdAt: Date.now(),
        verified: false
      };

      await addDoc(collection(db, 'match_results'), matchResult);
      
      // Generate scoreboard data
      const scoreboard = generateScoreboardData(group.sport, resultData);
      setScoreboardData(scoreboard);
      setShowMatchResultModal(false);
      setShowScorecard(true);
      
      // Update player stats in leaderboard
      await updateLeaderboardStats(group.sport, resultData);
      
      Alert.alert('Success', 'Match result submitted successfully!');
    } catch (error) {
      console.error('Error submitting match result:', error);
      Alert.alert('Error', 'Failed to submit match result');
    }
  };

  const updateLeaderboardStats = async (sport: string, matchData: any) => {
    try {
      // Get leaderboard for this sport
      const leaderboardRef = collection(db, 'sports_leaderboard');
      const q = query(leaderboardRef, where('sport', '==', sport));
      const querySnapshot = await getDocs(q);
      
      let leaderboardId = '';
      let leaderboardData: any = null;
      
      if (querySnapshot.empty) {
        // Create new leaderboard if it doesn't exist
        const newLeaderboardRef = await addDoc(leaderboardRef, {
          sport: sport,
          players: [],
          lastUpdated: Date.now()
        });
        leaderboardId = newLeaderboardRef.id;
      } else {
        // Use existing leaderboard
        const leaderboardDoc = querySnapshot.docs[0];
        leaderboardId = leaderboardDoc.id;
        leaderboardData = leaderboardDoc.data();
      }
      
      // Calculate individual scores based on sport and match data
      const playerScores = calculateIndividualScores(sport, matchData, group!.players);
      
      // Update stats for all players in the group
      for (const player of group!.players) {
        // Check if player is already in leaderboard
        let playerData = leaderboardData?.players?.find((p: any) => p.id === player.id);
        
        if (!playerData) {
          // Add new player to leaderboard
          playerData = {
            id: player.id,
            name: player.name,
            points: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            streak: 0,
            bestStreak: 0,
            level: player.level,
            badges: [],
            totalMatches: 0,
            averageScore: 0,
            totalScore: 0
          };
        }
        
        const playerScore = playerScores.find(p => p.playerId === player.id);
        if (playerScore) {
          // Update basic stats
          playerData.totalMatches += 1;
          playerData.totalScore += playerScore.score;
          playerData.averageScore = Math.round(playerData.totalScore / playerData.totalMatches);
          
          // Update win/loss/draw stats
          if (playerScore.result === 'win') {
            playerData.wins += 1;
            playerData.streak += 1;
            playerData.points += playerScore.points;
          } else if (playerScore.result === 'loss') {
            playerData.losses += 1;
            playerData.streak = 0;
            playerData.points += playerScore.points;
          } else {
            playerData.draws += 1;
            playerData.points += playerScore.points;
          }
          
          // Update best streak
          if (playerData.streak > playerData.bestStreak) {
            playerData.bestStreak = playerData.streak;
          }
          
          // Check for badges
          checkAndAwardBadges(playerData);
        }
        
        // Update player in leaderboard
        const leaderboardRef = doc(db, 'sports_leaderboard', leaderboardId);
        await updateDoc(leaderboardRef, {
          players: leaderboardData?.players ? 
            [...leaderboardData.players.filter((p: any) => p.id !== player.id), playerData] : 
            [playerData],
          lastUpdated: Date.now()
        });
      }
    } catch (error) {
      console.error('Error updating leaderboard stats:', error);
    }
  };

  const calculateIndividualScores = (sport: string, matchData: any, players: Player[]) => {
    const playerScores: Array<{
      playerId: string;
      score: number;
      points: number;
      result: 'win' | 'loss' | 'draw';
      performance: any;
    }> = [];

    switch (sport) {
      case 'basketball':
        return calculateBasketballScores(matchData, players);
      case 'badminton':
        return calculateBadmintonScores(matchData, players);
      case 'swimming':
        return calculateSwimmingScores(matchData, players);
      case 'tennis':
        return calculateTennisScores(matchData, players);
      case 'football':
        return calculateFootballScores(matchData, players);
      case 'hockey':
        return calculateHockeyScores(matchData, players);
      case 'cricket':
        return calculateCricketScores(matchData, players);
      default:
        return [];
    }
  };

  const calculateBasketballScores = (matchData: any, players: Player[]) => {
    const team1Won = parseInt(matchData.team1Score) > parseInt(matchData.team2Score);
    const team2Won = parseInt(matchData.team2Score) > parseInt(matchData.team1Score);
    const isDraw = parseInt(matchData.team1Score) === parseInt(matchData.team2Score);
    
    // Split players into teams (simplified - in real app you'd have team assignments)
    const team1Players = players.slice(0, Math.ceil(players.length / 2));
    const team2Players = players.slice(Math.ceil(players.length / 2));
    
    const playerScores = [];
    
    // Team 1 players
    for (const player of team1Players) {
      let baseScore = 50; // Base participation score
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (team1Won) {
        baseScore += 100; // Win bonus
        points = 15;
        result = 'win';
      } else if (team2Won) {
        baseScore += 20; // Loss consolation
        points = 5;
        result = 'loss';
      } else {
        baseScore += 60; // Draw bonus
        points = 10;
        result = 'draw';
      }
      
      // MVP bonus
      if (matchData.mvp === player.name) {
        baseScore += 50;
        points += 10;
      }
      
      // Performance bonuses
      if (matchData.totalAssists) baseScore += parseInt(matchData.totalAssists) * 2;
      if (matchData.totalRebounds) baseScore += parseInt(matchData.totalRebounds) * 1.5;
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          assists: matchData.totalAssists || 0,
          rebounds: matchData.totalRebounds || 0,
          mvp: matchData.mvp === player.name
        }
      });
    }
    
    // Team 2 players
    for (const player of team2Players) {
      let baseScore = 50;
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (team2Won) {
        baseScore += 100;
        points = 15;
        result = 'win';
      } else if (team1Won) {
        baseScore += 20;
        points = 5;
        result = 'loss';
      } else {
        baseScore += 60;
        points = 10;
        result = 'draw';
      }
      
      if (matchData.mvp === player.name) {
        baseScore += 50;
        points += 10;
      }
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          assists: matchData.totalAssists || 0,
          rebounds: matchData.totalRebounds || 0,
          mvp: matchData.mvp === player.name
        }
      });
    }
    
    return playerScores;
  };

  const calculateBadmintonScores = (matchData: any, players: Player[]) => {
    const winner = matchData.winner;
    const isDraw = !winner || winner === 'Draw';
    
    const playerScores = [];
    
    for (const player of players) {
      let baseScore = 30;
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (winner === player.name) {
        baseScore += 120;
        points = 20;
        result = 'win';
      } else if (!isDraw) {
        baseScore += 40;
        points = 8;
        result = 'loss';
      } else {
        baseScore += 80;
        points = 12;
        result = 'draw';
      }
      
      // Performance bonuses
      if (matchData.rallies) baseScore += parseInt(matchData.rallies) * 0.5;
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          rallies: matchData.rallies || 0,
          winner: winner === player.name
        }
      });
    }
    
    return playerScores;
  };

  const calculateSwimmingScores = (matchData: any, players: Player[]) => {
    const playerScores = [];
    
    for (const player of players) {
      let baseScore = 40;
      let points = 10;
      
      // Distance bonus
      if (matchData.distance) {
        const distance = parseInt(matchData.distance.replace(/\D/g, ''));
        baseScore += distance * 0.1;
      }
      
      // Time bonus (faster = more points)
      if (matchData.timeTaken) {
        const timeInMinutes = parseFloat(matchData.timeTaken);
        if (timeInMinutes < 10) baseScore += 50;
        else if (timeInMinutes < 20) baseScore += 30;
        else if (timeInMinutes < 30) baseScore += 20;
      }
      
      // Laps bonus
      if (matchData.laps) baseScore += parseInt(matchData.laps) * 2;
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result: 'win' as 'win' | 'loss' | 'draw', // Swimming is individual
        performance: {
          distance: matchData.distance || 0,
          time: matchData.timeTaken || 0,
          laps: matchData.laps || 0
        }
      });
    }
    
    return playerScores;
  };

  const calculateTennisScores = (matchData: any, players: Player[]) => {
    const winner = matchData.winner;
    const isDraw = !winner || winner === 'Draw';
    
    const playerScores = [];
    
    for (const player of players) {
      let baseScore = 35;
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (winner === player.name) {
        baseScore += 110;
        points = 18;
        result = 'win';
      } else if (!isDraw) {
        baseScore += 45;
        points = 7;
        result = 'loss';
      } else {
        baseScore += 75;
        points = 12;
        result = 'draw';
      }
      
      // Performance bonuses
      if (matchData.aces) baseScore += parseInt(matchData.aces) * 3;
      if (matchData.doubleFaults) baseScore -= parseInt(matchData.doubleFaults) * 2;
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          aces: matchData.aces || 0,
          doubleFaults: matchData.doubleFaults || 0,
          winner: winner === player.name
        }
      });
    }
    
    return playerScores;
  };

  const calculateFootballScores = (matchData: any, players: Player[]) => {
    const team1Won = parseInt(matchData.team1Score) > parseInt(matchData.team2Score);
    const team2Won = parseInt(matchData.team2Score) > parseInt(matchData.team1Score);
    const isDraw = parseInt(matchData.team1Score) === parseInt(matchData.team2Score);
    
    const team1Players = players.slice(0, Math.ceil(players.length / 2));
    const team2Players = players.slice(Math.ceil(players.length / 2));
    
    const playerScores = [];
    
    // Team 1 players
    for (const player of team1Players) {
      let baseScore = 45;
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (team1Won) {
        baseScore += 95;
        points = 16;
        result = 'win';
      } else if (team2Won) {
        baseScore += 25;
        points = 6;
        result = 'loss';
      } else {
        baseScore += 55;
        points = 11;
        result = 'draw';
      }
      
      // MVP bonus
      if (matchData.mvp === player.name) {
        baseScore += 45;
        points += 8;
      }
      
      // Goal scorer bonus
      if (matchData.goalScorers && matchData.goalScorers.includes(player.name)) {
        baseScore += 30;
        points += 5;
      }
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          goals: matchData.goalScorers?.includes(player.name) ? 1 : 0,
          mvp: matchData.mvp === player.name
        }
      });
    }
    
    // Team 2 players
    for (const player of team2Players) {
      let baseScore = 45;
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (team2Won) {
        baseScore += 95;
        points = 16;
        result = 'win';
      } else if (team1Won) {
        baseScore += 25;
        points = 6;
        result = 'loss';
      } else {
        baseScore += 55;
        points = 11;
        result = 'draw';
      }
      
      if (matchData.mvp === player.name) {
        baseScore += 45;
        points += 8;
      }
      
      if (matchData.goalScorers && matchData.goalScorers.includes(player.name)) {
        baseScore += 30;
        points += 5;
      }
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          goals: matchData.goalScorers?.includes(player.name) ? 1 : 0,
          mvp: matchData.mvp === player.name
        }
      });
    }
    
    return playerScores;
  };

  const calculateHockeyScores = (matchData: any, players: Player[]) => {
    const team1Won = parseInt(matchData.team1Score) > parseInt(matchData.team2Score);
    const team2Won = parseInt(matchData.team2Score) > parseInt(matchData.team1Score);
    const isDraw = parseInt(matchData.team1Score) === parseInt(matchData.team2Score);
    
    const team1Players = players.slice(0, Math.ceil(players.length / 2));
    const team2Players = players.slice(Math.ceil(players.length / 2));
    
    const playerScores = [];
    
    // Team 1 players
    for (const player of team1Players) {
      let baseScore = 40;
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (team1Won) {
        baseScore += 90;
        points = 15;
        result = 'win';
      } else if (team2Won) {
        baseScore += 20;
        points = 5;
        result = 'loss';
      } else {
        baseScore += 50;
        points = 10;
        result = 'draw';
      }
      
      if (matchData.mvp === player.name) {
        baseScore += 40;
        points += 7;
      }
      
      if (matchData.goalScorers && matchData.goalScorers.includes(player.name)) {
        baseScore += 25;
        points += 4;
      }
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          goals: matchData.goalScorers?.includes(player.name) ? 1 : 0,
          mvp: matchData.mvp === player.name
        }
      });
    }
    
    // Team 2 players
    for (const player of team2Players) {
      let baseScore = 40;
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (team2Won) {
        baseScore += 90;
        points = 15;
        result = 'win';
      } else if (team1Won) {
        baseScore += 20;
        points = 5;
        result = 'loss';
      } else {
        baseScore += 50;
        points = 10;
        result = 'draw';
      }
      
      if (matchData.mvp === player.name) {
        baseScore += 40;
        points += 7;
      }
      
      if (matchData.goalScorers && matchData.goalScorers.includes(player.name)) {
        baseScore += 25;
        points += 4;
      }
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          goals: matchData.goalScorers?.includes(player.name) ? 1 : 0,
          mvp: matchData.mvp === player.name
        }
      });
    }
    
    return playerScores;
  };

  const calculateCricketScores = (matchData: any, players: Player[]) => {
    const winningTeam = matchData.winningTeam;
    const isDraw = !winningTeam || winningTeam === 'Draw';
    
    const team1Players = players.slice(0, Math.ceil(players.length / 2));
    const team2Players = players.slice(Math.ceil(players.length / 2));
    
    const playerScores = [];
    
    // Team 1 players
    for (const player of team1Players) {
      let baseScore = 35;
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (winningTeam === 'Team A') {
        baseScore += 85;
        points = 14;
        result = 'win';
      } else if (winningTeam === 'Team B') {
        baseScore += 15;
        points = 4;
        result = 'loss';
      } else {
        baseScore += 45;
        points = 9;
        result = 'draw';
      }
      
      if (matchData.manOfTheMatch === player.name) {
        baseScore += 50;
        points += 10;
      }
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          manOfTheMatch: matchData.manOfTheMatch === player.name
        }
      });
    }
    
    // Team 2 players
    for (const player of team2Players) {
      let baseScore = 35;
      let points = 0;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      
      if (winningTeam === 'Team B') {
        baseScore += 85;
        points = 14;
        result = 'win';
      } else if (winningTeam === 'Team A') {
        baseScore += 15;
        points = 4;
        result = 'loss';
      } else {
        baseScore += 45;
        points = 9;
        result = 'draw';
      }
      
      if (matchData.manOfTheMatch === player.name) {
        baseScore += 50;
        points += 10;
      }
      
      playerScores.push({
        playerId: player.id,
        score: Math.round(baseScore),
        points,
        result,
        performance: {
          manOfTheMatch: matchData.manOfTheMatch === player.name
        }
      });
    }
    
    return playerScores;
  };

  const checkAndAwardBadges = (playerData: any) => {
    const newBadges = [];
    
    // Win streak badges
    if (playerData.streak >= 3 && !playerData.badges.includes('3-Win Streak')) {
      newBadges.push('3-Win Streak');
    }
    if (playerData.streak >= 5 && !playerData.badges.includes('5-Win Streak')) {
      newBadges.push('5-Win Streak');
    }
    if (playerData.streak >= 10 && !playerData.badges.includes('10-Win Streak')) {
      newBadges.push('10-Win Streak');
    }
    
    // Win count badges
    if (playerData.wins >= 10 && !playerData.badges.includes('10-Win Club')) {
      newBadges.push('10-Win Club');
    }
    if (playerData.wins >= 25 && !playerData.badges.includes('25-Win Club')) {
      newBadges.push('25-Win Club');
    }
    if (playerData.wins >= 50 && !playerData.badges.includes('50-Win Club')) {
      newBadges.push('50-Win Club');
    }
    
    // Points badges
    if (playerData.points >= 100 && !playerData.badges.includes('Century Club')) {
      newBadges.push('Century Club');
    }
    if (playerData.points >= 500 && !playerData.badges.includes('500 Points')) {
      newBadges.push('500 Points');
    }
    if (playerData.points >= 1000 && !playerData.badges.includes('1000 Points')) {
      newBadges.push('1000 Points');
    }
    
    // Match count badges
    if (playerData.totalMatches >= 10 && !playerData.badges.includes('Rookie')) {
      newBadges.push('Rookie');
    }
    if (playerData.totalMatches >= 25 && !playerData.badges.includes('Pro Player')) {
      newBadges.push('Pro Player');
    }
    if (playerData.totalMatches >= 50 && !playerData.badges.includes('Legend')) {
      newBadges.push('Legend');
    }
    
    // Add new badges to player data
    if (newBadges.length > 0) {
      playerData.badges = [...playerData.badges, ...newBadges];
    }
  };

  const generateScoreboardData = (sport: string, matchData: any): ScoreboardData => {
    const highlights: string[] = [];
    let winner = 'Draw';
    
    switch (sport) {
      case 'basketball':
        if (matchData.team1Score > matchData.team2Score) {
          winner = matchData.team1Name || 'Team 1';
        } else if (matchData.team2Score > matchData.team1Score) {
          winner = matchData.team2Name || 'Team 2';
        }
        if (matchData.mvp) highlights.push(`MVP: ${matchData.mvp}`);
        if (matchData.totalAssists) highlights.push(`Total Assists: ${matchData.totalAssists}`);
        break;
      
      case 'badminton':
        winner = matchData.winner || 'Unknown';
        if (matchData.rallies) highlights.push(`Total Rallies: ${matchData.rallies}`);
        break;
      
      case 'swimming':
        if (matchData.bestTime) highlights.push(`Best Time: ${matchData.bestTime}`);
        if (matchData.distance) highlights.push(`Distance: ${matchData.distance}`);
        break;
      
      case 'tennis':
        winner = matchData.winner || 'Unknown';
        if (matchData.aces) highlights.push(`Aces: ${matchData.aces}`);
        if (matchData.doubleFaults) highlights.push(`Double Faults: ${matchData.doubleFaults}`);
        break;
      
      case 'football':
        if (matchData.team1Score > matchData.team2Score) {
          winner = matchData.team1Name || 'Team 1';
        } else if (matchData.team2Score > matchData.team1Score) {
          winner = matchData.team2Name || 'Team 2';
        }
        if (matchData.goalScorers) highlights.push(`Goals: ${matchData.goalScorers}`);
        break;
      
      case 'hockey':
        if (matchData.team1Score > matchData.team2Score) {
          winner = matchData.team1Name || 'Team 1';
        } else if (matchData.team2Score > matchData.team1Score) {
          winner = matchData.team2Name || 'Team 2';
        }
        if (matchData.saves) highlights.push(`Saves: ${matchData.saves}`);
        break;
      
      case 'cricket':
        winner = matchData.winningTeam || 'Unknown';
        if (matchData.manOfTheMatch) highlights.push(`Man of the Match: ${matchData.manOfTheMatch}`);
        if (matchData.totalSixes) highlights.push(`Sixes: ${matchData.totalSixes}`);
        break;
    }

    return {
      sport,
      matchData,
      summary: {
        winner,
        duration: matchData.duration || group?.duration || 'N/A',
        location: matchData.location || group?.location || 'N/A',
        players: group?.players?.map(p => p.name) || [],
        highlights
      }
    };
  };

  const renderMatchResultForm = () => {
    if (!group) return null;

    switch (group.sport) {
      case 'basketball':
        return renderBasketballForm();
      case 'badminton':
        return renderBadmintonForm();
      case 'swimming':
        return renderSwimmingForm();
      case 'tennis':
        return renderTennisForm();
      case 'football':
        return renderFootballForm();
      case 'hockey':
        return renderHockeyForm();
      case 'cricket':
        return renderCricketForm();
      default:
        return <Text>Form not available for this sport</Text>;
    }
  };

  const renderBasketballForm = () => (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.formTitle}>Basketball Match Result</Text>
      
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Team Names</Text>
        <TextInput
          style={styles.input}
          placeholder="Team 1 Name"
          value={matchFormData.team1Name || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team1Name: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team 2 Name"
          value={matchFormData.team2Name || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team2Name: text})}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Scores</Text>
        <TextInput
          style={styles.input}
          placeholder="Team 1 Score"
          keyboardType="numeric"
          value={matchFormData.team1Score || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team1Score: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team 2 Score"
          keyboardType="numeric"
          value={matchFormData.team2Score || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team2Score: text})}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Statistics (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="MVP Player"
          value={matchFormData.mvp || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, mvp: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Total Assists"
          keyboardType="numeric"
          value={matchFormData.totalAssists || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, totalAssists: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Total Rebounds"
          keyboardType="numeric"
          value={matchFormData.totalRebounds || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, totalRebounds: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Game Duration (minutes)"
          keyboardType="numeric"
          value={matchFormData.duration || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, duration: text})}
        />
      </View>
    </ScrollView>
  );

  const renderBadmintonForm = () => (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.formTitle}>Badminton Match Result</Text>
      
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Match Type</Text>
        <View style={styles.radioGroup}>
          {['Singles', 'Doubles'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.radioOption, matchFormData.matchType === type && styles.radioSelected]}
              onPress={() => setMatchFormData({...matchFormData, matchType: type})}
            >
              <Text style={[styles.radioText, matchFormData.matchType === type && styles.radioTextSelected]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Final Score</Text>
        <TextInput
          style={styles.input}
          placeholder="Final Score (e.g., 21-18, 15-21, 21-19)"
          value={matchFormData.finalScore || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, finalScore: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Winner"
          value={matchFormData.winner || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, winner: text})}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Optional Details</Text>
        <TextInput
          style={styles.input}
          placeholder="Duration (minutes)"
          keyboardType="numeric"
          value={matchFormData.duration || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, duration: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Number of Rallies"
          keyboardType="numeric"
          value={matchFormData.rallies || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, rallies: text})}
        />
      </View>
    </ScrollView>
  );

  const renderSwimmingForm = () => (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.formTitle}>Swimming Session Result</Text>
      
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Session Type</Text>
        <View style={styles.radioGroup}>
          {['Free Swim', 'Race', 'Training'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.radioOption, matchFormData.sessionType === type && styles.radioSelected]}
              onPress={() => setMatchFormData({...matchFormData, sessionType: type})}
            >
              <Text style={[styles.radioText, matchFormData.sessionType === type && styles.radioTextSelected]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <TextInput
          style={styles.input}
          placeholder="Distance Covered (e.g., 500m, 1km)"
          value={matchFormData.distance || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, distance: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Time Taken"
          value={matchFormData.timeTaken || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, timeTaken: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Number of Laps"
          keyboardType="numeric"
          value={matchFormData.laps || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, laps: text})}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Optional Details</Text>
        <TextInput
          style={styles.input}
          placeholder="Stroke Type"
          value={matchFormData.strokeType || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, strokeType: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Best Time"
          value={matchFormData.bestTime || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, bestTime: text})}
        />
      </View>
    </ScrollView>
  );

  const renderTennisForm = () => (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.formTitle}>Tennis Match Result</Text>
      
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Match Type</Text>
        <View style={styles.radioGroup}>
          {['Singles', 'Doubles'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.radioOption, matchFormData.matchType === type && styles.radioSelected]}
              onPress={() => setMatchFormData({...matchFormData, matchType: type})}
            >
              <Text style={[styles.radioText, matchFormData.matchType === type && styles.radioTextSelected]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Match Result</Text>
        <TextInput
          style={styles.input}
          placeholder="Final Score (e.g., 6-4, 4-6, 7-5)"
          value={matchFormData.finalScore || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, finalScore: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Winner"
          value={matchFormData.winner || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, winner: text})}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Statistics (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Aces"
          keyboardType="numeric"
          value={matchFormData.aces || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, aces: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Double Faults"
          keyboardType="numeric"
          value={matchFormData.doubleFaults || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, doubleFaults: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Duration (minutes)"
          keyboardType="numeric"
          value={matchFormData.duration || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, duration: text})}
        />
      </View>
    </ScrollView>
  );

  const renderFootballForm = () => (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.formTitle}>Football Match Result</Text>
      
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Teams & Score</Text>
        <TextInput
          style={styles.input}
          placeholder="Team 1 Name"
          value={matchFormData.team1Name || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team1Name: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team 1 Score"
          keyboardType="numeric"
          value={matchFormData.team1Score || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team1Score: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team 2 Name"
          value={matchFormData.team2Name || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team2Name: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team 2 Score"
          keyboardType="numeric"
          value={matchFormData.team2Score || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team2Score: text})}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Statistics (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Goal Scorers (comma separated)"
          value={matchFormData.goalScorers || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, goalScorers: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="MVP Player"
          value={matchFormData.mvp || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, mvp: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Duration (minutes)"
          keyboardType="numeric"
          value={matchFormData.duration || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, duration: text})}
        />
      </View>
    </ScrollView>
  );

  const renderHockeyForm = () => (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.formTitle}>Hockey Match Result</Text>
      
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Teams & Score</Text>
        <TextInput
          style={styles.input}
          placeholder="Team 1 Name"
          value={matchFormData.team1Name || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team1Name: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team 1 Score"
          keyboardType="numeric"
          value={matchFormData.team1Score || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team1Score: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team 2 Name"
          value={matchFormData.team2Name || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team2Name: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team 2 Score"
          keyboardType="numeric"
          value={matchFormData.team2Score || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, team2Score: text})}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Statistics (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Goal Scorers"
          value={matchFormData.goalScorers || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, goalScorers: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Saves"
          keyboardType="numeric"
          value={matchFormData.saves || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, saves: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="MVP Player"
          value={matchFormData.mvp || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, mvp: text})}
        />
      </View>
    </ScrollView>
  );

  const renderCricketForm = () => (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.formTitle}>Cricket Match Result</Text>
      
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Match Format</Text>
        <View style={styles.radioGroup}>
          {['6-a-side', '8-a-side', '11-a-side'].map((format) => (
            <TouchableOpacity
              key={format}
              style={[styles.radioOption, matchFormData.matchFormat === format && styles.radioSelected]}
              onPress={() => setMatchFormData({...matchFormData, matchFormat: format})}
            >
              <Text style={[styles.radioText, matchFormData.matchFormat === format && styles.radioTextSelected]}>
                {format}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Match Details</Text>
        <TextInput
          style={styles.input}
          placeholder="Overs Per Side"
          keyboardType="numeric"
          value={matchFormData.oversPerSide || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, oversPerSide: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team A Score (e.g., 120/8)"
          value={matchFormData.teamAScore || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, teamAScore: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Team B Score (e.g., 121/6)"
          value={matchFormData.teamBScore || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, teamBScore: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Winning Team"
          value={matchFormData.winningTeam || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, winningTeam: text})}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Statistics (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Man of the Match"
          value={matchFormData.manOfTheMatch || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, manOfTheMatch: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Total Sixes"
          keyboardType="numeric"
          value={matchFormData.totalSixes || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, totalSixes: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Total Fours"
          keyboardType="numeric"
          value={matchFormData.totalFours || ''}
          onChangeText={(text) => setMatchFormData({...matchFormData, totalFours: text})}
        />
      </View>
    </ScrollView>
  );

  const renderScorecard = () => {
    if (!scoreboardData) return null;

    const sport = SPORTS.find(s => s.id === scoreboardData.sport);
    
    return (
      <Modal visible={showScorecard} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowScorecard(false)}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Match Scorecard</Text>
            <TouchableOpacity>
              <Ionicons name="share-outline" size={24} color="#4E54C8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scorecardContainer}>
            <LinearGradient colors={sport?.color || ['#667eea', '#764ba2']} style={styles.scorecardHeader}>
              <FontAwesome5 name={sport?.icon} size={32} color="#FFFFFF" />
              <Text style={styles.scorecardSport}>{sport?.name}</Text>
              <Text style={styles.scorecardWinner}>🏆 {scoreboardData.summary.winner}</Text>
            </LinearGradient>

            <View style={styles.scorecardContent}>
              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>Match Summary</Text>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Ionicons name="time" size={20} color="#4E54C8" />
                    <Text style={styles.summaryLabel}>Duration</Text>
                    <Text style={styles.summaryValue}>{scoreboardData.summary.duration} min</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Ionicons name="location" size={20} color="#4E54C8" />
                    <Text style={styles.summaryLabel}>Location</Text>
                    <Text style={styles.summaryValue}>{scoreboardData.summary.location}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Ionicons name="people" size={20} color="#4E54C8" />
                    <Text style={styles.summaryLabel}>Players</Text>
                    <Text style={styles.summaryValue}>{scoreboardData.summary.players.length}+</Text>
                  </View>
                </View>
              </View>

              <View style={styles.highlightsSection}>
                <Text style={styles.sectionTitle}>Match Highlights</Text>
                {scoreboardData.summary.highlights.map((highlight, index) => (
                  <View key={index} style={styles.highlightItem}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.highlightText}>{highlight}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.individualScoresSection}>
                <Text style={styles.sectionTitle}>Individual Scores</Text>
                <Text style={styles.sectionSubtitle}>Points earned in this match</Text>
                
                {group?.players.map((player, index) => {
                  const playerScore = calculateIndividualScores(
                    scoreboardData.sport, 
                    scoreboardData.matchData, 
                    group.players
                  ).find(p => p.playerId === player.id);
                  
                  if (!playerScore) return null;
                  
                  return (
                    <View key={player.id} style={styles.playerScoreCard}>
                      <View style={styles.playerScoreHeader}>
                        <View style={styles.playerScoreInfo}>
                          <View style={styles.playerScoreAvatar}>
                            <Text style={styles.playerScoreInitial}>{player.name.charAt(0)}</Text>
                          </View>
                          <View>
                            <Text style={styles.playerScoreName}>{player.name}</Text>
                            <Text style={styles.playerScoreLevel}>{player.level}</Text>
                          </View>
                        </View>
                        <View style={styles.playerScoreStats}>
                          <Text style={styles.playerScorePoints}>+{playerScore.points} pts</Text>
                          <Text style={[
                            styles.playerScoreResult,
                            { color: playerScore.result === 'win' ? '#4CAF50' : 
                                     playerScore.result === 'loss' ? '#F44336' : '#FF9800' }
                          ]}>
                            {playerScore.result.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.playerScoreDetails}>
                        <Text style={styles.playerScoreTotal}>Total Score: {playerScore.score}</Text>
                        {playerScore.performance && Object.keys(playerScore.performance).length > 0 && (
                          <View style={styles.performanceStats}>
                            {Object.entries(playerScore.performance).map(([key, value]) => (
                              <Text key={key} style={styles.performanceStat}>
                                {key.charAt(0).toUpperCase() + key.slice(1)}: {value}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading group details...</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.errorContainer}>
        <Text>Group not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sport = SPORTS.find(s => s.id === group.sport);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={sport?.color[0]} />
      
      {/* Header */}
      <LinearGradient colors={sport?.color || ['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{group.title}</Text>
          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerContent}>
          <View style={styles.sportInfo}>
            <FontAwesome5 name={sport?.icon} size={24} color="#FFFFFF" />
            <Text style={styles.sportName}>{sport?.name}</Text>
          </View>
          <Text style={styles.groupDescription}>{group.description}</Text>
          <View style={styles.groupStats}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={16} color="#FFFFFF" />
              <Text style={styles.statText}>{group.currentPlayers}/{group.maxPlayers}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time" size={16} color="#FFFFFF" />
              <Text style={styles.statText}>{group.duration} min</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="location" size={16} color="#FFFFFF" />
              <Text style={styles.statText}>{group.location}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {['details', 'chat', 'results'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'details' && (
          <View style={styles.detailsTab}>
            <View style={styles.playersSection}>
              <Text style={styles.sectionTitle}>Players ({group.currentPlayers})</Text>
              {group.players.map((player, index) => (
                <View key={index} style={styles.playerCard}>
                  <View style={styles.playerInfo}>
                    <View style={styles.playerAvatar}>
                      <Text style={styles.playerInitial}>{player.name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.playerName}>{player.name}</Text>
                      <Text style={styles.playerLevel}>{player.level}</Text>
                    </View>
                  </View>
                  <View style={styles.playerRating}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.ratingText}>{player.rating}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => setShowMatchResultModal(true)}
              >
                <Ionicons name="trophy" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Submit Match Result</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'chat' && (
          <View style={styles.chatTab}>
            <FlatList
              data={chatMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={[
                  styles.messageContainer,
                  item.userId === 'currentUser' && styles.ownMessage
                ]}>
                  <Text style={styles.messageSender}>{item.userName}</Text>
                  <Text style={styles.messageText}>{item.message}</Text>
                  <Text style={styles.messageTime}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              )}
              style={styles.messagesList}
            />
            
            <View style={styles.messageInput}>
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                <Ionicons name="send" size={20} color="#4E54C8" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'results' && (
          <View style={styles.resultsTab}>
            {matchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={64} color="#8E8E93" />
                <Text style={styles.emptyStateText}>No match results yet</Text>
                <Text style={styles.emptyStateSubtext}>Submit your first match result to see it here</Text>
              </View>
            ) : (
              matchResults.map((result, index) => (
                <View key={index} style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultDate}>
                      {new Date(result.createdAt).toLocaleDateString()}
                    </Text>
                    <View style={[styles.verifiedBadge, result.verified && styles.verifiedBadgeActive]}>
                      <Ionicons 
                        name={result.verified ? "checkmark-circle" : "time"} 
                        size={16} 
                        color={result.verified ? "#4CAF50" : "#FF9800"} 
                      />
                      <Text style={styles.verifiedText}>
                        {result.verified ? "Verified" : "Pending"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.resultSummary}>
                    Match completed - View details for full scorecard
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Match Result Modal */}
      <Modal
        visible={showMatchResultModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMatchResultModal(false)}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Submit Match Result</Text>
            <TouchableOpacity onPress={() => submitMatchResult(matchFormData)}>
              <Text style={styles.submitText}>Submit</Text>
            </TouchableOpacity>
          </View>
          
          <KeyboardAvoidingView 
            style={styles.modalContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {renderMatchResultForm()}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Scorecard Modal */}
      {renderScorecard()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    color: '#4E54C8',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  header: {
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  shareButton: {
    padding: 8,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sportName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  groupDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
    lineHeight: 20,
  },
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4E54C8',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#4E54C8',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  detailsTab: {
    padding: 20,
  },
  playersSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4E54C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  playerLevel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  playerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 4,
  },
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E54C8',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chatTab: {
    flex: 1,
    padding: 20,
  },
  messagesList: {
    flex: 1,
    marginBottom: 16,
  },
  messageContainer: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  ownMessage: {
    backgroundColor: '#4E54C8',
    alignSelf: 'flex-end',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'right',
  },
  messageInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    padding: 8,
    marginLeft: 8,
  },
  resultsTab: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  verifiedBadgeActive: {
    backgroundColor: '#E8F5E8',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 4,
  },
  resultSummary: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
  },
  modalContent: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 24,
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    marginBottom: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  radioOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  radioSelected: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  radioText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  radioTextSelected: {
    color: '#FFFFFF',
  },
  scorecardContainer: {
    flex: 1,
  },
  scorecardHeader: {
    padding: 24,
    alignItems: 'center',
  },
  scorecardSport: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  scorecardWinner: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  scorecardContent: {
    padding: 20,
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 2,
  },
  highlightsSection: {
    marginBottom: 24,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  highlightText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 8,
  },
  individualScoresSection: {
    marginBottom: 24,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  playerScoreCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4E54C8',
  },
  playerScoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerScoreInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerScoreAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4E54C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerScoreInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playerScoreName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  playerScoreLevel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  playerScoreStats: {
    alignItems: 'flex-end',
  },
  playerScorePoints: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4E54C8',
  },
  playerScoreResult: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  playerScoreDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
  },
  playerScoreTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  performanceStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  performanceStat: {
    fontSize: 12,
    color: '#8E8E93',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});

export default MyGroupSports;