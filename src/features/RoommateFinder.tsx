import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Linking,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { db as firestore, auth, db } from '../services/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  query,
  orderBy,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

// TypeScript interfaces
interface RoommateListing {
  id: string;
  userId: string;
  name?: string;
  alias?: string;
  type: 'Individual' | 'Broker'; // Made required to ensure proper filtering
  lookingFor: string; // e.g., "Female roommate", "Any gender", "1-2 people"
  description?: string;
  location: string;
  area: string; // nearby landmark
  accommodationType: 'PG' | 'Flat' | 'Hostel' | 'Apartment';
  rentPerMonth: number;
  availabilityDate: string;
  furnished: 'Furnished' | 'Unfurnished' | 'Semi-Furnished';
  contact: {
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
  details: {
    address: string;
    roomType: string; // 1BHK, 2BHK, Single Room, Shared Room
    deposit: number;
    utilities: string;
    photos: string[];
    amenities: string[];
  };
  preferences: {
    gender: 'Male' | 'Female' | 'Any';
    habits: string[];
    cleanliness: string;
  };
  userProfile?: {
    department?: string;
    year?: string;
    bio?: string;
    gender?: string;
  };
  verified: boolean;
  status: 'active' | 'closed';
  createdAt: any;
  distanceFromCollege?: string;
}

interface FilterOptions {
  gender: 'All' | 'Male' | 'Female';
  maxRent: number;
  sharingType: 'All' | '1BHK' | '2BHK' | 'Single Room' | 'Shared Room';
  landmark: 'All' | 'MIT' | 'TC' | 'End Point' | 'Other';
  furnished: 'All' | 'Furnished' | 'Unfurnished' | 'Semi-Furnished';
  distance: 'All' | '0-1km' | '1-3km' | '3-5km' | '5km+';
}

const RoommateFinder: React.FC = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'listings' | 'saved' | 'mypost'>('listings');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  const [listingType, setListingType] = useState<'roommate' | 'broker'>('roommate');
  const [listings, setListings] = useState<RoommateListing[]>([]);
  const [filteredListings, setFilteredListings] = useState<RoommateListing[]>([]);
  const [savedListings, setSavedListings] = useState<string[]>([]);
  const [messagedListings, setMessagedListings] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showPostForm, setShowPostForm] = useState<boolean>(false);
  const [selectedListing, setSelectedListing] = useState<RoommateListing | null>(null);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);
  const [hasUserPosted, setHasUserPosted] = useState<boolean>(false);

  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({
    gender: 'All',
    maxRent: 20000,
    sharingType: 'All',
    landmark: 'All',
    furnished: 'All',
    distance: 'All',
  });

  // Form state for posting a new listing
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    lookingFor: '',
    location: '',
    area: '',
    accommodationType: 'PG' as const,
    rentPerMonth: '',
    availabilityDate: '',
    furnished: 'Furnished' as const,
    type: 'Individual' as 'Individual' | 'Broker',
    description: '',
    maxBudget: '',
    contact: {
      phone: '',
      whatsapp: '',
      email: '',
    },
    details: {
      address: '',
      roomType: '',
      deposit: '',
      utilities: '',
      amenities: [] as string[],
      photos: [] as string[],
    },
    preferences: {
      gender: 'Any' as const,
      habits: [] as string[],
      cleanliness: '',
    },
    userProfile: {
      department: '',
      year: '',
      bio: '',
      gender: '',
    },
  });

  // Load listings from Firestore
  useEffect(() => {
    const listingsRef = collection(firestore, 'roommate_listings');
    const q = query(listingsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const listingsData: RoommateListing[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Ensure backward compatibility - default to 'Individual' if type is missing
          if (!data.type) {
            data.type = 'Individual';
          }
          listingsData.push({ id: doc.id, ...data } as RoommateListing);
        });
        setListings(listingsData);
        setFilteredListings(listingsData);
        setLoading(false);
      },
      (error) => {
        console.error('Firestore error:', error);
        Alert.alert('Error', 'Failed to load listings. Please check your connection.');
        setLoading(false);
      }
    );

    // Load saved and contacted listings from local storage or Firestore
    loadUserData();

    return () => unsubscribe();
    // Firebase Console Action: Create 'roommate_listings' collection in Firestore
  }, []);

  // Apply filters and search
  useEffect(() => {
    let filtered = listings;

    // Filter by listing type (roommate vs broker)
    if (listingType === 'roommate') {
      filtered = filtered.filter(listing => listing.type === 'Individual');
    } else if (listingType === 'broker') {
      filtered = filtered.filter(listing => listing.type === 'Broker');
    }

    // Debug logging
    console.log(`Filtering for ${listingType}: Found ${filtered.length} listings out of ${listings.length} total`);
    console.log('Sample filtered listings:', filtered.slice(0, 3).map(l => ({ id: l.id, type: l.type, alias: l.alias })));

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(listing =>
        listing.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.lookingFor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (listing.name && listing.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (listing.alias && listing.alias.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply filters
    if (filters.gender !== 'All') {
      filtered = filtered.filter(listing => listing.preferences.gender === filters.gender || listing.preferences.gender === 'Any');
    }

    if (filters.maxRent < 20000) {
      filtered = filtered.filter(listing => listing.rentPerMonth <= filters.maxRent);
    }

    if (filters.sharingType !== 'All') {
      filtered = filtered.filter(listing => listing.details.roomType === filters.sharingType);
    }

    if (filters.landmark !== 'All') {
      filtered = filtered.filter(listing => listing.area.toLowerCase().includes(filters.landmark.toLowerCase()));
    }

    if (filters.furnished !== 'All') {
      filtered = filtered.filter(listing => listing.furnished === filters.furnished);
    }

    setFilteredListings(filtered);
  }, [listings, searchQuery, filters, listingType]);

  const loadUserData = async () => {
    // In a real app, load from AsyncStorage or user's Firestore document
    // For now, using empty arrays
    setSavedListings([]);
    setMessagedListings([]);
    
    // Check if user has posted listings before
    try {
      // Check if user is logged in
      if (!auth.currentUser) {
        console.log('User not logged in');
        setHasUserPosted(false);
        return;
      }
      
      const listingsRef = collection(firestore, 'roommate_listings');
      const currentUserId = auth.currentUser.uid;
      const q = query(listingsRef, where('userId', '==', currentUserId));
      const querySnapshot = await getDocs(q);
      
      setHasUserPosted(!querySnapshot.empty);
    } catch (error) {
      console.error('Error checking user posts:', error);
      // Default to false if there's an error
      setHasUserPosted(false);
    }
  };

  const handleSaveListing = (listingId: string) => {
    if (savedListings.includes(listingId)) {
      setSavedListings(prev => prev.filter(id => id !== listingId));
    } else {
      setSavedListings(prev => [...prev, listingId]);
    }
    // In a real app, save to AsyncStorage or Firestore
  };

  const handleMessageListing = async (listing: RoommateListing) => {
    // Get current user info
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to message about this listing.');
      return;
    }
    const currentUserId = currentUser.uid;
    const currentUserName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    const currentUserProfileImage = currentUser.photoURL;

    // Poster info
    const posterId = listing.userId;
    const posterName = listing.name || listing.alias || 'User';
    // If user is trying to message themselves
    if (posterId === currentUserId) {
      Alert.alert('Info', 'You cannot message your own listing.');
      return;
    }

    // Generate a unique chatId (sorted to avoid duplicates)
    const chatId = [listing.id, currentUserId, posterId].sort().join('_');
    const chatRef = doc(db, 'roommate_chats', chatId);
    const chatDoc = await (await import('firebase/firestore')).getDoc(chatRef);
    if (!chatDoc.exists()) {
      // Create chat document if it doesn't exist
      await (await import('firebase/firestore')).setDoc(chatRef, {
        listingId: listing.id,
        userAId: currentUserId,
        userAName: currentUserName,
        userAProfileImage: currentUserProfileImage,
        userBId: posterId,
        userBName: posterName,
        userBProfileImage: null, // No profileImage in userProfile
        createdAt: Date.now(),
      });
    }
    // Prepare user objects for chat screen
    const userA = { id: currentUserId, name: currentUserName, profileImage: currentUserProfileImage };
    const userB = { id: posterId, name: posterName, profileImage: null };
    // @ts-ignore
    navigation.navigate('RoommateChat', {
      chatId,
      listing,
      posterId,
      currentUserId,
    });
  };

  const handlePostListing = async () => {
    // Validate required fields
    if (!formData.lookingFor?.trim() || 
        !formData.location?.trim() || 
        !formData.rentPerMonth?.trim() || 
        !formData.description?.trim()) {
      Alert.alert('Error', 'Please fill in all required fields marked with *');
      return;
    }

    // Validate that rent is a valid number
    const rent = parseFloat(formData.rentPerMonth);
    if (isNaN(rent) || rent <= 0) {
      Alert.alert('Error', 'Please enter a valid rent amount');
      return;
    }

    // For brokers, phone number is required
    if (formData.type === 'Broker') {
      if (!formData.contact.phone || !formData.contact.phone.trim()) {
        Alert.alert('Error', 'Phone number is required for broker listings');
        return;
      }
    }

    // Contact information validation
    const hasValidPhone = formData.contact.phone && formData.contact.phone.trim();
    const hasValidWhatsapp = formData.contact.whatsapp && formData.contact.whatsapp.trim();
    const hasValidEmail = formData.contact.email && formData.contact.email.trim();

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Login Required', 'Please log in to post a listing.');
        return;
      }
      const listingsRef = collection(firestore, 'roommate_listings');
      
      // Clean contact data - only include non-empty, trimmed fields
      const cleanContact: { phone?: string; whatsapp?: string; email?: string } = {};
      if (hasValidPhone) {
        cleanContact.phone = formData.contact.phone.trim();
      }
      if (hasValidWhatsapp) {
        cleanContact.whatsapp = formData.contact.whatsapp.trim();
      }
      if (hasValidEmail) {
        cleanContact.email = formData.contact.email.trim();
      }

      // Clean user profile data - only include non-empty fields
      const cleanUserProfile: { department?: string; year?: string; bio?: string; gender?: string } = {};
      if (formData.userProfile.department && formData.userProfile.department.trim()) {
        cleanUserProfile.department = formData.userProfile.department.trim();
      }
      if (formData.userProfile.year && formData.userProfile.year.trim()) {
        cleanUserProfile.year = formData.userProfile.year.trim();
      }
      if (formData.userProfile.bio && formData.userProfile.bio.trim()) {
        cleanUserProfile.bio = formData.userProfile.bio.trim();
      }
      if (formData.userProfile.gender && formData.userProfile.gender.trim()) {
        cleanUserProfile.gender = formData.userProfile.gender.trim();
      }

      // Ensure photos array doesn't contain any null/undefined values
      const cleanPhotos = (formData.details.photos || []).filter(photo => photo && typeof photo === 'string' && photo.trim());
      
      // Ensure amenities array doesn't contain any null/undefined values
      const cleanAmenities = (formData.details.amenities || []).filter(amenity => amenity && typeof amenity === 'string' && amenity.trim());
      
      // Ensure habits array doesn't contain any null/undefined values
      const cleanHabits = (formData.preferences.habits || []).filter(habit => habit && typeof habit === 'string' && habit.trim());
      
      const newListing: Omit<RoommateListing, 'id'> = {
        userId: user.uid, // Use actual user ID
        type: formData.type, // Always include the type field
        lookingFor: formData.lookingFor.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        area: formData.area?.trim() || '',
        accommodationType: formData.accommodationType,
        rentPerMonth: parseFloat(formData.rentPerMonth),
        availabilityDate: formData.availabilityDate?.trim() || 'Flexible',
        furnished: formData.furnished,
        contact: cleanContact,
        details: {
          address: formData.details.address?.trim() || '',
          roomType: formData.details.roomType?.trim() || '',
          deposit: parseFloat(formData.details.deposit) || 0,
          utilities: formData.details.utilities?.trim() || '',
          photos: cleanPhotos,
          amenities: cleanAmenities,
        },
        preferences: {
          gender: formData.preferences.gender,
          habits: cleanHabits,
          cleanliness: formData.preferences.cleanliness?.trim() || '',
        },
        verified: false,
        status: 'active',
        createdAt: serverTimestamp(),
      };

      // Only add optional fields if they have values
      if (formData.name?.trim()) {
        newListing.name = formData.name.trim();
      }
      if (formData.alias?.trim()) {
        newListing.alias = formData.alias.trim();
      } else {
        newListing.alias = 'Anonymous User';
      }
      if (formData.area?.trim()) {
        newListing.area = formData.area.trim();
        newListing.distanceFromCollege = formData.area.trim();
      }
      if (Object.keys(cleanUserProfile).length > 0) {
        newListing.userProfile = cleanUserProfile;
      }

      console.log('Submitting listing:', JSON.stringify(newListing, null, 2));
      await addDoc(listingsRef, newListing);
      
      // Set the user has posted flag to true
      setHasUserPosted(true);
      Alert.alert('Success', 'Your roommate listing has been posted successfully!');
      resetForm();
      setShowPostForm(false);
    } catch (error) {
      console.error('Error posting listing:', error);
      
      // More specific error handling
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        if (error.message.includes('invalid data') || error.message.includes('Unsupported field value')) {
          Alert.alert('Error', 'Invalid data detected. Please check all fields and try again.');
        } else if (error.message.includes('permission')) {
          Alert.alert('Error', 'Permission denied. Please check your account permissions.');
        } else {
          Alert.alert('Error', `Failed to post listing: ${error.message}`);
        }
      } else {
        Alert.alert('Error', 'Failed to post your listing. Please check your internet connection and try again.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      alias: '',
      lookingFor: '',
      location: '',
      area: '',
      accommodationType: 'PG',
      rentPerMonth: '',
      availabilityDate: '',
      furnished: 'Furnished',
      type: 'Individual',
      description: '',
      maxBudget: '',
      contact: { phone: '', whatsapp: '', email: '' },
      details: {
        address: '',
        roomType: '',
        deposit: '',
        utilities: '',
        amenities: [],
        photos: [],
      },
      preferences: {
        gender: 'Any',
        habits: [],
        cleanliness: '',
      },
      userProfile: {
        department: '',
        year: '',
        bio: '',
        gender: '',
      },
    });
    setShowPostForm(false);
  };

  // Image picker functions
  const pickImages = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload photos.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        aspect: [4, 3],
        allowsEditing: false,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImages(true);
        
        try {
          const newPhotos = result.assets.map(asset => asset.uri).filter(uri => uri);
          
          if (newPhotos.length > 0) {
            // Add to existing photos
            setFormData(prev => ({
              ...prev,
              details: {
                ...prev.details,
                photos: [...prev.details.photos, ...newPhotos]
              }
            }));
            
            Alert.alert('Success', `${newPhotos.length} photo(s) added successfully!`);
          } else {
            Alert.alert('Error', 'No valid photos were selected.');
          }
        } catch (processError) {
          console.error('Error processing selected images:', processError);
          Alert.alert('Error', 'Failed to process selected images. Please try again.');
        } finally {
          setUploadingImages(false);
        }
      } else {
        console.log('Image selection was canceled or no assets returned');
      }
    } catch (error) {
      setUploadingImages(false);
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take photos.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        aspect: [4, 3],
        allowsEditing: true,
      });

      console.log('Camera result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].uri) {
        setUploadingImages(true);
        
        try {
          const newPhoto = result.assets[0].uri;
          
          // Add to existing photos
          setFormData(prev => ({
            ...prev,
            details: {
              ...prev.details,
              photos: [...prev.details.photos, newPhoto]
            }
          }));
          
          Alert.alert('Success', 'Photo added successfully!');
        } catch (processError) {
          console.error('Error processing photo:', processError);
          Alert.alert('Error', 'Failed to process photo. Please try again.');
        } finally {
          setUploadingImages(false);
        }
      } else {
        console.log('Camera capture was canceled or no photo taken');
      }
    } catch (error) {
      setUploadingImages(false);
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      details: {
        ...prev.details,
        photos: prev.details.photos.filter((_, i) => i !== index)
      }
    }));
  };

  const showImagePickerOptions = () => {
    console.log('Showing image picker options');
    Alert.alert(
      'Add Photos',
      'Choose how you want to add photos',
      [
        { text: 'Camera', onPress: () => {
          console.log('Camera option selected');
          takePhoto();
        }},
        { text: 'Photo Library', onPress: () => {
          console.log('Photo library option selected');
          pickImages();
        }},
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Render listing card
  const renderListingCard = ({ item: listing }: { item: RoommateListing }) => {
    // Modern color themes based on listing type that match app's design
    const gradientColors = listing.type === 'Broker' 
      ? ['#F8F9FF', '#F0F2FF'] as const // Light blue/purple for brokers
      : ['#F1F5FF', '#F8F9FF'] as const; // Subtle blue for individuals
      
    const accentColor = listing.type === 'Broker' ? '#FF9500' : '#4E54C8';
    
    return (
    <TouchableOpacity
      style={[styles.listingCard, { borderColor: accentColor + '20' }]}
      onPress={() => {
        setSelectedListing(listing);
        setShowDetailModal(true);
      }}
    >
      <LinearGradient
        colors={gradientColors}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header with save button */}
        <View style={styles.cardHeader}>
          <View style={styles.statusContainer}>
            {listing.verified && (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(62, 207, 142, 0.15)' }]}>
                <Ionicons name="checkmark-circle" size={12} color="#38B000" style={{marginRight: 4}} />
                <Text style={[styles.statusText, {color: '#38B000'}]}>Verified</Text>
              </View>
            )}
            <Text style={styles.postedTime}>2 days ago</Text>
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => handleSaveListing(listing.id)}
          >
            <Ionicons
              name={savedListings.includes(listing.id) ? "heart" : "heart-outline"}
              size={24}
              color={savedListings.includes(listing.id) ? "#FF6B6B" : "#999"}
            />
          </TouchableOpacity>
        </View>

        {/* Main info */}
        <View style={styles.cardBody}>
          <Text style={styles.listingTitle}>
            {listing.name || listing.alias || 'Anonymous User'}
          </Text>
          <Text style={styles.lookingFor}>{listing.lookingFor}</Text>
          
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.locationText}>{listing.location}</Text>
            {listing.area && (
              <Text style={styles.areaText}>• Near {listing.area}</Text>
            )}
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="home-outline" size={16} color="#4E54C8" />
              <Text style={styles.detailText}>{listing.accommodationType}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="bed-outline" size={16} color="#4E54C8" />
              <Text style={styles.detailText}>{listing.details.roomType || 'Room'}</Text>
            </View>
            <View style={styles.detailItem}>
              <MaterialIcons name="chair" size={16} color="#4E54C8" />
              <Text style={styles.detailText}>{listing.furnished}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.rentPrice}>₹{listing.rentPerMonth.toLocaleString()}/month</Text>
            <Text style={styles.availabilityDate}>Available: {listing.availabilityDate}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => {
              setSelectedListing(listing);
              setShowDetailModal(true);
            }}
          >
            <Text style={styles.viewDetailsText}>View Details</Text>
            <Ionicons name="arrow-forward" size={16} color="#4E54C8" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => handleMessageListing(listing)}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
            <Text style={styles.contactButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
  };

  // Render listing in list view
  const renderListingList = ({ item: listing }: { item: RoommateListing }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => {
        setSelectedListing(listing);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.listItemLeft}>
        <Text style={styles.listItemTitle}>
          {listing.name || listing.alias || 'Anonymous'}
        </Text>
        <Text style={styles.listItemSubtitle}>{listing.lookingFor}</Text>
        <Text style={styles.listItemLocation}>📍 {listing.location}</Text>
      </View>
      
      <View style={styles.listItemRight}>
        <Text style={styles.listItemPrice}>₹{listing.rentPerMonth.toLocaleString()}</Text>
        <Text style={styles.listItemType}>{listing.accommodationType}</Text>
        <TouchableOpacity
          style={styles.listContactButton}
          onPress={() => handleMessageListing(listing)}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Render filter modal
  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilters(false)}
    >
      <SafeAreaView style={styles.filterModal}>
        <View style={styles.filterHeader}>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={styles.filterCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.filterTitle}>Filters</Text>
          <TouchableOpacity onPress={() => {
            setFilters({
              gender: 'All',
              maxRent: 20000,
              sharingType: 'All',
              landmark: 'All',
              furnished: 'All',
              distance: 'All',
            });
          }}>
            <Text style={styles.filterReset}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.filterContent}>
          {/* Gender Preference */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Gender Preference</Text>
            <View style={styles.filterOptions}>
              {['All', 'Male', 'Female'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterOption,
                    filters.gender === option && styles.filterOptionActive
                  ]}
                  onPress={() => setFilters({ ...filters, gender: option as any })}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.gender === option && styles.filterOptionTextActive
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Max Rent */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>
              Max Rent: ₹{filters.maxRent.toLocaleString()}/month
            </Text>
            <View style={styles.rentSliderContainer}>
              <Text style={styles.rentSliderLabel}>₹5,000</Text>
              <View style={styles.rentSlider}>
                {/* In a real app, use a proper slider component */}
                <TouchableOpacity
                  style={styles.rentSliderThumb}
                  onPress={() => {
                    // Handle slider interaction
                  }}
                />
              </View>
              <Text style={styles.rentSliderLabel}>₹20,000</Text>
            </View>
          </View>

          {/* Sharing Type */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Room Type</Text>
            <View style={styles.filterOptions}>
              {['All', '1BHK', '2BHK', 'Single Room', 'Shared Room'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterOption,
                    filters.sharingType === option && styles.filterOptionActive
                  ]}
                  onPress={() => setFilters({ ...filters, sharingType: option as any })}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.sharingType === option && styles.filterOptionTextActive
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Landmarks */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Near Landmark</Text>
            <View style={styles.filterOptions}>
              {['All', 'MIT', 'TC', 'End Point', 'Other'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterOption,
                    filters.landmark === option && styles.filterOptionActive
                  ]}
                  onPress={() => setFilters({ ...filters, landmark: option as any })}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.landmark === option && styles.filterOptionTextActive
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Furnished */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Furnishing</Text>
            <View style={styles.filterOptions}>
              {['All', 'Furnished', 'Semi-Furnished', 'Unfurnished'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterOption,
                    filters.furnished === option && styles.filterOptionActive
                  ]}
                  onPress={() => setFilters({ ...filters, furnished: option as any })}
                >
                  <Text style={[
                    styles.filterOptionText,
                    filters.furnished === option && styles.filterOptionTextActive
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.filterFooter}>
          <TouchableOpacity
            style={styles.applyFiltersButton}
            onPress={() => setShowFilters(false)}
          >
            <Text style={styles.applyFiltersText}>
              Apply Filters ({filteredListings.length} results)
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Render detailed listing modal
  const renderDetailModal = () => (
    <Modal
      visible={showDetailModal}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setShowDetailModal(false)}
    >
      <SafeAreaView style={styles.detailModal}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity
            style={styles.detailBackButton}
            onPress={() => setShowDetailModal(false)}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>Listing Details</Text>
          <TouchableOpacity
            style={styles.detailSaveButton}
            onPress={() => selectedListing && handleSaveListing(selectedListing.id)}
          >
            <Ionicons
              name={selectedListing && savedListings.includes(selectedListing.id) ? "heart" : "heart-outline"}
              size={24}
              color={selectedListing && savedListings.includes(selectedListing.id) ? "#FF6B6B" : "#999"}
            />
          </TouchableOpacity>
        </View>

        {selectedListing && (
          <ScrollView style={styles.detailContent}>
            {/* User Profile Section */}
            <View style={styles.detailSection}>
              <View style={styles.profileSection}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {(selectedListing.name || selectedListing.alias || 'A').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileDetails}>
                  <Text style={styles.profileName}>
                    {selectedListing.name || selectedListing.alias || 'Anonymous User'}
                  </Text>
                  {selectedListing.userProfile?.department && (
                    <Text style={styles.profileInfo}>
                      {selectedListing.userProfile.department} • {selectedListing.userProfile.year}
                    </Text>
                  )}
                  <View style={styles.verificationBadge}>
                    <Ionicons
                      name={selectedListing.verified ? "checkmark-circle" : "alert-circle"}
                      size={16}
                      color={selectedListing.verified ? "#38B000" : "#FF6B35"}
                    />
                    <Text style={[
                      styles.verificationText,
                      { color: selectedListing.verified ? "#38B000" : "#FF6B35" }
                    ]}>
                      {selectedListing.verified ? 'Verified' : 'Unverified'}
                    </Text>
                  </View>
                </View>
              </View>
              
              {selectedListing.userProfile?.bio && (
                <Text style={styles.bioText}>{selectedListing.userProfile.bio}</Text>
              )}
            </View>

            {/* Looking For Section */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Looking For</Text>
              <Text style={styles.sectionContent}>{selectedListing.lookingFor}</Text>
            </View>

            {/* Accommodation Details */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Accommodation Details</Text>
              
              <View style={styles.detailGrid}>
                <View style={styles.detailGridItem}>
                  <Ionicons name="home" size={20} color="#4E54C8" />
                  <Text style={styles.detailGridLabel}>Type</Text>
                  <Text style={styles.detailGridValue}>{selectedListing.accommodationType}</Text>
                </View>
                
                <View style={styles.detailGridItem}>
                  <Ionicons name="bed" size={20} color="#4E54C8" />
                  <Text style={styles.detailGridLabel}>Room</Text>
                  <Text style={styles.detailGridValue}>{selectedListing.details.roomType || 'N/A'}</Text>
                </View>
                
                <View style={styles.detailGridItem}>
                  <MaterialIcons name="chair" size={20} color="#4E54C8" />
                  <Text style={styles.detailGridLabel}>Furnished</Text>
                  <Text style={styles.detailGridValue}>{selectedListing.furnished}</Text>
                </View>
                
                <View style={styles.detailGridItem}>
                  <Ionicons name="calendar" size={20} color="#4E54C8" />
                  <Text style={styles.detailGridLabel}>Available</Text>
                  <Text style={styles.detailGridValue}>{selectedListing.availabilityDate}</Text>
                </View>
              </View>

              <View style={styles.addressSection}>
                <Text style={styles.addressTitle}>Address</Text>
                <Text style={styles.addressText}>
                  {selectedListing.details.address || selectedListing.location}
                </Text>
                {selectedListing.area && (
                  <Text style={styles.nearbyText}>Near {selectedListing.area}</Text>
                )}
              </View>
            </View>

            {/* Pricing */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Pricing</Text>
              <View style={styles.pricingGrid}>
                <View style={styles.pricingItem}>
                  <Text style={styles.pricingLabel}>Monthly Rent</Text>
                  <Text style={styles.pricingValue}>₹{selectedListing.rentPerMonth.toLocaleString()}</Text>
                </View>
                {selectedListing.details.deposit > 0 && (
                  <View style={styles.pricingItem}>
                    <Text style={styles.pricingLabel}>Security Deposit</Text>
                    <Text style={styles.pricingValue}>₹{selectedListing.details.deposit.toLocaleString()}</Text>
                  </View>
                )}
              </View>
              
              {selectedListing.details.utilities && (
                <View style={styles.utilitiesSection}>
                  <Text style={styles.utilitiesTitle}>Utilities Info</Text>
                  <Text style={styles.utilitiesText}>{selectedListing.details.utilities}</Text>
                </View>
              )}
            </View>

            {/* Preferences */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Roommate Preferences</Text>
              <View style={styles.preferencesGrid}>
                <View style={styles.preferenceItem}>
                  <Text style={styles.preferenceLabel}>Gender</Text>
                  <Text style={styles.preferenceValue}>{selectedListing.preferences.gender}</Text>
                </View>
                {selectedListing.preferences.cleanliness && (
                  <View style={styles.preferenceItem}>
                    <Text style={styles.preferenceLabel}>Cleanliness</Text>
                    <Text style={styles.preferenceValue}>{selectedListing.preferences.cleanliness}</Text>
                  </View>
                )}
              </View>
              
              {selectedListing.preferences.habits.length > 0 && (
                <View style={styles.habitsSection}>
                  <Text style={styles.habitsTitle}>Habits & Lifestyle</Text>
                  <View style={styles.habitsContainer}>
                    {selectedListing.preferences.habits.map((habit, index) => (
                      <View key={index} style={styles.habitTag}>
                        <Text style={styles.habitTagText}>{habit}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Amenities */}
            {selectedListing.details.amenities.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Amenities</Text>
                <View style={styles.amenitiesContainer}>
                  {selectedListing.details.amenities.map((amenity, index) => (
                    <View key={index} style={styles.amenityItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#38B000" />
                      <Text style={styles.amenityText}>{amenity}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Contact Actions */}
            <View style={styles.messageSection}>
              <TouchableOpacity
                style={styles.primaryMessageButton}
                onPress={() => handleMessageListing(selectedListing)}
              >
                <Ionicons name="chatbubble-ellipses" size={22} color="#FFFFFF" />
                <Text style={styles.primaryContactText}>Message Now</Text>
              </TouchableOpacity>
              
              <View style={styles.secondaryMessageButtons}>
                {selectedListing.contact.whatsapp && (
                  <TouchableOpacity
                    style={styles.secondaryMessageButton}
                    onPress={() => Linking.openURL(`whatsapp://send?phone=${selectedListing.contact.whatsapp}&text=Hi, I'm interested in your roommate listing.`)}
                  >
                    <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                    <Text style={styles.secondaryContactText}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
                
                {selectedListing.contact.email && (
                  <TouchableOpacity
                    style={styles.secondaryMessageButton}
                    onPress={() => Linking.openURL(`mailto:${selectedListing.contact.email}?subject=Roommate Inquiry`)}
                  >
                    <Ionicons name="mail" size={22} color="#4E54C8" />
                    <Text style={styles.secondaryContactText}>Email</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );

  const renderPostFormModal = () => (
    <Modal
      visible={showPostForm}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setShowPostForm(false)}
    >
      <SafeAreaView style={styles.detailModal}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity
            style={styles.detailBackButton}
            onPress={() => setShowPostForm(false)}
          >
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>
            {formData.type === 'Individual' ? 'Post Roommate Listing' : 'Post Property Listing'}
          </Text>
          <TouchableOpacity
            style={styles.postSubmitButton}
            onPress={() => {
              handlePostListing();
              setShowPostForm(false);
            }}
          >
            <Text style={styles.postSubmitButtonText}>Post</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.formContainer}>
          {/* Personal/Business Information */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>
              {formData.type === 'Individual' ? 'Personal Information' : 'Business Information'}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {formData.type === 'Individual' ? 'Name (Optional)' : 'Contact Person Name'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                placeholder={formData.type === 'Individual' ? "Your full name" : "Agent/Manager name"}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {formData.type === 'Individual' ? 'Alias (Display Name)' : 'Agency/Business Name'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={formData.alias}
                onChangeText={(text) => setFormData({...formData, alias: text})}
                placeholder={formData.type === 'Individual' 
                  ? "How others will see you (e.g., John D., Anonymous)"
                  : "Name of your agency or business"
                }
                placeholderTextColor="#999"
              />
            </View>
            
            {formData.type === 'Broker' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Experience/Credentials</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.userProfile.bio}
                  onChangeText={(text) => setFormData({
                    ...formData, 
                    userProfile: {...formData.userProfile, bio: text}
                  })}
                  placeholder="Years of experience, specialty areas, credentials"
                  placeholderTextColor="#999"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Type *</Text>
              <View style={styles.radioGroup}>
                {['Individual', 'Broker'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.radioOption,
                      formData.type === type && styles.radioOptionActive
                    ]}
                    onPress={() => {
                      // Reset contact information when switching user type
                      const updatedContact = {...formData.contact};
                      if (type === 'Individual') {
                        // For individual, we might want to clear the phone
                        updatedContact.phone = '';
                      }
                      setFormData({
                        ...formData, 
                        type: type as any, 
                        contact: updatedContact
                      });
                    }}
                  >
                    <View style={[
                      styles.radioCircle,
                      formData.type === type && styles.radioCircleActive
                    ]}>
                      {formData.type === type && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioLabel}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* What You're Looking For/Property Details */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>
              {formData.type === 'Individual' ? 'What You\'re Looking For' : 'Property Details'}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {formData.type === 'Individual' ? 'Looking For *' : 'Property Type *'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={formData.lookingFor}
                onChangeText={(text) => setFormData({...formData, lookingFor: text})}
                placeholder={formData.type === 'Individual' 
                  ? "e.g., Female roommate, 1-2 people, Any gender"
                  : "e.g., 1BHK, 2BHK, Single Room, PG for girls/boys"
                }
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {formData.type === 'Individual' ? 'Description *' : 'Property Description *'}
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({...formData, description: text})}
                placeholder={formData.type === 'Individual'
                  ? "Describe what you're looking for in detail..."
                  : "Describe the property, facilities, restrictions, etc."
                }
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </View>

            {formData.type === 'Broker' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Available Units/Vacancies *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.details.roomType}
                  onChangeText={(text) => setFormData({
                    ...formData, 
                    details: {...formData.details, roomType: text}
                  })}
                  placeholder="e.g., 5 rooms available, 2 units left"
                  placeholderTextColor="#999"
                />
              </View>
            )}
          </View>

          {/* Location Details */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Location Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Area/Locality *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.location}
                onChangeText={(text) => setFormData({...formData, location: text})}
                placeholder={formData.type === 'Individual' 
                  ? "e.g., Near MIT, End Point, TC" 
                  : "Main area of the property"
                }
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {formData.type === 'Individual' 
                  ? "Exact Location/Address (Optional)" 
                  : "Property Address"
                }
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.details.address}
                onChangeText={(text) => setFormData({
                  ...formData, 
                  details: {...formData.details, address: text}
                })}
                placeholder={formData.type === 'Individual'
                  ? "Full address with nearby landmarks (if you want to share)"
                  : "Full address of the property with landmarks"
                }
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Distance from College</Text>
              <TextInput
                style={styles.textInput}
                value={formData.area}
                onChangeText={(text) => setFormData({...formData, area: text})}
                placeholder="e.g., 5 mins walk, 2km, Walking distance"
                placeholderTextColor="#999"
              />
            </View>
            
            {formData.type === 'Broker' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Surrounding Amenities</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.userProfile.department}
                  onChangeText={(text) => setFormData({
                    ...formData, 
                    userProfile: {...formData.userProfile, department: text}
                  })}
                  placeholder="Nearby shops, hospitals, transport facilities, etc."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
          </View>

          {/* Accommodation Details */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Accommodation Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Accommodation Type *</Text>
              <View style={styles.optionsGrid}>
                {['PG', 'Flat', 'Hostel', 'Apartment'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionChip,
                      formData.accommodationType === type && styles.optionChipActive
                    ]}
                    onPress={() => setFormData({...formData, accommodationType: type as any})}
                  >
                    <Text style={[
                      styles.optionChipText,
                      formData.accommodationType === type && styles.optionChipTextActive
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Room Type</Text>
              <View style={styles.optionsGrid}>
                {['1BHK', '2BHK', '3BHK', 'Single Room', 'Shared Room'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionChip,
                      formData.details.roomType === type && styles.optionChipActive
                    ]}
                    onPress={() => setFormData({
                      ...formData, 
                      details: {...formData.details, roomType: type}
                    })}
                  >
                    <Text style={[
                      styles.optionChipText,
                      formData.details.roomType === type && styles.optionChipTextActive
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Furnishing *</Text>
              <View style={styles.optionsGrid}>
                {['Furnished', 'Semi-Furnished', 'Unfurnished'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionChip,
                      formData.furnished === type && styles.optionChipActive
                    ]}
                    onPress={() => setFormData({...formData, furnished: type as any})}
                  >
                    <Text style={[
                      styles.optionChipText,
                      formData.furnished === type && styles.optionChipTextActive
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Pricing */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Pricing</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {formData.type === 'Individual' ? 'Rent per Month *' : 'Rent Range *'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={formData.rentPerMonth}
                onChangeText={(text) => setFormData({...formData, rentPerMonth: text})}
                placeholder={formData.type === 'Individual' ? "₹15000" : "₹15000-25000 (for different room types)"}
                placeholderTextColor="#999"
                keyboardType={formData.type === 'Individual' ? "numeric" : "default"}
              />
            </View>

            {formData.type === 'Individual' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Budget (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.maxBudget}
                  onChangeText={(text) => setFormData({...formData, maxBudget: text})}
                  placeholder="₹20000"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {formData.type === 'Individual' ? 'Security Deposit' : 'Security Deposit/Advance'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={formData.details.deposit}
                onChangeText={(text) => setFormData({
                  ...formData, 
                  details: {...formData.details, deposit: text}
                })}
                placeholder={formData.type === 'Individual' ? "₹5000" : "₹15000 (1 month advance)"}
                placeholderTextColor="#999"
                keyboardType={formData.type === 'Individual' ? "numeric" : "default"}
              />
            </View>
            
            {formData.type === 'Broker' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Maintenance & Additional Charges</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.details.utilities}
                  onChangeText={(text) => setFormData({
                    ...formData, 
                    details: {...formData.details, utilities: text}
                  })}
                  placeholder="Maintenance costs, electricity, water, broker fee, etc."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}


          </View>

          {/* Availability */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Availability</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {formData.type === 'Individual' ? 'Move-in Date (Optional)' : 'Available From'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={formData.availabilityDate}
                onChangeText={(text) => setFormData({...formData, availabilityDate: text})}
                placeholder={formData.type === 'Individual' 
                  ? "Immediate / 15 July 2025" 
                  : "Immediate / Multiple units available from different dates"
                }
                placeholderTextColor="#999"
              />
            </View>

            {formData.type === 'Broker' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Minimum Stay Period</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.preferences.cleanliness}
                  onChangeText={(text) => setFormData({
                    ...formData, 
                    preferences: {...formData.preferences, cleanliness: text}
                  })}
                  placeholder="e.g., 11 months, 6 months minimum"
                  placeholderTextColor="#999"
                />
              </View>
            )}
          </View>

          {/* Roommate/Tenant Preferences */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>
              {formData.type === 'Individual' ? 'Roommate Preferences' : 'Tenant Requirements'}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gender Preference *</Text>
              <View style={styles.optionsGrid}>
                {['Male', 'Female', 'Any'].map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.optionChip,
                      formData.preferences.gender === gender && styles.optionChipActive
                    ]}
                    onPress={() => setFormData({
                      ...formData, 
                      preferences: {...formData.preferences, gender: gender as any}
                    })}
                  >
                    <Text style={[
                      styles.optionChipText,
                      formData.preferences.gender === gender && styles.optionChipTextActive
                    ]}>
                      {gender}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {formData.type === 'Broker' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Occupancy Rules</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.userProfile.year}
                  onChangeText={(text) => setFormData({
                    ...formData, 
                    userProfile: {...formData.userProfile, year: text}
                  })}
                  placeholder="Max occupants, student/working professional, family restrictions"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Habits & Lifestyle</Text>
              <View style={styles.optionsGrid}>
                {['Non-Smoker', 'Smoker', 'Early Riser', 'Night Owl', 'Vegetarian', 'Non-Vegetarian', 'Pets OK', 'No Pets'].map((habit) => (
                  <TouchableOpacity
                    key={habit}
                    style={[
                      styles.optionChip,
                      formData.preferences.habits.includes(habit) && styles.optionChipActive
                    ]}
                    onPress={() => {
                      const habits = formData.preferences.habits.includes(habit)
                        ? formData.preferences.habits.filter(h => h !== habit)
                        : [...formData.preferences.habits, habit];
                      setFormData({
                        ...formData, 
                        preferences: {...formData.preferences, habits}
                      });
                    }}
                  >
                    <Text style={[
                      styles.optionChipText,
                      formData.preferences.habits.includes(habit) && styles.optionChipTextActive
                    ]}>
                      {habit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cleanliness Level</Text>
              <View style={styles.optionsGrid}>
                {['Very Clean', 'Moderately Clean', 'Relaxed about Cleanliness'].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.optionChip,
                      formData.preferences.cleanliness === level && styles.optionChipActive
                    ]}
                    onPress={() => setFormData({
                      ...formData, 
                      preferences: {...formData.preferences, cleanliness: level}
                    })}
                  >
                    <Text style={[
                      styles.optionChipText,
                      formData.preferences.cleanliness === level && styles.optionChipTextActive
                    ]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Amenities */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Amenities</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Available Amenities</Text>
              <View style={styles.optionsGrid}>
                {['WiFi', 'AC', 'Washing Machine', 'Fridge', 'Parking', 'Gym', 'Swimming Pool', 'Security', 'Power Backup', 'Water Supply', 'Kitchen', 'Balcony'].map((amenity) => (
                  <TouchableOpacity
                    key={amenity}
                    style={[
                      styles.optionChip,
                      formData.details.amenities.includes(amenity) && styles.optionChipActive
                    ]}
                    onPress={() => {
                      const amenities = formData.details.amenities.includes(amenity)
                        ? formData.details.amenities.filter(a => a !== amenity)
                        : [...formData.details.amenities, amenity];
                      setFormData({
                        ...formData, 
                        details: {...formData.details, amenities}
                      });
                    }}
                  >
                    <Text style={[
                      styles.optionChipText,
                      formData.details.amenities.includes(amenity) && styles.optionChipTextActive
                    ]}>
                      {amenity}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Contact Information</Text>
            
            {formData.type === 'Broker' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.contact.phone}
                  onChangeText={(text) => setFormData({
                    ...formData, 
                    contact: {...formData.contact, phone: text}
                  })}
                  placeholder="Enter your business phone number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{formData.type === 'Individual' ? 'Email' : 'Email (Optional)'}</Text>
              <TextInput
                style={styles.textInput}
                value={formData.contact.email}
                onChangeText={(text) => setFormData({
                  ...formData, 
                  contact: {...formData.contact, email: text}
                })}
                placeholder="your.email@example.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Photos Upload Placeholder */}
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Photos</Text>
            <TouchableOpacity 
              style={styles.photoUploadButton} 
              onPress={showImagePickerOptions}
              disabled={uploadingImages}
            >
              {uploadingImages ? (
                <ActivityIndicator size="small" color="#4E54C8" />
              ) : (
                <Ionicons name="camera-outline" size={24} color="#4E54C8" />
              )}
              <Text style={styles.photoUploadText}>
                {uploadingImages ? 'Uploading...' : 'Add Photos (Optional)'}
              </Text>
              <Text style={styles.photoUploadSubtext}>Upload room/property photos</Text>
            </TouchableOpacity>

            {/* Display selected photos */}
            {formData.details.photos.length > 0 && (
              <View style={styles.photoPreviewContainer}>
                <Text style={styles.photoPreviewTitle}>
                  Selected Photos ({formData.details.photos.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {formData.details.photos.map((photo, index) => (
                    <View key={index} style={styles.photoPreviewItem}>
                      <Image source={{ uri: photo }} style={styles.photoPreview} />
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <Ionicons name="close-circle" size={20} color="#FF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.formFooter}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handlePostListing}
            >
              <Text style={styles.submitButtonText}>Post My Listing</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4E54C8" />
          <Text style={styles.loadingText}>Loading listings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F8FAFF', '#FFFFFF', '#F0F8FF']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header with gradient background */}
        <LinearGradient
          colors={['#4E54C8', '#8F94FB']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Roommate Finder</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setViewMode(viewMode === 'card' ? 'list' : 'card')}
            >
              <Ionicons 
                name={viewMode === 'card' ? 'list' : 'grid'} 
                size={24} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.postButton}
              onPress={() => setShowPostForm(true)}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.postButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Roommate/Broker Toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggleWrapper}>
            <TouchableOpacity
              style={[
                styles.toggleOption,
                listingType === 'roommate' && styles.toggleOptionActive
              ]}
              onPress={() => setListingType('roommate')}
            >
              <Text style={[
                styles.toggleText,
                listingType === 'roommate' && styles.toggleTextActive
              ]}>
                🧑‍🤝‍🧑 Roommate ({listings.filter(l => l.type === 'Individual').length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.toggleOption,
                listingType === 'broker' && styles.toggleOptionActive
              ]}
              onPress={() => setListingType('broker')}
            >
              <Text style={[
                styles.toggleText,
                listingType === 'broker' && styles.toggleTextActive
              ]}>
                🏢 Brokers ({listings.filter(l => l.type === 'Broker').length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search and Filter Bar */}
        <View style={styles.searchFilterContainer}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by location, area, or type..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={20} color="#4E54C8" />
          </TouchableOpacity>
        </View>

        {/* Results count */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'listings' && styles.activeTab]}
            onPress={() => setActiveTab('listings')}
          >
            <Ionicons 
              name="home-outline" 
              size={16} 
              color={activeTab === 'listings' ? '#FFFFFF' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'listings' && styles.activeTabText]}>
              Listings
            </Text>
          </TouchableOpacity>

          {/* My Post Tab - only shown if user has posted before */}
          {hasUserPosted && (
            <TouchableOpacity
              style={[styles.tab, activeTab === 'mypost' && styles.activeTab]}
              onPress={() => setActiveTab('mypost')}
            >
              <Ionicons 
                name="person-outline" 
                size={16} 
                color={activeTab === 'mypost' ? '#FFFFFF' : '#666'} 
              />
              <Text style={[styles.tabText, activeTab === 'mypost' && styles.activeTabText]}>
                My Post
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
            onPress={() => setActiveTab('saved')}
          >
            <Ionicons 
              name="heart-outline" 
              size={16} 
              color={activeTab === 'saved' ? '#FFFFFF' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>
              Saved ({savedListings.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'listings' && (
            <FlatList
              data={filteredListings}
              renderItem={viewMode === 'card' ? renderListingCard : renderListingList}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="home-outline" size={64} color="#DDD" />
                  <Text style={styles.emptyStateTitle}>No listings found</Text>
                  <Text style={styles.emptyStateText}>
                    Try adjusting your search or filters
                  </Text>
                </View>
              }
            />
          )}

          {activeTab === 'saved' && (
            <FlatList
              data={filteredListings.filter(listing => savedListings.includes(listing.id))}
              renderItem={viewMode === 'card' ? renderListingCard : renderListingList}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="heart-outline" size={64} color="#DDD" />
                  <Text style={styles.emptyStateTitle}>No saved listings</Text>
                  <Text style={styles.emptyStateText}>
                    Save listings by tapping the heart icon
                  </Text>
                </View>
              }
            />
          )}

          {activeTab === 'mypost' && (
            <FlatList
              data={filteredListings.filter(listing => listing.userId === 'current_user_id')}
              renderItem={viewMode === 'card' ? renderListingCard : renderListingList}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="person-outline" size={64} color="#DDD" />
                  <Text style={styles.emptyStateTitle}>Your posts will appear here</Text>
                  <Text style={styles.emptyStateText}>
                    Post a new listing by tapping the + button
                  </Text>
                </View>
              }
            />
          )}
        </View>

        {/* Modals */}
        {renderFilterModal()}
        {renderDetailModal()}
        {renderPostFormModal()}
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    overflow: 'hidden',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    padding: 5,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4E54C8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Toggle styles
  toggleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F8FAFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E4FF',
  },
  toggleWrapper: {
    flexDirection: 'row',
    backgroundColor: '#EAEDFF',
    borderRadius: 25,
    padding: 4,
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#4E54C8',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  toggleTextActive: {
    color: '#4E54C8',
    fontWeight: '600',
  },
  
  // Search and filter styles
  searchFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E0E4FF',
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  filterButton: {
    backgroundColor: '#EEF1FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E4FF',
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  // Results header
  resultsHeader: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  
  // Tab navigation
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F2FF',
    margin: 15,
    borderRadius: 20,
    padding: 5,
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0E4FF',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#4E54C8',
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  
  // Content area
  content: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  
  // Listing card styles
  listingCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F2FF',
  },
  cardGradient: {
    padding: 20,
    borderRadius: 20, // Ensure gradient respects the card's border radius
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4E54C8', // Default color, overridden when needed
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  postedTime: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  saveButton: {
    padding: 4,
  },
  
  cardBody: {
    marginBottom: 16,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  lookingFor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  areaText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 4,
  },
  
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4E54C8',
  },
  availabilityDate: {
    fontSize: 12,
    color: '#666',
  },
  
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF1FF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E4FF',
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4E54C8',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4E54C8',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // List view styles
  listItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  listItemLeft: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  listItemLocation: {
    fontSize: 12,
    color: '#999',
  },
  listItemRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minWidth: 80,
  },
  listItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4E54C8',
  },
  listItemType: {
    fontSize: 12,
    color: '#666',
  },
  listContactButton: {
    backgroundColor: '#4E54C8',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Form styles
  formContainer: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupHalf: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  
  // Picker styles
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  pickerOptionActive: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  pickerOptionTextActive: {
    color: '#FFFFFF',
  },
  
  postFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E54C8',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  postFormButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  
  // Filter modal styles
  filterModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterCancel: {
    fontSize: 16,
    color: '#666',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  filterReset: {
    fontSize: 16,
    color: '#4E54C8',
    fontWeight: '600',
  },
  filterContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    marginVertical: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterOptionActive: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
  },
  
  // Rent slider (simplified for now)
  rentSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rentSliderLabel: {
    fontSize: 12,
    color: '#666',
  },
  rentSlider: {
    flex: 1,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    justifyContent: 'center',
  },
  rentSliderThumb: {
    width: 20,
    height: 20,
    backgroundColor: '#4E54C8',
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginLeft: '50%',
  },
  
  filterFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  applyFiltersButton: {
    backgroundColor: '#4E54C8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyFiltersText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  
  // Detail modal styles
  detailModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailBackButton: {
    padding: 5,
  },
  detailHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  detailSaveButton: {
    padding: 5,
  },
  detailContent: {
    flex: 1,
  },
  detailSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  
  // Profile section in detail
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4E54C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bioText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  
  // Detail sections
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  
  // Detail grid
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  detailGridItem: {
    width: (width - 72) / 2,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  detailGridLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontWeight: '500',
  },
  detailGridValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
    marginTop: 4,
  },
  
  // Address section
  addressSection: {
    marginTop: 16,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  nearbyText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  
  // Pricing section
  pricingGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  pricingItem: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  pricingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4E54C8',
  },
  
  utilitiesSection: {
    marginTop: 8,
  },
  utilitiesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  utilitiesText: {
    fontSize: 14,
    color: '#555',
  },
  
  // Preferences section
  preferencesGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  preferenceItem: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  preferenceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  preferenceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  
  habitsSection: {
    marginTop: 8,
  },
  habitsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  habitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  habitTag: {
    backgroundColor: '#E8F2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  habitTagText: {
    fontSize: 12,
    color: '#4E54C8',
    fontWeight: '500',
  },
  
  // Amenities section
  amenitiesContainer: {
    gap: 8,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amenityText: {
    fontSize: 14,
    color: '#333',
  },
  
  // Contact section
  messageSection: {
    padding: 20,
    backgroundColor: '#F0F2FF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 10,
  },
  primaryMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E54C8',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
    gap: 10,
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  primaryContactText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  secondaryMessageButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  secondaryMessageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#4E54C830',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  secondaryContactText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
  },

  // New form styles
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  radioOptionActive: {
    backgroundColor: '#EEF1FF',
    borderColor: '#4E54C8',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#4E54C8',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4E54C8',
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    marginBottom: 4,
  },
  optionChipActive: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  optionChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  optionChipTextActive: {
    color: '#FFFFFF',
  },
  photoUploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E1E5E9',
    borderStyle: 'dashed',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  photoUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
    marginTop: 8,
  },
  photoUploadSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  postSubmitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4E54C8',
    borderRadius: 8,
  },
  postSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  formFooter: {
    marginVertical: 20,
  },
  submitButton: {
    backgroundColor: '#4E54C8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoPreviewContainer: {
    marginTop: 16,
  },
  photoPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  photoPreviewItem: {
    marginRight: 12,
    position: 'relative',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default RoommateFinder;
