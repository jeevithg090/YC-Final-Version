import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  FlatList,
  StatusBar,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// TypeScript interfaces for our data models
interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  seller: string;
  category: string;
  image: string;
  description: string;
  condition: 'New' | 'Like New' | 'Good' | 'Fair';
  listed: string; // date string
  department: string;
  rating: number;
}

interface FeatureHighlight {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const Marketplace: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const scrollY = useRef(new Animated.Value(0)).current;
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  // Animate elements on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  // Sample categories
  const categories: Category[] = [
    { id: 'all', name: 'All', icon: 'grid' },
    { id: 'books', name: 'Books', icon: 'book' },
    { id: 'electronics', name: 'Electronics', icon: 'laptop' },
    { id: 'furniture', name: 'Furniture', icon: 'bed' },
    { id: 'clothing', name: 'Clothing', icon: 'shirt' },
    { id: 'services', name: 'Services', icon: 'construct' },
  ];
  
  // Feature highlights to be displayed
  const featureHighlights: FeatureHighlight[] = [
    {
      id: '1',
      title: '📦 List Items',
      description: 'Sell books, gadgets, furniture, or more in minutes.',
      icon: 'cube'
    },
    {
      id: '2',
      title: '🛒 Browse & Filter',
      description: 'Easily find what you need by category, price, or department.',
      icon: 'filter'
    },
    {
      id: '3',
      title: '💬 Chat with Sellers',
      description: 'In-app messaging to coordinate pickups.',
      icon: 'chatbubbles'
    },
    {
      id: '7',
      title: '🔔 Save for Later',
      description: 'Bookmark cool finds!',
      icon: 'bookmark'
    }
  ];

  // Sample products data (would be fetched from Firebase in a real app)
  const products: Product[] = [
    {
      id: '1',
      name: 'Data Structures & Algorithms Textbook',
      price: 250,
      seller: 'Aisha M.',
      category: 'books',
      image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c',
      description: 'Used for CSE 301, great condition, some highlights',
      condition: 'Good',
      listed: '2 days ago',
      department: 'Computer Science',
      rating: 4.8
    },
    {
      id: '2',
      name: 'Desk Lamp - LED',
      price: 350,
      seller: 'Rahul K.',
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15',
      description: 'Adjustable brightness, perfect for studying, 1 year used',
      condition: 'Like New',
      listed: '5 days ago',
      department: 'Engineering',
      rating: 4.5
    },
    {
      id: '3',
      name: 'Foldable Study Table',
      price: 800,
      seller: 'Maya P.',
      category: 'furniture',
      image: 'https://images.unsplash.com/photo-1526887520775-4b14b8aed897',
      description: 'Compact and sturdy, perfect for hostel rooms',
      condition: 'Good',
      listed: '1 week ago',
      department: 'Design',
      rating: 4.2
    },
    {
      id: '4',
      name: 'Wireless Earbuds',
      price: 499,
      seller: 'Karan S.',
      category: 'electronics',
      image: 'https://images.unsplash.com/photo-1606741965429-02adcaea4347',
      description: 'Great sound quality, 3 months old, with box & accessories',
      condition: 'Like New',
      listed: '3 days ago',
      department: 'Media Studies',
      rating: 4.9
    }
  ];

  // Filter products based on selected category
  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(product => product.category === selectedCategory);

  // Header blur intensity increases as you scroll
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Handler for Buy button
  const handleBuyPress = () => {
    // Navigate to buying interface
    console.log('Navigating to BuyMarketplace...');
    try {
      navigation.navigate('BuyMarketplace');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  // Handler for Sell button
  const handleSellPress = () => {
    // Navigate to selling form/interface
    navigation.navigate('SellMarketplace');
  };

  // Go back to Dashboard
  const handleBackPress = () => {
    navigation.goBack();
  };

  // Render each feature highlight card
  const renderFeatureHighlight = ({ item }: { item: FeatureHighlight }) => {
    return (
      <Animated.View 
        style={[
          styles.featureCard,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: translateY }]
          }
        ]}
      >
        <View style={styles.featureIconContainer}>
          <Ionicons name={item.icon as any} size={24} color="#4E54C8" />
        </View>
        <View style={styles.featureContent}>
          <Text style={styles.featureTitle}>{item.title}</Text>
          <Text style={styles.featureDescription}>{item.description}</Text>
        </View>
      </Animated.View>
    );
  };

  // Render each category button
  const renderCategoryItem = ({ item }: { item: Category }) => {
    const isSelected = selectedCategory === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.categoryButton,
          isSelected && styles.selectedCategoryButton
        ]}
        onPress={() => setSelectedCategory(item.id)}
      >
        <Ionicons 
          name={item.icon as any} 
          size={20} 
          color={isSelected ? '#fff' : '#4E54C8'} 
        />
        <Text 
          style={[
            styles.categoryText,
            isSelected && styles.selectedCategoryText
          ]}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      
      {/* Animated Header with Blur Effect */}
      <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
        <BlurView intensity={70} style={StyleSheet.absoluteFill} tint="light" />
      </Animated.View>
      
      {/* Static Header Content */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/YOGOCampus.jpg')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>YOGO Campus</Text>
        </View>
        
        <TouchableOpacity style={styles.profileButton} onPress={() => {
          Alert.alert(
            "Your Posts",
            "Here are your marketplace posts",
            [
              { text: "Delete Post", onPress: () => console.log("Delete pressed") },
              { text: "OK", style: "cancel" }
            ]
          );
        }}>
          <Ionicons name="person-circle" size={28} color="#4E54C8" />
        </TouchableOpacity>
      </View>
      
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Hero Section with Animation */}
        <Animated.View style={[
          styles.heroSection,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: translateY }]
          }
        ]}>
          <LinearGradient
            colors={['rgba(78, 84, 200, 0.8)', 'rgba(143, 148, 251, 0.8)']}
            style={styles.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>Campus Marketplace</Text>
              <Text style={styles.heroSubtitle}>
                Buy, sell, and trade items with your campus community
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
        
        {/* Categories Horizontal Scroll */}
        <View style={styles.categoriesContainer}>
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          />
        </View>
        
        {/* Feature Highlights Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>🔑 Features at a Glance</Text>
          <FlatList
            data={featureHighlights}
            renderItem={renderFeatureHighlight}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
        
        {/* Action Buttons with Animation */}
        <Animated.View style={[
          styles.actionButtonsContainer,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: translateY }]
          }
        ]}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.buyButton]} 
            onPress={handleBuyPress}
            activeOpacity={0.8}
          >
            <Ionicons name="cart" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Buy</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.sellButton]} 
            onPress={handleSellPress}
            activeOpacity={0.8}
          >
            <Ionicons name="pricetag" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Sell</Text>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Extra space at bottom for better UX */}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 60,
    backgroundColor: 'transparent',
    zIndex: 101,
  },
  backButton: {
    padding: 8,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 8,
    borderRadius: 10,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  profileButton: {
    padding: 8,
  },
  scrollViewContent: {
    paddingTop: 0,
  },
  heroSection: {
    height: 200,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroContent: {
    maxWidth: '80%',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  categoriesContainer: {
    marginTop: 24,
  },
  categoriesList: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  selectedCategoryButton: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4E54C8',
    marginLeft: 8,
  },
  selectedCategoryText: {
    color: '#fff',
  },
  sectionContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 32,
    width: '48%',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buyButton: {
    backgroundColor: '#4E54C8',
  },
  sellButton: {
    backgroundColor: '#F3722C',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default Marketplace;
