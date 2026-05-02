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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { collection, addDoc, onSnapshot, query, orderBy, where, updateDoc, doc, getDoc, getDocs, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import CreateSportsGroup from './CreateSportsGroup';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define the navigation type to match the router's RootStackParamList
type SportsPlaceNavigationProp = NativeStackNavigationProp<{
  SportsPlace: undefined;
  MyGroupSports: { groupId: string };
}>;

// Firebase Console Action: Create Firestore collections: 'sports_groups', 'sports_matches', 'sports_posts', 'user_stats', 'leaderboards'

const { width, height } = Dimensions.get('window');

// Custom SportIcon component for better sport representation
const SportIcon: React.FC<{ sport?: string; size: number; color: string }> = ({ sport, size, color }) => {
  // Use specific icons based on sport ID
  switch(sport) {
    case 'badminton':
      // Using a more appropriate shuttlecock-like icon for badminton
      return <FontAwesome5 name="feather-alt" size={size} color={color} />;
    case 'tennis':
      return <FontAwesome5 name="baseball-ball" size={size} color={color} />;
    case 'cricket':
      return <FontAwesome5 name="cricket" size={size} color={color} />;
    case 'basketball':
      return <FontAwesome5 name="basketball-ball" size={size} color={color} />;
    case 'football':
      return <FontAwesome5 name="football-ball" size={size} color={color} />;
    case 'hockey':
      return <FontAwesome5 name="hockey-puck" size={size} color={color} />;
    case 'swimming':
      return <FontAwesome5 name="swimmer" size={size} color={color} />;
    default:
      // Use the sport's icon or fallback to a trophy
      return <FontAwesome5 name="trophy" size={size} color={color} />;
  }
};

// TypeScript Interfaces
interface Sport {
  id: string;
  name: string;
  icon: string;
  color: [string, string];
  maxPlayers: number;
  minPlayers: number;
}

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

interface Match {
  id: string;
  sport: string;
  groupId: string;
  teams: Team[];
  scores: number[];
  duration: number;
  location: string;
  completedAt: number;
  participants: Player[];
  winnerTeam?: number;
}

interface Team {
  name: string;
  players: Player[];
  score: number;
  stats?: Record<string, number>;
}

interface UserStats {
  id: string;
  userId: string;
  sport: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
  level: string;
  badges: string[];
  winStreak: number;
  bestStreak: number;
  rating: number;
}

interface SportsPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  sport: string;
  type: 'achievement' | 'match_result' | 'story';
  content: string;
  image?: string;
  matchData?: Match;
  stats?: Record<string, number>;
  likes: number;
  comments: number;
  createdAt: number;
}

const SPORTS: Sport[] = [
  { id: 'basketball', name: 'Basketball', icon: 'basketball', color: ['#FF6B35', '#F7931E'], maxPlayers: 10, minPlayers: 6 },
  { id: 'badminton', name: 'Badminton', icon: 'badminton', color: ['#4ECDC4', '#44A08D'], maxPlayers: 4, minPlayers: 2 },
  { id: 'swimming', name: 'Swimming', icon: 'swimmer', color: ['#667eea', '#764ba2'], maxPlayers: 8, minPlayers: 2 },
  { id: 'tennis', name: 'Tennis', icon: 'tennis', color: ['#fdbb2d', '#22c1c3'], maxPlayers: 4, minPlayers: 2 },
  { id: 'football', name: 'Football', icon: 'football', color: ['#56ab2f', '#a8e6cf'], maxPlayers: 22, minPlayers: 10 },
  { id: 'hockey', name: 'Hockey', icon: 'hockey-puck', color: ['#e96443', '#904e95'], maxPlayers: 22, minPlayers: 10 },
  { id: 'cricket', name: 'Cricket', icon: 'cricket', color: ['#FF8008', '#FFC837'], maxPlayers: 22, minPlayers: 6 },
];

const SKILL_LEVELS = [
  { key: 'beginner', label: 'Beginner', color: '#34C759', icon: 'leaf' },
  { key: 'amateur', label: 'Amateur', color: '#007AFF', icon: 'star' },
  { key: 'intermediate', label: 'Intermediate', color: '#FF9500', icon: 'flame' },
  { key: 'professional', label: 'Professional', color: '#FF3B30', icon: 'trophy' },
];

