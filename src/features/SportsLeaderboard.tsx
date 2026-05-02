import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Firebase Console Action: 
// 1. Create Firestore collection: 'sports_leaderboard'
// 2. Create composite index:
//    - Collection: 'sports_leaderboard' | Fields: sport (Ascending), lastUpdated (Descending)
// 3. Set Firestore rules to allow read access for all users

const { width, height } = Dimensions.get('window');

// TypeScript Interfaces
interface LeaderboardPlayer {
  id: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
  draws?: number;
  streak: number;
  bestStreak?: number;
  level: string;
  badges: string[];
  avatar?: string;
  rank?: number;
  totalMatches?: number;
  averageScore?: number;
  totalScore?: number;
}

interface SportLeaderboard {
  id: string;
  sport: string;
  players: LeaderboardPlayer[];
  lastUpdated: number;
}

type SportsLeaderboardNavigationProp = NativeStackNavigationProp<{
  SportsPlace: undefined;
}>;

const SPORTS = [
  { id: 'basketball', name: 'Basketball', icon: 'basketball', color: ['#FF6B35', '#F7931E'] as const },
  { id: 'badminton', name: 'Badminton', icon: 'badminton', color: ['#4ECDC4', '#44A08D'] as const },
  { id: 'swimming', name: 'Swimming', icon: 'swimmer', color: ['#667eea', '#764ba2'] as const },
  { id: 'tennis', name: 'Tennis', icon: 'tennis', color: ['#fdbb2d', '#22c1c3'] as const },
  { id: 'football', name: 'Football', icon: 'football', color: ['#56ab2f', '#a8e6cf'] as const },
  { id: 'hockey', name: 'Hockey', icon: 'hockey-puck', color: ['#e96443', '#904e95'] as const },
  { id: 'cricket', name: 'Cricket', icon: 'cricket', color: ['#FF8008', '#FFC837'] as const },
];

const BADGES = {
  '3-Win Streak': { icon: 'flame', color: '#FF6B35' },
  '5-Win Streak': { icon: 'flame', color: '#FF4500' },
  '10-Win Streak': { icon: 'flame', color: '#FF0000' },
  '10-Win Club': { icon: 'trophy', color: '#FFD700' },
  '25-Win Club': { icon: 'trophy', color: '#C0C0C0' },
  '50-Win Club': { icon: 'trophy', color: '#CD7F32' },
  'Century Club': { icon: 'star', color: '#9D4EDD' },
  '500 Points': { icon: 'star', color: '#FF6B35' },
  '1000 Points': { icon: 'star', color: '#FFD700' },
  'Rookie': { icon: 'leaf', color: '#4CAF50' },
  'Pro Player': { icon: 'medal', color: '#FF8C00' },
  'Legend': { icon: 'crown', color: '#8B5CF6' },
};

