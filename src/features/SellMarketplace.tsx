import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { db, collection, addDoc, serverTimestamp, storage, storageRef, uploadBytes, getDownloadURL, auth } from '../services/firebase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/router';
import { getDoc, doc } from 'firebase/firestore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// TypeScript interfaces
interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface PickupLocation {
  id: string;
  name: string;
  icon: string;
}

interface ContactMode {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

interface ProductListing {
  title: string;
  description: string;
  price: number;
  isNegotiable: boolean;
  category: string;
  condition: 'Brand New' | 'Used - Like New' | 'Good Condition' | 'Fair';
  photos: string[];
  pickupLocation: string;
  contactModes: ContactMode[];
  timestamp: number;
  sellerId: string;
  sellerName: string;
  status: 'active' | 'sold' | 'inactive';
  // Optional contact fields - only included if user enables them
  whatsappNumber?: string;
  phoneNumber?: string;
}

const SellMarketplace: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const windowWidth = Dimensions.get('window').width;
  
  // Form state
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [isNegotiable, setIsNegotiable] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<'Brand New' | 'Used - Like New' | 'Good Condition' | 'Fair'>('Good Condition');
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedPickupLocation, setSelectedPickupLocation] = useState<string>('');
  const [contactModes, setContactModes] = useState<ContactMode[]>([
    { id: 'inapp', name: 'In-app chat', icon: 'chatbubbles', enabled: true },
    { id: 'whatsapp', name: 'WhatsApp', icon: 'logo-whatsapp', enabled: false },
    { id: 'phone', name: 'Phone call', icon: 'call', enabled: false },
  ]);
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  
  // UI state
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Categories with beautiful colors
  const categories: Category[] = [
    { id: 'electronics', name: 'Electronics', icon: 'phone-portrait', color: '#4E54C8' },
    { id: 'books', name: 'Books', icon: 'book', color: '#F3722C' },
    { id: 'furniture', name: 'Furniture', icon: 'bed', color: '#F8961E' },
    { id: 'clothing', name: 'Clothing', icon: 'shirt', color: '#F9844A' },
    { id: 'vehicles', name: 'Vehicles', icon: 'bicycle', color: '#90323D' },
    { id: 'bags', name: 'Bags/Accessories', icon: 'bag', color: '#277DA1' },
    { id: 'hostel', name: 'Hostel Items', icon: 'home', color: '#43AA8B' },
    { id: 'others', name: 'Others', icon: 'ellipsis-horizontal', color: '#577590' },
  ];

  // Pickup locations
  const pickupLocations: PickupLocation[] = [
    { id: 'hostel-a', name: 'Hostel Block A', icon: 'business' },
    { id: 'hostel-b', name: 'Hostel Block B', icon: 'business' },
    { id: 'hostel-c', name: 'Hostel Block C', icon: 'business' },
    { id: 'cafeteria', name: 'Main Cafeteria', icon: 'restaurant' },
    { id: 'library', name: 'Central Library', icon: 'library' },
    { id: 'main-gate', name: 'Main Gate', icon: 'location' },
    { id: 'admin-block', name: 'Admin Block', icon: 'business' },
    { id: 'sports-complex', name: 'Sports Complex', icon: 'fitness' },
  ];

  // Request permissions on component mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to upload photos!');
        }
      }
    })();
  }, []);

  // Handle image selection
  const handleImagePicker = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limit reached', 'You can upload maximum 5 photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  // Remove photo
  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
  };

  // Toggle contact mode
  const toggleContactMode = (id: string) => {
    setContactModes(contactModes.map(mode => 
      mode.id === id ? { ...mode, enabled: !mode.enabled } : mode
    ));
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Missing Information', 'Please enter a title for your item');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Missing Information', 'Please add a description');
      return false;
    }
    if (!price.trim() || isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return false;
    }
    if (!selectedCategory) {
      Alert.alert('Missing Information', 'Please select a category');
      return false;
    }
    if (photos.length === 0) {
      Alert.alert('Missing Information', 'Please add at least one photo');
      return false;
    }
    
    // Check if WhatsApp is enabled but no number provided
    if (contactModes.find(m => m.id === 'whatsapp')?.enabled && !whatsappNumber.trim()) {
      Alert.alert('Missing Information', 'Please enter your WhatsApp number');
      return false;
    }
    
    // Check if phone is enabled but no number provided
    if (contactModes.find(m => m.id === 'phone')?.enabled && !phoneNumber.trim()) {
      Alert.alert('Missing Information', 'Please enter your phone number');
      return false;
    }

    return true;
  };

  // Publish listing to Firebase
  const handlePublish = async () => {
    if (!validateForm()) return;

    setIsPublishing(true);
    try {
      // 1. Upload images to Firebase Storage and get download URLs
      const downloadURLs: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const uri = photos[i];
        const response = await fetch(uri);
        const blob = await response.blob();
        // Use timestamp and index for unique path
        const imagePath = `product_images/${Date.now()}_${i}.jpg`;
        const imageRef = storageRef(storage, imagePath);
        await uploadBytes(imageRef, blob);
        const url = await getDownloadURL(imageRef);
        downloadURLs.push(url);
      }

      // Get current user info for sellerId and sellerName
      const currentUser = auth.currentUser;
      let sellerId = '';
      let sellerName = '';
      if (currentUser) {
        sellerId = currentUser.uid;
        // Fetch user profile for name
        const userDoc = await getDoc(doc(db, 'users', sellerId));
        if (userDoc.exists()) {
          sellerName = userDoc.data().name || '';
        } else {
          sellerName = currentUser.displayName || '';
        }
      }

      // Build listing data object, only including contact numbers if they exist
      const listingData: any = {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        isNegotiable,
        category: selectedCategory,
        condition: selectedCondition,
        images: downloadURLs, // use download URLs from Firebase Storage
        location: selectedPickupLocation,
        timestamp: serverTimestamp(),
        sellerId,
        seller: sellerName,
        status: 'active',
      };

      // Only add contact numbers if they are enabled and have values
      const whatsappEnabled = contactModes.find(m => m.id === 'whatsapp')?.enabled;
      const phoneEnabled = contactModes.find(m => m.id === 'phone')?.enabled;
      if (whatsappEnabled && whatsappNumber.trim()) {
        listingData.whatsappNumber = whatsappNumber.trim();
      }
      if (phoneEnabled && phoneNumber.trim()) {
        listingData.phoneNumber = phoneNumber.trim();
      }

      // Add to Firestore collection
      const productsCollection = collection(db, 'products');
      await addDoc(productsCollection, listingData);

      Alert.alert(
        'Success!', 
        'Your item has been listed successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('Error publishing listing:', error);
      Alert.alert('Error', 'Failed to publish your listing. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Get selected category
  const getSelectedCategory = () => {
    return categories.find(cat => cat.id === selectedCategory);
  };

  // Get selected pickup location
  const getSelectedPickupLocation = () => {
    return pickupLocations.find(loc => loc.id === selectedPickupLocation);
  };

  // Render category modal
  const renderCategoryModal = () => (
    <Modal
      visible={showCategoryModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowCategoryModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={categories}
            numColumns={2}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.categoryModalItem, { backgroundColor: item.color + '15' }]}
                onPress={() => {
                  setSelectedCategory(item.id);
                  setShowCategoryModal(false);
                }}
              >
                <Ionicons name={item.icon as any} size={32} color={item.color} />
                <Text style={[styles.categoryModalText, { color: item.color }]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  // Render location modal
  const renderLocationModal = () => (
    <Modal
      visible={showLocationModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowLocationModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Pickup Location</Text>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={pickupLocations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.locationModalItem}
                onPress={() => {
                  setSelectedPickupLocation(item.id);
                  setShowLocationModal(false);
                }}
              >
                <Ionicons name={item.icon as any} size={24} color="#4E54C8" />
                <Text style={styles.locationModalText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sell Item</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={['rgba(78, 84, 200, 0.1)', 'rgba(143, 148, 251, 0.05)']}
          style={styles.heroSection}
        >
          <Text style={styles.heroTitle}>List Your Item</Text>
          <Text style={styles.heroSubtitle}>
            Share details about your item to find the perfect buyer in your campus community
          </Text>
        </LinearGradient>

        {/* Form Sections */}
        
        {/* 1. Category Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 Category</Text>
          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => setShowCategoryModal(true)}
          >
            {selectedCategory ? (
              <View style={styles.categoryContent}>
                <Ionicons 
                  name={getSelectedCategory()?.icon as any} 
                  size={24} 
                  color={getSelectedCategory()?.color} 
                />
                <Text style={styles.categoryText}>{getSelectedCategory()?.name}</Text>
              </View>
            ) : (
              <Text style={styles.placeholderText}>Select a category</Text>
            )}
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* 1.5. Condition Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ Item Condition</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['Brand New', 'Used - Like New', 'Good Condition', 'Fair'] as const).map((condition) => (
              <TouchableOpacity
                key={condition}
                style={[
                  styles.conditionButton,
                  selectedCondition === condition && styles.selectedConditionButton
                ]}
                onPress={() => setSelectedCondition(condition)}
              >
                <Text style={[
                  styles.conditionText,
                  selectedCondition === condition && styles.selectedConditionText
                ]}>
                  {condition}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 2. Item Title */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Item Title</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter a clear title (e.g., Dell Monitor 24 inch)"
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
          <Text style={styles.charCount}>{title.length}/60</Text>
        </View>

        {/* 3. Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Description</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Describe your item's condition, usage duration, any defects, original price, and why you're selling..."
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* 4. Price */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Price</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="0"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
          </View>
          <TouchableOpacity
            style={styles.negotiableToggle}
            onPress={() => setIsNegotiable(!isNegotiable)}
          >
            <Ionicons 
              name={isNegotiable ? "checkbox" : "square-outline"} 
              size={20} 
              color={isNegotiable ? "#4E54C8" : "#666"} 
            />
            <Text style={styles.negotiableText}>Price is negotiable</Text>
          </TouchableOpacity>
        </View>

        {/* 5. Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📷 Photos (Min 1, Max 5)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photosContainer}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image source={{ uri: photo }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 5 && (
                <TouchableOpacity style={styles.addPhotoButton} onPress={handleImagePicker}>
                  <Ionicons name="camera" size={32} color="#4E54C8" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>

        {/* 6. Pickup Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Pickup Location (Optional)</Text>
          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => setShowLocationModal(true)}
          >
            {selectedPickupLocation ? (
              <View style={styles.categoryContent}>
                <Ionicons 
                  name={getSelectedPickupLocation()?.icon as any} 
                  size={24} 
                  color="#4E54C8" 
                />
                <Text style={styles.categoryText}>{getSelectedPickupLocation()?.name}</Text>
              </View>
            ) : (
              <Text style={styles.placeholderText}>Select pickup location</Text>
            )}
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* 7. Contact Modes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📞 Preferred Contact Mode</Text>
          {contactModes.map((mode) => (
            <View key={mode.id} style={styles.contactModeItem}>
              <TouchableOpacity
                style={styles.contactModeToggle}
                onPress={() => toggleContactMode(mode.id)}
              >
                <Ionicons 
                  name={mode.enabled ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={mode.enabled ? "#4E54C8" : "#666"} 
                />
                <Ionicons name={mode.icon as any} size={20} color="#4E54C8" style={styles.contactIcon} />
                <Text style={styles.contactModeText}>{mode.name}</Text>
              </TouchableOpacity>
              
              {/* Show input fields for WhatsApp and Phone when enabled */}
              {mode.id === 'whatsapp' && mode.enabled && (
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter WhatsApp number"
                  value={whatsappNumber}
                  onChangeText={setWhatsappNumber}
                  keyboardType="phone-pad"
                />
              )}
              {mode.id === 'phone' && mode.enabled && (
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              )}
            </View>
          ))}
        </View>

        {/* Publish Button */}
        <TouchableOpacity
          style={[styles.publishButton, isPublishing && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={isPublishing}
        >
          {isPublishing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.publishButtonText}>Publish Product</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Extra spacing at bottom */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      {renderCategoryModal()}
      {renderLocationModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroSection: {
    padding: 20,
    margin: 16,
    borderRadius: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingVertical: 16,
  },
  negotiableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  negotiableText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  photosContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  photoItem: {
    position: 'relative',
    marginRight: 12,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4E54C8',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 84, 200, 0.05)',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#4E54C8',
    fontWeight: '600',
    marginTop: 4,
  },
  contactModeItem: {
    marginBottom: 12,
  },
  contactModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  contactModeText: {
    fontSize: 16,
    color: '#333',
  },
  phoneInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    color: '#333',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E54C8',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  publishButtonDisabled: {
    backgroundColor: '#999',
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  categoryModalItem: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    margin: 8,
    borderRadius: 12,
    minHeight: 100,
    justifyContent: 'center',
  },
  categoryModalText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  locationModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locationModalText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  conditionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
  },
  selectedConditionButton: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  conditionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectedConditionText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default SellMarketplace;