import React, { useEffect, useState, useRef } from 'react';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QnaProfile from './QnaProfile';
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  where,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import notificationService from '../services/notificationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// TypeScript interfaces
interface Question {
  id: string;
  title: string;
  description: string;
  author: string;
  authorId: string;
  timestamp: any;
  upvotes: string[];
  downvotes: string[];
  answers: Answer[];
  tags: string[];
  category: string;
  isAnonymous: boolean;
  imageUrl?: string;
  points: number;
  views: number;
  lastActivity: any;
  type: 'text' | 'image';
  anonymousAvatar?: string; // Add anonymous avatar field
  viewedBy?: string[]; // Track who viewed the post
}

interface Answer {
  id: string;
  content: string;
  author: string;
  authorId: string;
  timestamp: any;
  upvotes: string[];
  downvotes: string[];
  isAccepted: boolean;
  isAnonymous: boolean;
  parentId?: string; // For threaded replies
  replies?: Answer[];
  questionId: string;
  points: number;
  anonymousAvatar?: string; // Add anonymous avatar field for answers
}

interface User {
  id: string;
  name: string;
  email: string;
  points: number;
  reputation: number;
  avatar?: string;
}

const { width, height } = Dimensions.get('window');

type QnaForumPostNavigationProp = NavigationProp<RootStackParamList>;
type QnaForumPostRouteProp = RouteProp<RootStackParamList, 'QnaForumPost'>;

