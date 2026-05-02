import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Image,
  ActivityIndicator,
  FlatList,
  Platform,
  Dimensions,
  Alert,
  Linking,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../services/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  addDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/router';

// Import the app logo
const appLogoImage = require('../../assets/images/icon.png');

const { width } = Dimensions.get('window');

// TypeScript interfaces
interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  distance: string;
  imageUrl: string;
  priceRange: string;
  isOpen: boolean;
  tags: string[];
  featured?: boolean;
  phoneNumber: string; // Added phone number property
}

type RestaurantsNavigationProp = StackNavigationProp<RootStackParamList, 'Restaurants'>;

const Restaurants = () => {
  // Initialize navigation
  const navigation = useNavigation<RestaurantsNavigationProp>();
  // Animation value for header
  const scrollY = new Animated.Value(0);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const cuisineFilters = ['All', 'Indian', 'Chinese', 'Italian', 'Fast Food', 'Desserts', 'Beverages', 'South Indian', 'Mexican', 'Bakery', 'Multi-Cuisine', 'Healthy'];

  // Function to seed restaurants data to Firebase if needed
  const seedRestaurantsData = async () => {
    try {
      // Check if restaurants collection already has data
      const restaurantsRef = collection(db, 'restaurants');
      const snapshot = await getDocs(restaurantsRef);
      
      if (snapshot.empty) {
        console.log('Seeding restaurants data to Firebase...');
        
        // Restaurant data from user input - each restaurant needs a unique ID
        const restaurantsData = [
          {
            name: 'Aditya Mess',
            phoneNumber: '+91 74836 44586',
            cuisine: 'Indian',
            rating: 4.1,
            deliveryTime: '15-20 min',
            distance: '0.3 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹',
            isOpen: true,
            tags: ['Mess Food', 'Budget Friendly'],
          },
          {
            name: 'Apoorva Mess',
            phoneNumber: '+91 91088 88320',
            cuisine: 'Indian',
            rating: 4.2,
            deliveryTime: '15-20 min',
            distance: '0.4 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹',
            isOpen: true,
            tags: ['Mess Food', 'Popular'],
          },
          {
            name: 'Ashraya',
            phoneNumber: '+91 63612 01519',
            cuisine: 'Indian',
            rating: 4.3,
            deliveryTime: '20-25 min',
            distance: '0.5 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹',
            isOpen: true,
            tags: ['Authentic', 'Clean'],
          },
          {
            name: 'Dollar Cafe',
            phoneNumber: '+91 81053 06109',
            cuisine: 'Fast Food',
            rating: 4.1,
            deliveryTime: '15-25 min',
            distance: '0.6 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹',
            isOpen: true,
            tags: ['Cafe', 'Snacks'],
          },
          {
            name: 'FC 2',
            phoneNumber: '+91 88619 53102',
            cuisine: 'Multi-Cuisine',
            rating: 4.4,
            deliveryTime: '20-30 min',
            distance: '0.4 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹',
            isOpen: true,
            tags: ['Fast Food', 'Variety'],
            featured: true,
          },
          {
            name: 'Flurry\'s Baken Bru',
            phoneNumber: '+91 99801 44033',
            cuisine: 'Bakery',
            rating: 4.5,
            deliveryTime: '15-20 min',
            distance: '0.7 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹',
            isOpen: true,
            tags: ['Bakery', 'Desserts'],
            featured: true,
          },
          {
            name: 'Hit & Run',
            phoneNumber: '+91 74063 30088',
            cuisine: 'Fast Food',
            rating: 4.2,
            deliveryTime: '10-15 min',
            distance: '0.3 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹',
            isOpen: true,
            tags: ['Quick Service', 'Student Favorite'],
          },
          {
            name: 'Hungry House',
            phoneNumber: '+91 98202 43177',
            cuisine: 'Multi-Cuisine',
            rating: 4.0,
            deliveryTime: '20-30 min',
            distance: '0.5 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹',
            isOpen: true,
            tags: ['Variety', 'Group Dining'],
          },
          {
            name: 'Janani Canteen',
            phoneNumber: '+91 86601 38488',
            cuisine: 'South Indian',
            rating: 4.1,
            deliveryTime: '15-20 min',
            distance: '0.4 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹',
            isOpen: true,
            tags: ['South Indian', 'Budget'],
          },
          {
            name: 'JustGuilty Meal Preps',
            phoneNumber: '+91 76195 32625',
            cuisine: 'Healthy',
            rating: 4.4,
            deliveryTime: '25-35 min',
            distance: '0.8 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹₹',
            isOpen: true,
            tags: ['Healthy', 'Meal Prep'],
            featured: true,
          },
          {
            name: 'Kamath Cafe',
            phoneNumber: '+91 82170 44886',
            cuisine: 'Multi-Cuisine',
            rating: 4.3,
            deliveryTime: '15-25 min',
            distance: '0.5 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹',
            isOpen: true,
            tags: ['Popular', 'Variety'],
          },
          {
            name: 'MFC (Multi Food Court)',
            phoneNumber: '+91 73383 34970',
            cuisine: 'Multi-Cuisine',
            rating: 4.6,
            deliveryTime: '20-30 min',
            distance: '0.7 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹',
            isOpen: true,
            tags: ['Food Court', 'Variety'],
            featured: true,
          },
          {
            name: 'Nom Nom Cafe',
            phoneNumber: '+91 76194 22026',
            cuisine: 'Cafe',
            rating: 4.3,
            deliveryTime: '15-20 min',
            distance: '0.5 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹',
            isOpen: true,
            tags: ['Cafe', 'Snacks'],
          },
          {
            name: 'Poornima Canteen',
            phoneNumber: '0821 763 5290',
            cuisine: 'Indian',
            rating: 4.1,
            deliveryTime: '15-25 min',
            distance: '0.4 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹',
            isOpen: true,
            tags: ['College Canteen', 'Budget'],
          },
          {
            name: 'Taco House',
            phoneNumber: '+91 77958 15315',
            cuisine: 'Mexican',
            rating: 4.2,
            deliveryTime: '20-30 min',
            distance: '0.6 km',
            imageUrl: 'https://via.placeholder.com/300x200',
            priceRange: '₹₹',
            isOpen: true,
            tags: ['Mexican', 'Tacos'],
          },
        ];
        
        // Add each restaurant to Firestore
        for (const restaurant of restaurantsData) {
          await addDoc(restaurantsRef, restaurant);
        }
        console.log('Restaurants data seeded successfully!');
      } else {
        console.log('Restaurants data already exists in Firestore.');
      }
    } catch (error) {
      console.error('Error seeding restaurants data:', error);
    }
  };

  /* Firebase Console Action: 
   * This query requires a composite index on the 'restaurants' collection.
   * Create the index by visiting this URL:
   * https://console.firebase.google.com/v1/r/project/yogo-campus/firestore/indexes?create_composite=Ck9wcm9qZWN0cy95b2dvLWNhbXB1cy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcmVzdGF1cmFudHMvaW5kZXhlcy9fEAEaDAoIZmVhdHVyZWQQAhoKCgZyYXRpbmcQAhoMCghfX25hbWVfXxAC
   * 
   * Or manually create an index with:
   * - Collection: restaurants
   * - Fields to index: featured (Ascending), rating (Descending)
   */

  // Firebase Console Action: Create 'restaurants' collection in Firestore
  useEffect(() => {
    // Set up real-time listener for restaurant data
    const restaurantsRef = collection(db, 'restaurants');
    
    // Use a simple query that doesn't require a composite index
    // This ensures all restaurants are retrieved regardless of index status
    const q = query(restaurantsRef);
    
    // First check if any data exists
    getDocs(q).then((snapshot) => {
      if (snapshot.empty) {
        console.log('No restaurants found, seeding data...');
        seedRestaurantsData().then(() => {
          console.log('Seeding complete, data should be available now');
        }).catch(error => {
          console.error('Error seeding data:', error);
          setLoading(false);
        });
      }
    }).catch(error => {
      console.error('Error checking for restaurants:', error);
    });
    
    // Set up the listener for real-time updates
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          console.log(`Retrieved ${snapshot.docs.length} restaurants from Firestore`);
          
          // Extract all restaurants with proper error checking
          let restaurantsData = snapshot.docs.map((doc) => {
            const data = doc.data();
            // Ensure all required fields have values
            return {
              id: doc.id,
              name: data.name || 'Unnamed Restaurant',
              cuisine: data.cuisine || 'Various',
              rating: data.rating || 4.0,
              deliveryTime: data.deliveryTime || '20-30 min',
              distance: data.distance || '0.5 km',
              imageUrl: data.imageUrl || 'https://via.placeholder.com/300x200',
              priceRange: data.priceRange || '₹₹',
              isOpen: data.isOpen !== undefined ? data.isOpen : true,
              tags: data.tags || ['Campus Food'],
              featured: data.featured || false,
              phoneNumber: data.phoneNumber || 'N/A',
            } as Restaurant;
          });
          
          // Sort manually - featured restaurants first, then by rating
          restaurantsData = restaurantsData.sort((a, b) => {
            // Sort by featured first
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            // Then by rating
            return b.rating - a.rating;
          });
          
          console.log(`Processed ${restaurantsData.length} restaurants`);
          setRestaurants(restaurantsData);
          setFilteredRestaurants(restaurantsData);
        } catch (error) {
          console.error('Error processing restaurant data:', error);
          // If there's an error, make sure we still have some data to show
          setRestaurants([]);
          setFilteredRestaurants([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Firebase connection failed:', error);
        
        // Check if the restaurants collection exists
        getDocs(restaurantsRef)
          .then((snapshot) => {
            if (snapshot.empty) {
              Alert.alert(
                'No Restaurants Found',
                'Would you like to seed the restaurant data now?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => setLoading(false)
                  },
                  {
                    text: 'Yes',
                    onPress: async () => {
                      try {
                        await seedRestaurantsData();
                        Alert.alert(
                          'Success',
                          'Restaurant data has been seeded. Please restart the app.'
                        );
                      } catch (seedError) {
                        console.error('Error seeding data:', seedError);
                        Alert.alert(
                          'Error',
                          'Failed to seed restaurant data. Please check your connection and try again.'
                        );
                      } finally {
                        setLoading(false);
                      }
                    }
                  }
                ]
              );
            } else {
              Alert.alert(
                'Connection Error',
                `Failed to connect to Firebase. Error: ${error.message || error}`
              );
              setLoading(false);
            }
          })
          .catch(() => {
            Alert.alert(
              'Connection Error',
              'Failed to connect to Firebase. Please check your internet connection and try again.'
            );
            setLoading(false);
          });
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter functionality
  useEffect(() => {
    if (!restaurants || restaurants.length === 0) {
      setFilteredRestaurants([]);
      return;
    }
    
    let filtered = [...restaurants];

    // Filter by cuisine
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(restaurant => 
        restaurant.cuisine && restaurant.cuisine.toLowerCase() === selectedFilter.toLowerCase()
      );
    }

    // Search functionality
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(restaurant =>
        (restaurant.name && restaurant.name.toLowerCase().includes(query)) ||
        (restaurant.cuisine && restaurant.cuisine.toLowerCase().includes(query)) ||
        (restaurant.tags && restaurant.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    console.log(`Filtered ${restaurants.length} restaurants to ${filtered.length}`);
    setFilteredRestaurants(filtered);
  }, [restaurants, searchQuery, selectedFilter]);

  // Function to handle calling restaurant
  const handleCallPress = (phoneNumber: string, restaurantName: string) => {
    Alert.alert(
      restaurantName,
      `Call ${phoneNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Call", 
          onPress: () => {
            // Format phone number for linking
            const phoneUrl = `tel:${phoneNumber.replace(/\s/g, '')}`;
            Linking.canOpenURL(phoneUrl)
              .then(supported => {
                if (supported) {
                  Linking.openURL(phoneUrl);
                } else {
                  Alert.alert("Phone not supported", "Your device doesn't support making phone calls");
                }
              })
              .catch(err => console.error('Error with phone call:', err));
          }
        }
      ]
    );
  };

  const renderRestaurantCard = ({ item }: { item: Restaurant }) => {
    // Safety check - this helps prevent blank/missing restaurants
    if (!item || !item.name) {
      console.warn('Attempted to render a restaurant with missing data:', item);
      return null;
    }
    
    return (
      <TouchableOpacity 
        style={styles.restaurantCard}
        activeOpacity={0.95}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          // Here you could navigate to a restaurant detail screen if it exists
          Alert.alert(item.name, `You selected ${item.name}`);
        }}
      >
        <Image 
          source={{ uri: item.imageUrl }} 
          style={styles.restaurantImage} 
          defaultSource={require('../../assets/images/campus-life.png')}
        />
        
        {item.featured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={12} color="white" />
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        )}

        <View style={styles.restaurantInfo}>
          <View style={styles.restaurantHeader}>
            <Text style={styles.restaurantName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.rating}>{item.rating}</Text>
            </View>
          </View>

          <Text style={styles.cuisine}>{item.cuisine || 'Various'}</Text>
          
          <View style={styles.restaurantMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#8E8E93" />
              <Text style={styles.metaText}>{item.deliveryTime}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color="#8E8E93" />
              <Text style={styles.metaText}>{item.distance}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.priceRange}>{item.priceRange}</Text>
            </View>
          </View>

          <View style={styles.tagsContainer}>
            {item.tags && item.tags.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {item.isOpen === false && (
              <View style={[styles.tag, styles.closedTag]}>
                <Text style={[styles.tagText, styles.closedTagText]}>Closed</Text>
              </View>
            )}
          </View>
          
          {/* Phone button */}
          <TouchableOpacity 
            style={styles.phoneButton} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleCallPress(item.phoneNumber, item.name);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={16} color="white" />
            <Text style={styles.phoneButtonText}>Call Restaurant</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4E54C8" />
        <Text style={styles.loadingText}>Loading restaurants...</Text>
      </View>
    );
  }

  // Calculate header opacity based on scroll position
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp'
  });
  
  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* App Logo and Name with Back Button */}
      <View style={styles.appLogoContainer}>
        <TouchableOpacity 
          style={styles.backButtonContainer} 
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#4E54C8" />
        </TouchableOpacity>
        
        <Image source={appLogoImage} style={styles.appLogo} />
        <Text style={styles.appName}>YOGO Campus</Text>
      </View>
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleContainer}>
            <LinearGradient
              colors={['#FF8C00', '#FF6347']}
              style={styles.iconContainer}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
            >
              <Ionicons name="restaurant" size={24} color="white" />
            </LinearGradient>
            <View>
              <Text style={styles.title}>Restaurants</Text>
              <Text style={styles.subtitle}>Order food near campus</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants, cuisines..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {cuisineFilters.map((filter, index) => {
            const filterValue = filter.toLowerCase();
            const isActive = selectedFilter === (filterValue === 'all' ? 'all' : filterValue);
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.filterChip,
                  isActive && styles.activeFilterChip
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedFilter(filterValue === 'all' ? 'all' : filterValue);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.activeFilterChipText
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Restaurants List */}
      <Animated.FlatList
        data={filteredRestaurants}
        renderItem={renderRestaurantCard}
        keyExtractor={(item) => item.id}
        style={styles.restaurantsList}
        contentContainerStyle={styles.restaurantsListContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        bounces={true}
        bouncesZoom={true}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={64} color="#E5E5EA" />
            <Text style={styles.emptyStateTitle}>No restaurants found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery || selectedFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Check back later for restaurant listings!'}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  appLogoContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    position: 'relative',
  },
  backButtonContainer: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: [{ translateY: -12 }],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 242, 247, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  appLogo: {
    width: 32,
    height: 32,
    marginRight: 8,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4E54C8',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  phoneButton: {
    backgroundColor: '#4E54C8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  phoneButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
    marginTop: 2,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: Platform.OS === 'ios' ? 0.5 : 0,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  filtersContainer: {
    marginTop: 8,
  },
  filtersContent: {
    paddingRight: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  activeFilterChip: {
    backgroundColor: '#4E54C8',
  },
  filterChipText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  activeFilterChipText: {
    color: 'white',
    fontWeight: '600',
  },
  restaurantsList: {
    flex: 1,
  },
  restaurantsListContent: {
    padding: 20,
  },
  restaurantCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    transform: [{ scale: 1.0 }], // For potential animation later
    borderColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.1)' : undefined,
    borderWidth: Platform.OS === 'ios' ? 0.5 : 0,
  },
  restaurantImage: {
    width: '100%',
    height: 160,
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF8C00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  featuredText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  restaurantInfo: {
    padding: 16,
  },
  restaurantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  restaurantName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  cuisine: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  restaurantMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  priceRange: {
    fontSize: 14,
    fontWeight: '600',
    color: '#38B000',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    color: '#4E54C8',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  closedTag: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  closedTagText: {
    color: '#FF3B30',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
});

export default Restaurants;
