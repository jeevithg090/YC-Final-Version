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
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { collection, addDoc, onSnapshot, query, orderBy, where, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

// Firebase Console Action: 
// 1. Create Firestore collection: 'sports_posts'
// 2. Create composite index:
//    - Collection: 'sports_posts' | Fields: sport (Ascending), createdAt (Descending)
// 3. Set Firestore rules to allow read/write access for authenticated users

const { width, height } = Dimensions.get('window');

// TypeScript Interfaces
interface SportsPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  sport: string;
  content: string;
  imageUrl?: string;
  matchStats?: {
    score?: string;
    duration?: string;
    location?: string;
    result?: 'win' | 'loss' | 'draw';
    mvp?: string;
    highlights?: string[];
  };
  likes: string[];
  comments: Comment[];
  createdAt: number;
  isHighlight: boolean;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
}

type SportsSocialNavigationProp = NativeStackNavigationProp<{
  SportsPlace: undefined;
}>;

const SPORTS = [
  { id: 'all', name: 'All Sports', icon: 'trophy', color: ['#667eea', '#764ba2'] as const },
  { id: 'basketball', name: 'Basketball', icon: 'basketball', color: ['#FF6B35', '#F7931E'] as const },
  { id: 'badminton', name: 'Badminton', icon: 'badminton', color: ['#4ECDC4', '#44A08D'] as const },
  { id: 'swimming', name: 'Swimming', icon: 'swimmer', color: ['#667eea', '#764ba2'] as const },
  { id: 'tennis', name: 'Tennis', icon: 'tennis', color: ['#fdbb2d', '#22c1c3'] as const },
  { id: 'football', name: 'Football', icon: 'football', color: ['#56ab2f', '#a8e6cf'] as const },
  { id: 'hockey', name: 'Hockey', icon: 'hockey-puck', color: ['#e96443', '#904e95'] as const },
  { id: 'cricket', name: 'Cricket', icon: 'cricket', color: ['#FF8008', '#FFC837'] as const },
];

