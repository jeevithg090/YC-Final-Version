import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  UIManager,
  LayoutAnimation,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Easing,
  StatusBar,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc,
  addDoc,
  serverTimestamp,
  getFirestore
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

// Ultra-light blue modern palette for soft, clean UI
const COLORS = {
  primary: '#3B82F6', // Blue for buttons/accents
  secondary: '#60A5FA', // Lighter blue accent
  lost: {
    primary: '#60A5FA', // Light blue
    secondary: '#E0E7EF', // Very light blue
    light: '#F1F5F9', // Card background
    gradient: ['#E0E7EF', '#F1F5F9'], // Subtle blue gradient
    muted: '#E0E7EF',
  },
  found: {
    primary: '#3B82F6', // Blue
    secondary: '#E0E7EF', // Very light blue
    light: '#F1F5F9', // Card background
    gradient: ['#E0E7EF', '#F1F5F9'],
    muted: '#E0E7EF',
  },
  inactive: '#CBD5E1', // Muted blue-gray
  background: '#F8FAFC', // App background (ultra-light blue/white)
  white: '#FFFFFF',
  text: {
    primary: '#1E293B', // Dark blue-gray
    secondary: '#334155', // Slightly lighter
    light: '#64748B', // Medium blue-gray
    inverse: '#FFFFFF', // White text
  },
  border: {
    light: '#E0E7EF', // Light blue-gray
    medium: '#CBD5E1', // Medium blue-gray
  },
  blue: {
    primary: '#3B82F6',
    light: '#E0E7EF',
  },
  shadow: 'rgba(30, 58, 138, 0.06)', // Very subtle blue shadow
};

const windowDimensions = Dimensions.get('window');
const { width, height } = windowDimensions;

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Animation configurations
const springConfig = {
  duration: 300,
  create: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.8,
    property: LayoutAnimation.Properties.scaleXY,
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.8,
    property: LayoutAnimation.Properties.scaleXY,
  },
};