const SportsPlace: React.FC = () => {
  // Navigation
  const navigation = useNavigation<SportsPlaceNavigationProp>();
  
  // State Management
  const [activeTab, setActiveTab] = useState<'groups' | 'leaderboard' | 'social'>('groups');
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [sportsGroups, setSportsGroups] = useState<SportsGroup[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [sportsPosts, setSportsPosts] = useState<SportsPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Add expanded group state
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  
  // Modal States
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showMatchResult, setShowMatchResult] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showMyGroups, setShowMyGroups] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  
  // Form States (now only used for match results)
  const [matchForm, setMatchForm] = useState({
    team1Score: '',
    team2Score: '',
    duration: '',
    mvp: '',
    notes: '',
  });

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Check Firebase connection
    console.log('Firebase DB instance:', db);
    console.log('Firebase connection test starting...');
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();

    loadSportsData();
  }, []);

  useEffect(() => {
    console.log('Setting up Firebase listeners...');
    
    const unsubscribeGroups = onSnapshot(
      query(collection(db, 'sports_groups'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        console.log('Groups snapshot received:', snapshot.size, 'documents');
        const groups = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as SportsGroup[];
        setSportsGroups(groups);
        console.log('Groups loaded:', groups.length);
      },
      (error) => {
        console.error('Firebase groups listener error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        Alert.alert('Error', `Failed to connect to Firebase: ${errorMessage}`);
      }
    );

    const unsubscribePosts = onSnapshot(
      query(collection(db, 'sports_posts'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        console.log('Posts snapshot received:', snapshot.size, 'documents');
        const posts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as SportsPost[];
        setSportsPosts(posts);
        console.log('Posts loaded:', posts.length);
      },
      (error) => {
        console.error('Firebase posts listener error:', error);
      }
    );

    return () => {
      console.log('Cleaning up Firebase listeners...');
      unsubscribeGroups();
      unsubscribePosts();
    };
  }, []);

  const loadSportsData = async () => {
    setLoading(true);
    try {
      console.log('Loading sports data from Firebase...');
      
      // Test Firebase connection first
      const testCollection = collection(db, 'sports_groups');
      console.log('Test collection created:', testCollection);
      
      // Load user stats and leaderboard data
      const statsQuery = query(collection(db, 'user_stats'), orderBy('points', 'desc'));
      console.log('Stats query created:', statsQuery);
      
      const statsSnapshot = await getDocs(statsQuery);
      console.log('Stats snapshot received:', statsSnapshot.size, 'documents');
      
      const stats = statsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserStats[];
      setUserStats(stats);
      console.log('User stats loaded successfully:', stats.length, 'items');
    } catch (error) {
      console.error('Error loading sports data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error details:', errorMessage);
      // Don't show alert here as this runs on mount
    } finally {
      setLoading(false);
    }
  };

  const loadSportsGroups = async () => {
    // This function is called when groups are updated
    // The real-time listeners in useEffect already handle updates
    console.log('Sports groups refreshed');
  };

  const joinGroup = async (groupId: string) => {
    try {
      const groupRef = doc(db, 'sports_groups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (groupDoc.exists()) {
        const groupData = groupDoc.data() as SportsGroup;
        if (groupData.currentPlayers < groupData.maxPlayers) {
          const newPlayer: Player = {
            id: 'current_user_id',
            name: 'Current User',
            level: 'amateur',
            rating: 1200
          };

          await updateDoc(groupRef, {
            currentPlayers: increment(1),
            players: [...groupData.players, newPlayer],
            status: groupData.currentPlayers + 1 >= groupData.maxPlayers ? 'full' : 'open'
          });
          
          Alert.alert('Success', 'Joined group successfully!');
        } else {
          Alert.alert('Error', 'Group is already full');
        }
      }
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('Error', 'Failed to join group');
    }
  };

  const submitMatchResult = async () => {
    if (!matchForm.team1Score || !matchForm.team2Score) {
      Alert.alert('Error', 'Please enter scores for both teams');
      return;
    }

    try {
      const matchResult: Omit<Match, 'id'> = {
        sport: 'general',
        groupId: 'group_id',
        teams: [
          {
            name: 'Team 1',
            players: [],
            score: parseInt(matchForm.team1Score),
            stats: {}
          },
          {
            name: 'Team 2',
            players: [],
            score: parseInt(matchForm.team2Score),
            stats: {}
          }
        ],
        scores: [parseInt(matchForm.team1Score), parseInt(matchForm.team2Score)],
        duration: parseInt(matchForm.duration) || 60,
        location: 'Sports Center',
        completedAt: Date.now(),
        participants: [],
        winnerTeam: parseInt(matchForm.team1Score) > parseInt(matchForm.team2Score) ? 0 : 1
      };

      await addDoc(collection(db, 'sports_matches'), matchResult);
      
      // Update user stats and create social post
      await createMatchPost(matchResult);
      
      setShowMatchResult(false);
      resetMatchForm();
      Alert.alert('Success', 'Match result submitted!');
    } catch (error) {
      console.error('Error submitting match result:', error);
      Alert.alert('Error', 'Failed to submit match result');
    }
  };

  const createMatchPost = async (match: Omit<Match, 'id'>) => {
    try {
      const post: Omit<SportsPost, 'id'> = {
        userId: 'current_user_id',
        userName: 'Current User',
        sport: match.sport,
        type: 'match_result',
        content: `Just finished an amazing ${match.sport} match! Final score: ${match.scores[0]} - ${match.scores[1]}`,
        matchData: match as Match,
        likes: 0,
        comments: 0,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'sports_posts'), post);
    } catch (error) {
      console.error('Error creating match post:', error);
    }
  };

  const resetMatchForm = () => {
    setMatchForm({
      team1Score: '',
      team2Score: '',
      duration: '',
      mvp: '',
      notes: '',
    });
  };



  // Filter groups based on selected sport
  // Only show groups where now < dateTime + 3 hours
  const now = Date.now();
  const isGroupActive = (group: SportsGroup) => {
    if (!group.dateTime) return true;
    const groupTime = new Date(group.dateTime).getTime();
    return now < groupTime + 3 * 60 * 60 * 1000;
  };

  const filteredGroups = (selectedSport === 'all' 
    ? sportsGroups 
    : sportsGroups.filter(group => group.sport === selectedSport)
  ).filter(isGroupActive);

  // For My Groups, allow 6 hours after start time
  const isMyGroupActive = (group: SportsGroup) => {
    if (!group.dateTime) return true;
    const groupTime = new Date(group.dateTime).getTime();
    return now < groupTime + 6 * 60 * 60 * 1000;
  };
  const myGroups = sportsGroups
    .filter(group => group.players.some(player => player.id === 'current_user_id'))
    .filter(isMyGroupActive);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSportsData();
    setRefreshing(false);
  };

  const renderGroupCard = ({ item }: { item: SportsGroup }) => {
    const sport = SPORTS.find(s => s.id === item.sport);
    const skillLevel = SKILL_LEVELS.find(s => s.key === item.skillLevel);
    
    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => setExpandedGroupId(expandedGroupId === item.id ? null : item.id)}
      >
        <Animated.View style={[styles.groupCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}> 
          <LinearGradient colors={sport?.color || ['#667eea', '#764ba2']} style={styles.groupCardHeader}>
            <View style={styles.groupCardTop}>
              <View style={styles.sportInfo}>
                <SportIcon sport={sport?.id} size={24} color="#FFFFFF" />
                <Text style={styles.sportName}>{sport?.name}</Text>
              </View>
              <View style={[styles.skillBadge, { backgroundColor: skillLevel?.color }]}>
                <Ionicons name={skillLevel?.icon as any} size={12} color="#FFFFFF" />
                <Text style={styles.skillText}>{skillLevel?.label}</Text>
              </View>
            </View>
          </LinearGradient>
          
          <View style={styles.groupCardContent}>
            <Text style={styles.groupTitle}>{item.title}</Text>
            <Text style={styles.groupDescription}>{item.description}</Text>
            
            <View style={styles.groupDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="people" size={16} color="#8E8E93" />
                <Text style={styles.detailText}>{item.currentPlayers}/{item.maxPlayers} players</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="time" size={16} color="#8E8E93" />
                <Text style={styles.detailText}>{item.duration} min</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="location" size={16} color="#8E8E93" />
                <Text style={styles.detailText}>{item.location}</Text>
              </View>
            </View>
            
            <View style={styles.playersPreview}>
              {item.players.slice(0, 4).map((player, index) => (
                <View key={player.id} style={[styles.playerAvatar, { zIndex: 4 - index }]}> 
                  <Text style={styles.playerInitial}>{player.name.charAt(0)}</Text>
                </View>
              ))}
              {item.players.length > 4 && (
                <View style={styles.morePlayersIndicator}>
                  <Text style={styles.morePlayersText}>+{item.players.length - 4}</Text>
                </View>
              )}
            </View>
            
            <TouchableOpacity
              style={[styles.joinButton, item.status === 'full' && styles.fullButton]}
              onPress={() => joinGroup(item.id)}
              disabled={item.status === 'full'}
            >
              <LinearGradient 
                colors={item.status === 'full' ? ['#8E8E93', '#8E8E93'] : sport?.color || ['#667eea', '#764ba2']} 
                style={styles.joinButtonGradient}
              >
                <Text style={styles.joinButtonText}>
                  {item.status === 'full' ? 'Full' : 'Join Group'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Expanded Section */}
            {expandedGroupId === item.id && (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedTitle}>Players:</Text>
                {item.players.length === 0 ? (
                  <Text style={styles.expandedPlayerName}>No players yet</Text>
                ) : (
                  item.players.map(player => (
                    <Text key={player.id} style={styles.expandedPlayerName}>{player.name}</Text>
                  ))
                )}
                <Text style={styles.expandedTitle}>Date & Time:</Text>
                <Text style={styles.expandedDateTime}>
                  {item.dateTime ? new Date(item.dateTime).toLocaleString() : 'N/A'}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderLeaderboardItem = ({ item, index }: { item: UserStats; index: number }) => {
    const sport = SPORTS.find(s => s.id === item.sport);
    const levelInfo = SKILL_LEVELS.find(s => s.key === item.level);
    
    return (
      <View style={styles.leaderboardItem}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>#{index + 1}</Text>
          {index < 3 && (
            <Ionicons 
              name={index === 0 ? 'trophy' : index === 1 ? 'medal' : 'ribbon'} 
              size={20} 
              color={index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : '#CD7F32'} 
            />
          )}
        </View>
        
        <View style={styles.playerInfo}>
          <View style={styles.playerAvatar}>
            <Text style={styles.playerInitial}>U</Text>
          </View>
          <View style={styles.playerDetails}>
            <Text style={styles.playerName}>User {item.userId}</Text>
            <View style={styles.playerStats}>
              <Text style={styles.statText}>{item.gamesWon}W - {item.gamesLost}L</Text>
              <View style={[styles.levelBadge, { backgroundColor: levelInfo?.color }]}>
                <Text style={styles.levelText}>{levelInfo?.label}</Text>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.pointsContainer}>
          <Text style={styles.pointsText}>{item.points}</Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </View>
    );
  };

  const renderSocialPost = ({ item }: { item: SportsPost }) => {
    const sport = SPORTS.find(s => s.id === item.sport);
    
    return (
      <View style={styles.socialPost}>
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Text style={styles.userInitial}>{item.userName.charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.userName}>{item.userName}</Text>
              <Text style={styles.postTime}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>
          <View style={[styles.sportTag, { backgroundColor: sport?.color[0] }]}>
            <SportIcon sport={sport?.id} size={12} color="#FFFFFF" />
          </View>
        </View>
        
        <Text style={styles.postContent}>{item.content}</Text>
        
        {item.matchData && (
          <View style={styles.matchCard}>
            <Text style={styles.matchTitle}>Match Result</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreText}>
                {item.matchData.scores[0]} - {item.matchData.scores[1]}
              </Text>
            </View>
          </View>
        )}
        
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="heart-outline" size={20} color="#8E8E93" />
            <Text style={styles.actionText}>{item.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={20} color="#8E8E93" />
            <Text style={styles.actionText}>{item.comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCreateGroupModal = () => (
    <CreateSportsGroup
      visible={showCreateGroup}
      onClose={() => setShowCreateGroup(false)}
      onSuccess={() => {
        setShowCreateGroup(false);
        loadSportsGroups(); // Refresh the groups list
      }}
    />
  );

  const renderMyGroupCard = (item: SportsGroup) => {
    const sport = SPORTS.find(s => s.id === item.sport);
    const skillLevel = SKILL_LEVELS.find(s => s.key === item.skillLevel);
    
    return (
      <View style={styles.myGroupCard}>
        <LinearGradient colors={sport?.color || ['#667eea', '#764ba2']} style={styles.myGroupCardHeader}>
          <View style={styles.myGroupCardTop}>
            <View style={styles.sportInfo}>
              <SportIcon sport={sport?.id} size={20} color="#FFFFFF" />
              <Text style={styles.sportName}>{sport?.name}</Text>
            </View>
            <View style={[styles.skillBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name={skillLevel?.icon as any || 'star'} size={12} color="#FFFFFF" />
              <Text style={styles.skillText}>{skillLevel?.label}</Text>
            </View>
          </View>
        </LinearGradient>
        
        <View style={styles.myGroupCardContent}>
          <Text style={styles.groupTitle}>{item.title}</Text>
          <Text style={styles.groupDescription}>{item.description}</Text>
          
          <View style={styles.groupDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar" size={14} color="#8E8E93" />
              <Text style={styles.detailText}>
                {new Date(item.dateTime).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={14} color="#8E8E93" />
              <Text style={styles.detailText}>{item.duration} min</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="location" size={14} color="#8E8E93" />
              <Text style={styles.detailText}>{item.location}</Text>
            </View>
          </View>
          
          <View style={styles.myGroupActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chatbubble-outline" size={16} color="#4E54C8" />
              <Text style={[styles.actionText, { color: '#4E54C8' }]}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="people-outline" size={16} color="#4E54C8" />
              <Text style={[styles.actionText, { color: '#4E54C8' }]}>Members</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                console.log('Navigating to MyGroupSports with groupId:', item.id);
                navigation.navigate('MyGroupSports', { groupId: item.id });
              }}
            >
              <Ionicons name="trophy-outline" size={16} color="#4E54C8" />
              <Text style={[styles.actionText, { color: '#4E54C8' }]}>View Match</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="settings-outline" size={16} color="#8E8E93" />
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderMyGroupsModal = () => (
    <Modal visible={showMyGroups} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowMyGroups(false)}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>My Groups</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.modalContent}>
          {myGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#D1D1D6" />
              <Text style={styles.emptyStateTitle}>No Groups Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Join or create a group to start playing sports with others!
              </Text>
              <TouchableOpacity 
                style={styles.emptyStateButton}
                onPress={() => {
                  setShowMyGroups(false);
                  setShowCreateGroup(true);
                }}
              >
                <LinearGradient colors={['#4E54C8', '#8F94FB']} style={styles.emptyStateButtonGradient}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyStateButtonText}>Create Group</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={myGroups}
              renderItem={({ item }) => renderMyGroupCard(item)}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderMatchResultModal = () => (
    <Modal visible={showMatchResult} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowMatchResult(false)}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Match Result</Text>
          <TouchableOpacity onPress={submitMatchResult}>
            <Text style={styles.createButton}>Submit</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <View style={styles.scoreInput}>
            <View style={styles.teamScore}>
              <Text style={styles.teamLabel}>Team 1</Text>
              <TextInput
                style={styles.scoreField}
                value={matchForm.team1Score}
                onChangeText={(text) => setMatchForm({...matchForm, team1Score: text})}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.teamScore}>
              <Text style={styles.teamLabel}>Team 2</Text>
              <TextInput
                style={styles.scoreField}
                value={matchForm.team2Score}
                onChangeText={(text) => setMatchForm({...matchForm, team2Score: text})}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Match Duration (minutes)</Text>
            <TextInput
              style={styles.textInput}
              value={matchForm.duration}
              onChangeText={(text) => setMatchForm({...matchForm, duration: text})}
              placeholder="60"
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>MVP</Text>
            <TextInput
              style={styles.textInput}
              value={matchForm.mvp}
              onChangeText={(text) => setMatchForm({...matchForm, mvp: text})}
              placeholder="Player name"
            />
          </View>
          
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={matchForm.notes}
              onChangeText={(text) => setMatchForm({...matchForm, notes: text})}
              placeholder="Any additional notes about the match"
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <Image 
            source={require('../../assets/images/campus-life.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.appNameContainer}>
            <Text style={styles.appName}>YOGO Campus</Text>
            <Text style={styles.appSubtitle}>Sports Hub</Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.myGroupsButton} 
            onPress={() => setShowMyGroups(true)}
          >
            <LinearGradient colors={['#34C759', '#30D158']} style={styles.myGroupsGradient}>
              <Ionicons name="people" size={16} color="#FFFFFF" />
              <Text style={styles.myGroupsText}>My Groups</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateGroup(true)}>
            <LinearGradient colors={['#4E54C8', '#8F94FB']} style={styles.addButtonGradient}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {[
          { key: 'groups', label: 'Find Groups', icon: 'people' },
          { key: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
          { key: 'social', label: 'Social', icon: 'images' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={20} 
              color={activeTab === tab.key ? '#4E54C8' : '#8E8E93'} 
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'groups' && (
          <>
            {/* Sport Filters */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.filterContainer}
            >
              <TouchableOpacity
                style={[styles.filterPill, selectedSport === 'all' && styles.activeFilterPill]}
                onPress={() => setSelectedSport('all')}
              >
                <Text style={[styles.filterText, selectedSport === 'all' && styles.activeFilterText]}>
                  All
                </Text>
              </TouchableOpacity>
              {SPORTS.map((sport) => (
                <TouchableOpacity
                  key={sport.id}
                  style={[styles.filterPill, selectedSport === sport.id && styles.activeFilterPill]}
                  onPress={() => setSelectedSport(sport.id)}
                >
                  <Text style={[styles.filterText, selectedSport === sport.id && styles.activeFilterText]}>
                    {sport.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <FlatList
              data={filteredGroups}
              renderItem={renderGroupCard}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </>
        )}

        {activeTab === 'leaderboard' && (
          <FlatList
            data={userStats}
            renderItem={renderLeaderboardItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
        )}

        {activeTab === 'social' && (
          <>
            <TouchableOpacity 
              style={styles.fab}
              onPress={() => setShowMatchResult(true)}
            >
              <LinearGradient colors={['#FF6B35', '#F7931E']} style={styles.fabGradient}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
            
            <FlatList
              data={sportsPosts}
              renderItem={renderSocialPost}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </>
        )}
      </ScrollView>

      {/* Modals */}
      {renderCreateGroupModal()}
      {renderMyGroupsModal()}
      {renderMatchResultModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  appNameContainer: {
    flex: 1,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  appSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  myGroupsButton: {
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  myGroupsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  myGroupsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  addButton: {
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#F0F1FF',
    borderBottomWidth: 0,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  activeTabText: {
    color: '#4E54C8',
  },
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingBottom: 16,
    paddingRight: 20,
  },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  activeFilterPill: {
    backgroundColor: '#EEF0FF',
    borderColor: '#4E54C8',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  activeFilterText: {
    color: '#4E54C8',
    fontWeight: '600',
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  groupCardHeader: {
    padding: 20,
  },
  groupCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sportName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  skillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  groupCardContent: {
    padding: 20,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  groupDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  groupDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  playersPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4E54C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  playerInitial: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  morePlayersIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  morePlayersText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  joinButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  fullButton: {
    opacity: 0.6,
  },
  joinButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rankContainer: {
    width: 60,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rankText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  playerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  statText: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  pointsContainer: {
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4E54C8',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  socialPost: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4E54C8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  postTime: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  sportTag: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postContent: {
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  matchCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  matchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  scoreRow: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  createButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  sportOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  sportOption: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 12,
  },
  selectedSportOption: {
    borderColor: '#4E54C8',
  },
  sportOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  sportOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  skillLevelOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skillOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    gap: 8,
  },
  selectedSkillOption: {
    borderColor: '#4E54C8',
    backgroundColor: '#F0F1FF',
  },
  skillOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  scoreInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  teamScore: {
    flex: 1,
    alignItems: 'center',
  },
  teamLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  scoreField: {
    width: 80,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    fontSize: 32,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#F2F2F7',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  vsText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#8E8E93',
    marginHorizontal: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  // My Groups Modal Styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  emptyStateButton: {
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyStateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  myGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  myGroupCardHeader: {
    padding: 20,
  },
  myGroupCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  myGroupCardContent: {
    padding: 20,
  },
  myGroupActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    marginTop: 16,
  },
  // Add styles for expanded section
  expandedSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0F1FF',
    borderRadius: 12,
  },
  expandedTitle: {
    fontWeight: '700',
    marginBottom: 4,
    color: '#4E54C8',
  },
  expandedPlayerName: {
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 8,
    marginBottom: 2,
  },
  expandedDateTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    marginLeft: 8,
  },
});

export default SportsPlace;