const SportsSocial: React.FC = () => {
  const navigation = useNavigation<SportsSocialNavigationProp>();
  
  // State management
  const [selectedSport, setSelectedSport] = useState('all');
  const [posts, setPosts] = useState<SportsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({
    content: '',
    sport: 'basketball',
    imageUrl: '',
    matchStats: {
      score: '',
      duration: '',
      location: '',
      result: 'win' as 'win' | 'loss' | 'draw',
      mvp: '',
      highlights: [] as string[]
    }
  });

  useEffect(() => {
    loadPosts();
  }, [selectedSport]);

  const loadPosts = () => {
    // Firebase Console Action: Create composite index for 'sports_posts' collection:
    // Fields: sport (Ascending), createdAt (Descending)
    // Or use the provided URL: https://console.firebase.google.com/v1/r/project/yogo-campus/firestore/indexes
    
    let postsQuery;
    if (selectedSport === 'all') {
      postsQuery = query(
        collection(db, 'sports_posts'),
        orderBy('createdAt', 'desc')
      );
    } else {
      postsQuery = query(
        collection(db, 'sports_posts'),
        where('sport', '==', selectedSport),
        orderBy('createdAt', 'desc')
      );
    }
    
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SportsPost[];
      
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error('Error loading posts:', error);
      setLoading(false);
    });

    return unsubscribe;
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts();
    setRefreshing(false);
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      const postRef = doc(db, 'sports_posts', postId);
      const currentUserId = auth.currentUser?.uid || 'anonymous';
      
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(currentUserId)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(currentUserId)
        });
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleComment = async (postId: string, commentText: string) => {
    if (!commentText.trim()) return;

    try {
      const postRef = doc(db, 'sports_posts', postId);
      const newComment: Comment = {
        id: Date.now().toString(),
        userId: auth.currentUser?.uid || 'anonymous',
        userName: auth.currentUser?.displayName || 'Anonymous User',
        content: commentText.trim(),
        createdAt: Date.now()
      };

      await updateDoc(postRef, {
        comments: arrayUnion(newComment)
      });
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setNewPost(prev => ({
        ...prev,
        imageUrl: result.assets[0].uri
      }));
    }
  };

  const createPost = async () => {
    if (!newPost.content.trim()) {
      Alert.alert('Error', 'Please add some content to your post');
      return;
    }

    try {
      const postData: Omit<SportsPost, 'id'> = {
        userId: auth.currentUser?.uid || 'anonymous',
        userName: auth.currentUser?.displayName || 'Anonymous User',
        userAvatar: auth.currentUser?.photoURL || '',
        sport: newPost.sport,
        content: newPost.content,
        imageUrl: newPost.imageUrl || undefined,
        matchStats: newPost.matchStats.score ? newPost.matchStats : undefined,
        likes: [],
        comments: [],
        createdAt: Date.now(),
        isHighlight: false
      };

      await addDoc(collection(db, 'sports_posts'), postData);
      
      // Reset form
      setNewPost({
        content: '',
        sport: 'basketball',
        imageUrl: '',
        matchStats: {
          score: '',
          duration: '',
          location: '',
          result: 'win',
          mvp: '',
          highlights: []
        }
      });
      
      setShowCreateModal(false);
      Alert.alert('Success', 'Post created successfully!');
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post');
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

  const renderPost = ({ item }: { item: SportsPost }) => {
    const currentUserId = auth.currentUser?.uid || 'anonymous';
    const isLiked = item.likes.includes(currentUserId);
    const sport = SPORTS.find(s => s.id === item.sport);
    
    return (
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Text style={styles.avatarText}>{item.userName.charAt(0)}</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{item.userName}</Text>
              <View style={styles.postMeta}>
                <FontAwesome5 name={sport?.icon} size={12} color={sport?.color[0]} />
                <Text style={styles.sportName}>{sport?.name}</Text>
                <Text style={styles.postTime}>
                  • {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Post Content */}
        <Text style={styles.postContent}>{item.content}</Text>

        {/* Match Stats */}
        {item.matchStats && (
          <View style={styles.matchStatsContainer}>
            <LinearGradient colors={sport?.color || ['#667eea', '#764ba2']} style={styles.matchStatsHeader}>
              <Ionicons name="trophy" size={16} color="#FFFFFF" />
              <Text style={styles.matchStatsTitle}>Match Stats</Text>
            </LinearGradient>
            <View style={styles.matchStatsContent}>
              {item.matchStats.score && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Score:</Text>
                  <Text style={styles.statValue}>{item.matchStats.score}</Text>
                </View>
              )}
              {item.matchStats.result && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Result:</Text>
                  <Text style={[
                    styles.statValue,
                    { color: item.matchStats.result === 'win' ? '#4CAF50' : 
                             item.matchStats.result === 'loss' ? '#F44336' : '#FF9800' }
                  ]}>
                    {item.matchStats.result.toUpperCase()}
                  </Text>
                </View>
              )}
              {item.matchStats.mvp && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>MVP:</Text>
                  <Text style={styles.statValue}>{item.matchStats.mvp}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Post Image */}
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
        )}

        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(item.id, isLiked)}
          >
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={20} 
              color={isLiked ? "#FF3B30" : "#8E8E93"} 
            />
            <Text style={[styles.actionText, isLiked && styles.likedText]}>
              {item.likes.length}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={20} color="#8E8E93" />
            <Text style={styles.actionText}>{item.comments.length}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={20} color="#8E8E93" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Comments Preview */}
        {item.comments.length > 0 && (
          <View style={styles.commentsPreview}>
            {item.comments.slice(0, 2).map((comment, index) => (
              <View key={index} style={styles.commentItem}>
                <Text style={styles.commentUser}>{comment.userName}</Text>
                <Text style={styles.commentText}>{comment.content}</Text>
              </View>
            ))}
            {item.comments.length > 2 && (
              <TouchableOpacity>
                <Text style={styles.viewMoreComments}>
                  View all {item.comments.length} comments
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderCreatePostModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCreateModal(false)}>
            <Ionicons name="close" size={24} color="#8E8E93" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Create Post</Text>
          <TouchableOpacity onPress={createPost}>
            <Text style={styles.postButton}>Post</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Sport Selection */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Sport</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.sportOptions}>
                {SPORTS.filter(s => s.id !== 'all').map((sport) => (
                  <TouchableOpacity
                    key={sport.id}
                    style={[
                      styles.sportOption,
                      newPost.sport === sport.id && styles.selectedSportOption
                    ]}
                    onPress={() => setNewPost(prev => ({ ...prev, sport: sport.id }))}
                  >
                    <FontAwesome5 
                      name={sport.icon} 
                      size={16} 
                      color={newPost.sport === sport.id ? '#FFFFFF' : '#8E8E93'} 
                    />
                    <Text style={[
                      styles.sportOptionText,
                      newPost.sport === sport.id && styles.selectedSportOptionText
                    ]}>
                      {sport.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Content */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>What's happening?</Text>
            <TextInput
              style={styles.contentInput}
              placeholder="Share your sports moment, achievement, or experience..."
              multiline
              numberOfLines={4}
              value={newPost.content}
              onChangeText={(text) => setNewPost(prev => ({ ...prev, content: text }))}
            />
          </View>

          {/* Image */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Add Photo</Text>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              {newPost.imageUrl ? (
                <Image source={{ uri: newPost.imageUrl }} style={styles.selectedImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera" size={32} color="#8E8E93" />
                  <Text style={styles.imagePlaceholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Match Stats */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Match Stats (Optional)</Text>
            <View style={styles.statsForm}>
              <TextInput
                style={styles.statInput}
                placeholder="Score (e.g., 21-18, 3-2)"
                value={newPost.matchStats.score}
                onChangeText={(text) => setNewPost(prev => ({
                  ...prev,
                  matchStats: { ...prev.matchStats, score: text }
                }))}
              />
              <TextInput
                style={styles.statInput}
                placeholder="Duration (e.g., 45 min)"
                value={newPost.matchStats.duration}
                onChangeText={(text) => setNewPost(prev => ({
                  ...prev,
                  matchStats: { ...prev.matchStats, duration: text }
                }))}
              />
              <TextInput
                style={styles.statInput}
                placeholder="Location"
                value={newPost.matchStats.location}
                onChangeText={(text) => setNewPost(prev => ({
                  ...prev,
                  matchStats: { ...prev.matchStats, location: text }
                }))}
              />
              <TextInput
                style={styles.statInput}
                placeholder="MVP Player"
                value={newPost.matchStats.mvp}
                onChangeText={(text) => setNewPost(prev => ({
                  ...prev,
                  matchStats: { ...prev.matchStats, mvp: text }
                }))}
              />
              
              {/* Result Selection */}
              <View style={styles.resultSelection}>
                {['win', 'loss', 'draw'].map((result) => (
                  <TouchableOpacity
                    key={result}
                    style={[
                      styles.resultOption,
                      newPost.matchStats.result === result && styles.selectedResultOption
                    ]}
                    onPress={() => setNewPost(prev => ({
                      ...prev,
                      matchStats: { ...prev.matchStats, result: result as any }
                    }))}
                  >
                    <Text style={[
                      styles.resultOptionText,
                      newPost.matchStats.result === result && styles.selectedResultOptionText
                    ]}>
                      {result.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <FontAwesome5 name="users" size={64} color="#E5E5EA" />
      <Text style={styles.emptyStateTitle}>No Posts Yet</Text>
      <Text style={styles.emptyStateText}>
        Be the first to share your sports moments and achievements!
      </Text>
      <TouchableOpacity 
        style={styles.createFirstPostButton}
        onPress={() => setShowCreateModal(true)}
      >
        <Text style={styles.createFirstPostText}>Create First Post</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sports Social</Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#4E54C8" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.headerSubtitle}>Share your sports moments and achievements</Text>
      </View>

      {/* Sport Selector */}
      {renderSportSelector()}

      {/* Content */}
      {posts.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          style={styles.postsList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Post Modal */}
      {renderCreatePostModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginBottom: 8,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  createButton: {
    padding: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
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
  postsList: {
    flex: 1,
    padding: 16,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4E54C8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sportName: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  postTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  moreButton: {
    padding: 8,
  },
  postContent: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 24,
    marginBottom: 12,
  },
  matchStatsContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  matchStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  matchStatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  matchStatsContent: {
    backgroundColor: '#F8F9FA',
    padding: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  likedText: {
    color: '#FF3B30',
  },
  commentsPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  commentItem: {
    marginBottom: 6,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  commentText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  viewMoreComments: {
    fontSize: 14,
    color: '#4E54C8',
    fontWeight: '500',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  createFirstPostButton: {
    backgroundColor: '#4E54C8',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
  },
  createFirstPostText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
  postButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  sportOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  sportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    gap: 8,
  },
  selectedSportOption: {
    backgroundColor: '#4E54C8',
  },
  sportOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  selectedSportOptionText: {
    color: '#FFFFFF',
  },
  contentInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1C1C1E',
    height: 120,
    textAlignVertical: 'top',
  },
  imageButton: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 8,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  statsForm: {
    gap: 12,
  },
  statInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  resultSelection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  resultOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginHorizontal: 4,
  },
  selectedResultOption: {
    backgroundColor: '#4E54C8',
  },
  resultOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  selectedResultOptionText: {
    color: '#FFFFFF',
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
});

export default SportsSocial;