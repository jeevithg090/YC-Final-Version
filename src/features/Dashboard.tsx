import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  FlatList,
  TextInput,
  Animated,
  Platform,
  Dimensions,
  Easing,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
  Modal,
  View as RNView
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useWeather } from '../hooks/useWeather';
import { RootStackParamList } from '../navigation/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiKeysService from '../services/apiKeysService';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { db } from '../services/firebase';
import { collection, getDocs, query, orderBy, onSnapshot, limit, doc, getDoc, where } from 'firebase/firestore';
import { TimetableData, ExtractedTimetable, ClassEntry } from '../types/timetable';
import { EventData, getLatestEvent } from './Events';
import AskAIBot from './AskAIBot';
import Alerts from './Alerts';
// import QnAIcon from '../../assets/images/qna.png'; // Commented out due to missing module
import { auth } from '../services/firebase'; // <-- Add this import
import { Collapsible } from '../../components/Collapsible';
import calendarDataRaw from '../../MITCalendar.json';
// Replace import ... from ... for badges with require()
const BeginnerBadge = require('../../assets/Badges-Points/Beginner.png');
const ExplorerBadge = require('../../assets/Badges-Points/Explorer.png');
const ProdigyBadge = require('../../assets/Badges-Points/Prodigy.png');
const MasterBadge = require('../../assets/Badges-Points/Master.png');
const LegendBadge = require('../../assets/Badges-Points/Legend.png');
import { getUserPoints, UserPoints, updateStreakOnDashboardVisit } from '../services/pointsService';
const OGUserBadge = require('../../assets/Badges/OgUser.png');
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// TypeScript interfaces for the data
interface MessMenu {
  meal: string;
  items: string[];
  time: string;
}

interface ClassAlert {
  subject: string;
  time: string;
  room: string;
}

interface EventItem {
  title: string;
  time: string;
  location: string;
}

interface WeatherInfo {
  temperature: number;
  condition: string;
  icon: string;
  location?: string;
}

interface NextClassInfo {
  subject: string;
  startTime: string;
  endTime: string;
  room?: string;
  professor?: string;
  dayOfWeek: string;
  minutesUntilStart: number;
  isToday: boolean;
}

interface HighlightCard {
  id: string;
  type: 'mess' | 'class' | 'event' | 'weather' | 'sports' | 'todayClass';
  data: MessMenu | ClassAlert | EventItem | WeatherInfo | NextClassInfo;
}

// TypeScript types for navigation
type DashboardNavigationProp = StackNavigationProp<RootStackParamList>;