const SportsLeaderboard: React.FC = () => {
  const navigation = useNavigation<SportsLeaderboardNavigationProp>();
  
  // State management
  const [selectedSport, setSelectedSport] = useState('basketball');
  const [leaderboards, setLeaderboards] = useState<{ [key: string]: SportLeaderboard }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLeaderboards();
  }, []);

  const loadLeaderboards = () => {
    // Firebase Console Action: Create composite index for 'sports_leaderboard' collection:
    // Fields: sport (Ascending), lastUpdated (Descending)
    // Or use the provided URL: https://console.firebase.google.com/v1/r/project/yogo-campus/firestore/indexes
    
    const leaderboardQuery = query(collection(db, 'sports_leaderboard'));
    
    const unsubscribe = onSnapshot(leaderboardQuery, (snapshot) => {
      const leaderboardData: { [key: string]: SportLeaderboard } = {};
      
      snapshot.docs.forEach(doc => {
        const data = { id: doc.id, ...doc.data() } as SportLeaderboard;
        
        // Sort players by points and assign ranks
        const sortedPlayers = data.players
          .sort((a, b) => b.points - a.points)
          .map((player, index) => ({
            ...player,
            rank: index + 1
          }));
        
        leaderboardData[data.sport] = {
          ...data,
          players: sortedPlayers
        };
      });
      
      setLeaderboards(leaderboardData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading leaderboards:', error);
      setLoading(false);
    });

    return unsubscribe;
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboards();
    setRefreshing(false);
  };

  const getCurrentLeaderboard = (): LeaderboardPlayer[] => {
    return leaderboards[selectedSport]?.players || [];
  };

  const getPlayerLevel = (points: number): string => {
    if (points >= 1000) return 'Legend';
    if (points >= 500) return 'Professional';
    if (points >= 200) return 'Intermediate';
    if (points >= 50) return 'Amateur';
    return 'Beginner';
  };

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'Legend': return '#8B5CF6';
      case 'Professional': return '#FF8C00';
      case 'Intermediate': return '#4CAF50';
      case 'Amateur': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const getRankIcon = (rank: number): string => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const renderSportSelector = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.sportSelector}
      contentContainerStyle={styles.sportSelectorContent}
    >
      {SPORTS.map((sport) => (
        <TouchableOpacity
          key={sport.id}
          style={[
            styles.sportChip,
            selectedSport === sport.id && styles.selectedSportChip
          ]}
          onPress={() => setSelectedSport(sport.id)}
        >
          <LinearGradient
            colors={selectedSport === sport.id ? sport.color : ['#F8F9FA', '#F8F9FA']}
            style={styles.sportChipGradient}
          >
            <FontAwesome5 
              name={sport.icon} 
              size={16} 
              color={selectedSport === sport.id ? '#FFFFFF' : '#8E8E93'} 
            />
            <Text style={[
              styles.sportChipText,
              selectedSport === sport.id && styles.selectedSportChipText
            ]}>
              {sport.name}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderTopThree = () => {
    const topThree = getCurrentLeaderboard().slice(0, 3);
    if (topThree.length === 0) return null;

    return (
      <View style={styles.topThreeContainer}>
        <Text style={styles.sectionTitle}>🏆 Top Performers</Text>
        <View style={styles.podium}>
          {/* Second Place */}
          {topThree[1] && (
            <View style={[styles.podiumPosition, styles.secondPlace]}>
              <View style={styles.playerAvatar}>
                <Text style={styles.avatarText}>{topThree[1].name.charAt(0)}</Text>
              </View>
              <Text style={styles.podiumRank}>🥈</Text>
              <Text style={styles.podiumName}>{topThree[1].name}</Text>
              <Text style={styles.podiumPoints}>{topThree[1].points} pts</Text>
            </View>
          )}

          {/* First Place */}
          <View style={[styles.podiumPosition, styles.firstPlace]}>
            <View style={[styles.playerAvatar, styles.firstPlaceAvatar]}>
              <Text style={styles.avatarText}>{topThree[0].name.charAt(0)}</Text>
            </View>
            <Text style={styles.podiumRank}>🥇</Text>
            <Text style={styles.podiumName}>{topThree[0].name}</Text>
            <Text style={styles.podiumPoints}>{topThree[0].points} pts</Text>
            <View style={styles.crownContainer}>
              <Text style={styles.crown}>👑</Text>
            </View>
          </View>

          {/* Third Place */}
          {topThree[2] && (
            <View style={[styles.podiumPosition, styles.thirdPlace]}>
              <View style={styles.playerAvatar}>
                <Text style={styles.avatarText}>{topThree[2].name.charAt(0)}</Text>
              </View>
              <Text style={styles.podiumRank}>🥉</Text>
              <Text style={styles.podiumName}>{topThree[2].name}</Text>
              <Text style={styles.podiumPoints}>{topThree[2].points} pts</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderPlayerCard = ({ item, index }: { item: LeaderboardPlayer; index: number }) => {
    const sport = SPORTS.find(s => s.id === selectedSport);
    const totalMatches = (item.wins || 0) + (item.losses || 0) + (item.draws || 0);
    const winRate = totalMatches > 0 ? ((item.wins || 0) / totalMatches * 100).toFixed(1) : '0.0';
    
    return (
      <View style={styles.playerCard}>
        <View style={styles.playerRank}>
          <Text style={styles.rankText}>{getRankIcon(item.rank || index + 1)}</Text>
        </View>
        
        <View style={styles.playerInfo}>
          <View style={styles.playerAvatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.playerDetails}>
            <Text style={styles.playerName}>{item.name}</Text>
            <View style={styles.playerStats}>
              <View style={styles.statChip}>
                <Text style={styles.statLabel}>Level</Text>
                <Text style={[styles.statValue, { color: getLevelColor(getPlayerLevel(item.points)) }]}>
                  {getPlayerLevel(item.points)}
                </Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statLabel}>Win Rate</Text>
                <Text style={styles.statValue}>{winRate}%</Text>
              </View>
              {item.streak > 0 && (
                <View style={styles.streakChip}>
                  <Ionicons name="flame" size={12} color="#FF6B35" />
                  <Text style={styles.streakText}>{item.streak}</Text>
                </View>
              )}
            </View>
            <View style={styles.additionalStats}>
              <Text style={styles.additionalStatText}>
                {item.wins || 0}W - {item.losses || 0}L - {item.draws || 0}D
              </Text>
              {item.averageScore && (
                <Text style={styles.additionalStatText}>
                  Avg: {item.averageScore}
                </Text>
              )}
            </View>
          </View>
        </View>
        
        <View style={styles.playerScore}>
          <Text style={styles.pointsText}>{item.points}</Text>
          <Text style={styles.pointsLabel}>points</Text>
        </View>
        
        {item.badges && item.badges.length > 0 && (
          <View style={styles.badgesContainer}>
            {item.badges.slice(0, 2).map((badge, badgeIndex) => {
              const badgeInfo = BADGES[badge as keyof typeof BADGES];
              return (
                <View key={badgeIndex} style={[styles.badge, { backgroundColor: badgeInfo?.color + '20' }]}>
                  <Ionicons 
                    name={badgeInfo?.icon as any} 
                    size={12} 
                    color={badgeInfo?.color} 
                  />
                </View>
              );
            })}
            {item.badges.length > 2 && (
              <View style={styles.moreBadges}>
                <Text style={styles.moreBadgesText}>+{item.badges.length - 2}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <FontAwesome5 name="trophy" size={64} color="#E5E5EA" />
      <Text style={styles.emptyStateTitle}>No Leaderboard Yet</Text>
      <Text style={styles.emptyStateText}>
        Start playing {SPORTS.find(s => s.id === selectedSport)?.name} matches to see rankings here!
      </Text>
      <TouchableOpacity 
        style={styles.playNowButton}
        onPress={() => navigation.navigate('SportsPlace')}
      >
        <Text style={styles.playNowText}>Find a Game</Text>
      </TouchableOpacity>
    </View>
  );

  const currentSport = SPORTS.find(s => s.id === selectedSport);
  const currentLeaderboard = getCurrentLeaderboard();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={currentSport?.color[0]} />
      
      {/* Header */}
      <LinearGradient colors={currentSport?.color || ['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="filter" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerSubtitle}>Compete, Win, and Climb the Rankings!</Text>
          <View style={styles.headerStats}>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>{currentLeaderboard.length}</Text>
              <Text style={styles.headerStatLabel}>Players</Text>
            </View>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>
                {currentLeaderboard.reduce((sum, player) => sum + (player.totalMatches || 0), 0)}
              </Text>
              <Text style={styles.headerStatLabel}>Matches</Text>
            </View>
            <View style={styles.headerStat}>
              <Text style={styles.headerStatValue}>
                {Math.max(...currentLeaderboard.map(p => p.bestStreak || 0), 0)}
              </Text>
              <Text style={styles.headerStatLabel}>Best Streak</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Sport Selector */}
      {renderSportSelector()}

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {currentLeaderboard.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {/* Top Three Podium */}
            {renderTopThree()}

            {/* Full Leaderboard */}
            <View style={styles.fullLeaderboard}>
              <Text style={styles.sectionTitle}>📊 Full Rankings</Text>
              <FlatList
                data={currentLeaderboard}
                keyExtractor={(item) => item.id}
                renderItem={renderPlayerCard}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  filterButton: {
    padding: 8,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  headerStat: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  sportSelector: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sportSelectorContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sportChip: {
    marginRight: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  selectedSportChip: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sportChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  sportChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  selectedSportChipText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  topThreeContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 20,
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 200,
  },
  podiumPosition: {
    alignItems: 'center',
    marginHorizontal: 8,
    flex: 1,
  },
  firstPlace: {
    marginBottom: 0,
  },
  secondPlace: {
    marginBottom: 20,
  },
  thirdPlace: {
    marginBottom: 40,
  },
  playerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4E54C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  firstPlaceAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  podiumRank: {
    fontSize: 24,
    marginBottom: 4,
  },
  podiumName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 4,
  },
  podiumPoints: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  crownContainer: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -12,
  },
  crown: {
    fontSize: 24,
  },
  fullLeaderboard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  playerRank: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  playerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  playerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B35',
  },
  playerScore: {
    alignItems: 'center',
    marginRight: 12,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4E54C8',
  },
  pointsLabel: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreBadges: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreBadgesText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  playNowButton: {
    backgroundColor: '#4E54C8',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
  },
  playNowText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  additionalStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  additionalStatText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
});

export default SportsLeaderboard;