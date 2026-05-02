import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { db, serverTimestamp, collection, addDoc, getDoc, setDoc, updateDoc, onSnapshot, auth } from '../services/firebase';
import { query, where, getDocs, doc } from 'firebase/firestore';
import { quickAwardPoints } from '../services/pointsService';

const { width } = Dimensions.get('window');

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Notification permission and scheduling utilities
const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Please enable notifications in your device settings to receive meal reminders.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK' }
      ]
    );
    return false;
  }
  
  return true;
};

const generateNotificationContent = async (dishName: string, mealType: string, day: string, mealTime: string): Promise<{
  title: string;
  body: string;
  data: any;
}> => {
  const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1);
  const mealCapitalized = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  
  // Default fallback message
  const fallbackContent = {
    title: `🍽️ ${mealCapitalized} Now!`,
    body: `${dishName} is being served right now! Come grab yours while it's fresh! (${dayCapitalized})`,
    data: {
      dishName,
      mealType,
      day,
      mealTime,
      type: 'meal_reminder'
    }
  };

  try {
    // Generate a fun, engaging reminder using OpenRouter
    const response = await generateEngagingReminder(dishName, mealType, day, mealTime);
    
    if (response && response.title && response.body) {
      return {
        ...response,
        data: {
          dishName,
          mealType,
          day,
          mealTime,
          type: 'meal_reminder',
          aiGenerated: true
        }
      };
    }
  } catch (error) {
    console.error('Failed to generate AI reminder, using fallback:', error);
  }
  
  return fallbackContent;
};

