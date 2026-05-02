import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
  useColorScheme,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  updateDoc,
  doc,
  increment,
  arrayUnion,
  arrayRemove,
  getDocs,
  getDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import QnaPostCard from './QnaPostCard';
import QnaVoteBar from './QnaVoteBar';
// 1. Add imports for image picker
import * as ImagePicker from 'expo-image-picker';
import QnaProfile from './QnaProfile';
import { quickAwardPoints } from '../services/pointsService';

const { width, height } = Dimensions.get('window');

interface Question {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName?: string;
  isAnonymous: boolean;
  tags: string[];
  timestamp: any;
  upvotes: number;
  downvotes: number;
  points: number;
  answersCount: number;
  viewsCount: number;
  isResolved: boolean;
  imageUrl?: string;
  upvotesArray?: string[];
  downvotesArray?: string[];
  viewedBy?: string[];
}

const QnaForum: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Tag color palette for tag chips
  const tagColors = [
    '#FF6B35', // orange
    '#7C3AED', // purple
    '#10B981', // green
    '#3B82F6', // blue
    '#F59E42', // yellow-orange
    '#F43F5E', // pink
    '#FBBF24', // yellow
    '#6366F1', // indigo
    '#06B6D4', // cyan
    '#A21CAF', // deep purple
  ];
  
  // State variables
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showMyQuestionsOnly, setShowMyQuestionsOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'hot' | 'new' | 'top'>('hot');
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year' | 'all'>('week');
  const [showTimeFilterModal, setShowTimeFilterModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [popularTags, setPopularTags] = useState<string[]>([]);
  // Update voteStates to be a boolean map (questionId -> hasUpvoted)
  const [voteStates, setVoteStates] = useState<{ [questionId: string]: boolean }>({});
  
  // Add state for create question modal fields
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [tagsArray, setTagsArray] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Other');
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  // Always use the authenticated user from Firebase Auth
  const user = auth.currentUser;
  if (!user) {
    // Optionally, you can redirect to login or show an error if not authenticated
    throw new Error('User not authenticated. Please log in.');
  }
  const currentUser = {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'User',
    avatar: user.photoURL || undefined,
  };

  // Add state for profile modal
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{id: string, name: string, isAnonymous: boolean, profileImage?: string} | null>(null);
  const [authorProfiles, setAuthorProfiles] = useState<{[userId: string]: {profileImage?: string, points?: number}}>({});

  // Add state for user profile from Firestore
  const [userProfile, setUserProfile] = useState<{name: string, id: string, avatar?: string} | null>(null);

  // IMPORTANT: If you see a Firestore index error, open the link in the error and create the index in the Firebase Console.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setQuestions([]);
    let q: any = null;
    const baseRef = collection(db, 'qna_questions');
    // Sorting logic
    if (activeTab === 'hot') {
      q = query(
        baseRef,
        orderBy('lastActivity', 'desc'),
        orderBy('points', 'desc'),
        limit(50) // Fetch more to allow for client-side filtering
      );
    } else if (activeTab === 'new') {
      q = query(
        baseRef,
        orderBy('timestamp', 'desc'),
        limit(20)
      );
    } else if (activeTab === 'top') {
      let timeLimit = undefined;
      const now = new Date();
      if (timeFilter === 'week') {
        timeLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeFilter === 'month') {
        timeLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (timeFilter === 'year') {
        timeLimit = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      }
      if (timeLimit) {
        q = query(
          baseRef,
          where('timestamp', '>=', timeLimit),
          orderBy('timestamp', 'desc'),
          orderBy('points', 'desc'),
          limit(20)
        );
      } else {
        q = query(
          baseRef,
          orderBy('points', 'desc'),
          limit(20)
        );
      }
    }
    // Filters
    if (showMyQuestionsOnly) {
      q = query(
        baseRef,
        where('authorId', '==', currentUser.id),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
    }
    if (q) {
      unsubscribe = onSnapshot(q, (snapshot: any) => {
        let qs: Question[] = [];
        snapshot.forEach((doc: any) => {
          const data = doc.data();
          qs.push({
            id: doc.id,
            title: data.title,
            description: data.description,
            authorId: data.authorId,
            authorName: data.author,
            isAnonymous: data.isAnonymous,
            tags: data.tags || [],
            timestamp: data.timestamp,
            upvotes: data.upvotes ? data.upvotes.length : 0,
            downvotes: data.downvotes ? data.downvotes.length : 0,
            points: data.points || 0,
            answersCount: data.answersCount || 0,
            viewsCount: data.views || 0,
            isResolved: data.isResolved || false,
            imageUrl: data.imageUrl,
            upvotesArray: data.upvotes || [],
            downvotesArray: data.downvotes || [],
            viewedBy: data.viewedBy || [], // Add viewedBy for filtering
          });
        });
        // Client-side filtering
        if (selectedTags.length > 0) {
          qs = qs.filter(q => selectedTags.every(tag => q.tags.includes(tag)));
        }
        if (searchQuery.trim()) {
          const qstr = searchQuery.trim().toLowerCase();
          qs = qs.filter(q =>
            q.title.toLowerCase().includes(qstr) ||
            q.description.toLowerCase().includes(qstr) ||
            (q.tags && q.tags.some(tag => tag.toLowerCase().includes(qstr)))
          );
        }
        // Hot tab: unread first
        if (activeTab === 'hot') {
          const unread = qs.filter(q => !(q.viewedBy && q.viewedBy.includes(currentUser.id)));
          const read = qs.filter(q => q.viewedBy && q.viewedBy.includes(currentUser.id));
          // Only show read if no unread left
          setQuestions(unread.length > 0 ? unread : read);
        } else {
          setQuestions(qs);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => unsubscribe && unsubscribe();
  }, [activeTab, timeFilter, searchQuery, selectedTags, showMyQuestionsOnly]);

  // Fetch user vote state for all visible questions
  useEffect(() => {
    const fetchVotes = async () => {
      const newVoteStates: { [questionId: string]: boolean } = {};
      for (const q of questions) {
        const questionRef = doc(db, 'qna_questions', q.id);
        const questionSnap = await getDoc(questionRef);
        if (!questionSnap.exists()) {
          newVoteStates[q.id] = false;
          continue;
        }
        const data = questionSnap.data();
        newVoteStates[q.id] = !!(data.upvotes && data.upvotes.includes(currentUser.id));
      }
      setVoteStates(newVoteStates);
    };
    if (questions.length > 0) fetchVotes();
    else setVoteStates({});
  }, [questions]);

  // Fetch author profile images and points for visible questions
  useEffect(() => {
    const fetchProfiles = async () => {
      const ids = Array.from(new Set(questions.filter(q => !q.isAnonymous).map(q => q.authorId)));
      if (ids.length === 0) return setAuthorProfiles({});
      const profiles: {[userId: string]: {profileImage?: string, points?: number}} = {};
      for (const id of ids) {
        try {
          const docSnap = await getDoc(doc(db, 'users', id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            profiles[id] = { profileImage: data.profileImage, points: data.points };
          }
        } catch {}
      }
      setAuthorProfiles(profiles);
    };
    if (questions.length > 0) fetchProfiles();
    else setAuthorProfiles({});
  }, [questions]);

  // Fetch user profile from Firestore on mount
  useEffect(() => {
    const fetchProfile = async () => {
      const userDoc = await getDoc(doc(db, 'users', currentUser.id));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserProfile({
          name: data.name || currentUser.name,
          id: currentUser.id,
          avatar: data.profileImage || currentUser.avatar,
        });
      } else {
        setUserProfile({ name: currentUser.name, id: currentUser.id, avatar: currentUser.avatar });
      }
    };
    fetchProfile();
  }, [currentUser.id]);

  // Remove loadQuestions, onRefresh, and RefreshControl from FlatList
  // Remove loadQuestions, onRefresh, and RefreshControl from FlatList

  const PAGE_SIZE = 20;

  const handleLoadMore = () => {
    // Only load more if not already loading and if we have at least PAGE_SIZE questions
    if (!loadingMore && questions.length >= PAGE_SIZE) {
      setLoadingMore(true);
      // TODO: Implement actual pagination logic here (fetch next page from Firestore)
      // For now, just simulate loading
      setTimeout(() => setLoadingMore(false), 1000);
    }
  };

  // Navigation to post details
  const navigateToQuestion = (question: Question) => {
    // @ts-ignore
    navigation.navigate('QnaForumPost', { questionId: question.id });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setShowMyQuestionsOnly(false);
  };

  // 2. Add tag input handler
  const handleTagInput = (text: string) => {
    setNewTags(text);
    const tags = text.split(',').map(t => t.trim()).filter(Boolean);
    setTagsArray(tags);
  };
  const removeTag = (tag: string) => {
    setTagsArray(prev => prev.filter(t => t !== tag));
    setNewTags(prev => prev.split(',').filter(t => t.trim() !== tag).join(','));
  };

  // 4. Add image picker handler
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPickedImage(result.assets[0].uri);
    }
  };

  // In createQuestion, use userProfile.name and userProfile.id for author fields
  const createQuestion = async (questionData: any) => {
    if (!userProfile) {
      Alert.alert('Error', 'User profile not loaded. Please try again.');
      return;
    }
    try {
      await addDoc(collection(db, 'qna_questions'), {
        title: questionData.title,
        description: questionData.description,
        author: userProfile.name,
        authorId: userProfile.id,
        tags: questionData.tags || [],
        category: questionData.category || 'Other',
        timestamp: serverTimestamp(),
        upvotes: [],
        downvotes: [],
        points: 0,
        answersCount: 0,
        views: 0,
        lastActivity: serverTimestamp(),
        imageUrl: questionData.imageUrl || null,
      });
      await quickAwardPoints.doubtAsked();
      setShowCreateModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to post question.');
    }
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Update handleVote to only handle upvotes (toggle)
  const handleVote = async (questionId: string) => {
    try {
      const questionRef = doc(db, 'qna_questions', questionId);
      const questionSnap = await getDoc(questionRef);
      if (!questionSnap.exists()) return;
      const data = questionSnap.data();
      const upvotes: string[] = data.upvotes || [];
      const hasUpvoted = upvotes.includes(currentUser.id);
      let updates: any = { lastActivity: serverTimestamp() };
      if (hasUpvoted) {
        updates.upvotes = arrayRemove(currentUser.id);
        updates.points = increment(-1);
      } else {
        updates.upvotes = arrayUnion(currentUser.id);
        updates.points = increment(1);
      }
      await updateDoc(questionRef, updates);
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to register your upvote. Please try again.');
    }
  };

  const handleAuthorPress = (authorId: string, authorName: string, isAnonymous: boolean) => {
    setSelectedUser({
      id: authorId,
      name: authorName,
      isAnonymous,
      profileImage: authorProfiles[authorId]?.profileImage,
    });
    setProfileModalVisible(true);
  };

  // In renderQuestionCard, move QnaVoteBar inside QnaPostCard. Pass upvotes, downvotes, currentUserId, and onVoteChange as props to QnaPostCard. Remove the outer wrapping View with flexDirection: 'row'.
  const renderQuestionCard = ({ item }: { item: Question }) => (
    <QnaPostCard
      question={item}
      upvotes={item.upvotesArray || []}
      downvotes={item.downvotesArray || []}
      currentUserId={currentUser.id}
      onVoteChange={(upvotes, downvotes) => {
        // Optionally update local state if you want instant UI update
      }}
      onPress={() => navigateToQuestion(item)}
      onAuthorPress={() => handleAuthorPress(item.authorId, item.authorName || 'Unknown User', item.isAnonymous)}
      authorProfileImage={authorProfiles[item.authorId]?.profileImage}
      authorPoints={authorProfiles[item.authorId]?.points}
    />
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Filter Tags */}
      {popularTags.length > 0 && (
        <View style={styles.popularTagsContainer}>
          <Text style={[styles.sectionTitle, isDark ? styles.textDark : null]}>
            Popular Tags
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsScrollView}
          >
            {popularTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagChip,
                  selectedTags.includes(tag) && styles.selectedTagChip,
                  isDark ? styles.tagChipDark : null
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[
                  styles.tagText,
                  selectedTags.includes(tag) && styles.selectedTagText,
                  isDark ? styles.textDark : null
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* Active Filters */}
      {(selectedTags.length > 0 || searchQuery || showMyQuestionsOnly) && (
        <View style={styles.activeFiltersContainer}>
          <Text style={[styles.activeFiltersTitle, isDark ? styles.textDark : null]}>
            Active Filters
          </Text>
          <View style={styles.activeFiltersRow}>
            {selectedTags.map((tag) => (
              <View key={tag} style={[styles.activeFilterChip, isDark ? styles.activeFilterChipDark : null]}>
                <Text style={[styles.activeFilterText, isDark ? styles.textDark : null]}>
                  {tag}
                </Text>
                <TouchableOpacity onPress={() => toggleTag(tag)}>
                  <Ionicons name="close" size={16} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                </TouchableOpacity>
              </View>
            ))}
            
            {searchQuery && (
              <View style={[styles.activeFilterChip, isDark ? styles.activeFilterChipDark : null]}>
                <Text style={[styles.activeFilterText, isDark ? styles.textDark : null]}>
                  Search: {searchQuery}
                </Text>
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close" size={16} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                </TouchableOpacity>
              </View>
            )}
            
            {showMyQuestionsOnly && (
              <View style={[styles.activeFilterChip, isDark ? styles.activeFilterChipDark : null]}>
                <Text style={[styles.activeFilterText, isDark ? styles.textDark : null]}>
                  My Questions
                </Text>
                <TouchableOpacity onPress={() => setShowMyQuestionsOnly(false)}>
                  <Ionicons name="close" size={16} color={isDark ? '#FFFFFF' : '#1C1C1E'} />
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.clearFiltersButton, isDark ? styles.clearFiltersButtonDark : null]}
              onPress={clearFilters}
            >
              <Text style={[styles.clearFiltersText, isDark ? styles.textDark : null]}>
                Clear All
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="chatbubbles-outline"
        size={64}
        color={isDark ? '#3A3A3C' : '#D1D1D6'}
      />
      <Text style={[styles.emptyStateTitle, isDark ? styles.textDark : null]}>
        No questions found
      </Text>
      <Text style={[styles.emptyStateText, isDark ? styles.textDark : null]}>
        Be the first to ask a question or adjust your filters
      </Text>
      
      {(selectedTags.length > 0 || searchQuery || showMyQuestionsOnly) && (
        <TouchableOpacity
          style={[styles.clearFiltersButtonLarge, isDark ? styles.clearFiltersButtonDark : null]}
          onPress={clearFilters}
        >
          <Text style={[styles.clearFiltersTextLarge, isDark ? styles.textDark : null]}>
            Clear Filters
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTimeFilterModal = () => (
    <View style={[
      styles.timeFilterModal,
      isDark ? styles.timeFilterModalDark : null,
      {
        top: 120,
        right: 16,
      }
    ]}>
      {['week', 'month', 'year', 'all'].map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.timeFilterOption,
            timeFilter === filter && styles.activeTimeFilterOption,
            isDark ? styles.timeFilterOptionDark : null
          ]}
          onPress={() => {
            setTimeFilter(filter as any);
            setShowTimeFilterModal(false);
          }}
        >
          <Text style={[
            styles.timeFilterText,
            timeFilter === filter && styles.activeTimeFilterText,
            isDark ? styles.textDark : null
          ]}>
            {filter === 'all' ? 'All Time' : `Past ${filter}`}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[
        styles.container,
        isDark ? styles.containerDark : null
      ]}>
        <View style={[
          styles.loadingContainer,
          isDark ? styles.loadingContainerDark : null
        ]}>
          <ActivityIndicator size="large" color={isDark ? '#FFFFFF' : '#FF6B35'} />
          <Text style={[
            styles.loadingText,
            isDark ? styles.textDark : null
          ]}>
            Loading questions...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={[
        styles.container,
        isDark ? styles.containerDark : null
      ]}>
        <View style={styles.emptyState}>
          <Ionicons
            name="chatbubbles-outline"
            size={64}
            color={isDark ? '#3A3A3C' : '#D1D1D6'}
          />
          <Text style={[styles.emptyStateTitle, isDark ? styles.textDark : null]}>
            No questions found
          </Text>
          <Text style={[styles.emptyStateText, isDark ? styles.textDark : null]}>
            Be the first to ask a question or adjust your filters
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      isDark ? styles.containerDark : null,
      { paddingTop: insets.top, paddingBottom: insets.bottom }
    ]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <Animated.View style={[
        styles.header,
        { opacity: headerOpacity },
        isDark ? styles.headerDark : null
      ]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? '#FFFFFF' : '#1C1C1E'}
            />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={[
              styles.headerTitle,
              isDark ? styles.textDark : null
            ]}>
              Q&A Forum
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[
                styles.myQuestionsButton,
                showMyQuestionsOnly && styles.myQuestionsButtonActive,
                isDark ? styles.myQuestionsButtonDark : null
              ]}
              onPress={() => setShowMyQuestionsOnly(!showMyQuestionsOnly)}
            >
              <Ionicons
                name="person"
                size={20}
                color={showMyQuestionsOnly ? '#FFFFFF' : isDark ? '#FFFFFF' : '#1C1C1E'}
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Search Bar */}
        <View style={[
          styles.searchContainer,
          isDark ? styles.searchContainerDark : null
        ]}>
          <Ionicons
            name="search"
            size={20}
            color={isDark ? '#8E8E93' : '#8E8E93'}
            style={styles.searchIcon}
          />
          <TextInput
            style={[
              styles.searchInput,
              isDark ? styles.searchInputDark : null
            ]}
            placeholder="Search questions, tags, or users..."
            placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchButton}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={isDark ? '#8E8E93' : '#8E8E93'}
              />
            </TouchableOpacity>
          ) : null}
        </View>
        
        {/* Tab Bar */}
        <View style={[
          styles.tabBar,
          isDark ? styles.tabBarDark : null
        ]}>
          {(['hot', 'new', 'top'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && styles.activeTab,
                isDark ? styles.tabDark : null,
                activeTab === tab && isDark && styles.activeTabDark
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
                isDark ? styles.textDark : null
              ]}>
                {tab === 'hot' ? '🔥 Hot' :
                 tab === 'new' ? '🆕 New' :
                 '⭐ Top'}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* Time filter button for Top tab */}
          {activeTab === 'top' && (
            <TouchableOpacity
              style={[
                styles.timeFilterButton,
                isDark ? styles.timeFilterButtonDark : null
              ]}
              onPress={() => setShowTimeFilterModal(!showTimeFilterModal)}
            >
              <Text style={[
                styles.timeFilterButtonText,
                isDark ? styles.textDark : null
              ]}>
                {timeFilter === 'all' ? 'All Time' : 
                 timeFilter === 'week' ? 'Week' :
                 timeFilter === 'month' ? 'Month' : 'Year'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={isDark ? '#FFFFFF' : '#1C1C1E'}
              />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
      
      {/* Time Filter Modal */}
      {showTimeFilterModal && renderTimeFilterModal()}
      
      {/* Question List */}
      <Animated.FlatList
        data={questions}
        renderItem={renderQuestionCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={null}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore && questions.length >= PAGE_SIZE ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator
                size="small"
                color={isDark ? '#FFFFFF' : '#FF6B35'}
              />
              <Text style={[
                styles.loadingMoreText,
                isDark ? styles.textDark : null
              ]}>
                Loading more questions...
              </Text>
            </View>
          ) : null
        }
      />
      
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowCreateModal(true);
        }}
      >
        <LinearGradient
          colors={['#FF6B35', '#FF8C66']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
      
      {/* Create Question Modal */}
      {showCreateModal && (
        <View style={[
          styles.modalContainer,
          isDark ? styles.modalContainerDark : null
        ]}>
          <View style={[
            styles.modalContent,
            isDark ? styles.modalContentDark : null
          ]}>
            <View style={styles.modalHeader}>
              <Text style={[
                styles.modalTitle,
                isDark ? styles.textDark : null
              ]}>
                Create Question
              </Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? '#FFFFFF' : '#1C1C1E'}
                />
              </TouchableOpacity>
            </View>
            {/* Create Question Form */}
            <View style={styles.createForm}>
              <Text style={[
                styles.formLabel,
                isDark ? styles.textDark : null
              ]}>
                Title
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  isDark ? styles.formInputDark : null
                ]}
                placeholder="Enter your question title"
                placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                value={newTitle}
                onChangeText={setNewTitle}
              />
              <Text style={[
                styles.formLabel,
                isDark ? styles.textDark : null
              ]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.formTextArea,
                  isDark ? styles.formInputDark : null
                ]}
                placeholder="Provide details about your question"
                placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={newDescription}
                onChangeText={setNewDescription}
              />
              <Text style={[
                styles.formLabel,
                isDark ? styles.textDark : null
              ]}>
                Tags
              </Text>
              <TextInput
                style={[styles.formInput, isDark ? styles.formInputDark : null]}
                placeholder="e.g. react-native, firebase"
                placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                value={newTags}
                onChangeText={handleTagInput}
              />
              {/* Add a color palette for tags */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                {tagsArray.map((tag, idx) => (
                  <View
                    key={tag}
                    style={[styles.tagChip, isDark ? styles.tagChipDark : null, {
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginRight: 8,
                      marginBottom: 8,
                      backgroundColor: tagColors[idx % tagColors.length],
                    }]}
                  >
                    <Text style={[styles.tagText, isDark ? styles.textDark : null, { color: '#fff', fontWeight: '600' }]}>{tag}</Text>
                    <TouchableOpacity onPress={() => removeTag(tag)}>
                      <Ionicons name="close" size={14} color={'#fff'} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <Text style={[styles.formLabel, isDark ? styles.textDark : null]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {['Food', 'Events', 'Hostel Life', 'Meme', 'Nature', 'Academic', 'Other'].map(category => (
                  <TouchableOpacity
                    key={category}
                    style={{
                      backgroundColor: selectedCategory === category ? '#FF6B35' : (isDark ? '#3A3A3C' : '#E9ECEF'),
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      marginRight: 8,
                    }}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={{ color: selectedCategory === category ? '#fff' : (isDark ? '#fff' : '#1C1C1E'), fontWeight: '600' }}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[styles.formLabel, isDark ? styles.textDark : null]}>Image (optional)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={pickImage} style={{ backgroundColor: '#FF6B35', borderRadius: 8, padding: 10, marginRight: 12 }}>
                  <Ionicons name="image" size={20} color="#fff" />
                </TouchableOpacity>
                {pickedImage && (
                  <Image source={{ uri: pickedImage }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                )}
              </View>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isDark ? styles.submitButtonDark : null
                ]}
                onPress={async () => {
                  if (!newTitle.trim() || !newDescription.trim()) {
                    Alert.alert('Error', 'Title and description are required.');
                    return;
                  }
                  let imageUrl = null;
                  if (pickedImage) {
                    // TODO: Upload image to your storage and get URL
                    imageUrl = pickedImage;
                  }
                  await createQuestion({
                    title: newTitle.trim(),
                    description: newDescription.trim(),
                    tags: tagsArray,
                    category: selectedCategory,
                    imageUrl,
                  });
                  setNewTitle('');
                  setNewDescription('');
                  setNewTags('');
                  setTagsArray([]);
                  setPickedImage(null);
                  setSelectedCategory('Other');
                }}
              >
                <Text style={styles.submitButtonText}>
                  Post Question
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Add QnaProfile modal at the end of the component */}
      {profileModalVisible && selectedUser && (
        <QnaProfile
          userId={selectedUser.id}
          username={selectedUser.name}
          isAnonymous={selectedUser.isAnonymous}
          isVisible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F6FF', // very light blue
  },
  containerDark: {
    backgroundColor: '#181C24', // deep blue-gray for dark mode
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  headerDark: {
    backgroundColor: '#2C2C2E',
    borderBottomColor: '#3A3A3C',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  headerRight: {
    width: 40,
  },
  myQuestionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myQuestionsButtonActive: {
    backgroundColor: '#FF6B35',
  },
  myQuestionsButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 44,
  },
  searchContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    height: 44,
  },
  searchInputDark: {
    color: '#FFFFFF',
  },
  clearSearchButton: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 4,
  },
  tabBarDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabDark: {
    backgroundColor: 'transparent',
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  activeTabDark: {
    backgroundColor: '#3A3A3C',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6E7B8B',
  },
  activeTabText: {
    color: '#FF6B35',
  },
  timeFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  timeFilterButtonDark: {
    backgroundColor: '#3A3A3C',
  },
  timeFilterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginRight: 4,
  },
  timeFilterModal: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  timeFilterModalDark: {
    backgroundColor: '#2C2C2E',
  },
  timeFilterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  timeFilterOptionDark: {
    backgroundColor: 'transparent',
  },
  activeTimeFilterOption: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
  },
  timeFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  activeTimeFilterText: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 80,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  popularTagsContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  tagsScrollView: {
    flexDirection: 'row',
  },
  tagChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedTagChip: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
  },
  tagText: {
    fontSize: 14,
    color: '#6E7B8B',
  },
  selectedTagText: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  activeFiltersContainer: {
    marginBottom: 16,
  },
  activeFiltersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  activeFilterChipDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeFilterText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginRight: 4,
  },
  clearFiltersButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  clearFiltersButtonDark: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
  },
  clearFiltersText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
  clearFiltersButtonLarge: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  clearFiltersTextLarge: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  questionCard: {
    flexDirection: 'row',
    backgroundColor: '#E5D9F2', // user-requested light color
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  questionCardDark: {
    backgroundColor: 'rgba(36,48,72,0.85)', // glassy deep blue for dark mode
  },
  voteColumn: {
    alignItems: 'center',
    marginRight: 12,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
  },
  voteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginVertical: 4,
  },
  upvotedButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
  },
  downvotedButton: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  voteCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginVertical: 4,
  },
  positiveVotes: {
    color: '#FF6B35',
  },
  negativeVotes: {
    color: '#7C3AED',
  },
  contentColumn: {
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  anonymousAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  authorText: {
    fontSize: 14,
    color: '#6E7B8B',
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    lineHeight: 22,
  },
  questionDescription: {
    fontSize: 14,
    color: '#6E7B8B',
    marginBottom: 12,
    lineHeight: 20,
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    color: '#6E7B8B',
    marginLeft: 4,
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resolvedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
  },
  loadingContainerDark: {
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
  },
  loadingText: {
    fontSize: 16,
    color: '#1C1C1E',
    marginTop: 16,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#6E7B8B',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6E7B8B',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainerDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: width * 0.9,
    maxHeight: height * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  modalContentDark: {
    backgroundColor: '#2C2C2E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  createForm: {
    padding: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1C1C1E',
    marginBottom: 16,
  },
  formInputDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
  },
  formTextArea: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1C1C1E',
    marginBottom: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDark: {
    backgroundColor: '#FF6B35',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  textDark: {
    color: '#FFFFFF',
  },
  cardGlassModern: {
    backgroundColor: 'rgba(240,246,255,0.85)', // very light blue glassy
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)', // subtle black border for glassmorphism
    marginHorizontal: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  cardGlassModernDark: {
    backgroundColor: 'rgba(36,48,72,0.85)', // glassy deep blue for dark mode
    borderColor: 'rgba(0,0,0,0.18)', // slightly stronger black border in dark mode
    borderWidth: 1,
  },
});

export default QnaForum;
