import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Animated,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { State, PanGestureHandler } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/router';
import { 
  db, 
  storage,
  collection, 
  getDocs, 
  query, 
  orderBy, 
  onSnapshot, 
  Timestamp, 
  addDoc, 
  doc, 
  setDoc, 
  limit,
  storageRef,
  getDownloadURL,
  auth,
  getDoc
} from '../services/firebase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// TypeScript interfaces
interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  seller: string;
  sellerRating: number;
  isSeen: boolean;
  originalPrice?: number;
  location: string;
  description: string;
  category: string;
  condition: string;
  timestamp: any; // Can be Firestore Timestamp or number
  tags: string[];
  sellerId?: string;
}

interface FilterOptions {
  category: string;
  priceRange: [number, number];
  condition: string[];
  location: string;
  sortBy: 'newest' | 'price-low' | 'price-high' | 'distance';
}

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

const BuyMarketplace: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGridView, setIsGridView] = useState(false);
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [seenProducts, setSeenProducts] = useState<Set<string>>(new Set());
  const [filteredCategory, setFilteredCategory] = useState<string | null>(null);
  const [showBookmarked, setShowBookmarked] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const imageTranslateX = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        console.log('BuyMarketplace: Initializing data...');
        
        // Check if Firebase is properly initialized
        if (!db) {
          console.error('Firebase db is not initialized!');
          Alert.alert('Firebase Error', 'Failed to initialize Firebase. Please restart the app.');
          setIsLoading(false);
          return;
        }
        
        console.log('Firebase db object status:', db ? 'Connected' : 'Not connected');
        console.log('Firebase storage object status:', storage ? 'Connected' : 'Not connected');
        
        // Test Firebase connection before proceeding
        const isConnected = await checkFirebaseConnection();
        
        if (!isConnected) {
          Alert.alert(
            'Connection Error',
            'Failed to connect to Firebase. Please check your internet connection and try again.'
          );
          setIsLoading(false);
          return;
        }
        
        await addSampleDataIfNeeded();
        await fetchProductsFromFirebase();
      } catch (error) {
        console.error('Fatal error during BuyMarketplace initialization:', error);
        Alert.alert(
          'Connection Error',
          'Failed to initialize the marketplace. Please check your internet connection and try again.'
        );
        setIsLoading(false);
      }
    };
    
    initializeData();
    
    // Set up a real-time listener for updates
    try {
      const productsCollection = collection(db, 'products');
      const q = query(productsCollection, orderBy('timestamp', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('Real-time update received from Firestore');
        if (!snapshot.empty) {
          // Only process updates if we're not currently loading
          if (!isLoading) {
            fetchProductsFromFirebase();
          }
        }
      }, (error) => {
        console.error('Error in Firestore real-time listener:', error);
      });
      
      // Cleanup function to unsubscribe when component unmounts
      return () => {
        console.log('Unsubscribing from Firestore listener');
        unsubscribe();
      };
    } catch (listenerError) {
      console.error('Failed to set up Firestore listener:', listenerError);
    }
  }, []);

  const fetchProductsFromFirebase = async () => {
    try {
      console.log('Starting to fetch products from Firestore...');
      
      // Verify db connection
      if (!db) {
        console.error('Firebase db object is undefined or null');
        Alert.alert('Connection Error', 'Failed to connect to Firebase database.');
        setIsLoading(false);
        return;
      }
      
      const productsCollection = collection(db, 'products');
      console.log('Fetching products collection...');
      
      const productsQuery = query(productsCollection, orderBy('timestamp', 'desc'));
      
      // Add more detailed error handling for Firestore query
      let snapshot;
      try {
        snapshot = await getDocs(productsQuery);
        console.log(`Fetched ${snapshot.docs.length} products from Firestore`);
      } catch (queryError) {
        console.error('Error querying Firestore:', queryError);
        Alert.alert(
          'Database Error', 
          'Failed to query the marketplace data. Please try again later.'
        );
        setIsLoading(false);
        return;
      }
      
      if (snapshot.empty) {
        console.warn('No products found in the collection');
        setProducts([]);
        setIsLoading(false);
        return;
      }
      
      const productsData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`Product ID: ${doc.id}, Title: ${data.title}`);
        return {
          id: doc.id,
          ...data,
        };
      });
  
      // Use the already imported storage instance
      console.log('Getting product images from Firebase Storage...');
      
      const productsWithImageUrls = await Promise.all(
        productsData.map(async (product: any) => {
          try {
            if (!product.images || !Array.isArray(product.images)) {
              console.warn(`Product ${product.id} has no images array`);
              product.images = ['product_images/sample.jpg'];
            }
            
            const images = await Promise.all(
              product.images.map(async (imagePath: string) => {
                try {
                  console.log(`Fetching image URL for path: ${imagePath}`);
                  return await getDownloadURL(storageRef(storage, imagePath));
                } catch (error) {
                  console.warn(`Image not found in Firebase Storage: ${imagePath}. Using placeholder.`);
                  return 'https://via.placeholder.com/400'; // Return a placeholder URL
                }
              })
            );
            return {
              ...product,
              images,
              sellerRating: generateRandomRating(),
              isSeen: seenProducts.has(product.id),
            };
          } catch (productError) {
            console.error(`Error processing product ${product.id}:`, productError);
            // Return product with placeholder image on error
            return {
              ...product,
              images: ['https://via.placeholder.com/400'],
              sellerRating: generateRandomRating(),
              isSeen: seenProducts.has(product.id),
            };
          }
        })
      );
  
      console.log('Successfully processed all products with images');
      setProducts(productsWithImageUrls);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert(
        'Error Loading Marketplace', 
        'There was a problem fetching marketplace items. Please check your connection and try again.'
      );
      setIsLoading(false);
    }
  };

  // Add some sample data to Firestore for testing (only if no data exists)
  const addSampleDataIfNeeded = async () => {
    try {
      console.log('Checking if sample data needs to be added...');
      
      if (!db) {
        console.error('Firebase db object is undefined or null');
        return;
      }
      
      const productsCollection = collection(db, 'products');
      const snapshot = await getDocs(productsCollection);

      if (snapshot.empty) {
        console.log('No products found. Adding sample data to Firestore...');
        // Firebase Console Action: Make sure you have uploaded sample images to 'product_images/sample.jpg' in Firebase Storage.
        const sampleProducts = [
          {
            title: 'Classic Study Lamp',
            price: 25,
            images: ['product_images/sample.jpg'], // Path in Firebase Storage
            seller: 'Campus Store',
            location: 'Library',
            description: 'A reliable and bright study lamp, perfect for late-night study sessions.',
            category: 'electronics',
            condition: 'Brand New',
            tags: ['New', 'Negotiable'],
            timestamp: Timestamp.now(),
          },
          {
            title: 'Computer Science Textbook',
            price: 50,
            images: ['product_images/sample.jpg'], // Using same placeholder image
            seller: 'John Doe',
            location: 'Engineering Block',
            description: 'Data Structures and Algorithms textbook, perfect condition.',
            category: 'books',
            condition: 'Used - Like New',
            tags: ['Negotiable'],
            timestamp: Timestamp.now(),
          },
          {
            title: 'Desk Chair',
            price: 35,
            images: ['product_images/sample.jpg'], // Using same placeholder image
            seller: 'Jane Smith',
            location: 'Hostel Block C',
            description: 'Ergonomic desk chair, very comfortable for long study sessions.',
            category: 'furniture',
            condition: 'Used - Good',
            tags: ['Pickup Only'],
            timestamp: Timestamp.now(),
          }
        ];

        console.log(`Adding ${sampleProducts.length} sample products to Firestore...`);
        
        for (const product of sampleProducts) {
          try {
            const docRef = await addDoc(productsCollection, product);
            console.log(`Added sample product with ID: ${docRef.id}`);
          } catch (addError) {
            console.error('Error adding individual sample product:', addError);
          }
        }
        console.log('Sample data added successfully.');
        
        // Verify data was added
        const verifySnapshot = await getDocs(productsCollection);
        console.log(`After adding samples, collection has ${verifySnapshot.docs.length} documents`);
      } else {
        console.log(`Products collection already has ${snapshot.docs.length} items, skipping sample data.`);
      }
    } catch (error) {
      console.error('Error in addSampleDataIfNeeded:', error);
      Alert.alert(
        'Setup Error', 
        'There was a problem setting up the marketplace data. Please restart the app.'
      );
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setIsLoading(true);
    
    // Check Firebase connection first
    const isConnected = await checkFirebaseConnection();
    
    if (isConnected) {
      // Fetch fresh data from Firebase
      await fetchProductsFromFirebase();
    } else {
      Alert.alert(
        'Connection Issue',
        'Could not connect to the marketplace. Please check your internet connection and try again.'
      );
    }
    
    setRefreshing(false);
    setIsLoading(false);
  };

  const toggleBookmark = (productId: string) => {
    const newBookmarks = new Set(bookmarkedItems);
    if (newBookmarks.has(productId)) {
      newBookmarks.delete(productId);
    } else {
      newBookmarks.add(productId);
    }
    setBookmarkedItems(newBookmarks);
  };

  const handleChatWithSeller = async (product: Product) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Not logged in', 'Please log in to chat with sellers.');
        return;
      }
      // Fetch current user profile
      const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!currentUserDoc.exists()) {
        Alert.alert('Profile Error', 'Your profile could not be found.');
        return;
      }
      const currentUserProfile = { id: currentUser.uid, name: (currentUserDoc.data() && currentUserDoc.data().name) || '', ...(currentUserDoc.data() || {}) };
      // Fetch seller profile
      let sellerProfile = null;
      if (product.sellerId) {
        const sellerDoc = await getDoc(doc(db, 'users', product.sellerId));
        if (sellerDoc.exists()) {
          sellerProfile = { id: product.sellerId, name: (sellerDoc.data() && sellerDoc.data().name) || '', ...(sellerDoc.data() || {}) };
        }
      }
      if (!sellerProfile) {
        // fallback: search by seller name
        const usersSnapshot = await getDocs(collection(db, 'users'));
        usersSnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.name === product.seller) {
            sellerProfile = { id: docSnap.id, name: data.name || '', ...data };
          }
        });
      }
      if (!sellerProfile) {
        Alert.alert('Seller Not Found', 'Could not find the seller profile.');
        return;
      }
      if (currentUserProfile.id === sellerProfile.id) {
        Alert.alert('Invalid Chat', 'You cannot chat with yourself.');
        return;
      }
      // Create or open product-specific chat
      const chatId = `${product.id}_${currentUserProfile.id}_${sellerProfile.id}`;
      const chatDocRef = doc(db, 'product_chats', chatId);
      const chatDoc = await getDoc(chatDocRef);
      if (!chatDoc.exists()) {
        await setDoc(chatDocRef, {
          productId: product.id,
          productTitle: product.title,
          productImage: product.images[0],
          buyerId: currentUserProfile.id,
          buyerName: currentUserProfile.name,
          sellerId: sellerProfile.id,
          sellerName: sellerProfile.name,
          createdAt: Date.now(),
        });
      }
      navigation.navigate('ProductChat', {
        chatId,
        product,
        buyer: currentUserProfile,
        seller: sellerProfile,
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  const getNextUnseenProductIndex = (isForward: boolean) => {
    const unseenIndices = products
      .map((p, i) => (seenProducts.has(p.id) ? -1 : i))
      .filter(i => i !== -1);

    if (unseenIndices.length > 0) {
      return unseenIndices[0];
    }
    // If all seen, cycle through all products
    if (isForward) {
        return (currentProductIndex + 1) % products.length;
    }
    return (currentProductIndex - 1 + products.length) % products.length;
  };

  const animateProductTransition = (direction: 'up' | 'down', onComplete: () => void) => {
    const outValue = direction === 'up' ? -windowHeight : windowHeight;
    const inValue = direction === 'up' ? windowHeight : -windowHeight;

    Animated.timing(slideAnim, {
      toValue: outValue,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onComplete();
      slideAnim.setValue(inValue);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const nextProduct = () => {
    animateProductTransition('up', () => {
      const nextIndex = getNextUnseenProductIndex(true);
      setCurrentProductIndex(nextIndex);
      const newSeen = new Set(seenProducts);
      newSeen.add(products[nextIndex].id);
      setSeenProducts(newSeen);
    });
  };

  const previousProduct = () => {
    animateProductTransition('down', () => {
      const prevIndex = getNextUnseenProductIndex(false);
      setCurrentProductIndex(prevIndex);
      const newSeen = new Set(seenProducts);
      newSeen.add(products[prevIndex].id);
      setSeenProducts(newSeen);
    });
  };

  const nextImage = () => {
    const currentProduct = products[currentProductIndex];
    if (currentProduct && currentImageIndex < currentProduct.images.length - 1) {
      const newIndex = currentImageIndex + 1;
      setCurrentImageIndex(newIndex);
      Animated.timing(imageTranslateX, {
        toValue: -newIndex * windowWidth,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const previousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  // Reset image position when product changes
  useEffect(() => {
    setCurrentImageIndex(0);
    imageTranslateX.setValue(0);
  }, [currentProductIndex]);

  const handleSwipeGesture = (event: any) => {
    const { translationY, velocityY, state } = event.nativeEvent;
    
    // Debug logging
    console.log('Swipe gesture:', { translationY, velocityY, state });
    
    if (state === State.END) {
      if (translationY < -50 || velocityY < -500) {
        nextProduct();
      } else if (translationY > 50 || velocityY > 500) {
        previousProduct();
      }
    }
  };

  const handleImageSwipe = (event: any) => {
    const { translationX, velocityX, state } = event.nativeEvent;
    
    // Debug logging
    console.log('Image swipe:', { translationX, velocityX, state });
    
    if (state === State.END) {
      // More lenient thresholds for better responsiveness
      if (translationX < -30 || velocityX < -300) {
        nextImage();
      } else if (translationX > 30 || velocityX > 300) {
        previousImage();
      }
    }
  };

  // Alternative: Touch-based navigation for fallback
  const handleImageTap = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      nextImage();
    } else {
      previousImage();
    }
  };

  // Simple touch-based product navigation
  const handleProductTap = (direction: 'up' | 'down') => {
    if (direction === 'down') {
      nextProduct();
    } else {
      previousProduct();
    }
  };

  const renderGridItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => {
        setCurrentProductIndex(products.findIndex(p => p.id === item.id));
        setIsGridView(false);
        const newSeen = new Set(seenProducts);
        newSeen.add(item.id);
        setSeenProducts(newSeen);
      }}
    >
      <Image source={{ uri: item.images[0] }} style={styles.gridImage} />
      <View style={styles.gridInfo}>
        <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.gridPrice}>₹{item.price}</Text>
        {item.tags.includes('Brand New') && (
          <View style={styles.gridTag}>
            <Text style={styles.gridTagText}>New</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderCardView = () => {
    if (products.length === 0) return null;
    
    const currentProduct = products[currentProductIndex];
    
    return (
      <PanGestureHandler onGestureEvent={handleSwipeGesture}>
        <Animated.View 
          style={[
            styles.cardContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Touch zones for product navigation */}
          <TouchableOpacity
            style={[styles.topTouchZone, { height: '15%' }]}
            onPress={() => handleProductTap('up')}
            activeOpacity={0.1}
          />
          <TouchableOpacity
            style={[styles.bottomTouchZone, { height: '15%' }]}
            onPress={() => handleProductTap('down')}
            activeOpacity={0.1}
          />
          <View style={styles.mediaSection}>
            <PanGestureHandler onGestureEvent={handleImageSwipe}>
              <Animated.View style={styles.imageContainer}>
                <Animated.View
                  style={[
                    styles.imageSlider,
                    {
                      width: `${products[currentProductIndex]?.images.length * 100}%`,
                      transform: [{ translateX: imageTranslateX }],
                    },
                  ]}
                >
                  {products[currentProductIndex]?.images.map((img, index) => (
                    <Image
                      key={index}
                      source={{ uri: img }}
                      style={[
                        styles.productImage,
                        { width: `${100 / products[currentProductIndex]?.images.length}%` },
                      ]}
                    />
                  ))}
                </Animated.View>
              </Animated.View>
            </PanGestureHandler>
            <View style={styles.imageIndicators}>
              {products[currentProductIndex]?.images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    index === currentImageIndex && styles.activeIndicator,
                  ]}
                />
              ))}
            </View>
            <TouchableOpacity
              style={styles.bookmarkButton}
              onPress={() => toggleBookmark(currentProduct.id)}
            >
              <Ionicons
                name={bookmarkedItems.has(currentProduct.id) ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={styles.gradientOverlay}
            />
          </View>
          <View style={styles.infoSection}>
            <View style={styles.productInfo}>
              <Text style={styles.productTitle}>{currentProduct.title}</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.price}>${currentProduct.price}</Text>
                {currentProduct.originalPrice && (
                  <Text style={styles.originalPrice}>
                    ${currentProduct.originalPrice}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.chatButton, { marginLeft: 12, paddingVertical: 4, paddingHorizontal: 10, minWidth: 0, height: 32 }]}
                  onPress={() => handleChatWithSeller(currentProduct)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
                  <Text style={[styles.chatButtonText, { fontSize: 13 }]}>Chat</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.metaInfo}>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryText}>
                    {mapCategoryToDepartment(currentProduct.category)}
                  </Text>
                </View>
                <Text style={styles.condition}>{currentProduct.condition}</Text>
              </View>
              <View style={styles.locationInfo}>
                <Ionicons name="location-outline" size={14} color="#666" />
                <Text style={styles.location}>{currentProduct.location}</Text>
                <Text style={styles.posted}>
                  {formatTimestamp(currentProduct.timestamp)}
                </Text>
              </View>
              <Text style={styles.description} numberOfLines={2}>
                {currentProduct.description}
              </Text>
              <View style={styles.tagsContainer}>
                {generateTags(currentProduct).map((tag, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tag,
                      tag === 'Urgent' && styles.urgentTag,
                      tag === 'Negotiable' && styles.negotiableTag,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        tag === 'Urgent' && styles.urgentTagText,
                        tag === 'Negotiable' && styles.negotiableTagText,
                      ]}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.productNavigation}>
               <TouchableOpacity
                style={styles.productNavButton}
                onPress={previousProduct}
              >
                <Ionicons
                  name="arrow-back"
                  size={18}
                  color={'#4E54C8'}
                />
                <Text
                  style={styles.navButtonText}
                >
                  Prev
                </Text>
              </TouchableOpacity>
              <View style={styles.productCounter}>
                <Text style={styles.counterText}>
                  {currentProductIndex + 1} / {products.length}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.productNavButton,
                  currentProductIndex === products.length - 1 &&
                    styles.disabledButton,
                ]}
                onPress={nextProduct}
                disabled={currentProductIndex === products.length - 1}
              >
                <Text
                  style={[
                    styles.navButtonText,
                    currentProductIndex === products.length - 1 &&
                      styles.disabledText,
                  ]}
                >
                  Next
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={
                    currentProductIndex === products.length - 1
                      ? '#adb5bd'
                      : '#4E54C8'
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </PanGestureHandler>
    );
  };

  // Helper functions to map Firebase data to Product interface
  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'Recently';
    
    let timestampMs: number;
    
    // Handle Firestore Timestamp objects
    if (timestamp && typeof timestamp.toDate === 'function') {
      timestampMs = timestamp.toDate().getTime();
    } else if (timestamp && typeof timestamp.seconds === 'number') {
      timestampMs = timestamp.seconds * 1000;
    } else if (typeof timestamp === 'number') {
      timestampMs = timestamp;
    } else {
      return 'Recently';
    }
    
    const now = Date.now();
    const diff = now - timestampMs;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const generateTags = (item: any): string[] => {
    const tags: string[] = [];
    if (item.isNegotiable) tags.push('Negotiable');
    if (item.condition === 'Brand New') tags.push('Brand New');
    if (Date.now() - item.timestamp < 24 * 60 * 60 * 1000) tags.push('New');
    return tags;
  };

  const mapCategoryToDepartment = (category: string): string => {
    const mapping: { [key: string]: string } = {
      'electronics': 'Computer Science',
      'books': 'Computer Science',
      'furniture': 'Design',
      'clothing': 'Fashion Design',
      'vehicles': 'Mechanical Engineering',
      'bags': 'Design',
      'hostel': 'General',
      'others': 'General'
    };
    return mapping[category] || 'General';
  };

  const generateRandomRating = (): number => {
    return Math.round((4.0 + Math.random() * 1.0) * 10) / 10; // Between 4.0 and 5.0
  };

  // Helper function to check Firebase connection
  const checkFirebaseConnection = async (): Promise<boolean> => {
    try {
      console.log('Checking Firebase connection...');
      if (!db) {
        console.error('Firebase db object is not initialized');
        return false;
      }
      
      // Try a simple query to check connection
      const testRef = collection(db, 'products');
      await getDocs(query(testRef, orderBy('timestamp', 'desc'), limit(1)));
      console.log('Firebase connection successful');
      return true;
    } catch (error) {
      console.error('Firebase connection check failed:', error);
      return false;
    }
  };

  const categories = [...new Set(products.map(p => p.category))];

  const filteredProducts = showBookmarked
    ? products.filter(p => bookmarkedItems.has(p.id))
    : filteredCategory
    ? products.filter(p => p.category === filteredCategory)
    : products;

  const displayedProducts = () => {
    const unseen = filteredProducts.filter(p => !seenProducts.has(p.id));
    if (unseen.length > 0) {
      return unseen;
    }
    return filteredProducts;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4E54C8" />
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/campus-life.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>YOGO Campus</Text>
        </View>
        
        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setShowBookmarked(!showBookmarked)}
          >
            <Ionicons
              name={showBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setIsGridView(!isGridView)}
          >
            <Ionicons
              name={isGridView ? 'card' : 'grid'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Filter Bar */}
      {(!isGridView || showBookmarked) && (
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                !filteredCategory && styles.activeFilter,
              ]}
              onPress={() => setFilteredCategory(null)}
            >
              <Text style={styles.filterText}>All</Text>
            </TouchableOpacity>
            {categories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterButton,
                  filteredCategory === category && styles.activeFilter,
                ]}
                onPress={() => setFilteredCategory(category)}
              >
                <Text style={styles.filterText}>{category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main Content */}
      {isGridView ? (
        <FlatList
          data={displayedProducts()}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        <View style={styles.cardViewContainer}>
          {renderCardView()}
        </View>
      )}
      
      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4E54C8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewToggle: {
    padding: 8,
    marginLeft: 8,
  },
  filterContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f0f2f5',
    marginRight: 8,
  },
  activeFilter: {
    backgroundColor: '#4E54C8',
  },
  filterText: {
    color: '#333',
    fontWeight: '600',
  },
  cardViewContainer: {
    flex: 1,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mediaSection: {
    height: '65%',
  },
  imageContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  imageSlider: {
    flex: 1,
    flexDirection: 'row',
  },
  productImage: {
    height: '100%',
    resizeMode: 'cover',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  activeIndicator: {
    backgroundColor: '#fff',
    width: 28,
    height: 8,
    borderRadius: 4,
    borderColor: '#fff',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  infoSection: {
    height: '35%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  productInfo: {
    padding: 16,
    paddingBottom: 0,
  },
  productTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  price: {
    fontSize: 24,
    fontWeight: '800',
    color: '#4E54C8',
    marginRight: 12,
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  categoryTag: {
    backgroundColor: 'rgba(78, 84, 200, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 12,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#4E54C8',
    fontWeight: '600',
  },
  condition: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  location: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  posted: {
    fontSize: 13,
    color: '#999',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  tag: {
    backgroundColor: '#f0f2f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  urgentTag: {
    backgroundColor: '#ffe6e6',
    borderWidth: 1,
    borderColor: '#ffb3b3',
  },
  negotiableTag: {
    backgroundColor: '#e6f3ff',
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  tagText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  urgentTagText: {
    color: '#dc3545',
  },
  negotiableTagText: {
    color: '#4E54C8',
  },
  actionButtons: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  chatButton: {
    backgroundColor: '#4E54C8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignSelf: 'center',
    minWidth: 140,
    elevation: 3,
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  gridContainer: {
    padding: 8,
  },
  gridItem: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  gridInfo: {
    padding: 12,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  gridPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4E54C8',
  },
  gridTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gridTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 247, 250, 0.9)',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  imageTouchZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  leftTouchZone: {
    left: 0,
  },
  rightTouchZone: {
    right: 0,
  },
  imageNavButton: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
    zIndex: 15,
    transform: [{ translateY: -20 }],
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  leftNavButton: {
    left: 16,
  },
  rightNavButton: {
    right: 16,
  },
  productNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  productNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#4E54C8',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  disabledButton: {
    borderColor: '#dee2e6',
    backgroundColor: '#f8f9fa',
  },
  navButtonText: {
    fontSize: 12,
    color: '#4E54C8',
    fontWeight: '600',
    marginLeft: 4,
  },
  disabledText: {
    color: '#adb5bd',
  },
  productCounter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4E54C8',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  topTouchZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '20%',
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  bottomTouchZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '20%',
    backgroundColor: 'transparent',
    zIndex: 5,
  },
});

export default BuyMarketplace;