// OpenRouter API integration for generating engaging reminders
const generateEngagingReminder = async (dishName: string, mealType: string, day: string, mealTime: string) => {
  const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '';
  const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1);
  const mealCapitalized = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  
  // Models to try in order (free models with extensive backups)
  const models = [
    'google/gemma-2-9b-it:free',  // Primary - Google Gemma
    'meta-llama/llama-3.1-8b-instruct:free',  // Meta Llama 3.1
    'microsoft/phi-3-mini-128k-instruct:free',  // Microsoft Phi-3
    'google/gemma-7b-it:free',  // Google Gemma 7B
    'meta-llama/llama-3-8b-instruct:free',  // Meta Llama 3
    'huggingface/zephyr-7b-beta:free',  // Hugging Face Zephyr
    'openchat/openchat-7b:free',  // OpenChat
    'gryphe/mythomist-7b:free',  // Gryphe Mythomist
    'undi95/toppy-m-7b:free',  // Toppy
    'mistralai/mistral-7b-instruct:free',  // Mistral 7B
    'teknium/openhermes-2.5-mistral-7b:free',  // OpenHermes
    'cognitivecomputations/dolphin-mixtral-8x7b:free',  // Dolphin Mixtral
    'nousresearch/nous-capybara-7b:free',  // Nous Capybara
    'neversleep/noromaid-mixtral-8x7b-instruct:free',  // Noromaid
    'koboldai/psyfighter-13b-2:free',  // Psyfighter
    'jebcarter/psyfighter-13b:free',  // Psyfighter alt
    'lizpreciatior/lzlv_70b_fp16_hf:free',  // LZLV
    'alpindale/goliath-120b:free',  // Goliath
    'sophosympatheia/midnight-rose-70b:free',  // Midnight Rose
    'sao10k/fimbulvetr-11b-v2:free',  // Fimbulvetr
    'lynn/soliloquy-l3:free',  // Soliloquy
    'flammenai/flammen-mixtral-8x7b:free',  // Flammen
    'rwkv/rwkv-5-world-3b:free',  // RWKV World
    'togethercomputer/redpajama-incite-7b-chat:free',  // RedPajama
    'bigscience/bloom:free',  // BLOOM
    'eleutherai/gpt-j-6b:free',  // GPT-J
    'google/flan-t5-xl:free',  // FLAN-T5
    'google/flan-t5-large:free',  // FLAN-T5 Large
    'microsoft/dialoqpt-medium:free',  // DialoGPT
    'facebook/blenderbot-3b:free'  // BlenderBot
  ];
  
  const prompt = `Generate a fun, engaging notification message for university students about their mess food. Make it trendy, exciting, and use Gen Z language/emojis.

Context:
- Dish: ${dishName}
- Meal: ${mealCapitalized}
- Day: ${dayCapitalized}
- Time: ${mealTime}
- This is a "meal happening now" notification (45 minutes after start time)

Requirements:
1. Create a catchy TITLE (max 30 chars) with emojis
2. Create an engaging BODY message (max 80 chars) that makes students excited about the food
3. Use modern slang, emojis, and energy that university students love
4. Make it feel like the meal is happening right now and they should come

Return ONLY a JSON object with this exact format:
{"title": "your title here", "body": "your body message here"}

Examples of good messages:
{"title": "🔥 Dinner Time!", "body": "Yo! That legendary Biryani is serving NOW! Don't miss out! 💯"}
{"title": "⚡ Breakfast Live!", "body": "Fresh Dosa hitting the tables rn! Come grab yours bestie! 🌟"}`;

  for (const model of models) {
    try {
      console.log(`Trying model: ${model}`);
      
      // Add timeout to prevent hanging requests (increased to 60 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout per model
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://yogocampus.app',
          'X-Title': 'YOGO Campus Mess Notifications'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 150,
          temperature: 0.8,
          top_p: 0.9,
          frequency_penalty: 0.5
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Model ${model} failed with status: ${response.status} - ${response.statusText}`);
        // Add delay before trying next model to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      console.log(`📡 Model ${model} responded successfully, parsing...`);
      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content.trim();
        
        // Try to parse the JSON response
        try {
          const parsedContent = JSON.parse(content);
          if (parsedContent.title && parsedContent.body && 
              parsedContent.title.length <= 35 && parsedContent.body.length <= 85) {
            console.log(`✅ Successfully generated reminder with ${model}:`, parsedContent);
            return parsedContent;
          } else {
            console.log(`⚠️ Response from ${model} doesn't meet requirements:`, parsedContent);
          }
        } catch (parseError) {
          console.error(`❌ Failed to parse JSON from ${model}:`, content);
          // Try to extract title and body manually from non-JSON response
          const titleMatch = content.match(/title["\s]*:["\s]*([^"]{1,35})/i);
          const bodyMatch = content.match(/body["\s]*:["\s]*([^"]{1,85})/i);
          if (titleMatch && bodyMatch) {
            const extracted = {
              title: titleMatch[1].trim(),
              body: bodyMatch[1].trim()
            };
            console.log(`🔧 Extracted from ${model}:`, extracted);
            return extracted;
          }
        }
      }
      
      // Add small delay before trying next model
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error(`⏰ Model ${model} timed out after 60 seconds`);
        } else {
          console.error(`💥 Error with model ${model}:`, error.message);
        }
      } else {
        console.error(`💥 Unknown error with model ${model}:`, error);
      }
      
      // Add delay before trying next model after error
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }
  }
  
  // If all models fail, return null to use fallback
  console.error(`❌ All ${models.length} models failed, using fallback message`);
  console.error(`🚨 All ${models.length} OpenRouter models failed, using fallback message`);
  return null;
};

/**
 * MessMenu Component
 * 
 * Displays the mess menu for a specific mess and meal type (veg/non-veg).
 * Fetches data from Firebase Firestore from either:
 * - messMenu collection (legacy)
 * - InstaMess collection (new format - single document with structured data)
 * 
 * Data is uploaded via the admin panel in:
 * - admin-portal/mess-menu-admin.html (legacy)
 * - admin-portal/insta-mess-admin.html (new format)
 */
// Using inline type definitions
type RootStackParamList = {
  MessMenu: { messName: string; mealType: string };
};
type MessMenuNavigationProp = any;

interface Dish {
  id?: string;
  name: string;
  messName?: string;
  messId?: string;
  day?: string;
  meal?: string;
  mealType?: string;
  calories?: number;
  type?: string;
  imageUrl?: string;
  description?: string;
  isVegetarian: boolean;
}

interface MealTimes {
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
}

const MEAL_TIMES: MealTimes = {
  breakfast: '07:30',
  lunch: '11:45',
  snacks: '16:30',
  dinner: '19:00'
};

const useHeartAnimation = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = () => {
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.3,
        duration: 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };
  return [scale, animate] as const;
};