// Helper to convert hex color to rgba
function hexToRgba(hex: string, alpha: number) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const Dashboard: React.FC = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'home' | 'social' | 'explore' | 'rides' | 'notifications'>('home');
  const [highlightCards, setHighlightCards] = useState<HighlightCard[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'mentions' | 'system' | 'club'>('all');
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [nextClassInfo, setNextClassInfo] = useState<NextClassInfo | null>(null);
  const { weatherData, loading: weatherLoading } = useWeather();
  const [latestEvent, setLatestEvent] = useState<EventData | null>(null);
  
  // Recent activities state
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  
  // Animation values for interactions
  const [quickActionAnimations] = useState([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1)
  ]);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [productChats, setProductChats] = useState<any[]>([]);
  const [roommateChats, setRoommateChats] = useState<any[]>([]);
  const [loadingProductChats, setLoadingProductChats] = useState<boolean>(true);
  const [loadingRoommateChats, setLoadingRoommateChats] = useState<boolean>(true);

  // Add state for leaderboard modal and data
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<{ uid: string, name: string, points: number }[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const rankThresholds = [
    { name: 'Beginner', min: 0, max: 800, badge: BeginnerBadge, color: '#34C759' },
    { name: 'Explorer', min: 801, max: 2000, badge: ExplorerBadge, color: '#007AFF' },
    { name: 'Prodigy', min: 2001, max: 4000, badge: ProdigyBadge, color: '#8E44AD' },
    { name: 'Master', min: 4001, max: 6500, badge: MasterBadge, color: '#FFB300' },
    { name: 'Legend', min: 6501, max: Infinity, badge: LegendBadge, color: '#FF3B30' },
  ];

  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [pointsLoading, setPointsLoading] = useState(true);
  // State for badge modal visibility
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  // Add at the top-level of Dashboard component
  const [badgeCarouselIndex, setBadgeCarouselIndex] = useState(0);
  const badgeCarouselRef = useRef<ScrollView>(null);

  const [isOGUser, setIsOGUser] = useState<boolean>(false);
  // Add state to track which badge is selected for the modal
  const [selectedBadge, setSelectedBadge] = useState<'planner' | 'oguser'>('planner');

  const insets = useSafeAreaInsets();

  // Load timetable data from Firebase or AsyncStorage
  const loadTimetableData = async (): Promise<TimetableData | null> => {
    try {
      // First try to load from Firebase
      const timetablesRef = collection(db, 'extracted_timetables');
      const q = query(timetablesRef, orderBy('extractionDate', 'desc'));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const latestTimetable = querySnapshot.docs[0].data() as ExtractedTimetable;
        setTimetableData(latestTimetable.extractedData);
        return latestTimetable.extractedData;
      }
      
      // Fallback to AsyncStorage
      const savedTimetable = await AsyncStorage.getItem('timetableData');
      if (savedTimetable) {
        const parsedTimetable = JSON.parse(savedTimetable) as TimetableData;
        setTimetableData(parsedTimetable);
        return parsedTimetable;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading timetable data:', error);
      return null;
    }
  };

  // Parse time string (e.g., "10:30 AM") to minutes since midnight
  const parseTime = (timeString: string): number => {
    try {
      const [time, period] = timeString.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      
      let totalMinutes = hours * 60 + minutes;
      
      if (period && period.toUpperCase() === 'PM' && hours !== 12) {
        totalMinutes += 12 * 60;
      } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
        totalMinutes = minutes;
      }
      
      return totalMinutes;
    } catch (error) {
      console.error('Error parsing time:', timeString);
      return 0;
    }
  };

  // Calculate next class based on current time and date
  const calculateNextClass = (timetableData: TimetableData): NextClassInfo | null => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes
    
    // Map days to our timetable format
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Look for classes today first
    const today = dayNames[currentDay];
    const todaySchedule = timetableData.days.find(day => 
      day.day.toLowerCase() === today.toLowerCase()
    );
    
    if (todaySchedule && todaySchedule.classes.length > 0) {
      // Sort classes by start time
      const sortedClasses = [...todaySchedule.classes].sort((a, b) => {
        return parseTime(a.startTime) - parseTime(b.startTime);
      });
      
      // Find next class today
      for (const classItem of sortedClasses) {
        const classStartTime = parseTime(classItem.startTime);
        if (classStartTime > currentTime) {
          return {
            subject: classItem.subject,
            startTime: classItem.startTime,
            endTime: classItem.endTime,
            room: classItem.room,
            professor: classItem.professor,
            dayOfWeek: today,
            minutesUntilStart: classStartTime - currentTime,
            isToday: true
          };
        }
      }
    }
    
    // If no class today, look for next day with classes
    for (let i = 1; i < 7; i++) {
      const nextDayIndex = (currentDay + i) % 7;
      const nextDay = dayNames[nextDayIndex];
      const nextDaySchedule = timetableData.days.find(day => 
        day.day.toLowerCase() === nextDay.toLowerCase()
      );
      
      if (nextDaySchedule && nextDaySchedule.classes.length > 0) {
        const sortedClasses = [...nextDaySchedule.classes].sort((a, b) => {
          return parseTime(a.startTime) - parseTime(b.startTime);
        });
        
        const firstClass = sortedClasses[0];
        const classStartTime = parseTime(firstClass.startTime);
        const minutesUntilStart = (i * 24 * 60) + classStartTime - currentTime;
        
        return {
          subject: firstClass.subject,
          startTime: firstClass.startTime,
          endTime: firstClass.endTime,
          room: firstClass.room,
          professor: firstClass.professor,
          dayOfWeek: nextDay,
          minutesUntilStart: minutesUntilStart,
          isToday: false
        };
      }
    }
    
    return null;
  };

  // Format minutes until class to readable string
  const formatTimeUntilClass = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else if (minutes < 1440) // Less than 24 hours
    {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      }
      return `${hours}h ${remainingMinutes}m`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  };

  // Get current meal based on time of day
  const getCurrentMeal = (): { 
    meal: 'Breakfast' | 'Lunch' | 'Snacks' | 'Dinner'; 
    isServing: boolean;
    timing: string; 
  } => {
    const now = new Date();
    const hours = now.getHours() + (now.getMinutes() / 60);
    
    // Define meal times (24-hour format)
    const mealTimes = {
      // Initialize API keys from Firestore
      try {
        await apiKeysService.initialize();
        console.log('API keys initialized in Dashboard');
      } catch (error) {
        console.error('Failed to initialize API keys in Dashboard:', error);
      }
      
      breakfast: { start: 7, end: 9.5, display: "7:00 AM - 9:30 AM" },     // 7:00 AM - 9:30 AM
      lunch: { start: 11.75, end: 14.25, display: "11:45 AM - 2:15 PM" },  // 11:45 AM - 2:15 PM
      snacks: { start: 16.5, end: 18, display: "4:30 PM - 6:00 PM" },      // 4:30 PM - 6:00 PM
      dinner: { start: 19, end: 21.5, display: "7:00 PM - 9:30 PM" },      // 7:00 PM - 9:30 PM
    };
    
    // Check which meal is currently being served
    if (hours >= mealTimes.breakfast.start && hours < mealTimes.breakfast.end) {
      return { meal: 'Breakfast', isServing: true, timing: mealTimes.breakfast.display };
    } else if (hours >= mealTimes.lunch.start && hours < mealTimes.lunch.end) {
      return { meal: 'Lunch', isServing: true, timing: mealTimes.lunch.display };
    } else if (hours >= mealTimes.snacks.start && hours < mealTimes.snacks.end) {
      return { meal: 'Snacks', isServing: true, timing: mealTimes.snacks.display };
    } else if (hours >= mealTimes.dinner.start && hours < mealTimes.dinner.end) {
      return { meal: 'Dinner', isServing: true, timing: mealTimes.dinner.display };
    }
    
    // If no meal is currently being served, determine the next meal
    if (hours < mealTimes.breakfast.start || hours >= mealTimes.dinner.end) {
      return { meal: 'Breakfast', isServing: false, timing: mealTimes.breakfast.display };
    } else if (hours >= mealTimes.breakfast.end && hours < mealTimes.lunch.start) {
      return { meal: 'Lunch', isServing: false, timing: mealTimes.lunch.display };
    } else if (hours >= mealTimes.lunch.end && hours < mealTimes.snacks.start) {
      return { meal: 'Snacks', isServing: false, timing: mealTimes.snacks.display };
    } else {
      return { meal: 'Dinner', isServing: false, timing: mealTimes.dinner.display };
    }
  };

  // Helper to get greeting based on time
  const getTimeBasedGreeting = () => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Initialize data on component mount
  useEffect(() => {
    const initializeData = async () => {
      const date = new Date();
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      };
      setCurrentDate(date.toLocaleDateString('en-US', options));
      
      // Load timetable data
      const timetable = await loadTimetableData();
      
      // Fetch latest event from Events module
      const event = await getLatestEvent();
      setLatestEvent(event);
      
      if (timetable) {
        setTimetableData(timetable);
        const nextClass = calculateNextClass(timetable);
        setNextClassInfo(nextClass);
        
        // Create initial highlight cards with next class if available
        const cards: HighlightCard[] = [];
        
        // Add next class card
        if (nextClass) {
          cards.push({
            id: 'next-class',
            type: 'class',
            data: nextClass
          });
        }
        
        // Mock mess data
        cards.push({
          id: 'mess-menu',
          type: 'mess',
          data: {
            meal: 'Lunch',
            items: ['Vegetable Biryani', 'Paneer Butter Masala', 'Roti', 'Salad', 'Ice Cream'],
            time: '12:30 PM - 2:30 PM'
          }
        });
        
        // Add event data from Events.tsx
        cards.push({
          id: 'event-card',
          type: 'event',
          data: {
            title: event ? event.title : 'No upcoming events',
            time: event ? event.time : 'N/A',
            location: event ? event.location : 'N/A'
          }
        });
        
        // Add weather card if available
        if (weatherData) {
          cards.push({
            id: 'today-class-card',
            type: 'todayClass',
            data: {
              subject: 'Today\'s Algorithm Design',
              startTime: '2:30 PM',
              room: 'NLH-301',
              minutesUntilStart: 120,
              isToday: true,
              dayOfWeek: 'Today'
            } as NextClassInfo
          });
        }
        
        setHighlightCards(cards);
      } else {
        // Mock data if no timetable available
        setHighlightCards([
          {
            id: '1',
            type: 'mess',
            data: {
              meal: 'Lunch',
              items: ['Basmati Rice', 'Dal Tadka', 'Paneer Butter Masala', 'Fresh Fruit Salad'],
              time: '12:00 PM - 2:00 PM'
            } as MessMenu
          },
          {
            id: '2',
            type: 'class',
            data: {
              subject: 'Data Structures & Algorithms',
              time: '10:30 AM',
              room: 'CS-301'
            } as ClassAlert
          },
          {
            id: '3',
            type: 'event',
            data: {
              title: 'Tech Innovation Meetup',
              time: '5:30 PM',
              location: 'Innovation Center'
            } as EventItem
          },
          {
            id: '4',
            type: 'todayClass',
            data: {
              subject: 'Today\'s Algorithm Design',
              startTime: '2:30 PM',
              room: 'NLH-301',
              minutesUntilStart: 120,
              isToday: true,
              dayOfWeek: 'Today'
            } as NextClassInfo
          }
        ]);
      }
    };

    initializeData();

    // Enhanced mock data for notifications
    setNotifications([
      { 
        id: '1', 
        type: 'event', 
        title: '🚀 Hackathon registration closes in 2 hours', 
        icon: 'code-slash-outline', 
        time: '2h ago',
        read: false
      },
      { 
        id: '2', 
        type: 'study', 
        title: '📚 New study material shared in DBMS group', 
        icon: 'book-outline', 
        time: '3h ago',
        read: false
      },
      { 
        id: '3', 
        type: 'roommate', 
        title: '🏠 Your roommate request has been accepted!', 
        icon: 'home-outline', 
        time: '5h ago',
        read: false
      },
      { 
        id: '4', 
        type: 'mess', 
        title: '🍽️ Tomorrow\'s mess menu has been updated', 
        icon: 'restaurant-outline', 
        time: '1d ago',
        read: true
      },
    ]);
  }, [weatherData]);

  // Reset to home tab when screen is focused (user returns from other screens)
  useFocusEffect(
    React.useCallback(() => {
      setActiveTab('home');
    }, [])
  );

  // Listen for recent activities
  useEffect(() => {
    const q = query(collection(db, 'recent_activities'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecentActivities(activities);
    }, (error) => {
      console.error('Error listening to recent activities:', error);
      // Fallback to empty array if there's an error
      setRecentActivities([]);
    });
    
    return () => unsubscribe();
  }, []);

  // Fetch user name from Firebase Auth on mount
  useEffect(() => {
    const fetchUserName = () => {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.displayName) {
        setUserName(currentUser.displayName);
      } else if (currentUser && currentUser.email) {
        setUserName(currentUser.email.split('@')[0]);
      } else {
        setUserName('User'); // fallback to generic if not logged in
      }
    };
    fetchUserName();
  }, []);

  // Fetch product chats for current user
  useEffect(() => {
    const fetchChats = async () => {
      setLoadingProductChats(true);
      const user = auth.currentUser;
      if (!user) {
        setProductChats([]);
        setLoadingProductChats(false);
        return;
      }
      const userId = user.uid;
      const chatsRef = collection(db, 'product_chats');
      const q1 = query(chatsRef, where('buyerId', '==', userId));
      const q2 = query(chatsRef, where('sellerId', '==', userId));
      const [buyerSnap, sellerSnap] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const allDocs = [...buyerSnap.docs, ...sellerSnap.docs];
      const threads: any[] = [];
      for (const docSnap of allDocs) {
        const data = docSnap.data();
        // Get last message
        const messagesRef = collection(db, 'product_chats', docSnap.id, 'messages');
        const messagesSnap = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(1)));
        let lastMessage = '';
        let lastMessageTime = 0;
        if (!messagesSnap.empty) {
          const msg = messagesSnap.docs[0].data();
          lastMessage = msg.content || '';
          lastMessageTime = msg.createdAt || 0;
        }
        // Determine other user
        let otherUserId = data.buyerId === userId ? data.sellerId : data.buyerId;
        let otherUserName = data.buyerId === userId ? data.sellerName : data.buyerName;
        let otherUserProfileImage = undefined;
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
        if (otherUserDoc.exists()) {
          otherUserProfileImage = otherUserDoc.data().profileImage;
        }
        threads.push({
          chatId: docSnap.id,
          type: 'product',
          productId: data.productId,
          productTitle: data.productTitle,
          productImage: data.productImage,
          buyerId: data.buyerId,
          buyerName: data.buyerName,
          sellerId: data.sellerId,
          sellerName: data.sellerName,
          lastMessage,
          lastMessageTime,
          otherUser: { id: otherUserId, name: otherUserName, profileImage: otherUserProfileImage },
        });
      }
      threads.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setProductChats(threads);
      setLoadingProductChats(false);
    };
    fetchChats();
  }, []);

  // Fetch roommate chats for current user
  useEffect(() => {
    const fetchRoommateChats = async () => {
      setLoadingRoommateChats(true);
      const user = auth.currentUser;
      if (!user) {
        setRoommateChats([]);
        setLoadingRoommateChats(false);
        return;
      }
      const userId = user.uid;
      const chatsRef = collection(db, 'roommate_chats');
      const q1 = query(chatsRef, where('userAId', '==', userId));
      const q2 = query(chatsRef, where('userBId', '==', userId));
      const [aSnap, bSnap] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const allDocs = [...aSnap.docs, ...bSnap.docs];
      const threads: any[] = [];
      for (const docSnap of allDocs) {
        const data = docSnap.data();
        // Get last message
        const messagesRef = collection(db, 'roommate_chats', docSnap.id, 'messages');
        const messagesSnap = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(1)));
        let lastMessage = '';
        let lastMessageTime = 0;
        if (!messagesSnap.empty) {
          const msg = messagesSnap.docs[0].data();
          lastMessage = msg.content || '';
          lastMessageTime = msg.createdAt || 0;
        }
        // Determine other user
        let otherUserId = data.userAId === userId ? data.userBId : data.userAId;
        let otherUserName = data.userAId === userId ? data.userBName : data.userAName;
        let otherUserProfileImage = data.userAId === userId ? data.userBProfileImage : data.userAProfileImage;
        threads.push({
          chatId: docSnap.id,
          type: 'roommate',
          listingId: data.listingId,
          userAId: data.userAId,
          userAName: data.userAName,
          userBId: data.userBId,
          userBName: data.userBName,
          lastMessage,
          lastMessageTime,
          otherUser: { id: otherUserId, name: otherUserName, profileImage: otherUserProfileImage },
        });
      }
      threads.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      setRoommateChats(threads);
      setLoadingRoommateChats(false);
    };
    fetchRoommateChats();
  }, []);

  // Merge product and roommate chats
  const allChats = [...productChats, ...roommateChats].sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  const loadingAllChats = loadingProductChats || loadingRoommateChats;

  // Render a highlight card with modern design
  const renderHighlightCard = ({ item }: { item: HighlightCard }) => {
    const getCardColors = (type: string) => {
      switch (type) {
        case 'mess':
          return {
            gradient: ['#FFE5E5', '#FFF0F0'] as const,
            accent: '#FF6B6B',
            icon: 'restaurant-outline'
          };
        case 'class':
        case 'todayClass':
          return {
            gradient: ['#E8F2FF', '#F0F8FF'] as const,
            accent: '#4E54C8',
            icon: 'school-outline'
          };
        case 'event':
          return {
            gradient: ['#E8F5E8', '#F0FAF0'] as const,
            accent: '#38B000',
            icon: 'calendar-outline'
          };
        default:
          return {
            gradient: ['#F5F5F5', '#FAFAFA'] as const,
            accent: '#999',
            icon: 'information-circle-outline'
          };
      }
    };

    const colors = getCardColors(item.type);

    switch (item.type) {
      case 'mess':
        return (
          <TouchableOpacity
            onPress={() => {
              handleTabNavigation('MessOption');
            }}
            style={styles.modernCardWrapper}
          >
          <LinearGradient
            colors={colors.gradient}
            style={styles.modernCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: colors.accent + '20' }]}>
                <Ionicons name={colors.icon as any} size={24} color={colors.accent} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.cardTitle}>Today's Mess</Text>
                {(() => {
                  const { meal, isServing } = getCurrentMeal();
                  return (
                    <Text style={styles.cardSubtitle}>
                      {isServing ? `Serving ${meal} Now` : `${meal} Around the Corner`}
                    </Text>
                  );
                })()}
              </View>
            </View>
            <View style={styles.cardContent}>
              {(() => {
                const { meal, timing } = getCurrentMeal();
                return (
                  <Text style={styles.timeText}>{meal} Timings: {timing}</Text>
                );
              })()}
              <TouchableOpacity
                style={[styles.checkButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  navigation.navigate('MessOption');
                }}
              >
                <Text style={styles.checkButtonText}>Check what's cooking!</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          </TouchableOpacity>
        );
      
      case 'class':
      case 'todayClass':
        // Clean and concise class card
        return (
          <TouchableOpacity
            onPress={() => handleTabNavigation('ClassNotification')}
            style={styles.modernCardWrapper}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={colors.gradient}
              style={styles.modernCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: colors.accent + '20' }]}>
                  <Ionicons name={colors.icon as any} size={24} color={colors.accent} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.cardTitle}>Class Schedule</Text>
                  <Text style={styles.cardSubtitle}>Stay updated with your classes</Text>
                </View>
              </View>
              
              <View style={styles.cardContent}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.accent }]}
                  onPress={() => handleTabNavigation('ClassNotification')}
                >
                  <Text style={styles.actionButtonText}>View Schedule</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        );
      case 'event':
        const eventData = item.data as EventItem;
        return (
          <TouchableOpacity
            onPress={() => {
              if (latestEvent) {
                handleTabNavigation('Events');
              }
            }}
            style={styles.modernCardWrapper}
          >
          <LinearGradient
            colors={colors.gradient}
            style={styles.modernCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: colors.accent + '20' }]}>
                <Ionicons name={colors.icon as any} size={24} color={colors.accent} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.cardTitle}>Upcoming Events</Text>
                <Text style={styles.cardSubtitle}>Don't miss out!</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.eventName}>
                {latestEvent ? latestEvent.title : eventData.title}
              </Text>
              <View style={styles.eventDetailsRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>{eventData.time}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="location-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>{eventData.location}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  if (latestEvent) {
                    handleTabNavigation('Events');
                  }
                }}
              >
                <Text style={styles.actionButtonText}>View Details</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          </TouchableOpacity>
        );
      
      default:
        return null;
    }
  };

  // Features for explore tab
  const features = [
    { id: '1', name: 'Mess Notification', icon: 'restaurant', color: '#ff6b6b' },
    { id: '2', name: 'Class Notification', icon: 'school', color: '#4e54c8' },
    { id: '3', name: 'Events', icon: 'calendar', color: '#f9c74f' },
    { id: '4', name: 'Club Recruitment', icon: 'people', color: '#5856d6' },
    { id: '5', name: 'Marketplace', icon: 'cart', color: '#43aa8b' },
    { id: '6', name: 'Study Groups', icon: 'library', color: '#277da1' },
    { id: '7', name: 'Lost and Found', icon: 'search', color: '#f8961e' },
    { id: '8', name: 'Restaurants', icon: 'storefront', color: '#ff8c00' },
    { id: '9', name: 'Sports', icon: 'football', color: '#3a86ff' },
    { id: '10', name: 'Previous Year Papers', icon: 'document-text', color: '#8b5cf6' },
    { id: '11', name: 'Auto Pooling', icon: 'people-circle', color: '#6B73FF' },
    { id: '12', name: 'Cab Share', icon: 'car', color: '#4ECDC4' },
    { id: '13', name: 'Your Rides', icon: 'list-circle', color: '#FF6B9D' },
    { id: '14', name: 'Smart Split', icon: 'calculator', color: '#FF9500' },
    { id: '15', name: 'Roommate Finder', icon: 'bed', color: '#E91E63' },
    { id: '16', name: 'QnA Forum', icon: 'help-circle', color: '#9B59B6' },
    { id: '17', name: 'Academic Calendar', icon: 'calendar-clear', color: '#00B894' },
  ];

  // Handle navigation from bottom tabs with proper back navigation
  const handleTabNavigation = (screenName: keyof RootStackParamList, params?: any) => {
    // Reset navigation stack to Dashboard first, then navigate to the screen
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Dashboard' },
        { name: screenName, params }
      ],
    });
  };

  // Animated Quick Actions with touch feedback
  const animateQuickAction = (index: number) => {
    Animated.sequence([
      Animated.timing(quickActionAnimations[index], {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(quickActionAnimations[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Handle feature navigation with proper back navigation
  const handleFeaturePress = (featureName: string) => {
    console.log(`Handling feature press for: ${featureName}`);
    switch (featureName) {
      case 'Mess Notification':
        console.log('Navigating to MessOption...');
        handleTabNavigation('MessOption');
        break;
      case 'Class Notification':
        handleTabNavigation('ClassNotification');
        break;
      case 'Marketplace':
        handleTabNavigation('Marketplace');
        break;
      case 'Lost and Found':
        handleTabNavigation('LostAndFound');
        break;
      case 'Timetable':
        handleTabNavigation('DailyTimetable', { timetableData });
        break;
      case 'Restaurants':
        handleTabNavigation('Restaurants');
        break;
      case 'Mess Menu':
        handleTabNavigation('MessNotification');
        break;
      case 'Today\'s Class':
        handleTabNavigation('DailyTimetable', { timetableData });
        break;
      case 'Sports':
        console.log(`Navigate to Sports Place`);
        handleTabNavigation('SportsPlace');
        break;
      case 'Previous Year Papers':
        handleTabNavigation('PreviousYearPapers');
        break;
      case 'Auto Pooling':
        handleTabNavigation('AutoShare');
        break;
      case 'Cab Share':
        handleTabNavigation('CabShare');
        break;
      case 'Your Rides':
        handleTabNavigation('YourRides');
        break;
      case 'Events':
        handleTabNavigation('Events');
        break;
      case 'Smart Split':
        handleTabNavigation('SmartSplit');
        break;
      case 'Roommate Finder':
        handleTabNavigation('RoommateFinder');
        break;
      case 'Study Groups':
        handleTabNavigation('StudyGroups');
        break;
      case 'QnA Forum':
        handleTabNavigation('QnaForum');
        break;
      case 'Club Recruitment':
        handleTabNavigation('ClubRecruitment');
        break;
      case 'Ask AI':
        handleTabNavigation('AskAIBot');
        break;
      case 'Academic Calendar':
        handleTabNavigation('AcademicCalendar');
        break;

      // Add more cases as needed
      default:
        console.log(`Navigate to ${featureName}`);
    }
  };

  const renderFeatureItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      style={styles.featureItem}
      onPress={() => {
        animateQuickAction(index % 4);
        try {
          handleFeaturePress(item.name);
        } catch (error) {
          console.error('Navigation error:', error);
        }
      }}
    >
      <Animated.View
        style={[
          styles.quickActionGradient,
          {
            transform: [{ scale: quickActionAnimations[index % 4] }],
          },
        ]}
      >
        <LinearGradient
          colors={[item.color + '20', item.color + '10']}
          style={styles.featureIcon}
        >
          {item.name === 'QnA Forum' && item.image ? (
            <Image source={item.image} style={{ width: 40, height: 40, resizeMode: 'contain' }} />
          ) : (
            <Ionicons name={item.icon as any} size={28} color={item.color} />
          )}
        </LinearGradient>
      </Animated.View>
      <Text style={styles.featureName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderQuickActions = () => {
    const quickActions = [
      { name: 'Mess Menu', icon: 'restaurant-outline', color: '#FF6B6B' },
      { name: 'Timetable', icon: 'calendar-outline', color: '#4E54C8' },
      { name: 'Marketplace', icon: 'storefront-outline', color: '#38B000' },
      { name: 'Today\'s Class', icon: 'today-outline', color: '#4E54C8' },
    ];

    return (
      <View style={styles.modernQuickActions}>
        {quickActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickActionItem}
            onPress={() => {
              animateQuickAction(index);
              handleFeaturePress(action.name);
            }}
          >
            <Animated.View
              style={[
                styles.quickActionButton,
                {
                  transform: [{ scale: quickActionAnimations[index] }],
                },
              ]}
            >
              <LinearGradient
                colors={[action.color + '20', action.color + '10']}
                style={styles.quickActionGradient}
              >
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </LinearGradient>
            </Animated.View>
            <Text style={styles.quickActionLabel}>{action.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTabBar = () => (
    <View style={styles.modernTabBarContainer}> {/* Removed paddingBottom: insets.bottom */}
      <BlurView intensity={95} tint="light" style={styles.modernTabBar}>
        {/* Home Tab */}
        <TouchableOpacity
          style={styles.modernTabButton}
          onPress={() => setActiveTab('home')}
        >
          <View style={[styles.tabIndicator, activeTab === 'home' && styles.activeTabIndicator]} />
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={22}
            color={activeTab === 'home' ? '#4E54C8' : '#8E8E93'}
          />
          <Text style={[
            styles.modernTabLabel,
            activeTab === 'home' && styles.activeModernTabLabel
          ]}>
            Home
          </Text>
        </TouchableOpacity>

        {/* Social Hub Tab */}
        <TouchableOpacity
          style={styles.modernTabButton}
          onPress={() => {
            setActiveTab('social');
            // Use handleTabNavigation to ensure proper back navigation to Dashboard
            handleTabNavigation('StudyGroups');
          }}
        >
          <View style={[styles.tabIndicator, activeTab === 'social' && styles.activeTabIndicator]} />
          <Ionicons
            name={activeTab === 'social' ? 'people' : 'people-outline'}
            size={22}
            color={activeTab === 'social' ? '#4E54C8' : '#8E8E93'}
          />
          <Text style={[
            styles.modernTabLabel,
            activeTab === 'social' && styles.activeModernTabLabel
          ]}>
            Social Hub
          </Text>
        </TouchableOpacity>

        {/* Explore Tab - Center with larger size */}
        <TouchableOpacity
          style={[styles.modernTabButton, styles.centerTabButton]}
          onPress={() => setActiveTab('explore')}
        >
          <View style={[styles.tabIndicator, activeTab === 'explore' && styles.activeTabIndicator]} />
          <View style={[styles.centerTabIconContainer, { backgroundColor: activeTab === 'explore' ? '#4E54C8' : '#F2F2F7' }]}>
            <Ionicons
              name={activeTab === 'explore' ? 'apps' : 'apps-outline'}
              size={26}
              color={activeTab === 'explore' ? '#FFFFFF' : '#8E8E93'}
            />
          </View>
          <Text style={[
            styles.modernTabLabel,
            activeTab === 'explore' && styles.activeModernTabLabel
          ]}>
            Explore
          </Text>
        </TouchableOpacity>

        {/* Your Rides Tab */}
        <TouchableOpacity
          style={styles.modernTabButton}
          onPress={() => {
            setActiveTab('rides');
            // Use handleTabNavigation to ensure proper back navigation to Dashboard
            handleTabNavigation('YourRides');
          }}
        >
          <View style={[styles.tabIndicator, activeTab === 'rides' && styles.activeTabIndicator]} />
          <Ionicons
            name={activeTab === 'rides' ? 'car' : 'car-outline'}
            size={22}
            color={activeTab === 'rides' ? '#4E54C8' : '#8E8E93'}
          />
          <Text style={[
            styles.modernTabLabel,
            activeTab === 'rides' && styles.activeModernTabLabel
          ]}>
            Your Rides
          </Text>
        </TouchableOpacity>

        {/* Notifications Tab */}
        <TouchableOpacity
          style={styles.modernTabButton}
          onPress={() => setActiveTab('notifications')}
        >
          <View style={[styles.tabIndicator, activeTab === 'notifications' && styles.activeTabIndicator]} />
          <View style={styles.notificationTabContainer}>
            <Ionicons
              name={activeTab === 'notifications' ? 'notifications' : 'notifications-outline'}
              size={22}
              color={activeTab === 'notifications' ? '#4E54C8' : '#8E8E93'}
            />
            {unreadCount > 0 && (
              <View style={styles.modernUnreadBadge}>
                <Text style={styles.modernUnreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount.toString()}
                </Text>
              </View>
            )}
          </View>
          <Text style={[
            styles.modernTabLabel,
            activeTab === 'notifications' && styles.activeModernTabLabel
          ]}>
            Alerts
          </Text>
        </TouchableOpacity>
        

      </BlurView>
    </View>
  );

  // Render Chat Messages section
  const renderProductChatList = () => (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, margin: 16, padding: 16, elevation: 2 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#4E54C8' }}>Chat Messages</Text>
      {loadingAllChats ? (
        <ActivityIndicator size="small" color="#4E54C8" style={{ marginTop: 20 }} />
      ) : allChats.length === 0 ? (
        <Text style={{ color: '#8E8E93', fontSize: 15, marginTop: 12 }}>No conversations yet</Text>
      ) : (
        <FlatList
          data={allChats}
          keyExtractor={item => item.chatId}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 10, padding: 10, marginBottom: 10 }}
              onPress={() => {
                if (item.type === 'product') {
                  navigation.navigate('ProductChat', {
                    chatId: item.chatId,
                    product: { id: item.productId, title: item.productTitle, images: [item.productImage] },
                    buyer: { id: item.buyerId, name: item.buyerName },
                    seller: { id: item.sellerId, name: item.sellerName },
                  });
                } else if (item.type === 'roommate') {
                  navigation.navigate('RoommateChat', {
                    chatId: item.chatId,
                    listing: { id: item.listingId },
                    userA: { id: item.userAId, name: item.userAName },
                    userB: { id: item.userBId, name: item.userBName },
                  });
                }
              }}
            >
              {item.type === 'product' && item.productImage ? (
                <Image source={{ uri: item.productImage }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10, backgroundColor: '#F2F2F7' }} />
              ) : item.type === 'roommate' ? (
                <Ionicons name="bed-outline" size={40} color="#C7C7CC" style={{ marginRight: 10 }} />
              ) : (
                <Ionicons name="cube-outline" size={40} color="#C7C7CC" style={{ marginRight: 10 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1C1C1E' }}>
                  {item.type === 'product' ? item.productTitle : 'Roommate Listing'}
                </Text>
                <Text style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }} numberOfLines={1}>{item.otherUser.name}: {item.lastMessage}</Text>
              </View>
              <Text style={{ fontSize: 11, color: '#8E8E93', marginLeft: 8 }}>{item.lastMessageTime ? new Date(item.lastMessageTime).toLocaleTimeString() : ''}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );

  // Move loadProfile function outside and use useFocusEffect to call it
  const loadProfile = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [])
  );

  useEffect(() => {
    const fetchPoints = async () => {
      setPointsLoading(true);
      await updateStreakOnDashboardVisit();
      const data = await getUserPoints();
      setUserPoints(data);
      setPointsLoading(false);
    };
    fetchPoints();
  }, []);

  useEffect(() => {
    // ... existing code ...
    // OG User badge logic
    const checkOGUser = async () => {
      const user = auth.currentUser;
      if (!user) return;
      // Query first 500 users by accountCreatedOn
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('accountCreatedOn', 'asc'), limit(500));
      const snapshot = await getDocs(q);
      const isOG = snapshot.docs.some(doc => doc.id === user.uid);
      setIsOGUser(isOG);
    };
    checkOGUser();
  }, []);
  // ... existing code ...

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFF" />
      <LinearGradient
        colors={['#F8FAFF', '#FFFFFF', '#F0F8FF']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.contentContainer}>
          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === 'home' && (
              <ScrollView 
                style={styles.modernTabContent} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
              >
                {/* Header */}
                <View style={styles.topHeaderSection}>
                  <View style={styles.logoContainer}>
                    <Image
                      source={require('../../assets/images/campus-life.png')}
                      style={styles.appLogo}
                      resizeMode="contain"
                    />
                    <Text style={styles.appName}>YOGO Campus</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.profileButton}
                    onPress={() => navigation.navigate('Profile')}
                  >
                    {userProfile?.profileImage ? (
                      <Image
                        source={{ uri: userProfile.profileImage }}
                        style={styles.profileGradient}
                      />
                    ) : (
                      <LinearGradient
                        colors={['#4E54C8', '#8B5CF6']}
                        style={styles.profileGradient}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
                          {userProfile?.name?.charAt(0) || 'U'}
                        </Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Greeting Section */}
                <View style={styles.modernGreetingSection}>
                  <Text style={styles.modernGreeting}>{getTimeBasedGreeting()}, {userName}!</Text>
                  <Text style={styles.modernDate}>{currentDate}</Text>
                </View>

                {/* Highlights Section */}
                <View style={styles.modernSectionContainer}>
                  <Text style={styles.modernSectionTitle}>Today's Highlights</Text>
                  <FlatList
                    data={highlightCards}
                    renderItem={(card) => renderHighlightCard(card)}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false} // Disable scrolling as it's inside ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 0 }}
                    ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
                  />
                </View>

                {/* Quick Actions */}
                <View style={styles.modernSectionContainer}>
                  <Text style={styles.modernSectionTitle}>Quick Actions</Text>
                  {renderQuickActions()}
                </View>

                {/* Recent Activity */}
                <View style={styles.modernRecentActivity}>
                  <Text style={styles.modernSectionTitle}>Recent Activity</Text>
                  {recentActivities.length > 0 ? (
                    recentActivities.map((activity, index) => (
                      <View key={activity.id} style={styles.modernActivityCard}>
                        <View style={styles.activityHeader}>
                          <LinearGradient
                            colors={[
                              hexToRgba(activity.color || '#4E54C8', 0.13),
                              hexToRgba(activity.color || '#4E54C8', 0.07)
                            ]}
                            style={styles.modernActivityIcon}
                          >
                            <Ionicons name={activity.icon as any} size={28} color={activity.color || '#4E54C8'} />
                          </LinearGradient>
                          <View style={styles.activityInfo}>
                            <Text style={styles.modernActivityTitle}>{activity.title}</Text>
                            <Text style={styles.modernActivitySubtitle}>{activity.subtitle}</Text>
                          </View>
                          <Text style={styles.modernActivityTime}>{activity.timeAgo}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.modernActivityCard}>
                      <View style={styles.activityHeader}>
                        <LinearGradient
                          colors={['rgba(142,142,147,0.13)', 'rgba(142,142,147,0.07)']}
                          style={styles.modernActivityIcon}
                        >
                          <Ionicons name="information-circle-outline" size={28} color="#8E8E93" />
                        </LinearGradient>
                        <View style={styles.activityInfo}>
                          <Text style={styles.modernActivityTitle}>No Recent Activity</Text>
                          <Text style={styles.modernActivitySubtitle}>Check back later for updates</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
                {/* Leaderboard Button */}
                <View style={{ alignItems: 'center', marginTop: 12 }}>
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#4E54C8',
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 32,
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                    onPress={async () => {
                      setLeaderboardVisible(true);
                      setLoadingLeaderboard(true);
                      try {
                        const userPointsSnap = await getDocs(
                          query(collection(db, 'user_points'), orderBy('totalPoints', 'desc'), limit(50))
                        );
                        const leaderboard = [];
                        for (const docSnap of userPointsSnap.docs) {
                          const uid = docSnap.id;
                          const points = docSnap.data().totalPoints || 0;
                          let name = '';
                          try {
                            const userDoc = await getDoc(doc(db, 'users', uid));
                            if (userDoc.exists()) {
                              name = userDoc.data().name || userDoc.data().displayName || userDoc.data().userName || '';
                            }
                          } catch {}
                          leaderboard.push({ uid, name: name || 'Unknown', points });
                        }
                        setLeaderboardData(leaderboard);
                      } catch (error) {
                        setLeaderboardData([]);
                      }
                      setLoadingLeaderboard(false);
                    }}
                  >
                    <Ionicons name="trophy" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Leaderboard</Text>
                  </TouchableOpacity>
                </View>

                {/* Collapsible Chat Messages Section */}
                <View style={{ marginHorizontal: 16, marginTop: 8 }}>
                  <Collapsible title="Chat Messages">
                    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 0, elevation: 0 }}>
                      {loadingAllChats ? (
                        <ActivityIndicator size="small" color="#4E54C8" style={{ marginTop: 20 }} />
                      ) : allChats.length === 0 ? (
                        <Text style={{ color: '#8E8E93', fontSize: 15, marginTop: 12, marginLeft: 12 }}>No conversations yet</Text>
                      ) : (
                        <FlatList
                          data={allChats}
                          keyExtractor={item => item.chatId}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 10, padding: 10, marginBottom: 10 }}
                              onPress={() => {
                                if (item.type === 'product') {
                                  navigation.navigate('ProductChat', {
                                    chatId: item.chatId,
                                    product: { id: item.productId, title: item.productTitle, images: [item.productImage] },
                                    buyer: { id: item.buyerId, name: item.buyerName },
                                    seller: { id: item.sellerId, name: item.sellerName },
                                  });
                                } else if (item.type === 'roommate') {
                                  navigation.navigate('RoommateChat', {
                                    chatId: item.chatId,
                                    listing: { id: item.listingId },
                                    userA: { id: item.userAId, name: item.userAName },
                                    userB: { id: item.userBId, name: item.userBName },
                                  });
                                }
                              }}
                            >
                              {item.type === 'product' && item.productImage ? (
                                <Image source={{ uri: item.productImage }} style={{ width: 40, height: 40, borderRadius: 8, marginRight: 10, backgroundColor: '#F2F2F7' }} />
                              ) : item.type === 'roommate' ? (
                                <Ionicons name="bed-outline" size={40} color="#C7C7CC" style={{ marginRight: 10 }} />
                              ) : (
                                <Ionicons name="cube-outline" size={40} color="#C7C7CC" style={{ marginRight: 10 }} />
                              )}
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1C1C1E' }}>
                                  {item.type === 'product' ? item.productTitle : 'Roommate Listing'}
                                </Text>
                                <Text style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }} numberOfLines={1}>{item.otherUser.name}: {item.lastMessage}</Text>
                              </View>
                              <Text style={{ fontSize: 11, color: '#8E8E93', marginLeft: 8 }}>{item.lastMessageTime ? new Date(item.lastMessageTime).toLocaleTimeString() : ''}</Text>
                            </TouchableOpacity>
                          )}
                        />
                      )}
                    </View>
                  </Collapsible>
                </View>

                {/* AI Assistant Widget */}
                <View style={styles.aiAssistantContainer}>
                  <Text style={styles.modernSectionTitle}>AI Assistant</Text>
                  <TouchableOpacity
                    style={styles.aiAssistantCard}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('AskAIBot')}
                  >
                    <View style={styles.aiAssistantHeader}>
                      <LinearGradient
                        colors={['#4E54C870', '#8F94FB50']}
                        style={styles.aiAssistantIcon}
                      >
                        <Ionicons name="chatbubble-ellipses" size={24} color="#4E54C8" />
                      </LinearGradient>
                      <View style={styles.aiAssistantContent}>
                        <Text style={styles.aiAssistantTitle}>Ask AI</Text>
                        <Text style={styles.aiAssistantSubtitle}>
                          Get instant answers to your questions about campus, courses, and more. Try our Video Assistant AI for face-to-face conversations!
                        </Text>
                      </View>
                    </View>
                    <View style={styles.aiAssistantPrompt}>
                      <Text style={styles.aiAssistantPromptText}>
                        "Tap to ask the AI assistant..."
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Academic Calendar Event Card */}
                <AcademicCalendarEventCard navigation={navigation} />

                {/* Points System */}
                {pointsLoading ? null : userPoints && (
                  <View style={styles.pointsCardContainer}>
                    <LinearGradient
                      colors={["#E6F9ED", "#C8F7DC"]}
                      style={styles.pointsCard}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.pointsCardContent}>
                        <Image
                          source={(rankThresholds.find(r => userPoints.totalPoints >= r.min && userPoints.totalPoints <= r.max) || rankThresholds[0]).badge}
                          style={styles.pointsBadgeImage}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pointsRankText}>
                            {(rankThresholds.find(r => userPoints.totalPoints >= r.min && userPoints.totalPoints <= r.max) || rankThresholds[0]).name} Rank
                          </Text>
                          <Text style={styles.pointsValueText}>{userPoints.totalPoints} Points</Text>
                          <View style={styles.pointsProgressBarContainer}>
                            {(() => {
                              const currentRank = rankThresholds.find(r => userPoints.totalPoints >= r.min && userPoints.totalPoints <= r.max) || rankThresholds[0];
                              const nextRank = rankThresholds[rankThresholds.indexOf(currentRank) + 1];
                              const min = currentRank.min;
                              const max = currentRank.max === Infinity ? userPoints.totalPoints + 1 : currentRank.max;
                              const progress = Math.min(1, (userPoints.totalPoints - min) / (max - min));
                              return (
                                <RNView style={styles.progressBarBg}>
                                  <RNView style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                                </RNView>
                              );
                            })()}
                          </View>
                          <Text style={styles.pointsToNextText}>
                            {(() => {
                              const currentRank = rankThresholds.find(r => userPoints.totalPoints >= r.min && userPoints.totalPoints <= r.max) || rankThresholds[0];
                              if (currentRank.name === 'Legend') return 'Top Rank!';
                              const nextRank = rankThresholds[rankThresholds.indexOf(currentRank) + 1];
                              if (!nextRank) return '';
                              return `${nextRank.min - userPoints.totalPoints} points to ${nextRank.name}`;
                            })()}
                          </Text>
                          <Text style={styles.pointsStreakText}>🔥 {userPoints.streak || 0} day streak</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                )}
                {/* Badges Earned Card */}
                {userPoints && (
                  <View style={styles.badgeCardContainer}>
                    <View style={{ position: 'relative', width: '100%' }}>
                      <ScrollView
                        ref={badgeCarouselRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        style={{ width: '100%' }}
                        contentContainerStyle={{ width: Dimensions.get('window').width * 2 }}
                        onScroll={e => {
                          const x = e.nativeEvent.contentOffset.x;
                          const idx = Math.round(x / Dimensions.get('window').width);
                          if (badgeCarouselIndex !== idx) setBadgeCarouselIndex(idx);
                        }}
                        scrollEventThrottle={16}
                      >
                        {/* Slide 1: Planner Pro badge card */}
                        <RNView style={{ width: Dimensions.get('window').width }}>
                          <View style={{ position: 'relative' }}>
                            <TouchableOpacity
                              style={styles.badgeCard}
                              activeOpacity={0.85}
                              onPress={() => { setSelectedBadge('planner'); setBadgeModalVisible(true); }}
                            >
                              <View style={styles.badgeCardContent}>
                                <Image
                                  source={require('../../assets/Badges/PlannerPro.png')}
                                  style={styles.badgeImage}
                                />
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                  <Text style={styles.badgeTitleMain}>Planner Pro</Text>
                                  <Text style={styles.badgeCriteria}>Criteria: Used timetable 7 days in a row</Text>
                                  <View style={styles.badgeProgressBarContainer}>
                                    <RNView style={styles.progressBarBg}>
                                      <RNView style={[styles.progressBarFill, { width: `${Math.min(1, (userPoints.timetableStreak || 0) / 7) * 100}%`, backgroundColor: (userPoints.timetableStreak || 0) >= 7 ? '#34C759' : '#4E54C8' }]} />
                                    </RNView>
                                  </View>
                                  <Text style={styles.badgeProgressText}>{Math.min(userPoints.timetableStreak || 0, 7)}/7 days</Text>
                                  <Text style={[styles.badgeUnlockText, { color: (userPoints.timetableStreak || 0) >= 7 ? '#34C759' : '#8E8E93', fontSize: 18, marginTop: 8 }]}> 
                                    {(userPoints.timetableStreak || 0) >= 7 ? 'Unlocked!' : 'Locked'}
                                  </Text>
                                </View>
                                {/* Next arrow button, absolutely positioned inside the card */}
                                {badgeCarouselIndex === 0 && (
                                  <TouchableOpacity
                                    style={{ position: 'absolute', right: 16, top: '50%', transform: [{ translateY: -16 }], zIndex: 10 }}
                                    onPress={() => {
                                      setBadgeCarouselIndex(1);
                                      badgeCarouselRef.current?.scrollTo({ x: Dimensions.get('window').width, animated: true });
                                    }}
                                  >
                                    <Ionicons name="arrow-forward-circle" size={32} color="#4E54C8" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </TouchableOpacity>
                          </View>
                        </RNView>
                        {/* Slide 2: OG User badge card */}
                        <RNView style={{ width: Dimensions.get('window').width }}>
                          <View style={{ position: 'relative' }}>
                            <TouchableOpacity
                              style={styles.badgeCard}
                              activeOpacity={0.85}
                              onPress={() => { setSelectedBadge('oguser'); setBadgeModalVisible(true); }}
                            >
                              <View style={styles.badgeCardContent}>
                                <Image
                                  source={OGUserBadge}
                                  style={styles.badgeImage}
                                />
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                  <Text style={styles.badgeTitleMain}>OG User</Text>
                                  <Text style={styles.badgeCriteria}>Criteria: First 500 Users</Text>
                                  <View style={styles.badgeProgressBarContainer}>
                                    <RNView style={styles.progressBarBg}>
                                      <RNView style={[
                                        styles.progressBarFill,
                                        { width: `${(isOGUser ? 1 : 0) * 100}%`, backgroundColor: isOGUser ? '#34C759' : '#4E54C8' }
                                      ]} />
                                    </RNView>
                                  </View>
                                  <Text style={styles.badgeProgressText}>{isOGUser ? '500/500' : '0/500'}</Text>
                                  <Text style={[
                                    styles.badgeUnlockText,
                                    { color: isOGUser ? '#34C759' : '#8E8E93' }
                                  ]}>
                                    {isOGUser ? 'Unlocked!' : 'Locked'}
                                  </Text>
                                </View>
                                {/* Previous arrow button, absolutely positioned inside the card */}
                                {badgeCarouselIndex === 1 && (
                                  <TouchableOpacity
                                    style={{ position: 'absolute', left: 16, top: '50%', transform: [{ translateY: -16 }], zIndex: 10 }}
                                    onPress={() => {
                                      setBadgeCarouselIndex(0);
                                      badgeCarouselRef.current?.scrollTo({ x: 0, animated: true });
                                    }}
                                  >
                                    <Ionicons name="arrow-back-circle" size={32} color="#4E54C8" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </TouchableOpacity>
                          </View>
                        </RNView>
                      </ScrollView>
                    </View>
                    {/* Badge Modal (dynamic content) */}
                    <Modal
                      visible={badgeModalVisible}
                      animationType="slide"
                      transparent={true}
                      onRequestClose={() => setBadgeModalVisible(false)}
                    >
                      <View style={styles.badgeModalOverlay}>
                        <View style={styles.badgeModalContent}>
                          <TouchableOpacity style={styles.badgeModalClose} onPress={() => setBadgeModalVisible(false)}>
                            <Ionicons name="close" size={28} color="#4E54C8" />
                          </TouchableOpacity>
                          {selectedBadge === 'planner' ? (
                            <>
                              <Image
                                source={require('../../assets/Badges/PlannerPro.png')}
                                style={styles.badgeModalImage}
                              />
                              <Text style={styles.badgeModalTitle}>Planner Pro</Text>
                              <Text style={styles.badgeModalCriteria}>Criteria: Used timetable 7 days in a row</Text>
                              <View style={styles.badgeProgressBarContainer}>
                                <RNView style={styles.progressBarBg}>
                                  <RNView style={[
                                    styles.progressBarFill,
                                    { width: `${Math.min(1, (userPoints.timetableStreak || 0) / 7) * 100}%`, backgroundColor: (userPoints.timetableStreak || 0) >= 7 ? '#34C759' : '#4E54C8' }
                                  ]} />
                                </RNView>
                              </View>
                              <Text style={styles.badgeProgressText}>{Math.min(userPoints.timetableStreak || 0, 7)}/7 days</Text>
                              <Text style={[styles.badgeUnlockText, { color: (userPoints.timetableStreak || 0) >= 7 ? '#34C759' : '#8E8E93', fontSize: 18, marginTop: 8 }]}> 
                                {(userPoints.timetableStreak || 0) >= 7 ? 'Unlocked!' : 'Locked'}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Image
                                source={OGUserBadge}
                                style={styles.badgeModalImage}
                              />
                              <Text style={styles.badgeModalTitle}>OG User</Text>
                              <Text style={styles.badgeModalCriteria}>Criteria: First 500 Users</Text>
                              <View style={styles.badgeProgressBarContainer}>
                                <RNView style={styles.progressBarBg}>
                                  <RNView style={[
                                    styles.progressBarFill,
                                    { width: `${(isOGUser ? 1 : 0) * 100}%`, backgroundColor: isOGUser ? '#34C759' : '#4E54C8' }
                                  ]} />
                                </RNView>
                              </View>
                              <Text style={styles.badgeProgressText}>{isOGUser ? '500/500' : '0/500'}</Text>
                              <Text style={[styles.badgeUnlockText, { color: isOGUser ? '#34C759' : '#8E8E93', fontSize: 18, marginTop: 8 }]}> 
                                {isOGUser ? 'Unlocked!' : 'Locked'}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    </Modal>
                  </View>
                )}
              </ScrollView>
            )}

            {activeTab === 'explore' && (
              <ScrollView style={styles.tabContentTransparent} showsVerticalScrollIndicator={false}>
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color="#777" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search features..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#999"
                  />
                </View>

                <Text style={styles.sectionTitle}>All Features</Text>
                
                <FlatList
                  data={features.filter(feature => 
                    feature.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )}
                  renderItem={renderFeatureItem}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  style={styles.featuresGrid}
                  scrollEnabled={false}
                />
              </ScrollView>
            )}

            {activeTab === 'notifications' && (
              <Alerts />
            )}
          </View>
        </View>
        
        {renderTabBar()}
      </LinearGradient>
      {/* Leaderboard Modal */}
      <Modal
        visible={leaderboardVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLeaderboardVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            width: '90%',
            maxHeight: '80%',
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 8,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#4E54C8' }}>Leaderboard</Text>
              <TouchableOpacity onPress={() => setLeaderboardVisible(false)}>
                <Ionicons name="close" size={24} color="#4E54C8" />
              </TouchableOpacity>
            </View>
            {loadingLeaderboard ? (
              <ActivityIndicator size="large" color="#4E54C8" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={leaderboardData}
                keyExtractor={item => item.uid}
                renderItem={({ item, index }) => (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F2F2F7',
                  }}>
                    <Text style={{ width: 32, fontWeight: '700', color: '#4E54C8', fontSize: 16 }}>{index + 1}</Text>
                    <Text style={{ flex: 1, fontSize: 16, color: '#1C1C1E', fontWeight: '600' }}>{item.name}</Text>
                    <Text style={{ fontSize: 16, color: '#8E8E93', fontWeight: '500' }}>{item.points}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeAreaContainer: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  modernTabContent: {
    flex: 1,
    paddingBottom: 16,
  },
  tabContentTransparent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modernGreetingSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  modernGreeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
    marginBottom: 4,
  },
  modernDate: {
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
    fontWeight: '500',
  },
  profileButton: {
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  profileGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernSectionContainer: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  modernSectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  modernCardWrapper: {
    marginBottom: 16,
    width: '100%',
  },
  modernCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  cardContent: {
    marginTop: 4,
  },
  timeText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  foodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  foodChip: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  foodChipText: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  className: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  classDetailsRow: {
    flexDirection: 'row',
    marginRight: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  countdownContainer: {
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  countdownText: {
    fontSize: 13,
    color: '#4E54C8',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  eventName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  eventDetailsRow: {
    flexDirection: 'row',
    marginRight: 16,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  weatherDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 16,
  },
  temperatureContainer: {
    flex: 1,
    marginRight: 16,
  },
  temperature: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  weatherCondition: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  weatherMessage: {
    backgroundColor: 'rgba(249, 199, 79, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  weatherMessageText: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  modernQuickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickActionButton: {
    alignItems: 'center',
    width: '100%',
  },
  quickActionGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  modernRecentActivity: {
    marginTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  modernActivityCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernActivityIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    padding: 8,
  },
  activityInfo: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  modernActivityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  modernActivitySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  modernActivityTime: {
    fontSize: 13,
    color: '#C7C7CC',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  activeTabIndicator: {
    backgroundColor: '#4E54C8',
  },
  modernTabBarContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingTop: 0,
    // Removed any vertical padding/margin
  },
  modernTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12, // Reduced from 20 to 12 for a tighter fit
    height: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 0,
    justifyContent: 'space-around',
    // Removed any vertical padding/margin
  },
  modernTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
    paddingHorizontal: 2, // Add some horizontal padding to fit more tabs
  },
  centerTabButton: {
    flex: 1.2, // Slightly larger for the center tab
  },
  centerTabIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modernTabLabel: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
    textAlign: 'center',
  },
  activeModernTabLabel: {
    color: '#4E54C8',
    fontWeight: '600',
  },
  notificationTabContainer: {
    position: 'relative',
  },
  modernUnreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modernUnreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  logoContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flexDirection: 'row',
  },
  appLogo: {
    width: 40,
    height: 40,
    tintColor: '#4E54C8',
    marginRight: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4E54C8',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
    letterSpacing: -0.5,
  },
  tabContent: {
    flex: 1,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
    height: 48,
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
  featuresGrid: {
    marginHorizontal: 20,
  },
  featureItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    margin: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  notificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  notificationTime: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  notificationFilters: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  activeFilterButton: {
    backgroundColor: '#4E54C8',
  },
  filterText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  notificationsList: {
    padding: 20,
  },
  emptyNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyNotificationsText: {
    fontSize: 17,
    color: '#8E8E93',
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
    paddingHorizontal: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  // Badge Preview Styles
  badgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(78, 84, 200, 0.1)',
    borderRadius: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: '#4E54C8',
    fontWeight: '600',
    marginRight: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  badgePreviewCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  badgeGradientBackground: {
    padding: 20,
  },
  badgePreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  badgeIconStack: {
    position: 'relative',
    width: 60,
    height: 40,
    marginRight: 12,
  },
  badgeIcon: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeIcon1: {
    top: 0,
    left: 0,
    zIndex: 3,
  },
  badgeIcon2: {
    top: 8,
    left: 16,
    zIndex: 2,
  },
  badgeIcon3: {
    top: 0,
    left: 32,
    zIndex: 1,
  },
  progressCircleContainer: {
    alignItems: 'center',
  },
  progressCircleBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressTextBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  badgeTextContent: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  badgeSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  recentBadgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  recentBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  checkButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  
  // AI Assistant Widget Styles
  aiAssistantContainer: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  aiAssistantCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  aiAssistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiAssistantIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  aiAssistantContent: {
    flex: 1,
  },
  aiAssistantTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  aiAssistantSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  aiAssistantPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  aiAssistantPromptText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '400',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  academicCardContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  academicCard: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
  },
  academicCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  academicEventTitle: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  academicEventDate: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  academicCloudContainer: {
    width: 100,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  academicCloud: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  academicCloudText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  academicViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#4E54C8',
    marginTop: 16,
  },
  academicViewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  academicCardContainerEnhanced: {
    alignSelf: 'center',
    maxWidth: 400,
    width: '92%',
    borderRadius: 20,
    marginTop: 24,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 10,
    backgroundColor: 'transparent',
  },
  academicCardEnhanced: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 240, 200, 0.96)', // user-specified yellow
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    // Soft glass effect: fallback gradient for platforms without blur
    // Use BlurView overlay in the component if desired for iOS/Android
    overflow: 'hidden',
    // Subtle gradient fallback for web
    ...Platform.select({
      web: {
        background: 'linear-gradient(135deg, rgba(255,240,200,0.96) 0%, rgba(255,245,220,0.96) 100%)',
      },
    }),
  },
  academicCardTitleEnhanced: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 18,
    color: '#1E1E1E',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  academicEventSubtextEnhanced: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    color: '#4B5563',
    maxWidth: '90%',
    marginBottom: 12,
  },
  academicDateRowEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 6,
    width: '100%',
  },
  academicDateTextEnhanced: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8,
  },
  todayBadgeEnhanced: {
    borderRadius: 9999,
    backgroundColor: '#D1FAE5',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginLeft: 'auto',
    alignSelf: 'center',
  },
  todayBadgeTextEnhanced: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  academicViewButtonEnhanced: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4338CA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 0,
  },
  academicViewButtonTextEnhanced: {
    color: '#fff',
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    marginRight: 8,
  },
  academicViewButtonArrowEnhanced: {
    transform: [{ translateX: 0 }],
    transitionProperty: 'transform',
    transitionDuration: '0.2s',
  },
  pointsCardContainer: {
    marginTop: 24,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 400,
    borderRadius: 20,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  pointsCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.10)',
    borderWidth: 1,
    borderColor: '#B2F2D7',
  },
  pointsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsBadgeImage: {
    width: 64,
    height: 64,
    marginRight: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E6F9ED',
  },
  pointsRankText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  pointsValueText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  pointsToNextText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  pointsStreakText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  pointsProgressBarContainer: {
    marginVertical: 8,
  },
  progressBarBg: {
    width: '100%',
    height: 10,
    borderRadius: 6,
    backgroundColor: '#E0F2E9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#34C759',
  },
  // --- BADGES CARD STYLES ---
  badgeCardContainer: {
    marginTop: 20,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 400,
    borderRadius: 20,
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  badgeCard: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 84, 200, 0.10)',
    borderWidth: 1,
    borderColor: '#E0D7FF',
  },
  badgeCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  badgeImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E0D7FF',
  },
  badgeTitleMain: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4E54C8',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
    marginBottom: 2,
  },
  badgeCriteria: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  badgeProgressBarContainer: {
    marginVertical: 6,
  },
  badgeProgressText: {
    fontSize: 14,
    color: '#4E54C8',
    fontWeight: '600',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  badgeUnlockText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  // --- BADGE MODAL STYLES ---
  badgeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '85%',
    maxWidth: 350,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  badgeModalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  badgeModalImage: {
    width: 90,
    height: 90,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E0D7FF',
  },
  badgeModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4E54C8',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  badgeModalCriteria: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
});

