import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  FlatList,
  Modal,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  RefreshControl,
  Animated,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from '../services/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, doc, updateDoc, arrayUnion, increment, getDocs, where, QuerySnapshot, DocumentData, getDoc, limit } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/router';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Chat from './Chat';
import GroupChat from './GroupChat';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// TypeScript interfaces
interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  location?: string;
  category: 'Food' | 'Events' | 'Hostel Life' | 'Meme' | 'Nature' | 'Academic' | 'Other';
  userId: string;
  userName: string;
  userAvatar?: string;
  userYear?: string;
  userBranch?: string;
  createdAt: number;
  likes: string[];
  comments: Comment[];
  shares: number;
  views: number;
  isPublic: boolean;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
  likes: string[];
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: number;
  type: 'text' | 'image' | 'reply';
  replyTo?: string;
  reactions: { [emoji: string]: string[] };
}

interface HotTopic {
  headline: string;
  category: string;
  emoji: string;
}

interface NewPostForm {
  content: string;
  imageUrl: string;
  location: string;
  category: Post['category'];
}

interface Group {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdBy: string;
  inviteLink: string;
  createdAt: number;
}

interface UserProfile {
  id: string;
  name: string;
  profileImage?: string;
}

interface ChatThread {
  chatId: string;
  otherUser: UserProfile;
  lastMessage: string;
  lastMessageTime: number;
  lastMessageSenderId: string;
}

interface ProductChatThread {
  chatId: string;
  productId: string;
  productTitle: string;
  productImage?: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  lastMessage: string;
  lastMessageTime: number;
  otherUser: { id: string; name: string; profileImage?: string };
}

type TabType = 'posts' | 'groups' | 'chat';