const MessMenu: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MessMenuNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'MessMenu'>>();

  // Get parameters from route
  const { messName, mealType } = route.params;
  console.log('Route params:', { messName, mealType });
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const meals = ['breakfast', 'lunch', 'snacks', 'dinner'];
  
  // Helper function to get current day and meal
  const getCurrentDayAndMeal = (): { day: string; meal: string } => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    // Convert to our days array index (where Monday is the first day)
    const dayIndex = currentDay === 0 ? 6 : currentDay - 1;
    const currentDayName = days[dayIndex];
    
    // Determine current meal based on time
    const currentHour = now.getHours();
    let currentMeal: string;
    
    if (currentHour < 10) {
      currentMeal = 'breakfast';
    } else if (currentHour < 15) {
      currentMeal = 'lunch';
    } else if (currentHour < 18) {
      currentMeal = 'snacks';
    } else {
      currentMeal = 'dinner';
    }
    
    return { day: currentDayName, meal: currentMeal };
  };
  
  // Helper function to convert dish type to title case
  const toTitleCase = (text: string): string => {
    // Handle underscore or dash separated words
    const formattedText = text.replace(/[_-]/g, ' ');
    
    // Convert to title case (capitalize first letter of each word)
    return formattedText
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  
  // Get current day and meal
  const { day: currentDay, meal: currentMeal } = getCurrentDayAndMeal();
  console.log('Auto-selected day and meal:', { day: currentDay, meal: currentMeal });
  
  const [selectedDay, setSelectedDay] = useState<string>(currentDay);
  const [selectedMeal, setSelectedMeal] = useState<string>(currentMeal);
  const [loading, setLoading] = useState<boolean>(true);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const [showDayPicker, setShowDayPicker] = useState<boolean>(false);
  const [dishHearts, setDishHearts] = useState<{ [key: string]: number }>({});
  const [userHearts, setUserHearts] = useState<{ [key: string]: boolean }>({});
  const [currentUserId, setCurrentUserId] = useState<string>(''); // Replace with actual user ID logic

  // Heart animation state for each dish
  const heartAnimRefs = useRef<{ [key: string]: Animated.Value }>({});
  const getHeartAnim = (dishId: string) => {
    if (!heartAnimRefs.current[dishId]) {
      heartAnimRefs.current[dishId] = new Animated.Value(1);
    }
    return heartAnimRefs.current[dishId];
  };
  const animateHeart = (dishId: string) => {
    const anim = getHeartAnim(dishId);
    anim.setValue(1);
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1.3,
        duration: 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Helper: Get meal time window
  const getMealTimeWindow = (meal: string) => {
    const start = MEAL_TIMES[meal as keyof MealTimes];
    let end;
    if (meal === 'breakfast') end = MEAL_TIMES['lunch'];
    else if (meal === 'lunch') end = MEAL_TIMES['snacks'];
    else if (meal === 'snacks') end = MEAL_TIMES['dinner'];
    else end = '23:59';
    return { start, end };
  };

  // Helper: Is now in meal time window
  const isNowInMealTime = (meal: string) => {
    const now = new Date();
    const [startH, startM] = getMealTimeWindow(meal).start.split(':').map(Number);
    const [endH, endM] = getMealTimeWindow(meal).end.split(':').map(Number);
    const start = new Date(now);
    start.setHours(startH, startM, 0, 0);
    const end = new Date(now);
    end.setHours(endH, endM, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1); // handle overnight
    return now >= start && now < end;
  };

  const getDishes = (): any[] => {
    return dishes;
  };

  // Fetch hearts for all dishes for the selected day/meal/mess
  useEffect(() => {
    if (!messName || !selectedDay || !selectedMeal) return;
    const formattedMessName = messName.toLowerCase().replace(/\s+/g, '');
    const unsubscribes: (() => void)[] = [];
    getDishes().forEach((dish) => {
      const heartDocId = `${formattedMessName}_${dish.id}_${selectedDay}_${selectedMeal}`;
      const heartDocRef = doc(db, 'dishHearts', heartDocId);
      const unsub = onSnapshot(heartDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setDishHearts((prev) => ({ ...prev, [heartDocId]: docSnap.data().hearts || 0 }));
          if (currentUserId && docSnap.data().users) {
            setUserHearts((prev) => ({ ...prev, [heartDocId]: docSnap.data().users.includes(currentUserId) }));
          }
        } else {
          setDishHearts((prev) => ({ ...prev, [heartDocId]: 0 }));
          setUserHearts((prev) => ({ ...prev, [heartDocId]: false }));
        }
      });
      unsubscribes.push(unsub);
    });
    return () => { unsubscribes.forEach((u) => u()); };
  }, [messName, selectedDay, selectedMeal, getDishes().length, currentUserId]);

  // Heart button handler
  const handleHeart = async (dish: Dish) => {
    if (!currentUserId) return; // Require user ID
    const formattedMessName = messName.toLowerCase().replace(/\s+/g, '');
    const heartDocId = `${formattedMessName}_${dish.id}_${selectedDay}_${selectedMeal}`;
    const heartDocRef = doc(db, 'dishHearts', heartDocId);
    const docSnap = await getDoc(heartDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.users && data.users.includes(currentUserId)) {
        // User already liked: unlike (remove heart)
        await updateDoc(heartDocRef, {
          hearts: (data.hearts || 1) - 1,
          users: (data.users || []).filter((id: string) => id !== currentUserId),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Like (add heart)
        await updateDoc(heartDocRef, {
          hearts: (data.hearts || 0) + 1,
          users: [...(data.users || []), currentUserId],
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      await setDoc(heartDocRef, {
        hearts: 1,
        users: [currentUserId],
        messName: formattedMessName,
        dishId: dish.id,
        day: selectedDay,
        meal: selectedMeal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  // Function to schedule notification reminder
  const scheduleReminder = async (dish: Dish) => {
    try {
      // First, request notification permissions
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) {
        return;
      }
      
      const mealTime = MEAL_TIMES[selectedMeal as keyof MealTimes];
      const [hours, minutes] = mealTime.split(':').map(Number);
      
      // Calculate reminder time (45 minutes after meal starts - for "happening now" notifications)
      const totalMinutes = hours * 60 + minutes + 45; // Add 45 minutes to meal start time
      const reminderHour = Math.floor(totalMinutes / 60) % 24; // Handle day overflow
      const reminderMinutes = totalMinutes % 60;
      
      // Get the selected day index (0 = Monday, 1 = Tuesday, etc.)
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const dayIndex = days.indexOf(selectedDay);
      
      // Calculate the next occurrence of this day and time
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const targetDay = dayIndex === 6 ? 0 : dayIndex + 1; // Convert our format to Date format
      
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget <= 0) {
        daysUntilTarget += 7; // Next week if day has passed
      }
      
      const notificationDate = new Date();
      notificationDate.setDate(now.getDate() + daysUntilTarget);
      notificationDate.setHours(reminderHour, reminderMinutes, 0, 0);
      
      // Generate notification content with AI
      console.log('🤖 Starting AI notification generation...');
      const notificationContent = await generateNotificationContent(
        dish.name,
        selectedMeal,
        selectedDay,
        mealTime
      );
      console.log('✅ AI notification generation completed');
      
      // For demo purposes, schedule notification to show immediately
      // In production, you would calculate the correct time until the meal reminder
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Show immediately for demo
      });
      
      // Update reminders state
      const reminderId = `${dish.id}-${selectedDay}-${selectedMeal}`;
      setReminders(prev => new Set(prev).add(reminderId));
      
      // Show confirmation with the exact notification message
      Alert.alert(
        '🔔 Meal Alert Set!',
        `📱 NOTIFICATION PREVIEW:\n\n` +
        `🔥 Title: "${notificationContent.title}"\n\n` +
        `📝 Message: "${notificationContent.body}"\n\n` +
        `⏰ When: 45 minutes after ${selectedMeal} starts (${String(reminderHour).padStart(2, '0')}:${String(reminderMinutes).padStart(2, '0')})\n\n` +
        `📅 Next occurrence: ${notificationDate.toLocaleDateString()} at ${String(reminderHour).padStart(2, '0')}:${String(reminderMinutes).padStart(2, '0')}\n\n` +
        `Note: Using OpenRouter AI to make your reminders more engaging! 🚀`,
        [{ text: 'Awesome!' }]
      );
      
      console.log('Notification scheduled:', {
        id: notificationId,
        content: notificationContent,
        scheduledFor: notificationDate,
      });
      
      // Save alert to Firestore
      try {
        await addDoc(collection(db, 'alerts'), {
          type: 'mess',
          title: notificationContent.title,
          body: notificationContent.body,
          icon: 'restaurant-outline',
          time: new Date().toISOString(),
          read: false,
          dishName: dish.name,
          meal: selectedMeal,
          day: selectedDay,
          messName: messName,
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.error('Failed to save alert to Firestore:', e);
      }
    } catch (error) {
      console.error('Error scheduling reminder:', error);
      Alert.alert('Error', 'Failed to set reminder. Please try again.');
    }
  };

  const handleReminder = (dish: Dish) => {
    const reminderId = `${dish.id}-${selectedDay}-${selectedMeal}`;
    const isReminderSet = reminders.has(reminderId);
    
    if (isReminderSet) {
      Alert.alert(
        'Reminder Already Set',
        `You already have a reminder for "${dish.name}" on ${selectedDay} for ${selectedMeal}.`
      );
      return;
    }
    
    Alert.alert(
      'Set Meal Alert 🤖',
      `Would you like to get a "meal happening now" notification for "${dish.name}" during ${selectedMeal} on ${selectedDay}?\n\nWe'll use AI to make your reminder extra engaging! 🚀`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set Meal Alert', onPress: () => scheduleReminder(dish) }
      ]
    );
  };

  // Fetch dishes from Firestore
  useEffect(() => {
    setLoading(true);
    
    // Format the mess name to match Firestore exactly: lowercase, no spaces
    const formattedMessName = messName.toLowerCase().replace(/\s+/g, '');
    console.log('Querying with:', {
      messName: formattedMessName,
      day: selectedDay,
      meal: selectedMeal
    });
    
    const fetchMenu = async () => {
      try {
        // Try to fetch from the InstaMess collection (new format from JSON uploads)
        const instaMessRef = doc(db, 'InstaMess', 'menu');
        const instaMessDoc = await getDoc(instaMessRef);
        
        if (instaMessDoc.exists()) {
          console.log('Found InstaMess data, using new JSON format');
          const instaMessData = instaMessDoc.data();
          
          // Get the correct menu based on meal type (veg or nonveg)
          const menuType = mealType === 'veg' ? 'veg' : 'nonveg';
          const menuData = instaMessData[menuType];
          
          if (menuData && menuData[selectedMeal] && menuData[selectedMeal][selectedDay]) {
            // Transform to match Dish interface
            const dishList = menuData[selectedMeal][selectedDay].map((dish: any, index: number) => {
              return {
                id: `insta-${selectedDay}-${selectedMeal}-${index}`,
                name: dish.name,
                day: selectedDay,
                meal: selectedMeal,
                mealType: menuType,
                calories: dish.calories || 0,
                type: dish.type || '',
                imageUrl: dish.imageUrl || '',
                description: dish.description || '',
                isVegetarian: dish.isVegetarian !== undefined ? dish.isVegetarian : (menuType === 'veg')
              } as Dish;
            });
            
            console.log('InstaMess dishes:', dishList);
            setDishes(dishList);
            setLoading(false);
            return;
          } else {
            console.log(`No ${mealType} menu data for ${selectedMeal} on ${selectedDay}`);
          }
        }
        
        // Fallback to the legacy messMenu collection if InstaMess doesn't have data
        console.log('Falling back to legacy mess menu data');
        const messMenuRef = collection(db, 'messMenu');
        const q = query(
          messMenuRef,
          where('messName', '==', formattedMessName)
        );
        
        // First get all dishes for this mess
        const querySnapshot = await getDocs(q);
        console.log('Legacy dishes for mess:', querySnapshot.size);
        
        if (querySnapshot.size === 0) {
          console.log('No data found for mess:', formattedMessName);
          setDishes([]);
          setLoading(false);
          return;
        }

        // Then filter for current day and meal
        const dishList = querySnapshot.docs
          .map(doc => {
            const data = doc.data() as Dish;
            console.log('Raw dish data:', data);
            return {
              id: doc.id,
              ...data
            } as Dish;
          })
          .filter(dish => 
            dish.day === selectedDay && 
            dish.meal === selectedMeal
          );
        
        console.log('Filtered legacy dishes:', dishList);
        setDishes(dishList);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching menu:', error);
        alert('Failed to load menu data. Please check your connection.');
        setLoading(false);
      }
    };
    
    fetchMenu();
  }, [messName, selectedDay, selectedMeal, mealType]);

  useEffect(() => {
    if (auth.currentUser) {
      setCurrentUserId(auth.currentUser.uid);
    } else {
      // Optionally, listen for auth state changes
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) setCurrentUserId(user.uid);
        else setCurrentUserId('');
      });
      return unsubscribe;
    }
  }, []);
  
  const handleGoBack = () => {
    navigation.goBack();
  };

  const renderDayFilter = () => {
    const dayAbbreviations = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {days.map((day, index) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.filterItem,
              selectedDay === day ? styles.filterItemActive : null
            ]}
            onPress={() => setSelectedDay(day)}
          >
            <Text style={[
              styles.filterText,
              selectedDay === day ? styles.filterTextActive : null
            ]}>
              {dayAbbreviations[index]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderMealFilter = () => {
    const mealIcons = {
      breakfast: '🌅',
      lunch: '☀️',
      snacks: '🍪',
      dinner: '🌙'
    };
    
    const mealFullNames = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      snacks: 'Snacks',
      dinner: 'Dinner'
    };
    
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.mealFilterContainer}
      >
        {meals.map((meal) => (
          <TouchableOpacity
            key={meal}
            style={[
              styles.mealFilterItem,
              selectedMeal === meal ? styles.mealFilterItemActive : null
            ]}
            onPress={() => setSelectedMeal(meal)}
          >
            <Text style={styles.mealFilterIcon}>
              {mealIcons[meal as keyof typeof mealIcons]}
            </Text>
            <Text style={[
              styles.mealFilterText,
              selectedMeal === meal ? styles.mealFilterTextActive : null
            ]}>
              {mealFullNames[meal as keyof typeof mealFullNames]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderDayPickerModal = () => {
    const dayAbbreviations = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    return (
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={() => setShowDayPicker(false)}
      >
        <View style={styles.dayPickerModal}>
          <Text style={styles.dayPickerTitle}>Select Day</Text>
          {days.map((day, index) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayPickerItem,
                selectedDay === day ? styles.dayPickerItemActive : null
              ]}
              onPress={() => {
                setSelectedDay(day);
                setShowDayPicker(false);
              }}
            >
              <Text style={styles.dayPickerItemText}>{dayAbbreviations[index]}</Text>
              <Text style={styles.dayPickerItemFullText}>{dayNames[index]}</Text>
              {selectedDay === day && (
                <Ionicons name="checkmark" size={20} color="#3498db" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    setLoading(true);
    // Award points and badge for checking mess menu
    (async () => {
      await quickAwardPoints.messMenuCheck();
    })();
    // ... existing code ...
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
      <View style={styles.container}>
        {/* Modern Header with Gradient */}
        <View style={styles.headerContainer}>
          <View style={styles.headerCenteredRow}>
            <View style={styles.headerSide}>
              <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerCenterContent}>
              <Image
                source={require('../../assets/images/campus-life.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.headerTitle}>YOGO Campus</Text>
            </View>
            <View style={styles.headerSide} />
          </View>
          <View style={styles.subheader}>
            <Text style={styles.pageTitle}>Mess Menu</Text>
            <View style={styles.messHeaderInBlue}>
              <View style={styles.messIconContainer}>
                <Ionicons name="restaurant" size={20} color="#fff" />
              </View>
              <View style={styles.messInfoInBlue}>
                <Text style={styles.messNameInBlue}>{messName}</Text>
                <View style={styles.messTypeContainer}>
                  <View style={mealType === 'veg' ? styles.vegIndicatorWhite : styles.nonVegIndicatorWhite} />
                  <Text style={styles.messTypeInBlue}>{mealType === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Enhanced Meal Filters Section */}
        <View style={styles.enhancedFiltersSection}>
          {renderMealFilter()}
        </View>

        {/* Enhanced Dish List */}
        <ScrollView style={styles.dishList} contentContainerStyle={styles.dishListContent}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3498db" />
              <Text style={styles.loadingText}>Loading delicious menu...</Text>
            </View>
          ) : getDishes().length > 0 ? (
            <View style={styles.dishCardsContainer}>
              {getDishes().map((dish) => {
                const reminderId = `${dish.id}-${selectedDay}-${selectedMeal}`;
                const isReminderSet = reminders.has(reminderId);
                
                return (
                  <View key={dish.id} style={styles.dishCard}>
                    {/* Dish Image */}
                    <View style={styles.dishImageContainer}>
                      {dish.imageUrl ? (
                        <Image
                          source={{ uri: dish.imageUrl }}
                          style={styles.dishImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.dishImagePlaceholder}>
                          <Ionicons name="restaurant-outline" size={40} color="#ccc" />
                        </View>
                      )}
                      
                      {/* Veg/Non-veg indicator overlay */}
                      <View style={styles.dishTypeOverlay}>
                        <View style={
                          (dish.isVegetarian !== undefined) 
                            ? (dish.isVegetarian ? styles.vegIndicatorLarge : styles.nonVegIndicatorLarge)
                            : (mealType === 'veg' ? styles.vegIndicatorLarge : styles.nonVegIndicatorLarge)
                        } />
                      </View>
                    </View>

                    {/* Dish Info */}
                    <View style={styles.dishInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={styles.dishName}>{dish.name}</Text>
                        {selectedDay === currentDay && selectedMeal === currentMeal && isNowInMealTime(selectedMeal) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {/* Heart Button */}
                            <TouchableOpacity
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: userHearts[`${messName.toLowerCase().replace(/\s+/g, '')}_${dish.id}_${selectedDay}_${selectedMeal}`] ? '#ffeaea' : '#f3f3f3',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 8,
                                shadowColor: '#FF6B6B',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: userHearts[`${messName.toLowerCase().replace(/\s+/g, '')}_${dish.id}_${selectedDay}_${selectedMeal}`] ? 0.25 : 0.08,
                                shadowRadius: 4,
                                elevation: userHearts[`${messName.toLowerCase().replace(/\s+/g, '')}_${dish.id}_${selectedDay}_${selectedMeal}`] ? 3 : 1,
                              }}
                              onPress={() => {
                                handleHeart(dish);
                                animateHeart(`${dish.id}`);
                              }}
                            >
                              <Animated.View style={{ transform: [{ scale: getHeartAnim(`${dish.id}`) }] }}>
                                <Ionicons
                                  name={userHearts[`${messName.toLowerCase().replace(/\s+/g, '')}_${dish.id}_${selectedDay}_${selectedMeal}`] ? 'heart' : 'heart-outline'}
                                  size={24}
                                  color={userHearts[`${messName.toLowerCase().replace(/\s+/g, '')}_${dish.id}_${selectedDay}_${selectedMeal}`] ? '#FF3B30' : '#bbb'}
                                  style={{ textShadowColor: userHearts[`${messName.toLowerCase().replace(/\s+/g, '')}_${dish.id}_${selectedDay}_${selectedMeal}`] ? '#FF6B6B' : 'transparent', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}
                                />
                              </Animated.View>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      
                      {dish.description && (
                        <Text style={styles.dishDescription} numberOfLines={2}>
                          {dish.description}
                        </Text>
                      )}
                      
                      <View style={[styles.dishDetailsRow, { justifyContent: 'space-between', alignItems: 'center' }]}> 
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          {dish.calories && (
                            <View style={styles.detailChip}>
                              <Ionicons name="flame" size={14} color="#FF6B6B" />
                              <Text style={styles.detailChipText}>{dish.calories} cal</Text>
                            </View>
                          )}
                          {dish.type && (
                            <View style={styles.detailChip}>
                              <Ionicons name="restaurant" size={14} color="#4E9F3D" />
                              <Text style={styles.detailChipText}>{toTitleCase(dish.type)}</Text>
                            </View>
                          )}
                        </View>
                        {(dishHearts[`${messName.toLowerCase().replace(/\s+/g, '')}_${dish.id}_${selectedDay}_${selectedMeal}`] >= 75 && (
                          <View style={{ backgroundColor: '#FFD700', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8, alignSelf: 'center' }}>
                            <Text style={{ color: '#2c3e50', fontWeight: '700', fontSize: 12 }}>Crowd Favorite</Text>
                          </View>
                        ))}
                      </View>

                      {/* Remind Button */}
                      <TouchableOpacity 
                        style={[
                          styles.remindButton, 
                          isReminderSet && styles.remindButtonActive
                        ]}
                        onPress={() => handleReminder(dish)}
                      >
                        <Ionicons 
                          name={isReminderSet ? "notifications" : "notifications-outline"} 
                          size={16} 
                          color={isReminderSet ? "#fff" : "#3498db"} 
                        />
                        <Text style={[styles.remindButtonText, isReminderSet && styles.remindButtonTextActive]}>
                          {isReminderSet ? "Reminder Set" : "Remind Me"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <View style={styles.noDataIcon}>
                <Ionicons name="restaurant-outline" size={60} color="#ccc" />
              </View>
              <Text style={styles.noDataText}>No menu available</Text>
              <Text style={styles.noDataSubtext}>Try selecting a different day or meal</Text>
            </View>
          )}
        </ScrollView>

        {/* Floating Day Picker Button */}
        <TouchableOpacity 
          style={styles.dayFloatingButton}
          onPress={() => setShowDayPicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color="#fff" />
          <Text style={styles.dayFloatingButtonText}>
            {selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1, 3)}
          </Text>
        </TouchableOpacity>

        {/* Day Picker Modal */}
        {showDayPicker && renderDayPickerModal()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  // Enhanced Header Styles
  headerContainer: {
    backgroundColor: '#3498db',
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  logo: {
    width: 28,
    height: 28,
    marginHorizontal: 12,
    tintColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  subheader: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  
  // Mess details in blue header
  messHeaderInBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  messIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messInfoInBlue: {
    flex: 1,
    marginLeft: 12,
  },
  messNameInBlue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  messTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messTypeInBlue: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 8,
  },
  
  // White indicators for blue header
  vegIndicatorWhite: {
    width: 10,
    height: 10,
    backgroundColor: '#27ae60',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fff',
  },
  nonVegIndicatorWhite: {
    width: 10,
    height: 10,
    backgroundColor: '#e74c3c',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fff',
  },
  
  // Enhanced Mess Details Card (remove old styles)
  
  // Compact Filter Styles - Only Meal
  filtersSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  enhancedFiltersSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  filterGroup: {
    flex: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterMainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginLeft: 8,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  filterScroll: {
    marginBottom: 0,
  },
  filterContainer: {
    paddingRight: 4,
  },
  filterItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  filterItemActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  filterText: {
    color: '#495057',
    fontSize: 12,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Meal Filter Styles
  mealFilterContainer: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealFilterItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    minWidth: 80,
  },
  mealFilterItemActive: {
    backgroundColor: '#3498db',
  },
  mealFilterIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  mealFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  mealFilterTextActive: {
    color: '#fff',
  },
  
  // Floating Day Button Styles
  dayFloatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#3498db',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 1000,
  },
  dayFloatingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Day Picker Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  dayPickerModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    maxHeight: '80%',
    minWidth: 280,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  dayPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  dayPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  dayPickerItemActive: {
    backgroundColor: '#e8f4fd',
    borderWidth: 1,
    borderColor: '#3498db',
  },
  dayPickerItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    width: 40,
  },
  dayPickerItemFullText: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
    marginLeft: 12,
  },
  
  // Enhanced Dish List
  dishList: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  dishListContent: {
    padding: 16,
    paddingTop: 8,
  },
  dishCardsContainer: {
    flexDirection: 'column',
  },
  dishCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dishImageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
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
  dishTypeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 6,
  },
  dishInfo: {
    padding: 16,
  },
  dishName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
  },
  dishDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
    marginBottom: 12,
  },
  dishDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  detailChipText: {
    fontSize: 12,
    color: '#495057',
    marginLeft: 6,
    fontWeight: '500',
  },
  
  // Remind Button
  remindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  remindButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  remindButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
    marginLeft: 8,
  },
  remindButtonTextActive: {
    color: '#fff',
  },
  
  // Indicators
  vegIndicator: {
    width: 12,
    height: 12,
    backgroundColor: '#27ae60',
    borderRadius: 6,
  },
  nonVegIndicator: {
    width: 12,
    height: 12,
    backgroundColor: '#e74c3c',
    borderRadius: 6,
  },
  vegIndicatorLarge: {
    width: 16,
    height: 16,
    backgroundColor: '#27ae60',
    borderRadius: 8,
  },
  nonVegIndicatorLarge: {
    width: 16,
    height: 16,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
  },
  
  // Loading and No Data
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  noDataIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  headerCenteredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  headerSide: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});

export default MessMenu;
