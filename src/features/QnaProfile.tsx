import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface QnaProfileProps {
  userId: string;
  username: string;
  isAnonymous: boolean;
  isVisible: boolean;
  onClose: () => void;
  profileImage?: string;
}

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  points: number;
  reputation: number;
  avatar?: string;
  joinDate?: any;
  questionsCount?: number;
  answersCount?: number;
  acceptedAnswers?: number;
  badges?: string[];
}

interface UserActivity {
  id: string;
  type: 'question' | 'answer';
  title: string;
  timestamp: any;
  points: number;
  isAccepted?: boolean;
}

const QnaProfile: React.FC<QnaProfileProps> = ({
  userId,
  username,
  isAnonymous,
  isVisible,
  onClose,
  profileImage: propProfileImage
}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');

  useEffect(() => {
    if (isVisible && !isAnonymous) {
      loadUserProfile();
      loadUserActivity();
    } else if (isVisible && isAnonymous) {
      setUserProfile({
        id: 'anonymous',
        name: 'Anonymous User',
        points: 0,
        reputation: 0,
        avatar: 'https://i.pravatar.cc/150?u=anonymous',
      });
      setUserActivity([]);
      setLoading(false);
    }
  }, [isVisible, userId, isAnonymous]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile({
          id: userDoc.id,
          name: userData.name || username,
          email: userData.email,
          points: userData.points || 0,
          reputation: userData.reputation || 0,
          avatar: userData.profileImage || userData.avatar || propProfileImage || 'https://i.pravatar.cc/150?u=' + userId,
          joinDate: userData.joinDate,
          questionsCount: userData.questionsCount || 0,
          answersCount: userData.answersCount || 0,
          acceptedAnswers: userData.acceptedAnswers || 0,
          badges: userData.badges || []
        });
      } else {
        setUserProfile({
          id: userId,
          name: username,
          points: 0,
          reputation: 0,
          avatar: propProfileImage || 'https://i.pravatar.cc/150?u=' + userId
        });
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading user profile:', error);
      setLoading(false);
    }
  };

  const loadUserActivity = async () => {
    try {
      // Get user's questions
      const questionsQuery = query(
        collection(db, 'qna_questions'),
        where('authorId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      
      const questionsSnapshot = await getDocs(questionsQuery);
      const questions = questionsSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'question' as const,
        title: doc.data().title,
        timestamp: doc.data().timestamp,
        points: doc.data().points || 0
      }));
      
      // Get user's answers
      const answersQuery = query(
        collection(db, 'qna_answers'),
        where('authorId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      
      const answersSnapshot = await getDocs(answersQuery);
      const answers = answersSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'answer' as const,
        title: doc.data().content.substring(0, 50) + '...',
        timestamp: doc.data().timestamp,
        points: doc.data().points || 0,
        isAccepted: doc.data().isAccepted || false
      }));
      
      // Combine and sort by timestamp
      const combined = [...questions, ...answers].sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
        return bTime - aTime;
      });
      
      setUserActivity(combined);
    } catch (error) {
      console.error('Error loading user activity:', error);
    }
  };

  const handleViewProfile = () => {
    if (isAnonymous) {
      Alert.alert('Anonymous Profile', 'This user has chosen to remain anonymous');
    } else {
      navigation.navigate('Profile', { userId });
    }
    onClose();
  };

  const handleReportUser = () => {
    Alert.alert(
      'Report User',
      'Why are you reporting this user?',
      [
        {
          text: 'Inappropriate Content',
          onPress: () => reportUser('inappropriate_content')
        },
        {
          text: 'Harassment',
          onPress: () => reportUser('harassment')
        },
        {
          text: 'Spam',
          onPress: () => reportUser('spam')
        },
        {
          text: 'Cancel',
          style: 'cancel'
        },
      ]
    );
    onClose();
  };

  const reportUser = (reason: string) => {
    // Implement the reporting functionality
    console.log(`Reporting user ${userId} for reason: ${reason}`);
    Alert.alert(
      'Report Submitted',
      'Thank you for helping to keep our community safe. We will review this report soon.'
    );
  };

  const handleStartChat = () => {
    if (isAnonymous) {
      Alert.alert('Anonymous User', 'Cannot chat with anonymous users');
      return;
    }
    
    (async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          Alert.alert('Login Required', 'Please log in to start a chat');
          return;
        }
        
        if (currentUser.uid === userId) {
          Alert.alert('Cannot chat with yourself', 'You cannot start a chat with yourself');
          return;
        }
        
        // Get current user profile
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!currentUserDoc.exists()) {
          Alert.alert('Profile Error', 'Your profile could not be found');
          return;
        }
        
        const currentUserProfile = { 
          id: currentUser.uid, 
          name: currentUserDoc.data().name || currentUser.displayName || 'User',
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
          name: otherUserDoc.data().name || username,
          ...otherUserDoc.data()
        };
        
        // Navigate to chat
        navigation.navigate('Chat', {
          currentUser: currentUserProfile,
          selectedUser: otherUserProfile
        });
        onClose();
      } catch (error) {
        console.error('Error starting chat:', error);
        Alert.alert('Error', 'Failed to start chat. Please try again.');
      }
    })();
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    
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

  const renderOverviewTab = () => {
    if (!userProfile) return null;
    
    return (
      <ScrollView style={styles.tabContent}>
        {/* Stats Section */}
        <View style={[styles.statsSection, isDark ? styles.sectionDark : null]}>
          <Text style={[styles.sectionTitle, isDark ? styles.textDark : null]}>
            Stats
          </Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statItem, isDark ? styles.statItemDark : null]}>
              <Text style={[styles.statValue, isDark ? styles.textDark : null]}>
                {userProfile.reputation || 0}
              </Text>
              <Text style={[styles.statLabel, isDark ? styles.textDark : null]}>
                Reputation
              </Text>
            </View>
            
            <View style={[styles.statItem, isDark ? styles.statItemDark : null]}>
              <Text style={[styles.statValue, isDark ? styles.textDark : null]}>
                {userProfile.points || 0}
              </Text>
              <Text style={[styles.statLabel, isDark ? styles.textDark : null]}>
                Points
              </Text>
            </View>
            
            <View style={[styles.statItem, isDark ? styles.statItemDark : null]}>
              <Text style={[styles.statValue, isDark ? styles.textDark : null]}>
                {userProfile.questionsCount || 0}
              </Text>
              <Text style={[styles.statLabel, isDark ? styles.textDark : null]}>
                Questions
              </Text>
            </View>
            
            <View style={[styles.statItem, isDark ? styles.statItemDark : null]}>
              <Text style={[styles.statValue, isDark ? styles.textDark : null]}>
                {userProfile.answersCount || 0}
              </Text>
              <Text style={[styles.statLabel, isDark ? styles.textDark : null]}>
                Answers
              </Text>
            </View>
          </View>
        </View>
        
        {/* Badges Section */}
        {userProfile.badges && userProfile.badges.length > 0 && (
          <View style={[styles.badgesSection, isDark ? styles.sectionDark : null]}>
            <Text style={[styles.sectionTitle, isDark ? styles.textDark : null]}>
              Badges
            </Text>
            
            <View style={styles.badgesGrid}>
              {userProfile.badges.map((badge, index) => (
                <View key={index} style={[styles.badgeItem, isDark ? styles.badgeItemDark : null]}>
                  <Ionicons name="ribbon" size={20} color="#FFD700" />
                  <Text style={[styles.badgeText, isDark ? styles.textDark : null]}>
                    {badge}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* Join Date */}
        {userProfile.joinDate && (
          <View style={[styles.joinDateSection, isDark ? styles.sectionDark : null]}>
            <Text style={[styles.joinDateText, isDark ? styles.textDark : null]}>
              Member since {formatDate(userProfile.joinDate)}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderActivityTab = () => {
    return (
      <ScrollView style={styles.tabContent}>
        {userActivity.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Ionicons
              name="document-text-outline"
              size={48}
              color={isDark ? '#3A3A3C' : '#D1D1D6'}
            />
            <Text style={[styles.emptyActivityText, isDark ? styles.textDark : null]}>
              No activity yet
            </Text>
          </View>
        ) : (
          userActivity.map((activity, index) => (
            <View
              key={index}
              style={[styles.activityItem, isDark ? styles.activityItemDark : null]}
            >
              <View style={styles.activityHeader}>
                <View style={styles.activityTypeContainer}>
                  <Ionicons
                    name={activity.type === 'question' ? 'help-circle' : 'chatbubble'}
                    size={16}
                    color={activity.type === 'question' ? '#FF6B35' : '#4E54C8'}
                  />
                  <Text style={[
                    styles.activityType,
                    { color: activity.type === 'question' ? '#FF6B35' : '#4E54C8' }
                  ]}>
                    {activity.type === 'question' ? 'Question' : 'Answer'}
                  </Text>
                </View>
                
                <Text style={[styles.activityTime, isDark ? styles.textDark : null]}>
                  {formatTimestamp(activity.timestamp)}
                </Text>
              </View>
              
              <Text style={[styles.activityTitle, isDark ? styles.textDark : null]}>
                {activity.title}
              </Text>
              
              <View style={styles.activityFooter}>
                <View style={styles.activityPoints}>
                  <Ionicons
                    name={activity.points >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={14}
                    color={activity.points >= 0 ? '#10B981' : '#EF4444'}
                  />
                  <Text style={[
                    styles.pointsText,
                    { color: activity.points >= 0 ? '#10B981' : '#EF4444' }
                  ]}>
                    {Math.abs(activity.points)} points
                  </Text>
                </View>
                
                {activity.type === 'answer' && activity.isAccepted && (
                  <View style={styles.acceptedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.acceptedText}>Accepted</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[
        styles.overlay,
        isDark ? styles.overlayDark : null
      ]}>
        <View style={[
          styles.profileCard,
          isDark ? styles.profileCardDark : null
        ]}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={[styles.loadingText, isDark ? styles.textDark : null]}>
                Loading profile...
              </Text>
            </View>
          ) : (
            <>
              {/* Profile Header */}
              <View style={styles.header}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={isDark ? '#FFFFFF' : '#1C1C1E'}
                  />
                </TouchableOpacity>
              </View>
              
              {/* User Info */}
              <View style={styles.userInfoContainer}>
                <Image
                  source={{ uri: userProfile?.avatar || propProfileImage || 'https://via.placeholder.com/100' }}
                  style={styles.userAvatar}
                />
                
                <Text style={[styles.userName, isDark ? styles.textDark : null]}>
                  {isAnonymous ? '🕶️ Anonymous User' : userProfile?.name}
                </Text>
                
                {!isAnonymous && (
                  <View style={styles.userStats}>
                    <LinearGradient
                      colors={['#FF6B35', '#FF8C66']}
                      style={styles.pointsBadge}
                    >
                      <Text style={styles.pointsBadgeText}>
                        {userProfile?.points || 0} points
                      </Text>
                    </LinearGradient>
                  </View>
                )}
              </View>
              
              {/* Tab Bar */}
              {!isAnonymous && (
                <View style={[styles.tabBar, isDark ? styles.tabBarDark : null]}>
                  <TouchableOpacity
                    style={[
                      styles.tab,
                      activeTab === 'overview' && styles.activeTab,
                      isDark ? styles.tabDark : null,
                      activeTab === 'overview' && isDark && styles.activeTabDark
                    ]}
                    onPress={() => setActiveTab('overview')}
                  >
                    <Text style={[
                      styles.tabText,
                      activeTab === 'overview' && styles.activeTabText,
                      isDark ? styles.textDark : null
                    ]}>
                      Overview
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.tab,
                      activeTab === 'activity' && styles.activeTab,
                      isDark ? styles.tabDark : null,
                      activeTab === 'activity' && isDark && styles.activeTabDark
                    ]}
                    onPress={() => setActiveTab('activity')}
                  >
                    <Text style={[
                      styles.tabText,
                      activeTab === 'activity' && styles.activeTabText,
                      isDark ? styles.textDark : null
                    ]}>
                      Activity
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Tab Content */}
              {!isAnonymous && (
                <View style={styles.tabContentContainer}>
                  {activeTab === 'overview' ? renderOverviewTab() : renderActivityTab()}
                </View>
              )}
              
              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                {!isAnonymous && (
                  <TouchableOpacity
                    style={[styles.actionButton, isDark ? styles.actionButtonDark : null]}
                    onPress={handleViewProfile}
                  >
                    <Ionicons
                      name="person"
                      size={20}
                      color={isDark ? '#FFFFFF' : '#1C1C1E'}
                      style={styles.actionIcon}
                    />
                    <Text style={[styles.actionText, isDark ? styles.textDark : null]}>
                      View Full Profile
                    </Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.chatButton]}
                  onPress={handleStartChat}
                >
                  <Ionicons
                    name="chatbubble"
                    size={20}
                    color="#FFFFFF"
                    style={styles.actionIcon}
                  />
                  <Text style={styles.chatButtonText}>
                    Start Chatting
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.reportButton, isDark ? styles.reportButtonDark : null]}
                  onPress={handleReportUser}
                >
                  <Ionicons
                    name="flag"
                    size={20}
                    color="#EF4444"
                    style={styles.actionIcon}
                  />
                  <Text style={styles.reportButtonText}>
                    Report User
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  profileCardDark: {
    backgroundColor: '#2C2C2E',
  },
  header: {
    alignItems: 'flex-end',
    padding: 16,
  },
  closeButton: {
    padding: 4,
  },
  userInfoContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  pointsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pointsBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    margin: 16,
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
  tabContentContainer: {
    maxHeight: 200,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tabContent: {
    flex: 1,
  },
  statsSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  statItemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6E7B8B',
  },
  badgesSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeItemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 8,
  },
  joinDateSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  joinDateText: {
    fontSize: 14,
    color: '#6E7B8B',
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyActivityText: {
    fontSize: 16,
    color: '#6E7B8B',
    marginTop: 12,
  },
  activityItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityItemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityType: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  activityTitle: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 8,
  },
  activityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  acceptedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
  },
  actionButtons: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  actionButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionIcon: {
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  chatButton: {
    backgroundColor: '#4E54C8',
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  reportButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  reportButtonDark: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6E7B8B',
    marginTop: 16,
  },
  textDark: {
    color: '#FFFFFF',
  },
});

export default QnaProfile;