const QnaForumPost: React.FC = () => {
  const navigation = useNavigation<QnaForumPostNavigationProp>();
  const insets = useSafeAreaInsets();
  const route = useRoute<QnaForumPostRouteProp>();
  const params = route.params as { questionId: string } | undefined;
  const questionId = params?.questionId;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation values
  const scrollY = useSharedValue(0);
  const headerOpacity = useSharedValue(1);
  const questionScale = useSharedValue(1);
  const refreshProgress = useSharedValue(0);

  // Animated styles
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 50],
          [0, -10],
          Extrapolate.CLAMP
        ),
      },
    ],
  }));

  const questionCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: questionScale.value }],
  }));

  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [submittingReply, setSubmittingReply] = useState<boolean>(false);
  const fadeAnim = useSharedValue(0);
  const [error, setError] = useState<string | null>(null);
  
  // Profile popup states
  const [profileModalVisible, setProfileModalVisible] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<{id: string; name: string; isAnonymous: boolean} | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Not logged in', 'Please log in to interact with Q&A.');
        setCurrentUser(null);
        return;
      }
      let userProfile: User = {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        points: 0,
        reputation: 0,
        avatar: user.photoURL || undefined,
      };
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          userProfile = {
            ...userProfile,
            name: data.name || userProfile.name,
            points: data.points || 0,
            reputation: data.reputation || 0,
            avatar: data.profileImage || userProfile.avatar,
          };
        }
      } catch {}
      setCurrentUser(userProfile);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!questionId) {
      setError('Question ID is missing');
      return;
    }
    
    console.log('QnaForumPost: Component mounted with questionId:', questionId);
    loadQuestionDetails();
    loadAnswers();
    fadeAnim.value = withTiming(1, {
      duration: 300,
    });
  }, [questionId]);

  // Load question details
  const loadQuestionDetails = async () => {
    try {
      console.log('QnaForumPost: Loading question details for ID:', questionId);
      if (!db) {
        console.error('QnaForumPost: Firebase db not initialized');
        Alert.alert('Error', 'Firebase not configured properly. Please check your setup.');
        setLoading(false);
        return;
      }

      const questionRef = doc(db, 'qna_questions', questionId);
      const questionSnap = await getDoc(questionRef);
      
      if (questionSnap.exists()) {
        const data = questionSnap.data();
        console.log('QnaForumPost: Question data loaded:', data);
        
        // Update view count
        await updateDoc(questionRef, {
          views: increment(1),
          viewedBy: arrayUnion(currentUser?.id)
        });
        
        setQuestion({
          id: questionSnap.id,
          ...data,
          upvotes: data.upvotes || [],
          downvotes: data.downvotes || [],
          answers: data.answers || [],
          tags: data.tags || [],
          points: data.points || 0,
          views: (data.views || 0) + 1, // Increment locally too
          isAnonymous: data.isAnonymous || false,
          anonymousAvatar: data.anonymousAvatar || generateRandomAvatar()
        } as Question);
      } else {
        console.error('QnaForumPost: Question not found for ID:', questionId);
        Alert.alert('Error', 'Question not found.');
        navigation.goBack();
      }
    } catch (error) {
      console.error('QnaForumPost: Error loading question:', error);
      Alert.alert('Error', 'Failed to load question details.');
    } finally {
      setLoading(false);
    }
  };

  // Load answers with real-time updates
  const loadAnswers = () => {
    if (!questionId) return;
    
    try {
      const answersRef = collection(db, 'qna_answers');
      // Simplified query to avoid complex indexing requirements
      const q = query(
        answersRef,
        where('questionId', '==', questionId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedAnswers: Answer[] = [];
        const answerMap = new Map<string, Answer>();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const answer: Answer = {
            id: doc.id,
            content: data.content || '',
            author: data.author || 'Unknown',
            authorId: data.authorId || '',
            timestamp: data.timestamp,
            upvotes: data.upvotes || [],
            downvotes: data.downvotes || [],
            isAccepted: data.isAccepted || false,
            isAnonymous: data.isAnonymous || false,
            parentId: data.parentId || undefined,
            replies: [],
            questionId: data.questionId || questionId,
            points: data.points || 0,
            anonymousAvatar: data.anonymousAvatar || generateRandomAvatar()
          };
          answerMap.set(doc.id, answer);
        });

        // Build threaded structure and sort client-side
        const rootAnswers: Answer[] = [];
        answerMap.forEach((answer) => {
          if (answer.parentId) {
            // This is a reply
            const parent = answerMap.get(answer.parentId);
            if (parent) {
              if (!parent.replies) parent.replies = [];
              parent.replies.push(answer);
            }
          } else {
            // This is a root answer
            rootAnswers.push(answer);
          }
        });

        // Sort root answers by points (descending), then by timestamp (newest first)
        rootAnswers.sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
          const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
          return bTime - aTime;
        });

        // Sort replies for each answer
        rootAnswers.forEach((answer) => {
          if (answer.replies && answer.replies.length > 0) {
            answer.replies.sort((a, b) => {
              if (b.points !== a.points) return b.points - a.points;
              const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
              const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
              return bTime - aTime;
            });
          }
        });

        setAnswers(rootAnswers);
        
        // Auto-expand all replies by default
        const answersWithReplies = new Set<string>();
        rootAnswers.forEach(answer => {
          if (answer.replies && answer.replies.length > 0) {
            answersWithReplies.add(answer.id);
          }
        });
        setExpandedReplies(answersWithReplies);
      }, (error) => {
        console.error('Error loading answers:', error);
        Alert.alert('Error', 'Failed to load answers. Please check your Firebase connection.');
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up answers listener:', error);
      Alert.alert('Error', 'Failed to connect to Firebase.');
    }
  };

  // Helper: Safe includes for string arrays
  const safeIncludes = (arr: string[], id: string | undefined): boolean => !!id && arr.includes(id);

  // Vote on question with haptic feedback
  const voteQuestion = async (voteType: 'up' | 'down') => {
    if (!question) return;
    
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animate the question card
    questionScale.value = withSpring(0.95, { damping: 10 });
    setTimeout(() => {
      questionScale.value = withSpring(1);
    }, 100);
    
    try {
      if (!currentUser || !currentUser.id) {
        Alert.alert('Not logged in', 'Please log in to vote.');
        return;
      }

      const questionRef = doc(db, 'qna_questions', questionId);
      const hasUpvoted = safeIncludes(question.upvotes, currentUser.id);
      const hasDownvoted = safeIncludes(question.downvotes, currentUser.id);

      let pointsChange = 0;
      let updates: any = { lastActivity: serverTimestamp() };

      if (voteType === 'up') {
        if (hasUpvoted) {
          // Remove upvote
          updates.upvotes = arrayRemove(currentUser.id);
          updates.points = increment(-5);
          pointsChange = -5;
        } else {
          // Add upvote
          updates.upvotes = arrayUnion(currentUser.id);
          updates.points = increment(5);
          pointsChange = 5;
          if (hasDownvoted) {
            updates.downvotes = arrayRemove(currentUser.id);
            updates.points = increment(2); // Remove downvote penalty
            pointsChange += 2;
          }
        }
      } else {
        if (hasDownvoted) {
          // Remove downvote
          updates.downvotes = arrayRemove(currentUser.id);
          updates.points = increment(2);
          pointsChange = 2;
        } else {
          // Add downvote
          updates.downvotes = arrayUnion(currentUser.id);
          updates.points = increment(-2);
          pointsChange = -2;
          if (hasUpvoted) {
            updates.upvotes = arrayRemove(currentUser.id);
            updates.points = increment(-5); // Remove upvote bonus
            pointsChange -= 5;
          }
        }
      }

      await updateDoc(questionRef, updates);

      // Update question author's reputation (only if not using mock user)
      if (!question.isAnonymous && question.authorId !== 'anonymous' && question.authorId !== 'current_user_id') {
        try {
          const authorRef = doc(db, 'users', question.authorId);
          await updateDoc(authorRef, {
            reputation: increment(pointsChange),
            points: increment(pointsChange)
          });
        } catch (userError) {
          console.warn('Could not update question author reputation (user document may not exist):', userError);
          // Continue without failing - this is not critical for the voting functionality
        }
      }

      // Notify author if upvotes cross 2 (only on upvote)
      if (voteType === 'up' && !hasUpvoted && !question.isAnonymous && question.authorId !== 'anonymous' && question.authorId !== 'current_user_id') {
        const updatedSnap = await getDoc(questionRef);
        const updated = updatedSnap.data();
        if (updated && updated.upvotes && updated.upvotes.length === 3) {
          await notificationService.sendUserAlert({
            userId: question.authorId,
            type: 'qna',
            title: 'Your question is getting popular!',
            body: `Your question "${question.title}" has received 3 upvotes!`,
            icon: 'arrow-up-circle',
            extra: { questionId: question.id }
          });
        }
      }

      // Update local state
      setQuestion(prev => {
        if (!prev) return prev;
        const newUpvotes = voteType === 'up' 
          ? (hasUpvoted 
              ? prev.upvotes.filter(id => id !== currentUser.id)
              : [...prev.upvotes.filter(id => id !== currentUser.id), currentUser.id])
          : prev.upvotes.filter(id => id !== currentUser.id);
        
        const newDownvotes = voteType === 'down'
          ? (hasDownvoted
              ? prev.downvotes.filter(id => id !== currentUser.id)
              : [...prev.downvotes.filter(id => id !== currentUser.id), currentUser.id])
          : prev.downvotes.filter(id => id !== currentUser.id);

        return {
          ...prev,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
          points: prev.points + pointsChange
        };
      });

    } catch (error) {
      console.error('Error voting on question:', error);
      Alert.alert('Error', 'Failed to vote. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Vote on answer with haptic feedback
  const voteAnswer = async (answerId: string, voteType: 'up' | 'down') => {
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      if (!currentUser || !currentUser.id) {
        Alert.alert('Not logged in', 'Please log in to vote.');
        return;
      }

      const answerRef = doc(db, 'qna_answers', answerId);
      const answer = findAnswerById(answerId);
      if (!answer) return;

      const hasUpvoted = safeIncludes(answer.upvotes, currentUser.id);
      const hasDownvoted = safeIncludes(answer.downvotes, currentUser.id);

      let pointsChange = 0;
      let updates: any = {};

      if (voteType === 'up') {
        if (hasUpvoted) {
          // Remove upvote
          updates.upvotes = arrayRemove(currentUser.id);
          updates.points = increment(-5);
          pointsChange = -5;
        } else {
          // Add upvote
          updates.upvotes = arrayUnion(currentUser.id);
          updates.points = increment(5);
          pointsChange = 5;
          if (hasDownvoted) {
            updates.downvotes = arrayRemove(currentUser.id);
            updates.points = increment(2);
            pointsChange += 2;
          }
        }
      } else {
        if (hasDownvoted) {
          // Remove downvote
          updates.downvotes = arrayRemove(currentUser.id);
          updates.points = increment(2);
          pointsChange = 2;
        } else {
          // Add downvote
          updates.downvotes = arrayUnion(currentUser.id);
          updates.points = increment(-2);
          pointsChange = -2;
          if (hasUpvoted) {
            updates.upvotes = arrayRemove(currentUser.id);
            updates.points = increment(-5);
            pointsChange -= 5;
          }
        }
      }

      await updateDoc(answerRef, updates);

      // Update answer author's reputation and award bonus points for upvotes
      if (!answer.isAnonymous && answer.authorId !== 'anonymous' && answer.authorId !== 'current_user_id') {
        try {
          const authorRef = doc(db, 'users', answer.authorId);
          let bonusPoints = pointsChange;
          
          // Award bonus points for getting upvotes (2x the vote value)
          if (voteType === 'up' && !hasUpvoted) {
            bonusPoints += 5; // Extra 5 points for getting an upvote
          }
          
          await updateDoc(authorRef, {
            reputation: increment(pointsChange),
            points: increment(bonusPoints)
          });
        } catch (userError) {
          console.warn('Could not update answer author reputation (user document may not exist):', userError);
          // Continue without failing - this is not critical for the voting functionality
        }
      }

      // Notify answer author if upvotes cross 2 (only on upvote)
      if (voteType === 'up' && !hasUpvoted && answer && !answer.isAnonymous && answer.authorId !== 'anonymous' && answer.authorId !== 'current_user_id') {
        const updatedSnap = await getDoc(answerRef);
        const updated = updatedSnap.data();
        if (updated && updated.upvotes && updated.upvotes.length === 3) {
          await notificationService.sendUserAlert({
            userId: answer.authorId,
            type: 'qna',
            title: 'Your answer is getting popular!',
            body: `Your answer on "${question?.title || ''}" has received 3 upvotes!`,
            icon: 'arrow-up-circle',
            extra: { questionId: questionId, answerId: answer.id }
          });
        }
      }

    } catch (error) {
      console.error('Error voting on answer:', error);
      Alert.alert('Error', 'Failed to vote. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Submit reply
  const submitReply = async () => {
    if (!questionId) return;
    
    if (!replyText.trim()) {
      Alert.alert('Error', 'Please enter a reply.');
      return;
    }

    const currentUserAuth = auth.currentUser;
    if (!currentUserAuth) {
      Alert.alert('Login Required', 'Please log in to submit an answer');
      return;
    }

    setSubmittingReply(true);
    try {
      const answersRef = collection(db, 'qna_answers');
      const replyData = {
        content: replyText.trim(),
        author: isAnonymous ? 'Anonymous' : currentUser?.name,
        authorId: isAnonymous ? 'anonymous' : currentUser?.id,
        timestamp: serverTimestamp(),
        upvotes: [],
        downvotes: [],
        isAccepted: false,
        isAnonymous: isAnonymous,
        parentId: replyingTo || null,
        questionId: questionId,
        points: 1,
        anonymousAvatar: isAnonymous ? generateRandomAvatar() : null
      };

      await addDoc(answersRef, replyData);

      // Update question's last activity
      const questionRef = doc(db, 'qna_questions', questionId);
      await updateDoc(questionRef, {
        lastActivity: serverTimestamp(),
        answersCount: increment(1), // Increment answer count
      });

      // Award 3 points to user for answering (increased from 2)
      if (!isAnonymous && currentUser?.id !== 'current_user_id') {
        try {
          if (currentUser?.id) {
            const userRef = doc(db, 'users', currentUser.id);
            await updateDoc(userRef, {
              points: increment(3), // Increased points for replies
              reputation: increment(1),
              answersCount: increment(1)
            });
          }
        } catch (userError) {
          console.warn('Could not update user points (user document may not exist):', userError);
          // Continue without failing - this is not critical for the reply functionality
        }
      }

      // --- Notification logic for replies ---
      // Helper to get sneak peek
      const getSneakPeek = (text: string) => {
        const firstSentence = text.split(/[.!?\n]/)[0];
        return firstSentence.length > 0 ? firstSentence.slice(0, 50) : text.slice(0, 50);
      };
      const sneakPeek = getSneakPeek(replyText.trim());
      // Notify question author if replying to question (not self)
      if (question && (!replyingTo || replyingTo === null)) {
        if (!question.isAnonymous && question.authorId !== 'anonymous' && question.authorId !== currentUser?.id) {
          await notificationService.sendUserAlert({
            userId: question.authorId,
            type: 'qna',
            title: 'New reply to your question',
            body: `"${sneakPeek}..."`,
            icon: 'chatbubble-ellipses',
            extra: { questionId: question.id }
          });
        }
      }
      // If replying to an answer (threaded reply)
      if (replyingTo) {
        const parentAnswer = findAnswerById(replyingTo);
        if (parentAnswer && !parentAnswer.isAnonymous && parentAnswer.authorId !== 'anonymous' && parentAnswer.authorId !== currentUser?.id) {
          await notificationService.sendUserAlert({
            userId: parentAnswer.authorId,
            type: 'qna',
            title: 'New reply to your answer',
            body: `"${sneakPeek}..."`,
            icon: 'chatbubble-ellipses',
            extra: { questionId: questionId, answerId: parentAnswer.id }
          });
        }
        // Also notify question author if not already notified and not self
        if (question && question.authorId !== currentUser?.id && question.authorId !== parentAnswer?.authorId && !question.isAnonymous && question.authorId !== 'anonymous') {
          await notificationService.sendUserAlert({
            userId: question.authorId,
            type: 'qna',
            title: 'New reply in your question thread',
            body: `"${sneakPeek}..."`,
            icon: 'chatbubble-ellipses',
            extra: { questionId: question.id, answerId: parentAnswer?.id }
          });
        }
      }

      setReplyText('');
      setReplyingTo(null);
      setIsAnonymous(false);
      Alert.alert('Success', 'Your reply has been posted! You earned 3 points.');
    } catch (error) {
      console.error('Error submitting reply:', error);
      Alert.alert('Error', 'Failed to post reply. Please try again.');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Helper function to find answer by ID in nested structure
  const findAnswerById = (answerId: string): Answer | null => {
    for (const answer of answers) {
      if (answer.id === answerId) return answer;
      if (answer.replies) {
        for (const reply of answer.replies) {
          if (reply.id === answerId) return reply;
        }
      }
    }
    return null;
  };

  const handleStartChat = async (userId: string, userName: string) => {
    try {
      const currentUserAuth = auth.currentUser;
      if (!currentUserAuth) {
        Alert.alert('Login Required', 'Please log in to start a chat');
        return;
      }
      
      if (currentUserAuth.uid === userId) {
        Alert.alert('Cannot chat with yourself', 'You cannot start a chat with yourself');
        return;
      }
      
      // Get current user profile
      const currentUserDoc = await getDoc(doc(db, 'users', currentUserAuth.uid));
      if (!currentUserDoc.exists()) {
        Alert.alert('Profile Error', 'Your profile could not be found');
        return;
      }
      
      const currentUserProfile = { 
        id: currentUserAuth.uid, 
        name: currentUserDoc.data().name || currentUserAuth.displayName || 'User',
        ...currentUserDoc.data()
      };
      
      // Get other user profile
      const otherUserDoc = await getDoc(doc(db, 'users', userId));
      if (!otherUserDoc.exists()) {
        Alert.alert('Profile Error', 'User profile could not be found');
        return;
      }
      
      const otherUserProfile = { 
        id: userId, 
        name: otherUserDoc.data().name || userName,
        ...otherUserDoc.data()
      };
      
      // Navigate to chat
      navigation.navigate('Chat', {
        currentUser: currentUserProfile,
        selectedUser: otherUserProfile
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  // Show profile modal when clicking on a username
  const handleOpenProfile = (userId: string, username: string, isAnonymous: boolean) => {
    setSelectedUser({
      id: userId,
      name: username,
      isAnonymous: isAnonymous
    });
    setProfileModalVisible(true);
  };

  // Close profile modal
  const handleCloseProfile = () => {
    setProfileModalVisible(false);
  };

  // Toggle expanded replies
  const toggleReplies = (answerId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(answerId)) {
        newSet.delete(answerId);
      } else {
        newSet.add(answerId);
      }
      return newSet;
    });
  };

  // Format timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Render answer with threaded replies
  const renderAnswer = (answer: Answer, isReply: boolean = false) => (
    <View key={answer.id} style={[
      styles.answerContainer, 
      isReply && styles.replyContainer,
      isDark && styles.answerContainerDark,
      isReply && isDark && styles.replyContainerDark
    ]}>
      <View style={styles.answerHeader}>
        <View style={styles.authorInfo}>
          <Image 
            source={{ uri: answer.isAnonymous 
              ? answer.anonymousAvatar || generateRandomAvatar() 
              : (answer.authorId === currentUser?.id ? currentUser?.avatar : undefined) // fallback to undefined for now
            }} 
            style={styles.authorAvatar} 
          />
          <View style={styles.authorDetails}>
            <TouchableOpacity onPress={() => handleOpenProfile(answer.authorId, answer.author, answer.isAnonymous)}>
              <Text style={[styles.authorName, isDark && styles.textDark]}>
                {answer.isAnonymous ? '🕶️ Anonymous' : answer.author}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.answerTimestamp, isDark && styles.textDark]}>
              {formatTimestamp(answer.timestamp)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.answerContent, isDark && styles.textDark]}>{answer.content}</Text>

      <View style={styles.answerFooter}>
        <View style={styles.voteContainer}>
          <TouchableOpacity 
            style={[
              styles.voteButton,
              safeIncludes(answer.upvotes, currentUser?.id) && styles.upvotedButton
            ]}
            onPress={() => voteAnswer(answer.id, 'up')}
          >
            <Ionicons 
              name="arrow-up" 
              size={18} 
              color={safeIncludes(answer.upvotes, currentUser?.id) ? '#FF6B35' : isDark ? '#8E8E93' : '#6E7B8B'} 
            />
            <Text style={[
              styles.voteText,
              safeIncludes(answer.upvotes, currentUser?.id) && styles.upvotedText,
              isDark && styles.textDark
            ]}>
              {answer.upvotes.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.voteButton,
              safeIncludes(answer.downvotes, currentUser?.id) && styles.downvotedButton
            ]}
            onPress={() => voteAnswer(answer.id, 'down')}
          >
            <Ionicons 
              name="arrow-down" 
              size={18} 
              color={safeIncludes(answer.downvotes, currentUser?.id) ? '#7C3AED' : isDark ? '#8E8E93' : '#6E7B8B'} 
            />
            <Text style={[
              styles.voteText,
              safeIncludes(answer.downvotes, currentUser?.id) && styles.downvotedText,
              isDark && styles.textDark
            ]}>
              {answer.downvotes.length}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.answerActions}>
          <TouchableOpacity 
            style={styles.replyButton}
            onPress={() => setReplyingTo(answer.id)}
          >
            <Ionicons name="chatbubble-outline" size={16} color={isDark ? '#8E8E93' : '#6E7B8B'} />
            <Text style={[styles.replyButtonText, isDark && styles.textDark]}>Reply</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => {
              if (!answer.isAnonymous) {
                handleStartChat(answer.authorId, answer.author);
              } else {
                Alert.alert('Anonymous User', 'Cannot chat with anonymous users');
              }
            }}
            disabled={answer.isAnonymous}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={answer.isAnonymous ? '#C7C7CC' : (isDark ? '#8E8E93' : '#6E7B8B')} />
            <Text style={[styles.chatButtonText, answer.isAnonymous && styles.chatButtonTextDisabled, isDark && styles.textDark]}>Chat</Text>
          </TouchableOpacity>
        </View>

        {answer.replies && answer.replies.length > 0 && (
          <TouchableOpacity 
            style={styles.showRepliesButton}
            onPress={() => toggleReplies(answer.id)}
          >
            <Ionicons 
              name={expandedReplies.has(answer.id) ? "chevron-up" : "chevron-down"} 
              size={16} 
              color={isDark ? '#8E8E93' : '#6E7B8B'} 
            />
            <Text style={[styles.showRepliesText, isDark && styles.textDark]}>
              {expandedReplies.has(answer.id) ? 'Hide' : 'Show'} {answer.replies.length} {answer.replies.length === 1 ? 'reply' : 'replies'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Threaded Replies */}
      {answer.replies && answer.replies.length > 0 && expandedReplies.has(answer.id) && (
        <View style={styles.repliesContainer}>
          {answer.replies.map(reply => renderAnswer(reply, true))}
        </View>
      )}
    </View>
  );

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await loadQuestionDetails();
    setRefreshing(false);
  };

  // Restore generateRandomAvatar function
  const generateRandomAvatar = (): string => {
    const avatars = [
      'https://i.pravatar.cc/150?u=anon1',
      'https://i.pravatar.cc/150?u=anon2',
      'https://i.pravatar.cc/150?u=anon3',
      'https://i.pravatar.cc/150?u=anon4',
      'https://i.pravatar.cc/150?u=anon5',
      'https://i.pravatar.cc/150?u=anon6',
      'https://i.pravatar.cc/150?u=anon7',
      'https://i.pravatar.cc/150?u=anon8',
      'https://i.pravatar.cc/150?u=anon9',
      'https://i.pravatar.cc/150?u=anon10'
    ];
    return avatars[Math.floor(Math.random() * avatars.length)];
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }
  
  if (error || !questionId) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B35" />
          <Text style={styles.errorText}>{error || 'Question ID is missing'}</Text>
          <TouchableOpacity 
            style={styles.backToForumButton}
            onPress={() => navigation.navigate('QnaForum')}
          >
            <Text style={styles.backToForumButtonText}>Back to Forum</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!question) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="help-circle-outline" size={64} color="#FF6B35" />
          <Text style={styles.errorText}>Question not found</Text>
          <TouchableOpacity 
            style={styles.backToForumButton}
            onPress={() => navigation.navigate('QnaForum')}
          >
            <Text style={styles.backToForumButtonText}>Back to Forum</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDark ? styles.safeAreaDark : styles.safeAreaLight, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#1C1C1E" : "#FFFFFF"} />
      <View style={[styles.container, isDark && styles.containerDark]}>
        {/* Header */}
        <View style={[styles.header, isDark && styles.headerDark]}>
          <TouchableOpacity 
            style={[styles.headerBackButton, isDark && styles.headerBackButtonDark]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back-sharp" size={24} color={isDark ? "#FFFFFF" : "#FF6B35"} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, isDark && styles.textDark]}>Q&A Post</Text>
          </View>
          <TouchableOpacity 
            style={[styles.headerActionButton, isDark && styles.headerActionButtonDark]}
            onPress={() => {
              // Share functionality
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Share', 'Sharing functionality will be implemented here.');
            }}
          >
            <Ionicons name="share-outline" size={24} color={isDark ? "#FFFFFF" : "#FF6B35"} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Question Card */}
          <Animated.View style={[
            styles.questionCard, 
            questionCardStyle,
            isDark && styles.questionCardDark
          ]}>
            <View style={styles.questionHeader}>
              <View style={styles.authorInfo}>
                <Image 
                  source={{ uri: question.isAnonymous 
                    ? question.anonymousAvatar || generateRandomAvatar() 
                    : (question.authorId === currentUser?.id ? currentUser?.avatar : undefined) // fallback to undefined for now
                  }} 
                  style={styles.authorAvatar} 
                />
                <View style={styles.authorDetails}>
                  <TouchableOpacity onPress={() => handleOpenProfile(question.authorId, question.author, question.isAnonymous)}>
                    <Text style={[styles.authorName, isDark && styles.textDark]}>
                      {question.isAnonymous ? '🕶️ Anonymous' : question.author}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.questionTimestamp, isDark && styles.textDark]}>
                    {formatTimestamp(question.timestamp)}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={[styles.questionTitle, isDark && styles.textDark]}>{question.title}</Text>
            <Text style={[styles.questionDescription, isDark && styles.textDark]}>{question.description}</Text>

            {question.imageUrl && (
              <Image source={{ uri: question.imageUrl }} style={styles.questionImage} />
            )}

            {question.tags && question.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {question.tags.map((tag, index) => (
                  <View key={index} style={[styles.tag, isDark && styles.tagDark]}>
                    <Text style={[styles.tagText, isDark && styles.tagTextDark]}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.questionFooter}>
              <View style={styles.voteContainer}>
                <TouchableOpacity 
                  style={[
                    styles.voteButton,
                    safeIncludes(question.upvotes, currentUser?.id) && styles.upvotedButton
                  ]}
                  onPress={() => voteQuestion('up')}
                >
                  <Ionicons 
                    name="arrow-up" 
                    size={18} 
                    color={safeIncludes(question.upvotes, currentUser?.id) ? '#FF6B35' : isDark ? '#8E8E93' : '#6E7B8B'} 
                  />
                  <Text style={[
                    styles.voteText,
                    safeIncludes(question.upvotes, currentUser?.id) && styles.upvotedText,
                    isDark && styles.textDark
                  ]}>
                    {question.upvotes.length}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.voteButton,
                    safeIncludes(question.downvotes, currentUser?.id) && styles.downvotedButton
                  ]}
                  onPress={() => voteQuestion('down')}
                >
                  <Ionicons 
                    name="arrow-down" 
                    size={18} 
                    color={safeIncludes(question.downvotes, currentUser?.id) ? '#7C3AED' : isDark ? '#8E8E93' : '#6E7B8B'} 
                  />
                  <Text style={[
                    styles.voteText,
                    safeIncludes(question.downvotes, currentUser?.id) && styles.downvotedText,
                    isDark && styles.textDark
                  ]}>
                    {question.downvotes.length}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Ionicons name="eye-outline" size={16} color={isDark ? '#8E8E93' : '#6E7B8B'} />
                  <Text style={[styles.statText, isDark && styles.textDark]}>{question.views}</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="chatbubble-outline" size={16} color={isDark ? '#8E8E93' : '#6E7B8B'} />
                  <Text style={[styles.statText, isDark && styles.textDark]}>{answers.length}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Answers Section */}
          <View style={styles.answersSection}>
            <Text style={[styles.answersTitle, isDark && styles.textDark]}>
              Answers ({answers.length})
            </Text>
            
            {answers.map((answer) => renderAnswer(answer))}

            {answers.length === 0 && (
              <View style={styles.noAnswers}>
                <Ionicons name="chatbubble-outline" size={48} color={isDark ? '#3A3A3C' : '#D1D1D6'} />
                <Text style={[styles.noAnswersTitle, isDark && styles.textDark]}>No answers yet</Text>
                <Text style={[styles.noAnswersText, isDark && styles.textDark]}>
                  Be the first to share your knowledge and help others!
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Reply Input */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={[styles.replyInputContainer, isDark && styles.replyInputContainerDark]}>
            {replyingTo && (
              <View style={[styles.replyingToContainer, isDark && styles.replyingToContainerDark]}>
                <Text style={[styles.replyingToText, isDark && styles.textDark]}>
                  Replying to {findAnswerById(replyingTo)?.author || 'Unknown'}
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Ionicons name="close" size={20} color={isDark ? '#FFFFFF' : '#8E8E93'} />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
                <TextInput
                  style={[styles.replyInput, isDark && styles.replyInputDark]}
                  placeholder="Write your answer..."
                  placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                  value={replyText}
                  onChangeText={setReplyText}
                  multiline
                  maxLength={1000}
                />
              </View>
              
              <TouchableOpacity 
                style={[styles.anonymousToggle, isAnonymous && styles.anonymousToggleActive]}
                onPress={() => setIsAnonymous(!isAnonymous)}
              >
                <Ionicons 
                  name={isAnonymous ? "eye-off" : "eye"} 
                  size={20} 
                  color={isAnonymous ? "#FF6B35" : isDark ? '#FFFFFF' : '#8E8E93'} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.sendButton,
                  (!replyText.trim() || submittingReply) && styles.sendButtonDisabled
                ]}
                onPress={submitReply}
                disabled={!replyText.trim() || submittingReply}
              >
                {submittingReply ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Profile Modal */}
        {selectedUser && (
          <QnaProfile
            isVisible={profileModalVisible}
            onClose={handleCloseProfile}
            userId={selectedUser.id}
            username={selectedUser.name}
            isAnonymous={selectedUser.isAnonymous}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaLight: {
    backgroundColor: '#FF6B35',
  },
  safeAreaDark: {
    backgroundColor: '#FF6B35',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  containerDark: {
    backgroundColor: '#1C1C1E',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 53, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 8,
  },
  headerDark: {
    backgroundColor: '#2C2C2E',
    borderBottomColor: '#3A3A3C',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    transform: [{ scale: 1 }],
  },
  headerBackButtonDark: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B35',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(255, 107, 53, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  headerActionButtonDark: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F6FF',
  },
  loadingContainerDark: {
    backgroundColor: '#1C1C1E',
  },
  loadingText: {
    fontSize: 16,
    color: '#2D3748',
    marginTop: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F0F6FF',
  },
  errorContainerDark: {
    backgroundColor: '#1C1C1E',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  backToForumButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToForumButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Question Card Styles
  questionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 24,
    padding: 24,
    shadowColor: 'rgba(255, 107, 53, 0.3)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
    transform: [{ translateY: 0 }],
  },
  questionCardDark: {
    backgroundColor: '#2C2C2E',
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  questionTimestamp: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  questionResolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  resolvedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
  questionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
    lineHeight: 28,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  questionDescription: {
    fontSize: 16,
    color: '#2D3748',
    lineHeight: 22,
    marginBottom: 16,
  },
  questionImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tag: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
  },
  tagDark: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  tagText: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
  tagTextDark: {
    color: '#FF8C66',
  },
  questionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Vote & Stats Styles
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: 'rgba(248, 249, 250, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  upvotedButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  downvotedButton: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  voteText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    marginLeft: 6,
  },
  upvotedText: {
    color: '#FF6B35',
  },
  downvotedText: {
    color: '#7C3AED',
  },
  statsContainer: {
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
    color: '#8E8E93',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Answers Section
  answersSection: {
    marginTop: 20,
  },
  answersTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  answerContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: 'rgba(124, 58, 237, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.1)',
  },
  answerContainerDark: {
    backgroundColor: '#2C2C2E',
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  replyContainer: {
    marginLeft: 20,
    marginRight: 0,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EAEAEA',
    backgroundColor: '#F0F2F5',
  },
  replyContainerDark: {
    borderLeftColor: '#3A3A3C',
    backgroundColor: '#3A3A3C',
  },
  answerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  answerTimestamp: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  answerResolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  acceptedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
  answerContent: {
    fontSize: 15,
    color: '#2D3748',
    lineHeight: 20,
    marginBottom: 12,
  },
  answerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  answerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  replyButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginLeft: 4,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  chatButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginLeft: 4,
  },
  chatButtonTextDisabled: {
    color: '#C7C7CC',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  acceptButtonText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
  },
  showRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  showRepliesText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginLeft: 4,
  },
  repliesContainer: {
    marginTop: 12,
  },

  // No Answers State
  noAnswers: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  noAnswersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8E8E93',
    marginTop: 16,
    marginBottom: 8,
  },
  noAnswersText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Reply Input Section
  replyInputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    paddingTop: 16,
    shadowColor: 'rgba(255, 107, 53, 0.2)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  replyInputContainerDark: {
    backgroundColor: '#2C2C2E',
    borderTopColor: '#3A3A3C',
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  replyingToContainerDark: {
    backgroundColor: '#3A3A3C',
  },
  replyingToText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    maxHeight: 100,
  },
  inputContainerDark: {
    backgroundColor: '#3A3A3C',
  },
  replyInput: {
    fontSize: 16,
    color: '#2D3748',
    minHeight: 20,
  },
  replyInputDark: {
    color: '#FFFFFF',
  },
  anonymousToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F2F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  anonymousToggleActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  textDark: {
    color: '#FFFFFF',
  },
});

export default QnaForumPost;