// CalendarEvent type for AcademicCalendarEventCard
interface CalendarEvent {
  date: string;
  day: string;
  event: string;
}

// Inline AcademicCalendarEventCard component
const AcademicCalendarEventCard = ({ navigation }: { navigation: any }) => {
  // Helper functions (copied from AcademicCalendar.tsx)
  const getMonthIndex = (monthName: string): number => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months.indexOf(monthName);
  };
  const calculateDaysRemaining = (dateString: string, monthName: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMatch = dateString.match(/(\d+)/);
    if (!dayMatch) return 0;
    const day = parseInt(dayMatch[1]);
    const currentYear = today.getFullYear();
    const eventMonthIdx = getMonthIndex(monthName);
    const currentMonthIdx = today.getMonth();
    let eventYear = currentYear;
    if (eventMonthIdx < 6 && currentMonthIdx >= 6) {
      eventYear = currentYear + 1;
    }
    let eventDate = new Date(eventYear, eventMonthIdx, day);
    eventDate.setHours(0, 0, 0, 0);
    const timeDiff = eventDate.getTime() - today.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    return daysDiff;
  };
  const formatDaysRemaining = (days: number): string => {
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 0) return 'Today';
    if (days === 1) return '1 day to go';
    return `${days} days to go`;
  };
  // Find next upcoming event
  let nextEvent: CalendarEvent | null = null;
  let minDays = Infinity;
  let nextMonth: string = '';
  // Fix typing for calendarDataRaw
  const months = (calendarDataRaw as { months: { name: string; events: CalendarEvent[] }[] }).months;
  months.forEach((month) => {
    month.events.forEach((event: CalendarEvent) => {
      const days = calculateDaysRemaining(event.date, month.name);
      if (days >= 0 && days < minDays) {
        minDays = days;
        nextEvent = event;
        nextMonth = month.name;
      }
    });
  });
  if (!nextEvent) return null;
  // Card UI (PURPLE THEME)
  return (
    <View style={[styles.academicCardContainerEnhanced, { backgroundColor: 'transparent' }]}> {/* Remove default bg */}
      <LinearGradient
        colors={["#F8FAFF", "#EDE7F6"]} // Soft purple gradient
        style={[styles.academicCardEnhanced, {
          backgroundColor: undefined, // Remove fallback bg
          borderColor: '#E0D7FF', // Soft purple border
          borderWidth: 1,
          shadowColor: '#8B5CF6',
          shadowOpacity: 0.10,
          shadowRadius: 18,
        }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ width: "100%", maxWidth: 400 }}>
          {/* Title */}
          <Text style={[styles.academicCardTitleEnhanced, { color: '#4E54C8' }]}>Academic Calendar Events</Text>
          {/* Subtext */}
          <Text style={[styles.academicEventSubtextEnhanced, { color: '#4E54C8' }]} numberOfLines={2}>
            {(nextEvent as CalendarEvent).event}
          </Text>
          {/* Date Row + Today Badge */}
          <View style={styles.academicDateRowEnhanced}>
            <Ionicons name="calendar-outline" size={18} color="#8B5CF6" style={{ marginRight: 6 }} />
            <Text style={[styles.academicDateTextEnhanced, { color: '#4E54C8' }]}> 
              {(nextEvent as CalendarEvent).date}{(nextEvent as CalendarEvent).day ? ` | ${(nextEvent as CalendarEvent).day}` : ''}
            </Text>
            {minDays === 0 && (
              <View style={[styles.todayBadgeEnhanced, { backgroundColor: '#E0D7FF' }]}> {/* Purple badge */}
                <Text style={[styles.todayBadgeTextEnhanced, { color: '#4E54C8' }]}>Today</Text>
              </View>
            )}
          </View>
          {/* Button */}
          <TouchableOpacity
            style={[styles.academicViewButtonEnhanced, { backgroundColor: '#4E54C8' }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AcademicCalendar')}
          >
            <Text style={[styles.academicViewButtonTextEnhanced, { color: '#fff' }]}>View Academic Calendar</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.academicViewButtonArrowEnhanced} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

export default Dashboard;