const fadeConfig = {
  duration: 300,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

// TypeScript interfaces
interface LostFoundItem {
  id: string;
  type: 'lost' | 'found';
  title: string;
  description: string;
  location: string;
  dateLost: string;
  imageUrl?: string;
  contactInfo: string;
  itemCategory: string;
  secretPhrase?: string; // For verification
  status: 'active' | 'claimed' | 'resolved';
  createdAt: any;
  createdBy: string;
  claims?: ClaimRequest[];
}

interface ClaimRequest {
  id: string;
  claimerName: string;
  claimerContact: string;
  verificationAnswer: string;
  timestamp: any;
  status: 'pending' | 'approved' | 'rejected';
}

// Enhanced card gradients with improved visual depth
const cardGradients = {
  lost: ['#E0E7EF', '#F1F5F9'], // Subtle blue gradient
  found: ['#E0E7EF', '#F1F5F9'],
};

// Enhanced Header Component with back button and My Posts toggle
const Header: React.FC<{
  showMyPosts: boolean;
  setShowMyPosts: (show: boolean) => void;
  navigation: any;
}> = ({ showMyPosts, setShowMyPosts, navigation }) => {
  return (
    <SafeAreaView style={styles.headerContainer}>
      <View style={styles.headerContent}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Feather name="arrow-left" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Lost & Found</Text>
        
        <TouchableOpacity 
          style={[
            styles.myPostsButton,
            showMyPosts && styles.myPostsButtonActive
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowMyPosts(!showMyPosts);
          }}
        >
          <Feather 
            name="user" 
            size={16} 
            color={showMyPosts ? COLORS.white : COLORS.primary}
          />
          <Text 
            style={[
              styles.myPostsText,
              showMyPosts && styles.myPostsTextActive
            ]}
          >
            My Posts
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const LostAndFound: React.FC = () => {
  const navigation = useNavigation<any>();
  const db = getFirestore();
  const { currentUser } = useAuth();

  // Animation refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const postButtonScale = useRef(new Animated.Value(1)).current;
  const filterSlideAnim = useRef(new Animated.Value(0)).current;
  const itemAnimations = useRef<{ [key: string]: Animated.Value }>({}).current;
  
  // State
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [showClaimModal, setShowClaimModal] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'lost' | 'found'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showMyPosts, setShowMyPosts] = useState<boolean>(false);

  // Post form states
  const [postType, setPostType] = useState<'lost' | 'found'>('lost');
  const [postTitle, setPostTitle] = useState<string>('');
  const [postDescription, setPostDescription] = useState<string>('');
  const [postLocation, setPostLocation] = useState<string>('');
  const [postDate, setPostDate] = useState<string>('');
  const [postCategory, setPostCategory] = useState<string>('');
  const [postContact, setPostContact] = useState<string>('');
  const [postSecretPhrase, setPostSecretPhrase] = useState<string>('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [posting, setPosting] = useState<boolean>(false);

  // Claim form states
  const [claimerName, setClaimerName] = useState<string>('');
  const [claimerContact, setClaimerContact] = useState<string>('');
  const [verificationAnswer, setVerificationAnswer] = useState<string>('');
  const [claiming, setClaiming] = useState<boolean>(false);

  const categories = [
    'Electronics', 'Books', 'Clothing', 'Accessories', 'ID Cards',
    'Keys', 'Water Bottles', 'Bags', 'Sports Equipment', 'Other'
  ];

  const locations = [
    'Library', 'Cafeteria', 'Hostel', 'Academic Block A', 'Academic Block B',
    'Sports Complex', 'Auditorium', 'Parking Area', 'Garden', 'Other'
  ];

  // Firebase Console Action: Create 'lost_and_found' collection in Firestore with proper indexes
  useEffect(() => {
    const itemsRef = collection(db, 'lost_and_found');
    const q = query(itemsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LostFoundItem[];
        
        // Animate items loading
        LayoutAnimation.configureNext(fadeConfig);
        setItems(itemsData);
        setFilteredItems(itemsData);
        setLoading(false);
        setRefreshing(false);
        
        // Trigger haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      (error) => {
        console.error('Firebase connection failed:', error);
        Alert.alert('Error', 'Failed to connect to Firebase. Please check your setup.');
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Animation setup
  useEffect(() => {
    // Animate filter bar on mount
    Animated.timing(filterSlideAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Loading animation
    if (loading) {
      Animated.loop(
        Animated.timing(scrollY, {
          toValue: 360,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [loading]);

  // Animate post button on press
  const animatePostButton = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(postButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(postButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Get item animation value
  const getItemAnimation = (itemId: string) => {
    if (!itemAnimations[itemId]) {
      itemAnimations[itemId] = new Animated.Value(0);
      // Animate item in
      Animated.timing(itemAnimations[itemId], {
        toValue: 1,
        duration: 300,
        delay: Math.random() * 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    return itemAnimations[itemId];
  };

  // Filter and search functionality with animations
  useEffect(() => {
    let filtered = items;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(item => item.itemCategory === filterCategory);
    }

    // Search functionality
    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return b.createdAt?.seconds - a.createdAt?.seconds;
      } else {
        return a.createdAt?.seconds - b.createdAt?.seconds;
      }
    });

    // Animate filter changes
    LayoutAnimation.configureNext(springConfig);
    setFilteredItems(filtered);
    
    // Trigger haptic feedback for filter changes
    if (items.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [items, searchQuery, filterType, filterCategory, sortBy]);

  // Enhanced filter toggle
  const toggleFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(springConfig);
    setShowFilters(!showFilters);
  };

  const handleImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sorry', 'We need camera roll permissions to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPostImage(result.assets[0].uri);
    }
  };

  const handlePostItem = async () => {
    if (!postTitle.trim() || !postDescription.trim() || !postLocation.trim() || !postDate.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    setPosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const newItem: Omit<LostFoundItem, 'id'> = {
        type: postType,
        title: postTitle.trim(),
        description: postDescription.trim(),
        location: postLocation,
        dateLost: postDate,
        contactInfo: postContact.trim(),
        itemCategory: postCategory,
        secretPhrase: postSecretPhrase.trim(),
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: 'current_user', // Replace with actual user ID
        ...(postImage ? { imageUrl: postImage } : {}), // Only add imageUrl if present
      };

      await addDoc(collection(db, 'lost_and_found'), newItem);
      
      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Reset form with animation
      LayoutAnimation.configureNext(fadeConfig);
      setPostTitle('');
      setPostDescription('');
      setPostLocation('');
      setPostDate('');
      setPostCategory('');
      setPostContact('');
      setPostSecretPhrase('');
      setPostImage(null);
      setShowPostModal(false);
      
      Alert.alert('Success', `Your ${postType} item has been posted!`);
    } catch (error) {
      console.error('Error posting item:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to post item. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleClaimItem = async () => {
    if (!claimerName.trim() || !claimerContact.trim() || !verificationAnswer.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (!selectedItem) return;

    setClaiming(true);
    
    try {
      const claimRequest: ClaimRequest = {
        id: Date.now().toString(),
        claimerName: claimerName.trim(),
        claimerContact: claimerContact.trim(),
        verificationAnswer: verificationAnswer.trim(),
        timestamp: serverTimestamp(),
        status: 'pending',
      };

      const itemRef = doc(db, 'lost_and_found', selectedItem.id);
      const updatedClaims = [...(selectedItem.claims || []), claimRequest];
      
      await updateDoc(itemRef, {
        claims: updatedClaims,
      });

      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset form with animation
      LayoutAnimation.configureNext(fadeConfig);
      setClaimerName('');
      setClaimerContact('');
      setVerificationAnswer('');
      setShowClaimModal(false);
      setSelectedItem(null);

      Alert.alert('Success', 'Your claim has been submitted! The owner will be notified.');
    } catch (error) {
      console.error('Error submitting claim:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to submit claim. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  // Pull to refresh functionality
  const handleRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Firebase will automatically update through the listener
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // Enhanced item press handler
  const handleItemPress = (item: LostFoundItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedItem(item);
    setShowClaimModal(true);
  };

  // Enhanced item rendering with message button and status toggle for My Posts
  const renderItem = ({ item, index }: { item: LostFoundItem; index: number }) => {
    const animationValue = getItemAnimation(item.id);
    // Use real user ID from auth
    const isMyPost = currentUser && item.createdBy === currentUser.uid;
    
    // Only render in My Posts mode if it's the user's post
    if (showMyPosts && !isMyPost) return null;

    return (
      <Animated.View
        style={[
          styles.itemCard,
          {
            opacity: animationValue,
            transform: [{ scale: animationValue }],
          },
        ]}
      >
        <TouchableOpacity 
          style={styles.itemTouchable}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={
              (item.type === 'lost' ? cardGradients.lost : cardGradients.found) as [string, string]
            }
            style={styles.itemCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.itemHeader}>
              <View style={styles.typeIndicator}>
                <Feather 
                  name={item.type === 'lost' ? 'search' : 'check-circle'} 
                  size={16} 
                  color={COLORS.primary} 
                />
                <Text style={styles.typeText}>
                  {item.type === 'lost' ? 'Lost' : 'Found'}
                </Text>
              </View>
              {/* Delete icon for My Posts only, remove eye button */}
              {showMyPosts && isMyPost && (
                <TouchableOpacity
                  style={{ marginLeft: 12 }}
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Alert.alert(
                      'Delete Post',
                      'Are you sure you want to delete this post?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: async () => {
                          try {
                            const itemRef = doc(db, 'lost_and_found', item.id);
                            await updateDoc(itemRef, { status: 'deleted' }); // Soft delete
                          } catch (error) {
                            Alert.alert('Error', 'Failed to delete post.');
                          }
                        }}
                      ]
                    );
                  }}
                >
                  <Feather name="trash-2" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>

            {item.imageUrl && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.3)']}
                  style={styles.imageOverlay}
                />
              </View>
            )}

            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemDescription} numberOfLines={3}>
                {item.description}
              </Text>

              <View style={styles.itemDetails}>
                <View style={styles.detailRow}>
                  <Feather name="map-pin" size={14} color={COLORS.text.secondary} />
                  <Text style={styles.detailText}>{item.location}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Feather name="calendar" size={14} color={COLORS.text.secondary} />
                  <Text style={styles.detailText}>{item.dateLost}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Feather name="tag" size={14} color={COLORS.text.secondary} />
                  <Text style={styles.detailText}>{item.itemCategory}</Text>
                </View>
                {/^\+?\d{10,15}$/.test(item.contactInfo) && (
                  <TouchableOpacity
                    style={styles.messageButton}
                    onPress={() => {
                      const phone = item.contactInfo.replace(/[^\d+]/g, '');
                      const url = `https://wa.me/${phone}?text=Hi!%20I'm%20interested%20in%20your%20Lost%20%26%20Found%20post%20on%20YOGO%20Campus.`;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      // Open WhatsApp
                      if (Platform.OS === 'web') {
                        window.open(url, '_blank');
                      } else {
                        // Use Linking for React Native
                        import('react-native').then(({ Linking }) => {
                          Linking.openURL(url);
                        });
                      }
                    }}
                  >
                    <Feather name="message-circle" size={16} color={COLORS.white} />
                    <Text style={styles.messageButtonText}>Contact</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderPostModal = () => (
    <Modal
      visible={showPostModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPostModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPostModal(false);
            }}
            style={styles.modalCloseButton}
          >
            <Feather name="x" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Post Item</Text>
          <TouchableOpacity 
            onPress={handlePostItem} 
            disabled={posting}
            style={[styles.modalActionButton, posting && styles.disabledButton]}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#4E54C8" />
            ) : (
              <LinearGradient
                colors={['#4E54C8', '#8B5CF6']}
                style={styles.modalActionGradient}
              >
                <Text style={styles.modalActionText}>Post</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Enhanced Type Selection */}
          <View style={styles.typeSelection}>
            <TouchableOpacity
              style={[styles.typeButton, postType === 'lost' && styles.selectedTypeButton]}
              onPress={() => {
                setPostType('lost');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={postType === 'lost' ? ['#FF6B6B', '#FF8E8E'] : ['white', 'white']}
                style={styles.typeButtonGradient}
              >
                <Icon 
                  name="alert-circle" 
                  size={20} 
                  color={postType === 'lost' ? 'white' : '#FF6B6B'} 
                />
                <Text style={[styles.typeButtonText, postType === 'lost' && styles.selectedTypeButtonText]}>
                  Lost Item
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, postType === 'found' && styles.selectedTypeButton]}
              onPress={() => {
                setPostType('found');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={postType === 'found' ? ['#38B000', '#4ED42F'] : ['white', 'white']}
                style={styles.typeButtonGradient}
              >
                <Icon 
                  name="checkmark-circle" 
                  size={20} 
                  color={postType === 'found' ? 'white' : '#38B000'} 
                />
                <Text style={[styles.typeButtonText, postType === 'found' && styles.selectedTypeButtonText]}>
                  Found Item
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Image Upload */}
          <TouchableOpacity style={styles.imageUpload} onPress={handleImagePicker}>
            {postImage ? (
              <Image source={{ uri: postImage }} style={styles.uploadedImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="camera-outline" size={32} color="#8E8E93" />
                <Text style={styles.imageUploadText}>Add Photo (Optional)</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Item Details</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder={`${postType === 'lost' ? 'Lost' : 'Found'} black wallet near cafeteria`}
                value={postTitle}
                onChangeText={setPostTitle}
                maxLength={50}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe the item in detail..."
                value={postDescription}
                onChangeText={setPostDescription}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            <View style={styles.pickerRow}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryChip,
                        postCategory === category && styles.selectedCategoryChip
                      ]}
                      onPress={() => setPostCategory(category)}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        postCategory === category && styles.selectedCategoryChipText
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.pickerRow}>
              <View style={[styles.inputContainer, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Location *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {locations.map((location) => (
                    <TouchableOpacity
                      key={location}
                      style={[
                        styles.categoryChip,
                        postLocation === location && styles.selectedCategoryChip
                      ]}
                      onPress={() => setPostLocation(location)}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        postLocation === location && styles.selectedCategoryChipText
                      ]}>
                        {location}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Date {postType === 'lost' ? 'Lost' : 'Found'} *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., June 15, 2025"
                value={postDate}
                onChangeText={setPostDate}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Contact Information *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="WhatsApp number or email"
                value={postContact}
                onChangeText={setPostContact}
              />
            </View>

            {postType === 'found' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Verification Question</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., What color is the wallet? What's written on the ID?"
                  value={postSecretPhrase}
                  onChangeText={setPostSecretPhrase}
                />
                <Text style={styles.helperText}>
                  Add a question only the real owner would know the answer to
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderClaimModal = () => (
    <Modal
      visible={showClaimModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => {
            setShowClaimModal(false);
            setSelectedItem(null);
          }}>
            <Icon name="close" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {selectedItem?.type === 'lost' ? 'Found This Item?' : 'Claim Item'}
          </Text>
          <TouchableOpacity onPress={handleClaimItem} disabled={claiming}>
            {claiming ? (
              <ActivityIndicator size="small" color="#4E54C8" />
            ) : (
              <Text style={styles.postButton}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {selectedItem && (
            <>
              <View style={styles.itemPreview}>
                {selectedItem.imageUrl && (
                  <Image source={{ uri: selectedItem.imageUrl }} style={styles.previewImage} />
                )}
                <Text style={styles.previewTitle}>{selectedItem.title}</Text>
                <Text style={styles.previewDescription}>{selectedItem.description}</Text>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Your Information</Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Your Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your full name"
                    value={claimerName}
                    onChangeText={setClaimerName}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Contact Information *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="WhatsApp number or email"
                    value={claimerContact}
                    onChangeText={setClaimerContact}
                  />
                </View>

                {selectedItem.secretPhrase && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Verification *</Text>
                    <Text style={styles.verificationQuestion}>{selectedItem.secretPhrase}</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Your answer..."
                      value={verificationAnswer}
                      onChangeText={setVerificationAnswer}
                    />
                  </View>
                )}

                {!selectedItem.secretPhrase && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>
                      {selectedItem.type === 'lost' ? 'Describe where you found it *' : 'Prove this is yours *'}
                    </Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      placeholder={
                        selectedItem.type === 'lost' 
                          ? "Describe where and when you found this item..."
                          : "Describe the item in detail to prove ownership..."
                      }
                      value={verificationAnswer}
                      onChangeText={setVerificationAnswer}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // Header with back button and My Posts toggle
  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
      <View style={styles.headerLeft}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lost & Found</Text>
      </View>
      
      <View style={styles.headerRight}>
        <TouchableOpacity 
          style={[styles.myPostsButton, showMyPosts && styles.activeMyPostsButton]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            LayoutAnimation.configureNext(springConfig);
            setShowMyPosts(!showMyPosts);
            
            // Filter my posts
            if (!showMyPosts) {
              const myItems = items.filter(item => item.createdBy === 'current_user'); // Replace with appropriate user ID
              setFilteredItems(myItems);
            } else {
              // Reset to original filtering
              setFilteredItems(items);
            }
          }}
        >
          <Icon 
            name={showMyPosts ? "user-check" : "user"} 
            size={20} 
            color={showMyPosts ? COLORS.white : COLORS.primary} 
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#F8F9FA', '#E5E5EA']}
          style={styles.loadingGradient}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: scrollY.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            }}
          >
            <LinearGradient
              colors={['#4E54C8', '#8B5CF6']}
              style={styles.loadingIcon}
            >
              <Icon name="search" size={32} color="white" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.loadingText}>Loading Lost & Found items...</Text>
          <Text style={styles.loadingSubtext}>Finding your items across campus</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Custom Header with Back Button and My Posts toggle */}
      <Header 
        navigation={navigation} 
        showMyPosts={showMyPosts} 
        setShowMyPosts={setShowMyPosts} 
      />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color={COLORS.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search lost or found items..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSearchQuery('');
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Feather name="x" size={20} color={COLORS.text.secondary} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Main Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={['#4E54C8', '#8B5CF6']}
            style={styles.loadingGradient}
          >
            <ActivityIndicator size="large" color="white" />
          </LinearGradient>
        </View>
      ) : (
        <>
          <FlatList
            data={filteredItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.contentContainer}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Icon name="search-outline" size={80} color="#C7C7CC" />
                <Text style={styles.emptyText}>
                  {showMyPosts
                    ? "Nothing here to display"
                    : "No items found"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {showMyPosts
                    ? "Items you post will appear here"
                    : "Try adjusting your filters or search terms"}
                </Text>
              </View>
            )}
          />
          
          {/* Floating Action Button (Post) */}
          <TouchableOpacity
            style={styles.floatingButton}
            activeOpacity={0.9}
            onPress={() => {
              animatePostButton();
              setShowPostModal(true);
            }}
          >
            <Animated.View 
              style={{ 
                transform: [{ scale: postButtonScale }]
              }}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.secondary]}
                style={styles.floatingButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Feather name="plus" size={24} color="white" />
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </>
      )}
      
      {/* Modals */}
      {renderPostModal()}
      {renderClaimModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Main container
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 4,
  },
  
  // Header styles
  headerContainer: {
    backgroundColor: COLORS.white,
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    letterSpacing: 0.3,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  myPostsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  myPostsButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  activeMyPostsButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  myPostsText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.primary,
    marginLeft: 4,
  },
  myPostsTextActive: {
    color: COLORS.white,
  },
  
  // Search bar styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: COLORS.text.primary,
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 8,
  },
  
  // Filter bar
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    zIndex: 5,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  filterButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.blue.light,
  },
  filterText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginRight: 4,
  },
  filterTextActive: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  
  // Filter expanded section
  filtersExpanded: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.blue.light,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  filterChipTextActive: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  
  // Content container for FlatList
  contentContainer: {
    padding: 16,
    paddingBottom: 100, // Extra padding for FAB
  },
  
  // Item card styles
  itemCard: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.lost.light,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    padding: 0,
  },
  itemTouchable: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  itemCardGradient: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 0,
    minHeight: 120,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blue.light,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginBottom: 8,
  },
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 18,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    borderRadius: 18,
  },
  itemContent: {
    padding: 20,
    paddingTop: 8,
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 15,
    color: COLORS.text.secondary,
    opacity: 1,
    marginBottom: 14,
    fontWeight: 'bold',
  },
  itemDetails: {
    marginTop: 10,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 15,
    color: COLORS.text.primary,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    alignSelf: 'flex-start',
    marginTop: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  messageButtonText: {
    color: COLORS.text.inverse,
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    paddingBottom: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingIcon: {
    width: 40,
    height: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.text.secondary,
    opacity: 0.7,
    textAlign: 'center',
  },
  
  // Floating action button
  floatingButton: {
    position: 'absolute',
    right: 32,
    bottom: 32,
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingButtonGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalActionButton: {
    padding: 0,
    borderRadius: 20,
    overflow: 'hidden',
    marginLeft: 8,
    width: 100,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modalActionText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text.inverse,
    letterSpacing: 0.2,
  },
  modalActionGradient: {
    width: 100,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
  
  // Form styles
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textInput: {
    fontSize: 16,
    color: COLORS.text.primary,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeSelection: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  typeButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectedTypeButton: {
    // Additional styling for selected state
  },
  typeButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  selectedTypeButtonText: {
    color: COLORS.white,
  },
  imageUpload: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.border.light,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.border.medium,
    borderStyle: 'dashed',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imageUploadText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.text.light,
  },
  pickerRow: {
    marginBottom: 16,
  },
  categoryScroll: {
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    borderRadius: 20,
    marginRight: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  selectedCategoryChip: {
    backgroundColor: COLORS.blue.light,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  selectedCategoryChipText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  formButton: {
    marginTop: 16,
    marginBottom: 32,
  },
  postButton: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  
  // Claim modal styles
  itemPreview: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  previewDescription: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 16,
  },
  claimForm: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
  },
  claimTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  verificationSection: {
    backgroundColor: COLORS.blue.light,
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  verificationQuestion: {
    fontSize: 16,
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    padding: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

// Icon component
const Icon = ({ name, size, color, style }: { name: string; size: number; color: string; style?: any }) => {
  // Determine which icon set to use based on name
  if (name.includes('-outline') || name === 'add' || name === 'add-circle-outline' || name === 'checkmark-circle' || name === 'camera-outline') {
    return <Ionicons name={name as any} size={size} color={color} style={style} />;
  }
  
  // Default to Feather icons
  return <Feather name={name as any} size={size} color={color} style={style} />;
};

// Additional styles
const additionalStyles = StyleSheet.create({
  categoryScroll: {
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    borderRadius: 20,
    marginRight: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  selectedCategoryChip: {
    backgroundColor: COLORS.blue.light,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  selectedCategoryChipText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  itemPreview: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  previewDescription: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 16,
  },
  verificationSection: {
    backgroundColor: COLORS.blue.light,
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  verificationQuestion: {
    fontSize: 16,
    color: COLORS.text.primary,
    marginBottom: 12,
  },
});

export default LostAndFound;