const StudyGroups: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [generalChatMessages, setGeneralChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Posts state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | Post['category']>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [showCreatePost, setShowCreatePost] = useState<boolean>(false);
  const [newPostForm, setNewPostForm] = useState<NewPostForm>({
    content: '',
    imageUrl: '',
    location: '',
    category: 'Other'
  });

  // Groups/Chat state
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', isPublic: true });
  const [selectedGroupObj, setSelectedGroupObj] = useState<Group | null>(null);
  const [newMessage, setNewMessage] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [hotTopic, setHotTopic] = useState<HotTopic | null>(null);
  const [showHotTopic, setShowHotTopic] = useState<boolean>(false);
  
  // General Chat state (move to top-level scope)
  const [newGeneralMessage, setNewGeneralMessage] = useState<string>('');
  const [replyingToGeneral, setReplyingToGeneral] = useState<ChatMessage | null>(null);
  const generalChatScrollRef = useRef<FlatList>(null);
  
  const scrollViewRef = useRef<FlatList>(null);
  const chatScrollRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const hotTopicAnim = useRef(new Animated.Value(-100)).current;

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Chat thread list state
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState<boolean>(true);

  // Product chat thread state
  const [productChats, setProductChats] = useState<ProductChatThread[]>([]);
  const [loadingProductChats, setLoadingProductChats] = useState<boolean>(true);

  // Load posts, group chat, and general chat messages from Firebase
  useEffect(() => {
    if (activeTab === 'posts') {
      const postsRef = collection(db, 'social_posts');
      const q = query(postsRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          try {
            const postsArray = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Post));
            setPosts(postsArray);
          } catch (error) {
            console.error('Error parsing posts data:', error);
            Alert.alert('Error', 'Failed to load posts data');
          }
          setLoading(false);
        },
        (error) => {
          console.error('Firebase connection failed:', error);
          Alert.alert('Connection Error', 'Failed to connect to Firebase. Please check your internet connection.');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } else if (activeTab === 'groups') {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const groupArr: Group[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
        setGroups(groupArr);
      });
      return () => unsubscribe();
    } else {
      // Listen to general chat messages
      const chatRef = collection(db, 'study_groups_general_chat');
      const q = query(chatRef, orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs: ChatMessage[] = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage));
        setGeneralChatMessages(msgs);
      }, (error) => {
        console.error('Firebase connection failed (general chat):', error);
        Alert.alert('Error', 'Failed to connect to general chat. Please check your Firebase setup.');
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  // Fetch hot discussion topic from OpenRouter
  const fetchHotTopic = async () => {
    try {
      const topics = [
        'campus life', 'student struggles', 'food adventures', 'exam stress', 
        'friendship moments', 'hostel life', 'academic achievements', 'tech trends',
        'weekend plans', 'career anxiety', 'social media', 'mental health',
        'sports events', 'cultural festivals', 'study tips', 'relationship advice'
      ];
      
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer YOUR_OPENROUTER_API_KEY', // Replace with your API key
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://yogo-campus.app',
          'X-Title': 'YOGO Campus'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-3b-instruct:free',
          messages: [
            {
              role: 'user',
              content: `Generate a fun, engaging discussion headline about ${randomTopic} for college students. Make it relatable, catchy, and thought-provoking. Include a relevant emoji. Format: "emoji Headline" (max 60 characters). Examples: "🍕 What's your weirdest midnight snack combo?" or "📚 Should AI tools be allowed in exams?"`
            }
          ],
          max_tokens: 100,
          temperature: 0.8
        })
      });

      if (response.ok) {
        const data = await response.json();
        const fullResponse = data.choices[0].message.content.trim();
        
        // Extract emoji and headline
        const emojiMatch = fullResponse.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u);
        const emoji = emojiMatch ? emojiMatch[0] : '💬';
        const headline = fullResponse.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u, '').trim();
        
        const newHotTopic: HotTopic = {
          headline: headline || 'What\'s on your mind today?',
          category: randomTopic,
          emoji: emoji
        };
        
        setHotTopic(newHotTopic);
        setShowHotTopic(true);
        
        // Animate the hot topic in
        Animated.sequence([
          Animated.timing(hotTopicAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.delay(5000), // Show for 5 seconds
          Animated.timing(hotTopicAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          })
        ]).start(() => setShowHotTopic(false));
        
      } else {
        // Fallback to local suggestions if API fails
        const fallbackTopics = [
          { headline: "What's your biggest campus pet peeve?", category: "campus life", emoji: "😤" },
          { headline: "Best study spot on campus?", category: "academic", emoji: "📚" },
          { headline: "Weirdest thing in your hostel room?", category: "hostel life", emoji: "🏠" },
          { headline: "Most overrated campus food?", category: "food", emoji: "🍔" },
          { headline: "Dream weekend plan vs reality?", category: "weekend", emoji: "😴" }
        ];
        
        const randomFallback = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
        setHotTopic(randomFallback);
        setShowHotTopic(true);
        
        // Animate fallback topic
        Animated.sequence([
          Animated.timing(hotTopicAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.delay(5000),
          Animated.timing(hotTopicAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          })
        ]).start(() => setShowHotTopic(false));
      }
    } catch (error) {
      console.error('Error fetching hot topic:', error);
      // Use fallback topic on error
      const fallbackTopics = [
        { headline: "What's your biggest campus pet peeve?", category: "campus life", emoji: "😤" },
        { headline: "Best study spot on campus?", category: "academic", emoji: "📚" },
        { headline: "Weirdest thing in your hostel room?", category: "hostel life", emoji: "🏠" }
      ];
      
      const randomFallback = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
      setHotTopic(randomFallback);
      setShowHotTopic(true);
      
      Animated.sequence([
        Animated.timing(hotTopicAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.delay(5000),
        Animated.timing(hotTopicAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => setShowHotTopic(false));
    }
  };

  // Trigger hot topic fetch when switching to groups tab and Student Lounge
  useEffect(() => {
    if (activeTab === 'groups' && selectedGroupObj) {
      const timer = setTimeout(() => {
        fetchHotTopic();
      }, 2000); // Wait 2 seconds after switching to lounge
      
      return () => clearTimeout(timer);
    }
  }, [activeTab, selectedGroupObj]);

  // Animate tab transition
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeTab === 'posts' ? 0 : 1,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    // Refresh logic would go here
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Filter and sort posts
  const filteredPosts = posts
    .filter(post => {
      const matchesSearch = post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           post.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (post.location && post.location.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return b.createdAt - a.createdAt;
      } else {
        return (b.likes.length + b.comments.length + b.shares) - (a.likes.length + a.comments.length + a.shares);
      }
    });

  // Handle post creation
  const handleCreatePost = async () => {
    if (!newPostForm.content.trim()) {
      Alert.alert('Error', 'Please add some content to your post');
      return;
    }

    if (!auth.currentUser) {
      Alert.alert('Login Required', 'Please log in to create a post');
      return;
    }

    try {
      const postsRef = collection(db, 'social_posts');
      
      // Get user data from Firestore if available
      let userName = auth.currentUser.displayName || 'Anonymous User';
      let userYear = '1st Year';
      let userBranch = 'Undeclared';
      
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userName = userData.displayName || userName;
          userYear = userData.year || userYear;
          userBranch = userData.branch || userBranch;
        }
      } catch (userError) {
        console.error('Error fetching user data:', userError);
      }
      
      const newPost: Omit<Post, 'id'> = {
        content: newPostForm.content.trim(),
        imageUrl: newPostForm.imageUrl || undefined,
        location: newPostForm.location.trim() || undefined,
        category: newPostForm.category,
        userId: auth.currentUser.uid,
        userName: userName,
        userYear: userYear,
        userBranch: userBranch,
        createdAt: Date.now(),
        likes: [],
        comments: [],
        shares: 0,
        views: 0,
        isPublic: true
      };

      await addDoc(postsRef, newPost);
      
      // Reset form and close modal
      setNewPostForm({
        content: '',
        imageUrl: '',
        location: '',
        category: 'Other'
      });
      setShowCreatePost(false);
      
      Alert.alert('Success', 'Post created successfully!');
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    }
  };

  // Handle like post
  const handleLikePost = async (postId: string, currentLikes: string[]) => {
    if (!auth.currentUser) {
      Alert.alert('Login Required', 'Please log in to like posts');
      return;
    }
    
    const userId = auth.currentUser.uid;
    const isLiked = currentLikes.includes(userId);
    
    try {
      const postRef = doc(db, 'social_posts', postId);
      if (isLiked) {
        await updateDoc(postRef, {
          likes: currentLikes.filter(id => id !== userId)
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(userId)
        });
      }
    } catch (error) {
      console.error('Error updating like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  // Handle send message in group chat
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    if (!auth.currentUser) {
      Alert.alert('Login Required', 'Please log in to send messages');
      return;
    }

    try {
      const chatRef = collection(db, selectedGroupObj?.id || 'academic_talk_chat'); // Use selectedGroupObj.id or a default
      
      // Get user name from auth or Firestore
      let userName = auth.currentUser.displayName || 'Anonymous User';
      
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userName = userData.displayName || userName;
        }
      } catch (userError) {
        console.error('Error fetching user data:', userError);
      }
      
      const message: Omit<ChatMessage, 'id'> = {
        userId: auth.currentUser.uid,
        userName: userName,
        content: newMessage.trim(),
        createdAt: Date.now(),
        type: replyingTo ? 'reply' : 'text',
        replyTo: replyingTo?.id,
        reactions: {}
      };

      await addDoc(chatRef, message);
      setNewMessage('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // Handle send message in general chat
  const handleSendGeneralMessage = async () => {
    if (!newGeneralMessage.trim()) return;
    
    if (!auth.currentUser) {
      Alert.alert('Login Required', 'Please log in to send messages');
      return;
    }
    
    try {
      const chatRef = collection(db, 'study_groups_general_chat');
      
      // Get user name from auth or Firestore
      let userName = auth.currentUser.displayName || 'Anonymous User';
      
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userName = userData.displayName || userName;
        }
      } catch (userError) {
        console.error('Error fetching user data:', userError);
      }
      
      const message: Omit<ChatMessage, 'id'> = {
        userId: auth.currentUser.uid,
        userName: userName,
        content: newGeneralMessage.trim(),
        createdAt: Date.now(),
        type: replyingToGeneral ? 'reply' : 'text',
        replyTo: replyingToGeneral?.id,
        reactions: {}
      };
      await addDoc(chatRef, message);
      setNewGeneralMessage('');
      setReplyingToGeneral(null);
    } catch (error) {
      console.error('Error sending general chat message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // Group creation logic
  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    try {
      const inviteLink = `https://yogo-campus.app/invite/${Math.random().toString(36).substr(2, 8)}`;
      const groupData: Omit<Group, 'id'> = {
        name: newGroup.name.trim(),
        description: newGroup.description.trim(),
        isPublic: newGroup.isPublic,
        createdBy: 'current_user', // Replace with actual user ID
        inviteLink,
        createdAt: Date.now(),
      };
      await addDoc(collection(db, 'groups'), groupData);
      setShowCreateGroup(false);
      setNewGroup({ name: '', description: '', isPublic: true });
      Alert.alert('Success', 'Group created!');
    } catch (e) {
      Alert.alert('Error', 'Failed to create group');
    }
  };

  // Group join logic (for private groups via invite link)
  const handleJoinGroup = async (group: Group) => {
    // Add user to group members (not implemented here)
    Alert.alert('Joined', `You joined ${group.name}`);
    setSelectedGroupObj(group);
  };

  // Render post card
  const renderPostCard = ({ item }: { item: Post }) => {
    const currentUserId = auth.currentUser?.uid || 'anonymous';
    const isLiked = item.likes.includes(currentUserId);
    const timeAgo = formatTimeAgo(item.createdAt);
    
    return (
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              {item.userAvatar ? (
                <Image source={{ uri: item.userAvatar }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={20} color="#8E8E93" />
              )}
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{item.userName}</Text>
              <View style={styles.userMeta}>
                <Text style={styles.userYear}>{item.userYear} • {item.userBranch}</Text>
                <Text style={styles.timeStamp}> • {timeAgo}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        {/* Post Content */}
        <Text style={styles.postContent}>{item.content}</Text>
        
        {/* Location */}
        {item.location && (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={14} color="#8E8E93" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        )}

        {/* Post Image */}
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
        )}

        {/* Category Tag */}
        <View style={styles.categoryContainer}>
          <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(item.category) }]}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>

        {/* Engagement Stats */}
        <View style={styles.engagementStats}>
          <Text style={styles.statsText}>
            {item.likes.length} likes • {item.comments.length} comments • {item.views} views
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLikePost(item.id, item.likes)}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={22}
              color={isLiked ? "#FF3B30" : "#8E8E93"}
            />
            <Text style={[styles.actionText, isLiked && styles.likedText]}>Like</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color="#8E8E93" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={22} color="#8E8E93" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="bookmark-outline" size={22} color="#8E8E93" />
            <Text style={styles.actionText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render group list
  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
      onPress={() => setSelectedGroupObj(item)}
    >
      <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#4E54C8' }}>{item.name}</Text>
      <Text style={{ color: '#8E8E93', marginTop: 4 }}>{item.description}</Text>
      <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
        <Ionicons name={item.isPublic ? 'earth' : 'lock-closed'} size={16} color={item.isPublic ? '#4E54C8' : '#8E8E93'} />
        <Text style={{ marginLeft: 6, color: '#8E8E93', fontSize: 13 }}>{item.isPublic ? 'Public' : 'Private'}</Text>
        <TouchableOpacity
          style={{ marginLeft: 16 }}
          onPress={() => {
            // Placeholder: share invite link
            Alert.alert('Invite Link', item.inviteLink);
          }}
        >
          <Ionicons name="share-social" size={18} color="#4E54C8" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Render group chat message
  const renderChatMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.userId === 'current_user'; // Replace with actual user ID
    const timeAgo = formatTimeAgo(item.createdAt);
    
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessage]}>
        {!isOwnMessage && (
          <View style={styles.messageAvatar}>
            {item.userAvatar ? (
              <Image source={{ uri: item.userAvatar }} style={styles.messageAvatarImage} />
            ) : (
              <Ionicons name="person-circle" size={32} color="#C7C7CC" />
            )}
          </View>
        )}
        
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          {!isOwnMessage && (
            <Text style={styles.messageUserName}>{item.userName}</Text>
          )}
          
          {item.type === 'reply' && item.replyTo && (
            <View style={styles.replyPreview}>
              <Text style={styles.replyText}>Replying to message...</Text>
            </View>
          )}
          
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.content}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{timeAgo}</Text>
            {Object.keys(item.reactions).length > 0 && (
              <View style={styles.reactionsContainer}>
                {Object.entries(item.reactions).map(([emoji, users]) => (
                  <TouchableOpacity key={emoji} style={styles.reactionBubble}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    <Text style={styles.reactionCount}>{users.length}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.replyButton}
          onPress={() => setReplyingTo(item)}
        >
          <Ionicons name="arrow-undo-outline" size={16} color="#8E8E93" />
        </TouchableOpacity>
      </View>
    );
  };

  // Render general chat message
  const renderGeneralChatMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.userId === 'current_user'; // Replace with actual user ID
    const timeAgo = formatTimeAgo(item.createdAt);
    
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessage]}>
        {!isOwnMessage && (
          <View style={styles.messageAvatar}>
            {item.userAvatar ? (
              <Image source={{ uri: item.userAvatar }} style={styles.messageAvatarImage} />
            ) : (
              <Ionicons name="person-circle" size={32} color="#C7C7CC" />
            )}
          </View>
        )}
        
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          {/* Username and message */}
          <Text style={[styles.messageUserName, isOwnMessage && styles.activeGroupTabText]}>{item.userName}</Text>
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>{item.content}</Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{timeAgo}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.replyButton}
          onPress={() => setReplyingToGeneral(item)}
        >
          <Ionicons name="arrow-undo-outline" size={16} color="#8E8E93" />
        </TouchableOpacity>
      </View>
    );
  };

  // Render create post modal
  const renderCreatePostModal = () => (
    <Modal
      visible={showCreatePost}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <KeyboardAvoidingView 
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowCreatePost(false)}
            style={styles.modalCloseButton}
          >
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Create Post</Text>
          <TouchableOpacity
            onPress={handleCreatePost}
            style={styles.modalSaveButton}
          >
            <Text style={styles.modalSaveText}>Post</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Photo/Video Upload - Top Priority */}
          <TouchableOpacity style={styles.mediaButton}>
            <Ionicons name="camera-outline" size={24} color="#4E54C8" />
            <Text style={styles.mediaButtonText}>Add Photo/Video</Text>
          </TouchableOpacity>

          {/* Caption/Content */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Caption</Text>
            <TextInput
              style={styles.postTextInput}
              value={newPostForm.content}
              onChangeText={(text) => setNewPostForm({...newPostForm, content: text})}
              placeholder="What's happening on campus?"
              placeholderTextColor="#8E8E93"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Category/Tag */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category Tag</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
              {(['Food', 'Events', 'Hostel Life', 'Meme', 'Nature', 'Academic', 'Other'] as Post['category'][]).map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryOption,
                    newPostForm.category === category && styles.selectedCategoryOption
                  ]}
                  onPress={() => setNewPostForm({...newPostForm, category})}
                >
                  <Text style={[
                    styles.categoryOptionText,
                    newPostForm.category === category && styles.selectedCategoryOptionText
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Location (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={newPostForm.location}
              onChangeText={(text) => setNewPostForm({...newPostForm, location: text})}
              placeholder="MIT Canteen, Innovation Centre..."
              placeholderTextColor="#8E8E93"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Render create group modal
  const renderCreateGroupModal = () => (
    <Modal visible={showCreateGroup} animationType="slide" onRequestClose={() => setShowCreateGroup(false)}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F8F9FA', padding: 24 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#4E54C8', marginBottom: 24 }}>Create Group</Text>
        <TextInput
          style={{ backgroundColor: '#fff', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F2F2F7' }}
          placeholder="Group Name"
          value={newGroup.name}
          onChangeText={t => setNewGroup({ ...newGroup, name: t })}
        />
        <TextInput
          style={{ backgroundColor: '#fff', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F2F2F7' }}
          placeholder="Description"
          value={newGroup.description}
          onChangeText={t => setNewGroup({ ...newGroup, description: t })}
          multiline
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}
            onPress={() => setNewGroup({ ...newGroup, isPublic: true })}
          >
            <Ionicons name={newGroup.isPublic ? 'radio-button-on' : 'radio-button-off'} size={20} color="#4E54C8" />
            <Text style={{ marginLeft: 8, color: '#4E54C8', fontWeight: '600' }}>Public</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => setNewGroup({ ...newGroup, isPublic: false })}
          >
            <Ionicons name={!newGroup.isPublic ? 'radio-button-on' : 'radio-button-off'} size={20} color="#4E54C8" />
            <Text style={{ marginLeft: 8, color: '#4E54C8', fontWeight: '600' }}>Private</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: '#4E54C8', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 16 }}
          onPress={handleCreateGroup}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Create Group</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowCreateGroup(false)} style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FF3B30', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Helper functions
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  };

  const getCategoryColor = (category: Post['category']) => {
    const colors = {
      'Food': 'rgba(255, 149, 0, 0.1)',
      'Events': 'rgba(52, 199, 89, 0.1)',
      'Hostel Life': 'rgba(255, 59, 48, 0.1)',
      'Meme': 'rgba(255, 204, 0, 0.1)',
      'Nature': 'rgba(50, 215, 75, 0.1)',
      'Academic': 'rgba(0, 122, 255, 0.1)',
      'Other': 'rgba(142, 142, 147, 0.1)'
    };
    return colors[category];
  };

  // Real-time chat thread list for the current user
  useEffect(() => {
    if (activeTab !== 'chat') return;
    setLoadingThreads(true);
    let unsubscribe: (() => void) | null = null;
    const user = auth.currentUser;
    if (!user) {
      setChatThreads([]);
      setLoadingThreads(false);
      return;
    }
    const userId = user.uid;
    const threadsRef = collection(db, 'direct_chats');
    unsubscribe = onSnapshot(threadsRef, async (snapshot) => {
      const threads: ChatThread[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (!data.users || !Array.isArray(data.users) || !data.users.includes(userId)) continue;
        // Find the other user
        const otherUserId = data.users.find((id: string) => id !== userId);
        if (!otherUserId) continue;
        // Fetch other user's profile
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
        if (!otherUserDoc.exists()) continue;
        const otherUserData = otherUserDoc.data();
        const otherUser: UserProfile = {
          id: otherUserId,
          name: otherUserData?.name || 'Unknown',
          profileImage: otherUserData?.profileImage || undefined,
        };
        // Get last message
        const messagesRef = collection(db, 'direct_chats', docSnap.id, 'messages');
        const messagesSnap = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(1)));
        let lastMessage = '';
        let lastMessageTime = 0;
        let lastMessageSenderId = '';
        if (!messagesSnap.empty) {
          const msg = messagesSnap.docs[0].data();
          lastMessage = msg.content || '';
          lastMessageTime = msg.createdAt || 0;
          lastMessageSenderId = msg.senderId || '';
        }
        threads.push({
          chatId: docSnap.id,
          otherUser,
          lastMessage,
          lastMessageTime,
          lastMessageSenderId,
        });
      }
      // Sort by last message time desc
      threads.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setChatThreads(threads);
      setLoadingThreads(false);
    }, (error) => {
      console.error('Error fetching chat threads:', error);
      setChatThreads([]);
      setLoadingThreads(false);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [activeTab]);

  // Render chat thread list (in Chat tab)
  const renderChatThreadList = () => (
    <View style={{ flex: 1, backgroundColor: '#F8F9FA', padding: 20 }}>
      {loadingThreads ? (
        <ActivityIndicator size="large" color="#4E54C8" style={{ marginTop: 40 }} />
      ) : chatThreads.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={64} color="#C7C7CC" />
          <Text style={{ color: '#8E8E93', fontSize: 18, marginTop: 16 }}>No conversations yet</Text>
          <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 4 }}>Start a chat from the marketplace or user profile</Text>
        </View>
      ) : (
        <FlatList
          data={chatThreads}
          keyExtractor={item => item.chatId}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
              onPress={() => {
                navigation.navigate('Chat', {
                  currentUser: { id: auth.currentUser?.uid, name: auth.currentUser?.displayName },
                  selectedUser: item.otherUser,
                });
              }}
            >
              {item.otherUser.profileImage ? (
                <Image source={{ uri: item.otherUser.profileImage }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#F2F2F7' }} />
              ) : (
                <Ionicons name="person-circle" size={44} color="#C7C7CC" style={{ marginRight: 12 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1C1E' }}>{item.otherUser.name}</Text>
                <Text style={{ fontSize: 14, color: '#8E8E93', marginTop: 2 }} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#8E8E93', marginLeft: 8 }}>{formatTimeAgo(item.lastMessageTime)}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );

  // Real-time product chat list for the current user
  useEffect(() => {
    if (activeTab !== 'chat') return;
    setLoadingProductChats(true);
    let unsubscribe: (() => void) | null = null;
    const user = auth.currentUser;
    if (!user) {
      setProductChats([]);
      setLoadingProductChats(false);
      return;
    }
    const userId = user.uid;
    const chatsRef = collection(db, 'product_chats');
    const q1 = query(chatsRef, where('buyerId', '==', userId));
    const q2 = query(chatsRef, where('sellerId', '==', userId));
    // Listen to both as buyer and seller
    const fetchChats = async () => {
      const [buyerSnap, sellerSnap] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const allDocs = [...buyerSnap.docs, ...sellerSnap.docs];
      const threads: ProductChatThread[] = [];
      for (const docSnap of allDocs) {
        const data = docSnap.data();
        // Get last message
        const messagesRef = collection(db, 'product_chats', docSnap.id, 'messages');
        const messagesSnap = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(1)));
        let lastMessage = '';
        let lastMessageTime = 0;
        if (!messagesSnap.empty) {
          const msg = messagesSnap.docs[0].data();
          lastMessage = msg.content || '';
          lastMessageTime = msg.createdAt || 0;
        }
        // Determine other user
        let otherUserId = data.buyerId === userId ? data.sellerId : data.buyerId;
        let otherUserName = data.buyerId === userId ? data.sellerName : data.buyerName;
        let otherUserProfileImage = undefined;
        // Try to fetch profile image
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
        if (otherUserDoc.exists()) {
          otherUserProfileImage = otherUserDoc.data().profileImage;
        }
        threads.push({
          chatId: docSnap.id,
          productId: data.productId,
          productTitle: data.productTitle,
          productImage: data.productImage,
          buyerId: data.buyerId,
          buyerName: data.buyerName,
          sellerId: data.sellerId,
          sellerName: data.sellerName,
          lastMessage,
          lastMessageTime,
          otherUser: { id: otherUserId, name: otherUserName, profileImage: otherUserProfileImage },
        });
      }
      threads.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setProductChats(threads);
      setLoadingProductChats(false);
    };
    fetchChats();
    // Optionally: set up onSnapshot for real-time updates
    // (for simplicity, polling with fetchChats for now)
    if (typeof unsubscribe !== 'function') unsubscribe = () => {};
    return () => { unsubscribe && unsubscribe(); };
  }, [activeTab]);

  // Render product chat list in Chat tab
  const renderProductChatList = () => (
    <View style={{ flex: 1, backgroundColor: '#F8F9FA', padding: 20 }}>
      {loadingProductChats ? (
        <ActivityIndicator size="large" color="#4E54C8" style={{ marginTop: 40 }} />
      ) : productChats.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={64} color="#C7C7CC" />
          <Text style={{ color: '#8E8E93', fontSize: 18, marginTop: 16 }}>No product conversations yet</Text>
          <Text style={{ color: '#8E8E93', fontSize: 14, marginTop: 4 }}>Start a chat from a product page</Text>
        </View>
      ) : (
        <FlatList
          data={productChats}
          keyExtractor={item => item.chatId}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
              onPress={() => {
                navigation.navigate('ProductChat', {
                  chatId: item.chatId,
                  product: {
                    id: item.productId,
                    title: item.productTitle,
                    image: item.productImage
                  },
                  buyer: {
                    id: item.buyerId,
                    name: item.buyerName
                  },
                  seller: {
                    id: item.sellerId,
                    name: item.sellerName
                  }
                });
              }}
            >
              {item.productImage ? (
                <Image source={{ uri: item.productImage }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12, backgroundColor: '#F2F2F7' }} />
              ) : (
                <Ionicons name="cube-outline" size={44} color="#C7C7CC" style={{ marginRight: 12 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1C1E' }}>{item.productTitle}</Text>
                <Text style={{ fontSize: 14, color: '#8E8E93', marginTop: 2 }} numberOfLines={1}>{item.otherUser.name}: {item.lastMessage}</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#8E8E93', marginLeft: 8 }}>{formatTimeAgo(item.lastMessageTime)}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Enhanced Social Hub Navigation Bar */}
      <LinearGradient
        colors={["#4E54C8", "#8B5CF6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 48,
          paddingBottom: 16,
          paddingHorizontal: 16,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
          elevation: 6,
          zIndex: 20,
        }}
      >
        <TouchableOpacity 
          onPress={() => {
            // If coming from bottom tab in Dashboard, navigate to Dashboard
            // This ensures we don't end up on a blank screen
            navigation.navigate('Dashboard');
          }} 
          style={{ marginRight: 12, padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' }}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
          <Ionicons name="people-circle" size={26} color="#fff" style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#fff', letterSpacing: 0.5 }}>Social Hub</Text>
        </View>
        {/* Spacer to balance the back button */}
        <View style={{ width: 38 }} />
      </LinearGradient>
      <LinearGradient
        colors={['#4E54C8', '#8B5CF6']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Campus Social</Text>
          <Text style={styles.headerSubtitle}>Connect, Share, Chat</Text>
          {/* Tab Toggle */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
              onPress={() => setActiveTab('posts')}
            >
              <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
              onPress={() => setActiveTab('groups')}
            >
              <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>Groups</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
              onPress={() => setActiveTab('chat')}
            >
              <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
      <View style={styles.content}>
        {activeTab === 'posts' ? (
          <>
            {/* Search and Filter Section */}
            <View style={styles.searchSection}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search posts, users, locations..."
                  placeholderTextColor="#8E8E93"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              
              {/* Category Filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
                {(['All', 'Food', 'Events', 'Hostel Life', 'Meme', 'Nature', 'Academic', 'Other'] as const).map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.filterChip,
                      selectedCategory === category && styles.activeFilterChip
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedCategory === category && styles.activeFilterChipText
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Sort Options */}
              <View style={styles.sortContainer}>
                <TouchableOpacity
                  style={[styles.sortButton, sortBy === 'newest' && styles.activeSortButton]}
                  onPress={() => setSortBy('newest')}
                >
                  <Text style={[styles.sortText, sortBy === 'newest' && styles.activeSortText]}>
                    Newest
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortButton, sortBy === 'popular' && styles.activeSortButton]}
                  onPress={() => setSortBy('popular')}
                >
                  <Text style={[styles.sortText, sortBy === 'popular' && styles.activeSortText]}>
                    Popular
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Posts Feed */}
            <FlatList
              ref={scrollViewRef}
              data={filteredPosts}
              renderItem={renderPostCard}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              contentContainerStyle={styles.postsContainer}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="newspaper-outline" size={64} color="#C7C7CC" />
                  <Text style={styles.emptyTitle}>No Posts Found</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery ? 'Try adjusting your search' : 'Be the first to share something!'}
                  </Text>
                </View>
              }
            />

            {/* Create Post Button */}
            <TouchableOpacity
              style={styles.createPostButton}
              onPress={() => setShowCreatePost(true)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4E54C8', '#8B5CF6']}
                style={styles.createPostGradient}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : activeTab === 'groups' ? (
          selectedGroupObj ? (
            <GroupChat
              groupId={selectedGroupObj.id}
              groupName={selectedGroupObj.name}
              onBack={() => setSelectedGroupObj(null)}
            />
          ) : (
            <>
              <FlatList
                data={groups.filter(g => g.isPublic || g.createdBy === 'current_user')}
                renderItem={renderGroupItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingVertical: 20 }}
                ListEmptyComponent={<Text style={{ color: '#8E8E93', textAlign: 'center', marginTop: 40 }}>No groups found. Create one!</Text>}
              />
              <TouchableOpacity
                style={{ position: 'absolute', bottom: 24, right: 0, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4E54C8', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 }}
                onPress={() => setShowCreateGroup(true)}
              >
                <Ionicons name="add" size={28} color="#fff" />
              </TouchableOpacity>
              {renderCreateGroupModal()}
            </>
          )
        ) : (
          // Chat tab: show product-specific conversation list
          renderProductChatList()
        )}
      </View>
      {renderCreatePostModal()}
      {/* Firebase Console Actions:
          1. Create 'social_posts' collection in Firestore with read/write rules
          2. Create 'student_lounge_chat' collection for Student Lounge messages
          3. Create 'academic_talk_chat' collection for Academic Talk messages
          4. Create 'study_groups_general_chat' collection for the general chat tab
          5. Set appropriate read/write permissions for authenticated users
      */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
    fontWeight: '500',
    marginBottom: 20,
  },
  
  // Tab Container
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    padding: 4,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  activeTabText: {
    color: '#4E54C8',
  },
  
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Posts Section
  searchSection: {
    marginVertical: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  categoryFilter: {
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeFilterChip: {
    backgroundColor: '#4E54C8',
  },
  filterChipText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  
  sortContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeSortButton: {
    backgroundColor: '#4E54C8',
  },
  sortText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  activeSortText: {
    color: '#FFFFFF',
  },

  postsContainer: {
    paddingBottom: 100,
  },
  
  // Post Card Styles
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userYear: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  timeStamp: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  moreButton: {
    padding: 4,
  },
  
  postContent: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  postImage: {
    width: '100%',
    height: 300,
    marginBottom: 12,
  },
  
  categoryContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 12,
    color: '#4E54C8',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  engagementStats: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statsText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  actionButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  likedText: {
    color: '#FF3B30',
  },
  
  createPostButton: {
    position: 'absolute',
    bottom: 20,
    right: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createPostGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Groups/Chat Section
  groupHeader: {
    marginTop: 20,
    marginBottom: 16,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTabs: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  hotTopicRefreshButton: {
    marginLeft: 12,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  groupTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeGroupTab: {
    backgroundColor: '#4E54C8',
  },
  groupTabText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
    textAlign: 'center',
  },
  activeGroupTabText: {
    color: '#FFFFFF',
  },

  chatContainer: {
    paddingBottom: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    gap: 8,
  },
  ownMessage: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubble: {
    maxWidth: screenWidth * 0.7,
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    padding: 12,
  },
  ownMessageBubble: {
    backgroundColor: '#4E54C8',
  },
  messageUserName: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  messageText: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  reactionsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    color: '#4E54C8',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  replyButton: {
    padding: 4,
  },
  replyPreview: {
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },

  replyPreviewContainer: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  replyPreviewText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  replyPreviewClose: {
    padding: 4,
  },

  messageInputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  messageInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  messageInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    maxHeight: 100,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  sendButton: {
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  modalSaveButton: {
    padding: 4,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  postTextInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  
  categorySelector: {
    marginTop: 8,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  selectedCategoryOption: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  selectedCategoryOptionText: {
    color: '#FFFFFF',
  },
  
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#4E54C8',
    borderStyle: 'dashed',
    gap: 8,
  },
  mediaButtonText: {
    fontSize: 16,
    color: '#4E54C8',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  // Empty States
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyChatContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    flex: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },

  // Hot Topic Styles
  hotTopicContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  hotTopicGradient: {
    borderRadius: 16,
    padding: 16,
  },
  hotTopicContent: {
    alignItems: 'center',
  },
  hotTopicBadge: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
    marginBottom: 8,
  },
  hotTopicClose: {
    padding: 4,
  },
  hotTopicDiscussion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 12,
    minWidth: '85%',
  },
  hotTopicEmoji: {
    fontSize: 22,
    marginRight: 8,
  },
  hotTopicText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    flex: 1,
  },
  hotTopicSubtext: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.8,
    marginTop: 2,
  },
  hotTopicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
});

export default StudyGroups;
