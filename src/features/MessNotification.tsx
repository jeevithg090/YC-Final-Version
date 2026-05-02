import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  FlatList,
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

// TypeScript interfaces
interface Dish {
  name: string;
  calories: number;
  type: string;
  description?: string;
  imageUrl?: string;
  isVegetarian: boolean;
}

interface MealData {
  [day: string]: Dish[];
}

interface MessMenu {
  breakfast: MealData;
  lunch: MealData;
  snacks: MealData;
  dinner: MealData;
  [key: string]: MealData; // Add index signature
}

interface MessData {
  veg: MessMenu;
  nonveg: MessMenu;
  lastUpdated?: any;
}

// Navigation type
type RootStackParamList = {
  MessMenu: {
    messName: string;
    mealType: 'veg' | 'nonveg';
  };
  [key: string]: any;
};

type NavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const MessNotification: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState<boolean>(true);
  const [messData, setMessData] = useState<MessData | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedMeal, setSelectedMeal] = useState<string>('breakfast');
  const [selectedDiet, setSelectedDiet] = useState<'veg' | 'nonveg'>('veg');
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get current day of week
  const getCurrentDay = (): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    return days[today];
  };

  // Load mess data from Firestore
  const loadMessData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get data from InstaMess collection (new format)
      const messRef = doc(db, 'InstaMess', 'menu');
      const messDoc = await getDoc(messRef);
      
      if (messDoc.exists()) {
        const data = messDoc.data() as MessData;
        setMessData(data);
        
        // Set selected day to current day
        const currentDay = getCurrentDay();
        setSelectedDay(currentDay);
      } else {
        // Fallback to old format or show error
        setError('Menu data not found. Please check back later.');
      }
    } catch (error) {
      console.error('Error loading mess data:', error);
      setError('Failed to load menu data. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadMessData();
  }, []);

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadMessData();
  };

  // Navigate to MessMenu screen
  const navigateToMessMenu = () => {
    navigation.navigate('MessMenu', {
      messName: 'Food Court 1',
      mealType: selectedDiet
    });
  };

  // Render day selector
  const renderDaySelector = () => {
    const days = [
      { id: 'monday', label: 'Mon' },
      { id: 'tuesday', label: 'Tue' },
      { id: 'wednesday', label: 'Wed' },
      { id: 'thursday', label: 'Thu' },
      { id: 'friday', label: 'Fri' },
      { id: 'saturday', label: 'Sat' },
      { id: 'sunday', label: 'Sun' },
    ];

    return (
      <View style={styles.daySelector}>
        {days.map((day) => (
          <TouchableOpacity
            key={day.id}
            style={[
              styles.dayButton,
              selectedDay === day.id && styles.selectedDayButton
            ]}
            onPress={() => setSelectedDay(day.id)}
          >
            <Text style={[
              styles.dayButtonText,
              selectedDay === day.id && styles.selectedDayButtonText
            ]}>
              {day.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render meal selector
  const renderMealSelector = () => {
    const meals = [
      { id: 'breakfast', label: 'Breakfast', icon: 'cafe-outline' },
      { id: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
      { id: 'snacks', label: 'Snacks', icon: 'fast-food-outline' },
      { id: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    ];

    return (
      <View style={styles.mealSelector}>
        {meals.map((meal) => (
          <TouchableOpacity
            key={meal.id}
            style={[
              styles.mealButton,
              selectedMeal === meal.id && styles.selectedMealButton
            ]}
            onPress={() => setSelectedMeal(meal.id)}
          >
            <Ionicons
              name={meal.icon as any}
              size={20}
              color={selectedMeal === meal.id ? '#fff' : '#666'}
            />
            <Text style={[
              styles.mealButtonText,
              selectedMeal === meal.id && styles.selectedMealButtonText
            ]}>
              {meal.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render diet selector
  const renderDietSelector = () => {
    return (
      <View style={styles.dietSelector}>
        <TouchableOpacity
          style={[
            styles.dietButton,
            selectedDiet === 'veg' && styles.selectedDietButton,
            { borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }
          ]}
          onPress={() => setSelectedDiet('veg')}
        >
          <View style={styles.vegIndicator} />
          <Text style={[
            styles.dietButtonText,
            selectedDiet === 'veg' && styles.selectedDietButtonText
          ]}>
            Veg
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.dietButton,
            selectedDiet === 'nonveg' && styles.selectedDietButton,
            { borderTopRightRadius: 20, borderBottomRightRadius: 20 }
          ]}
          onPress={() => setSelectedDiet('nonveg')}
        >
          <View style={styles.nonVegIndicator} />
          <Text style={[
            styles.dietButtonText,
            selectedDiet === 'nonveg' && styles.selectedDietButtonText
          ]}>
            Non-Veg
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render dish item
  const renderDishItem = ({ item }: { item: Dish }) => {
    return (
      <View style={styles.dishCard}>
        <View style={styles.dishImageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.dishImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.dishImagePlaceholder}>
              <Ionicons name="restaurant-outline" size={40} color="#ddd" />
            </View>
          )}
          <View style={styles.caloriesBadge}>
            <Text style={styles.caloriesText}>{item.calories} cal</Text>
          </View>
        </View>
        <View style={styles.dishInfo}>
          <View style={styles.dishNameRow}>
            {item.isVegetarian ? (
              <View style={styles.vegIndicator} />
            ) : (
              <View style={styles.nonVegIndicator} />
            )}
            <Text style={styles.dishName}>{item.name}</Text>
          </View>
          <Text style={styles.dishType}>{item.type}</Text>
        </View>
      </View>
    );
  };

  // Get dishes for selected day, meal, and diet
  const getSelectedDishes = (): Dish[] => {
    if (!messData || !selectedDay) return [];
    
    const menu = messData[selectedDiet];
    if (!menu || !menu[selectedMeal] || !menu[selectedMeal][selectedDay]) {
      return [];
    }
    
    return menu[selectedMeal][selectedDay];
  };

  // Format date
  const formatDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const now = new Date();
    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const date = now.getDate();
    
    return `${dayName}, ${monthName} ${date}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4e54c8" />
          <Text style={styles.loadingText}>Loading mess menu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMessData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mess Notification</Text>
        <TouchableOpacity 
          style={styles.optionsButton}
          onPress={navigateToMessMenu}
        >
          <Ionicons name="options-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Date Display */}
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>{formatDate()}</Text>
      </View>

      {/* Diet Selector */}
      {renderDietSelector()}

      {/* Day Selector */}
      {renderDaySelector()}

      {/* Meal Selector */}
      {renderMealSelector()}

      {/* Dishes List */}
      <FlatList
        data={getSelectedDishes()}
        renderItem={renderDishItem}
        keyExtractor={(item, index) => `${item.name}-${index}`}
        numColumns={2}
        contentContainerStyle={styles.dishesContainer}
        columnWrapperStyle={styles.dishesRow}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color="#ddd" />
            <Text style={styles.emptyText}>No dishes available for this selection</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4e54c8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  optionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  dietSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  dietButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedDietButton: {
    backgroundColor: '#4e54c8',
    borderColor: '#4e54c8',
  },
  dietButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  selectedDietButtonText: {
    color: '#fff',
  },
  vegIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4caf50',
    marginRight: 8,
  },
  nonVegIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f44336',
    marginRight: 8,
  },
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  dayButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedDayButton: {
    backgroundColor: '#4e54c8',
    borderColor: '#4e54c8',
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  selectedDayButtonText: {
    color: '#fff',
  },
  mealSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  mealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  selectedMealButton: {
    backgroundColor: '#4e54c8',
    borderColor: '#4e54c8',
  },
  mealButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 8,
  },
  selectedMealButtonText: {
    color: '#fff',
  },
  dishesContainer: {
    padding: 12,
  },
  dishesRow: {
    justifyContent: 'space-between',
  },
  dishCard: {
    width: (width - 36) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dishImageContainer: {
    position: 'relative',
    height: 120,
  },
  dishImage: {
    width: '100%',
    height: '100%',
  },
  dishImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  caloriesBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  caloriesText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  dishInfo: {
    padding: 12,
  },
  dishNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  dishType: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default MessNotification;