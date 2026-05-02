import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  TextInput,
  Modal,
  Animated,
  Platform,
  Dimensions,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { RootStackParamList } from '../navigation/router';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../services/firebase'; // Add this import
import { signOut } from 'firebase/auth'; // Add this import

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// TypeScript interfaces
interface UserProfile {
  id: string;
  name: string;
  userName: string;
  bio: string;
  college: string;
  branch: string;
  rank: number;
  badgesObtained: number;
  accountCreatedOn: string;
  connections: number;
  profileImage?: string;
  email?: string;
  yearOfStudy?: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earnedDate: string;
}

interface DropdownOption {
  id: string;
  title: string;
  icon: string;
  action: () => void;
}

type ProfileNavigationProp = StackNavigationProp<RootStackParamList>;

// Helper to format date as '7th July 2025'
function formatMemberSince(dateString?: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  const day = date.getDate();
  const daySuffix = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  return `${day}${daySuffix(day)} ${month} ${year}`;
}

const Profile: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const route = useRoute();
  // @ts-ignore
  const routeUserId = route.params?.userId;
  
  // State management
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<'profile' | 'settings' | 'feedback' | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  
  const [userBadges, setUserBadges] = useState<Badge[]>([
    { id: '1', name: 'Early Bird', description: 'First 100 users', icon: 'star', color: '#FFD700', earnedDate: '15 Jan 2024' },
    { id: '2', name: 'Social Butterfly', description: '50+ connections', icon: 'people', color: '#FF6B6B', earnedDate: '20 Jan 2024' },
    { id: '3', name: 'Study Master', description: 'Joined 10 study groups', icon: 'book', color: '#4ECDC4', earnedDate: '25 Jan 2024' },
    { id: '4', name: 'Event Organizer', description: 'Created 5 events', icon: 'calendar', color: '#45B7D1', earnedDate: '30 Jan 2024' },
    { id: '5', name: 'Helpful Hero', description: 'Helped 20+ students', icon: 'heart', color: '#96CEB4', earnedDate: '05 Feb 2024' },
  ]);
  
  // Feedback form state
  const [feedbackCategory, setFeedbackCategory] = useState<string>('');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState<boolean>(false);
  
  // Edit profile state
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  
  // Animation values
  const dropdownAnimation = useRef(new Animated.Value(0)).current;
  const modalAnimation = useRef(new Animated.Value(0)).current;
  const [uploadingProfileImage, setUploadingProfileImage] = useState<boolean>(false);

  // Dropdown options
  const dropdownOptions: DropdownOption[] = [
    {
      id: 'profile',
      title: 'Your Profile',
      icon: 'person-outline',
      action: () => openModal('profile'),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings-outline',
      action: () => openModal('settings'),
    },
    {
      id: 'feedback',
      title: 'Feedback & Support',
      icon: 'chatbubble-outline',
      action: () => openModal('feedback'),
    },
    {
      id: 'logout',
      title: 'Log Out',
      icon: 'log-out-outline',
      action: () => handleLogout(),
    },
  ];

  const feedbackCategories = [
    'General Feedback',
    'Bug Report',
    'Feature Request',
    'UI/UX Improvement',
    'Performance Issue',
    'Content Suggestion',
    'Other',
  ];

  // Animation functions
  const toggleDropdown = () => {
    const toValue = showDropdown ? 0 : 1;
    setShowDropdown(!showDropdown);
    
    Animated.spring(dropdownAnimation, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const openModal = (modalType: 'profile' | 'settings' | 'feedback') => {
    setShowDropdown(false);
    setActiveModal(modalType);
    
    Animated.spring(modalAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(modalAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setActiveModal(null);
    });
  };

  // Handle functions
  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              // Optionally clear user state here
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              Alert.alert('Logout Error', 'Failed to log out. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackCategory || !feedbackText.trim()) {
      Alert.alert('Error', 'Please select a category and enter your feedback.');
      return;
    }

    setFeedbackSubmitting(true);
    
    try {
      // Firebase Console Action: Create 'feedback' collection in Firestore
      await addDoc(collection(db, 'feedback'), {
        category: feedbackCategory,
        message: feedbackText,
        userId: userProfile?.id,
        userName: userProfile?.name,
        createdAt: new Date().toISOString(),
        status: 'pending',
      });
      
      Alert.alert('Success', 'Thank you for your feedback! We appreciate your input.');
      setFeedbackText('');
      setFeedbackCategory('');
      closeModal();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editingProfile) return;
    try {
      // If the bio is the default message, save as blank
      const defaultBio = `${editingProfile.name || 'This user'} hasn't shared much yet, but we're excited to find out more!`;
      const bioToSave =
        editingProfile.bio && editingProfile.bio.trim() !== '' && editingProfile.bio !== defaultBio
          ? editingProfile.bio
          : '';
      // Only save yearOfStudy if it is defined and not undefined
      const updateData: any = {
        bio: bioToSave,
        branch: editingProfile.branch,
        updatedAt: new Date().toISOString(),
      };
      if (editingProfile.yearOfStudy !== undefined) {
        updateData.yearOfStudy = editingProfile.yearOfStudy;
      }
      await setDoc(doc(db, 'users', userProfile?.id || ''), {
        ...updateData
      }, { merge: true });
      setUserProfile({ ...userProfile!, ...editingProfile, bio: bioToSave });
      setIsEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out ${userProfile?.name}'s profile on YOGO Campus!`,
        title: 'Share Profile',
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  };

  const handleReportIssue = () => {
    setActiveModal('feedback');
    setFeedbackCategory('Bug Report');
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const imageUri = result.assets[0].uri;
      try {
        setUploadingProfileImage(true);
        const storage = getStorage();
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const storageRef = ref(storage, `profileImages/${userProfile?.id}.jpg`);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        await setDoc(doc(db, 'users', userProfile?.id || ''), {
          profileImage: downloadURL,
        }, { merge: true });
        // Immediately fetch the latest profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', userProfile?.id || ''));
        if (userDoc.exists()) {
          setUserProfile({ ...userProfile!, ...userDoc.data() });
        }
        Alert.alert('Success', 'Profile picture updated!');
      } catch (error) {
        console.error('Error uploading image:', error);
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      } finally {
        setUploadingProfileImage(false);
      }
    }
  };

  // When entering edit mode, prefill bio with default if empty
  const handleEditProfile = () => {
    if (userProfile) {
      setEditingProfile({
        ...userProfile,
        bio:
          userProfile.bio && userProfile.bio.trim().length > 0
            ? userProfile.bio
            : `${userProfile.name || 'This user'} hasn't shared much yet, but we're excited to find out more!`,
      });
      setIsEditingProfile(true);
    }
  };

  // Render functions
  const renderDropdown = () => {
    if (!showDropdown) return null;

    return (
      <Animated.View
        style={[
          styles.dropdownContainer,
          {
            opacity: dropdownAnimation,
            transform: [
              {
                translateY: dropdownAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
              {
                scale: dropdownAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}
      >
        <BlurView intensity={95} style={styles.dropdownBlur}>
          {dropdownOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.dropdownItem,
                option.id === 'logout' && styles.logoutItem,
              ]}
              onPress={() => {
                option.action();
                setShowDropdown(false);
              }}
            >
              <Ionicons
                name={option.icon as any}
                size={20}
                color={option.id === 'logout' ? '#FF3B30' : '#1C1C1E'}
                style={styles.dropdownIcon}
              />
              <Text
                style={[
                  styles.dropdownText,
                  option.id === 'logout' && styles.logoutText,
                ]}
              >
                {option.title}
              </Text>
            </TouchableOpacity>
          ))}
        </BlurView>
      </Animated.View>
    );
  };

  const renderProfileModal = () => (
    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
      {loadingProfile || !userProfile ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <ActivityIndicator size="large" color="#4E54C8" />
          <Text style={{ marginTop: 16, color: '#4E54C8', fontSize: 16 }}>Loading profile...</Text>
        </View>
      ) : (
        <>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.profileHeaderGradient}
            >
              <View style={styles.profileImageContainer}>
                <View style={styles.profileImageWrapper}>
                  {userProfile.profileImage ? (
                    <Image
                      source={{ uri: userProfile.profileImage }}
                      style={styles.profileImage}
                    />
                  ) : (
                    <LinearGradient
                      colors={['#4E54C8', '#8B5CF6']}
                      style={styles.profileImage}
                    >
                      <Text style={styles.profileImageText}>
                        {userProfile.name?.charAt(0) || 'U'}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <TouchableOpacity style={styles.editImageButton} onPress={handlePickImage} disabled={uploadingProfileImage}>
                  {uploadingProfileImage ? (
                    <ActivityIndicator color="#FFF" size={16} />
                  ) : (
                    <Ionicons name="camera" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.profileName}>{userProfile.name}</Text>
              <Text style={styles.profileUsername}>{userProfile.userName ? `@${userProfile.userName}` : ''}</Text>
              <View style={styles.profileActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={handleShareProfile}
                >
                  <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.editButton]}
                  onPress={handleEditProfile}
                >
                  <Ionicons name="create-outline" size={18} color="#4E54C8" />
                  <Text style={[styles.actionButtonText, { color: '#4E54C8' }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
          {/* Profile Stats (optional, can be hidden if not available) */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile.rank ?? '-'}</Text>
              <Text style={styles.statLabel}>Rank</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile.badgesObtained ?? '-'}</Text>
              <Text style={styles.statLabel}>Badges</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userProfile.connections ?? '-'}</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </View>
          </View>
          {/* Profile Info */}
          <View style={styles.profileInfoContainer}>
            {/* Bio Section */}
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>About</Text>
              {isEditingProfile ? (
                <TextInput
                  style={[styles.bioText, { backgroundColor: '#F2F2F7', borderRadius: 8, padding: 8, minHeight: 60 }]}
                  multiline
                  value={editingProfile?.bio || ''}
                  onChangeText={text => editingProfile && setEditingProfile({ ...editingProfile, bio: text })}
                  placeholder={`${userProfile.name || 'This user'} hasn't shared much yet, but we're excited to find out more!`}
                />
              ) : (
                <Text style={styles.bioText}>
                  {userProfile.bio && userProfile.bio.trim().length > 0
                    ? userProfile.bio
                    : `${userProfile.name || 'This user'} hasn't shared much yet, but we're excited to find out more!`}
                </Text>
              )}
            </View>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Academic Details</Text>
              <View style={styles.infoRow}>
                <Ionicons name="school-outline" size={20} color="#8E8E93" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>College</Text>
                  <Text style={styles.infoValue}>{userProfile.college}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="code-slash-outline" size={20} color="#8E8E93" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Branch</Text>
                  <Text style={styles.infoValue}>{userProfile.branch}</Text>
                </View>
              </View>
            </View>
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Account Information</Text>
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={20} color="#8E8E93" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{userProfile.email}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={20} color="#8E8E93" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Member Since</Text>
                  <Text style={styles.infoValue}>{formatMemberSince(userProfile.accountCreatedOn)}</Text>
                </View>
              </View>
            </View>
            {/* Save/Cancel buttons for edit mode */}
            {isEditingProfile && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12 }}>
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: '#C7C7CC' }]}
                  onPress={() => setIsEditingProfile(false)}
                >
                  <Text style={styles.submitButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleUpdateProfile}
                  disabled={!editingProfile}
                >
                  <Text style={styles.submitButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderSettingsModal = () => (
    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
      <View style={styles.settingsContainer}>
        <Text style={styles.modalTitle}>Settings</Text>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => {
            closeModal();
            // Navigate to edit profile
            openModal('profile');
          }}
        >
          <View style={styles.settingIconContainer}>
            <Ionicons name="person-outline" size={24} color="#4E54C8" />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Edit Profile</Text>
            <Text style={styles.settingSubtitle}>Update your personal information</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="information-circle-outline" size={24} color="#4E54C8" />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>About App</Text>
            <Text style={styles.settingSubtitle}>Version 1.0.0 • Learn more about YOGO</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem}
          onPress={handleReportIssue}
        >
          <View style={styles.settingIconContainer}>
            <Ionicons name="bug-outline" size={24} color="#FF3B30" />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Report Issue</Text>
            <Text style={styles.settingSubtitle}>Found a bug? Let us know!</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderFeedbackModal = () => (
    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
      <View style={styles.feedbackContainer}>
        <Text style={styles.modalTitle}>Feedback & Support</Text>
        
        <Text style={styles.feedbackLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {feedbackCategories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                feedbackCategory === category && styles.selectedCategoryChip,
              ]}
              onPress={() => setFeedbackCategory(category)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  feedbackCategory === category && styles.selectedCategoryChipText,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.feedbackLabel}>Your Message</Text>
        <TextInput
          style={styles.feedbackInput}
          multiline
          numberOfLines={6}
          placeholder="Tell us about your experience, suggestions, or any issues you've encountered..."
          placeholderTextColor="#C7C7CC"
          value={feedbackText}
          onChangeText={setFeedbackText}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitButton, (!feedbackCategory || !feedbackText.trim()) && styles.disabledButton]}
          onPress={handleFeedbackSubmit}
          disabled={feedbackSubmitting || !feedbackCategory || !feedbackText.trim()}
        >
          <Text style={styles.submitButtonText}>
            {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderModal = () => {
    if (!activeModal) return null;

    return (
      <Modal
        visible={!!activeModal}
        animationType="none"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeModal}
          />
          
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: modalAnimation,
                transform: [
                  {
                    translateY: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [SCREEN_HEIGHT, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <BlurView intensity={95} style={styles.modalBlur}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#1C1C1E" />
                </TouchableOpacity>
              </View>
              
              {activeModal === 'profile' && renderProfileModal()}
              {activeModal === 'settings' && renderSettingsModal()}
              {activeModal === 'feedback' && renderFeedbackModal()}
            </BlurView>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // Fetch user profile from Firestore on mount
  useEffect(() => {
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        let userIdToFetch = routeUserId;
        if (!userIdToFetch) {
          const user = auth.currentUser;
          userIdToFetch = user?.uid;
        }
        if (userIdToFetch) {
          const userDoc = await getDoc(doc(db, 'users', userIdToFetch));
          if (userDoc.exists()) {
            setUserProfile({ id: userIdToFetch, ...userDoc.data() } as UserProfile);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [routeUserId]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Profile</Text>
        
        <TouchableOpacity onPress={toggleDropdown} style={styles.menuButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#1C1C1E" />
        </TouchableOpacity>
      </View>

      {/* Dropdown */}
      {renderDropdown()}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profilePreview}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.previewGradient}
          >
            <View style={styles.previewImageContainer}>
              <LinearGradient
                colors={['#4E54C8', '#8B5CF6']}
                style={styles.previewImage}
              >
                <Text style={styles.previewImageText}>
                  {userProfile?.name?.charAt(0) || 'U'}
                </Text>
              </LinearGradient>
            </View>
            
            <Text style={styles.previewName}>{userProfile?.name || ''}</Text>
            <Text style={styles.previewUsername}>{userProfile?.userName ? `@${userProfile.userName}` : ''}</Text>
            <Text style={styles.previewBio}>
              {userProfile?.bio && userProfile.bio.trim().length > 0
                ? userProfile.bio
                : `${userProfile?.name || 'This user'} hasn't shared much yet, but we're excited to find out more!`}
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatNumber}>{userProfile?.rank ?? '-'}</Text>
            <Text style={styles.quickStatLabel}>Campus Rank</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatNumber}>{userProfile?.badgesObtained ?? '-'}</Text>
            <Text style={styles.quickStatLabel}>Badges Earned</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatNumber}>{userProfile?.connections ?? '-'}</Text>
            <Text style={styles.quickStatLabel}>Connections</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.viewFullProfileButton}
          onPress={() => openModal('profile')}
        >
          <Text style={styles.viewFullProfileText}>View Full Profile</Text>
          <Ionicons name="arrow-forward" size={20} color="#4E54C8" />
        </TouchableOpacity>
      </ScrollView>

      {/* Modal */}
      {renderModal()}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  
  // Dropdown styles
  dropdownContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 120,
    right: 20,
    zIndex: 1000,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dropdownBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  dropdownIcon: {
    marginRight: 12,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  logoutText: {
    color: '#FF3B30',
  },
  
  // Content styles
  content: {
    flex: 1,
  },
  profilePreview: {
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  previewGradient: {
    padding: 32,
    alignItems: 'center',
  },
  previewImageContainer: {
    marginBottom: 16,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  previewImageText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  previewName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  previewUsername: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  previewBio: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  viewFullProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  viewFullProfileText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    flex: 1,
    marginTop: SCREEN_HEIGHT * 0.1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalBlur: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  modalContent: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  
  // Profile modal styles
  profileHeader: {
    borderRadius: 20,
    margin: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  profileHeaderGradient: {
    padding: 32,
    alignItems: 'center',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImageWrapper: {
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileImageText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4E54C8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  profileUsername: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  editButton: {
    backgroundColor: '#FFFFFF',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  statLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F2F2F7',
    marginHorizontal: 20,
  },
  
  profileInfoContainer: {
    padding: 20,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4E54C8',
    fontWeight: '600',
    marginRight: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  bioText: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  infoValue: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  badgesScroll: {
    marginTop: 8,
  },
  badgeItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 80,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  badgeDate: {
    fontSize: 10,
    color: '#8E8E93',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  // Settings modal styles
  settingsContainer: {
    padding: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  settingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  // Feedback modal styles
  feedbackContainer: {
    padding: 20,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  categoriesScroll: {
    marginBottom: 24,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    marginRight: 12,
  },
  selectedCategoryChip: {
    backgroundColor: '#4E54C8',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  selectedCategoryChipText: {
    color: '#FFFFFF',
  },
  feedbackInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    marginBottom: 24,
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: '#4E54C8',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
});

export default Profile;
