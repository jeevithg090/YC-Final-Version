import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
  Switch,
  Animated,
  StatusBar,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import notificationService from '../services/notificationService';
import { db, auth } from '../services/firebase';
import { 
  collection, 
  doc, 
  updateDoc, 
  getDocs, 
  query,
  orderBy,
  Timestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { TimetableData, ExtractedTimetable, ClassEntry, DaySchedule } from '../types/timetable';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ClassReminderSettings {
  classId: string;
  enabled: boolean;
}

interface AlarmSettings {
  enabled: boolean;
  reminderMinutes: number; // 5, 10, 15, 20, 25, or 30
}

interface DailyTimetableProps {
  route?: {
    params?: {
      timetableData?: TimetableData;
      extractedId?: string;
    };
  };
  navigation?: {
    goBack: () => void;
  };
}

const EXTRACTED_TIMETABLES_COLLECTION = 'extracted_timetables';

const DailyTimetable: React.FC<DailyTimetableProps> = ({ route, navigation }) => {
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [extractedTimetables, setExtractedTimetables] = useState<ExtractedTimetable[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [editingClass, setEditingClass] = useState<{ dayIndex: number; classIndex: number; classData: ClassEntry } | null>(null);
  
  // Edit modal state
  const [editSubject, setEditSubject] = useState<string>('');
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [editEndTime, setEditEndTime] = useState<string>('');
  const [editRoom, setEditRoom] = useState<string>('');
  const [editProfessor, setEditProfessor] = useState<string>('');

  // Alarm settings state
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>({
    enabled: false,
    reminderMinutes: 15
  });
  const [showAlarmModal, setShowAlarmModal] = useState<boolean>(false);
  const [classReminders, setClassReminders] = useState<{ [key: string]: boolean }>({});
  const [animatedValues] = useState(() => new Map<string, Animated.Value>());

  // Toast notification state
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning'>('success');
  
  // Custom class state
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [newSubject, setNewSubject] = useState<string>('');
  const [newStartTime, setNewStartTime] = useState<string>('');
  const [newEndTime, setNewEndTime] = useState<string>('');
  const [newRoom, setNewRoom] = useState<string>('');
  const [newProfessor, setNewProfessor] = useState<string>('');

  // Helper function to get current day of week
  const getCurrentDayOfWeek = (): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    return days[today.getDay()];
  };

  // Helper function to set selected day to today or fallback to first available day
  const setSelectedDayToToday = (timetableData: TimetableData) => {
    if (!timetableData.days || timetableData.days.length === 0) {
      console.log('No days available in timetable');
      return;
    }

    const currentDayOfWeek = getCurrentDayOfWeek();
    console.log('Today is:', currentDayOfWeek);
    console.log('Available days in timetable:', timetableData.days.map(d => d.day));
    
    // Create a mapping of full day names to common abbreviations
    const dayMappings: { [key: string]: string[] } = {
      'Sunday': ['SUN', 'SUNDAY'],
      'Monday': ['MON', 'MONDAY'],
      'Tuesday': ['TUE', 'TUESDAY', 'TUES'],
      'Wednesday': ['WED', 'WEDNESDAY'],
      'Thursday': ['THU', 'THURSDAY', 'THURS'],
      'Friday': ['FRI', 'FRIDAY'],
      'Saturday': ['SAT', 'SATURDAY']
    };
    
    // Get possible abbreviations for today
    const todayAbbreviations = dayMappings[currentDayOfWeek] || [];
    
    // Try to find today's day in the timetable using various formats
    const todaySchedule = timetableData.days.find(day => {
      const dayName = day.day.toUpperCase().trim();
      return todayAbbreviations.some(abbrev => abbrev === dayName) || 
             dayName === currentDayOfWeek.toUpperCase();
    });
    
    if (todaySchedule) {
      // Set to today if found
      console.log('Found today in timetable, setting to:', todaySchedule.day);
      setSelectedDay(todaySchedule.day);
    } else {
      // Fallback to first available day if today is not in timetable
      console.log('Today not found in timetable, falling back to:', timetableData.days[0].day);
      setSelectedDay(timetableData.days[0].day);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      // Get timetable data from navigation params or load from storage
      if (route?.params?.timetableData) {
        setTimetableData(route.params.timetableData);
        setSelectedDayToToday(route.params.timetableData);
      } else {
        // Load from AsyncStorage
        await loadExtractedTimetables();
      }
      // --- Timetable streak logic ---
      try {
        const userId = auth.currentUser?.uid;
        if (userId) {
          const userDocRef = doc(db, 'user_points', userId);
          const userDoc = await getDoc(userDocRef);
          const today = new Date();
          const todayStr = today.toDateString();
          let timetableStreak = 1;
          let lastTimetableUseDate = '';
          if (userDoc.exists()) {
            const data = userDoc.data();
            timetableStreak = data.timetableStreak || 0;
            lastTimetableUseDate = data.lastTimetableUseDate || '';
            if (lastTimetableUseDate !== todayStr) {
              // Calculate difference in days
              const lastDate = lastTimetableUseDate ? new Date(lastTimetableUseDate) : null;
              let newStreak = 1;
              if (lastDate) {
                const diff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diff === 1) {
                  newStreak = timetableStreak + 1;
                } else {
                  newStreak = 1;
                }
              }
              await updateDoc(userDocRef, {
                timetableStreak: newStreak,
                lastTimetableUseDate: todayStr
              });
            }
          } else {
            await setDoc(userDocRef, {
              timetableStreak: 1,
              lastTimetableUseDate: todayStr
            }, { merge: true });
          }
        }
      } catch (error) {
        console.error('Error updating timetable streak:', error);
      }
      // --- end timetable streak logic ---
    };
    loadData();
  }, [route?.params]);

  // Load alarm settings on component mount
  useEffect(() => {
    loadAlarmSettings();
    loadClassReminders();
  }, []);

  // Initialize animated values for bell icons
  useEffect(() => {
    if (timetableData) {
      timetableData.days.forEach((day, dayIndex) => {
        day.classes.forEach((classItem, classIndex) => {
          const classId = getClassId(classItem, dayIndex, classIndex);
          if (!animatedValues.has(classId)) {
            animatedValues.set(classId, new Animated.Value(1));
          }
        });
      });
    }
  }, [timetableData]);

  // Re-schedule alarms when timetable data or alarm settings change
  useEffect(() => {
    if (timetableData && alarmSettings.enabled) {
      scheduleClassAlarms();
    }
  }, [timetableData, alarmSettings]);

  const loadAlarmSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('alarmSettings');
      if (savedSettings) {
        setAlarmSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading alarm settings:', error);
    }
  };

  const saveAlarmSettings = async (settings: AlarmSettings) => {
    try {
      await AsyncStorage.setItem('alarmSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving alarm settings:', error);
    }
  };

  const loadExtractedTimetables = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.error('No authenticated user');
        return;
      }

      const timetablesRef = collection(db, EXTRACTED_TIMETABLES_COLLECTION);
      const q = query(
        timetablesRef,
        where('userId', '==', userId),
        orderBy('extractionDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const extractedList: ExtractedTimetable[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        extractedList.push({
          id: doc.id,
          userId: data.userId,
          originalImageUrl: data.originalImageUrl,
          extractedData: data.extractedData,
          extractionDate: data.extractionDate,
          confidence: data.confidence
        });
      });
      
      setExtractedTimetables(extractedList);
      
      if (extractedList.length > 0) {
        const mostRecent = extractedList[0]; // Already ordered by extractionDate desc
        setTimetableData(mostRecent.extractedData);
        setSelectedDayToToday(mostRecent.extractedData);
      }
    } catch (error) {
      console.error('Error loading extracted timetables:', error);
      Alert.alert('Error', 'Failed to load timetable data from Firebase');
    }
  };

  const saveExtractedTimetables = async (list: ExtractedTimetable[]) => {
    // This function is now replaced by individual Firestore operations
    // Keeping for compatibility
  };

  const getCurrentDay = (): DaySchedule | null => {
    if (!timetableData || !selectedDay) return null;
    return timetableData.days.find(day => day.day === selectedDay) || null;
  };

  // Enhanced class reminder functions
  const getClassId = (classEntry: ClassEntry, dayIndex: number, classIndex: number): string => {
    return `${dayIndex}_${classIndex}_${classEntry.subject}_${classEntry.startTime}`;
  };

  const loadClassReminders = async () => {
    try {
      const savedReminders = await AsyncStorage.getItem('classReminders');
      if (savedReminders) {
        setClassReminders(JSON.parse(savedReminders));
      }
    } catch (error) {
      console.error('Error loading class reminders:', error);
    }
  };

  const saveClassReminders = async (reminders: { [key: string]: boolean }) => {
    try {
      await AsyncStorage.setItem('classReminders', JSON.stringify(reminders));
    } catch (error) {
      console.error('Error saving class reminders:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const toggleClassReminder = async (classEntry: ClassEntry, dayIndex: number, classIndex: number) => {
    const classId = getClassId(classEntry, dayIndex, classIndex);
    const isCurrentlyEnabled = classReminders[classId] || false;
    const newEnabled = !isCurrentlyEnabled;
    
    const updatedReminders = {
      ...classReminders,
      [classId]: newEnabled
    };
    
    setClassReminders(updatedReminders);
    await saveClassReminders(updatedReminders);
    
    // Animate the bell icon
    const animValue = animatedValues.get(classId);
    if (animValue) {
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
    
    if (newEnabled) {
      // Schedule individual notification for this class
      await scheduleIndividualClassReminder(classEntry, dayIndex, classIndex);
      showToast(`AI reminder set for ${classEntry.subject}`, 'success');
    } else {
      // Cancel individual notification for this class
      await cancelIndividualClassReminder(classId);
      showToast(`Reminder cancelled for ${classEntry.subject}`, 'info');
    }
  };

  const scheduleIndividualClassReminder = async (classEntry: ClassEntry, dayIndex: number, classIndex: number) => {
    try {
      const classId = getClassId(classEntry, dayIndex, classIndex);
      // Create temporary timetable data for single class
      const singleClassTimetable: TimetableData = {
        days: [{
          day: 'Individual',
          classes: [classEntry]
        }]
      };
      await notificationService.scheduleClassAlarms(singleClassTimetable, 20); // 20 minutes before class
      console.log(`Scheduled AI reminder for ${classEntry.subject} at ${classEntry.startTime}`);
    } catch (error) {
      console.error('Error scheduling individual class reminder:', error);
    }
  };

  const cancelIndividualClassReminder = async (classId: string) => {
    try {
      await notificationService.cancelAllAlarms(); // Note: This will cancel all alarms
      console.log(`Cancelled reminder for class ID: ${classId}`);
    } catch (error) {
      console.error('Error cancelling individual class reminder:', error);
    }
  };

  // Enhanced time formatting
  const formatTime = (time: string): string => {
    try {
      // Handle various time formats and avoid duplicate AM/PM
      const cleanTime = time.replace(/\s*(AM|PM|am|pm)\s*/g, '').trim();
      const timeParts = cleanTime.split(':');
      let hour = parseInt(timeParts[0]);
      const minute = timeParts[1] ? timeParts[1].padStart(2, '0') : '00';

      // If hour is between 0 and 7, always show as PM
      if (hour >= 0 && hour < 8) {
        if (hour === 0) hour = 12;
        return `${hour}:${minute} PM`;
      }
      if (hour === 12) return `12:${minute} PM`;
      if (hour < 12) return `${hour}:${minute} AM`;
      return `${hour - 12}:${minute} PM`;
    } catch (error) {
      return time; // Return original if parsing fails
    }
  };

  // Enhanced color scheme - consistent blue theme with subtle variations
  const getTimeColor = (startTime: string): string => {
    try {
      const cleanTime = startTime.replace(/\s*(AM|PM|am|pm)\s*/g, '').trim();
      const hour = parseInt(cleanTime.split(':')[0]);
      
      // Use different shades of blue for better visual hierarchy while maintaining consistency
      if (hour < 9) return '#1976D2';   // Darker blue - Early morning
      if (hour < 12) return '#2196F3';  // Standard blue - Morning  
      if (hour < 15) return '#42A5F5';  // Medium blue - Afternoon
      if (hour < 18) return '#64B5F6';  // Light blue - Late afternoon
      return '#1565C0';                 // Deep blue - Evening
    } catch (error) {
      return '#4285F4'; // Default Google blue
    }
  };

  const getSubjectIcon = (subject: string): string => {
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes('math') || subjectLower.includes('calculus') || subjectLower.includes('algebra')) return 'calculator-outline';
    if (subjectLower.includes('physics') || subjectLower.includes('chemistry')) return 'flask-outline';
    if (subjectLower.includes('computer') || subjectLower.includes('programming') || subjectLower.includes('cs')) return 'code-outline';
    if (subjectLower.includes('english') || subjectLower.includes('literature')) return 'book-outline';
    if (subjectLower.includes('history') || subjectLower.includes('social')) return 'library-outline';
    if (subjectLower.includes('art') || subjectLower.includes('design')) return 'color-palette-outline';
    if (subjectLower.includes('music')) return 'musical-notes-outline';
    if (subjectLower.includes('biology') || subjectLower.includes('bio')) return 'leaf-outline';
    if (subjectLower.includes('lab')) return 'beaker-outline';
    return 'school-outline';
  };

  const editClass = (dayIndex: number, classIndex: number, classData: ClassEntry) => {
    setEditingClass({ dayIndex, classIndex, classData });
    setEditSubject(classData.subject);
    setEditStartTime(classData.startTime);
    setEditEndTime(classData.endTime);
    setEditRoom(classData.room || '');
    setEditProfessor(classData.professor || '');
  };

  const updateClass = async (updatedClass: ClassEntry) => {
    if (!editingClass || !timetableData) return;
    
    try {
      const updatedTimetableData = { ...timetableData };
      updatedTimetableData.days[editingClass.dayIndex].classes[editingClass.classIndex] = updatedClass;
      setTimetableData(updatedTimetableData);
      
      // Find the corresponding extracted timetable to update in Firestore
      const timetableToUpdate = extractedTimetables.find(t => t.extractedData === timetableData);
      if (timetableToUpdate) {
        // Update in Firestore
        const docRef = doc(db, EXTRACTED_TIMETABLES_COLLECTION, timetableToUpdate.id);
        await updateDoc(docRef, {
          extractedData: updatedTimetableData,
          updatedAt: Timestamp.now()
        });
        
        // Update local state
        const updatedExtracted = extractedTimetables.map(t =>
          t.id === timetableToUpdate.id ? { ...t, extractedData: updatedTimetableData } : t
        );
        setExtractedTimetables(updatedExtracted);
      }
      
      
      setEditingClass(null);
      Alert.alert('Success', 'Class updated successfully!');
    } catch (error) {
      console.error('Error updating class:', error);
      Alert.alert('Error', 'Failed to update class');
    }
  };

  const saveEditedClass = async () => {
    // --- Time validation logic start ---
    // Helper to parse time string to minutes since midnight
    const parseTime = (time: string): number => {
      const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!match) return -1;
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      let ampm = match[3]?.toUpperCase();
      if (!ampm) {
        // Infer AM/PM: if hour < 8, assume AM; if hour >= 8 and < 12, AM; if hour >= 12, PM
        if (hour < 8) ampm = 'AM';
        else if (hour < 12) ampm = 'AM';
        else ampm = 'PM';
      }
      if (ampm === 'PM' && hour !== 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      return hour * 60 + minute;
    };

    // Normalize time string to 12-hour format with AM/PM
    const normalizeTime = (time: string): string => {
      const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!match) return time;
      let hour = parseInt(match[1], 10);
      const minute = match[2].padStart(2, '0');
      let ampm = match[3]?.toUpperCase();
      if (!ampm) {
        if (hour < 8) ampm = 'AM';
        else if (hour < 12) ampm = 'AM';
        else ampm = 'PM';
      }
      // New logic: if time is between 00:00 AM and 7:59 AM, change to PM
      if (ampm === 'AM' && hour >= 0 && hour < 8) {
        ampm = 'PM';
      }
      if (hour === 0) return `12:${minute} ${ampm}`;
      if (hour < 12) return `${hour}:${minute} ${ampm}`;
      if (hour === 12) return `12:${minute} PM`;
      return `${hour - 12}:${minute} PM`;
    };

    const start = normalizeTime(editStartTime);
    const end = normalizeTime(editEndTime);
    const startMins = parseTime(start);
    const endMins = parseTime(end);
    if (startMins === -1 || endMins === -1) {
      Alert.alert('Invalid Time', 'Please enter valid start and end times in HH:MM format.');
      return;
    }
    if (endMins <= startMins) {
      Alert.alert('Invalid Time Order', 'End time must be after start time.');
      return;
    }
    // --- Time validation logic end ---
    const updatedClass: ClassEntry = {
      subject: editSubject,
      startTime: start,
      endTime: end,
      room: editRoom,
      professor: editProfessor
    };
    await updateClass(updatedClass);
  };
  
  // Add a new custom class
  const addCustomClass = async () => {
    if (!timetableData) {
      // Initialize timetable data if it doesn't exist
      setTimetableData({
        days: [
          { day: selectedDay, classes: [] }
        ]
      });
      return;
    }
    
    // --- Time validation logic start ---
    // Helper to parse time string to minutes since midnight
    const parseTime = (time: string): number => {
      const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!match) return -1;
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      let ampm = match[3]?.toUpperCase();
      if (!ampm) {
        if (hour < 8) ampm = 'AM';
        else if (hour < 12) ampm = 'AM';
        else ampm = 'PM';
      }
      if (ampm === 'PM' && hour !== 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      return hour * 60 + minute;
    };

    // Normalize time string to 12-hour format with AM/PM
    const normalizeTime = (time: string): string => {
      const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!match) return time;
      let hour = parseInt(match[1], 10);
      const minute = match[2].padStart(2, '0');
      let ampm = match[3]?.toUpperCase();
      if (!ampm) {
        if (hour < 8) ampm = 'AM';
        else if (hour < 12) ampm = 'AM';
        else ampm = 'PM';
      }
      // If time is between 00:00 AM and 7:59 AM, change to PM
      if (ampm === 'AM' && hour >= 0 && hour < 8) {
        ampm = 'PM';
      }
      if (hour === 0) return `12:${minute} ${ampm}`;
      if (hour < 12) return `${hour}:${minute} ${ampm}`;
      if (hour === 12) return `12:${minute} PM`;
      return `${hour - 12}:${minute} PM`;
    };

    // Validate inputs
    if (!newSubject.trim()) {
      Alert.alert('Missing Information', 'Please enter a subject name.');
      return;
    }
    
    const start = normalizeTime(newStartTime);
    const end = normalizeTime(newEndTime);
    const startMins = parseTime(start);
    const endMins = parseTime(end);
    
    if (startMins === -1 || endMins === -1) {
      Alert.alert('Invalid Time', 'Please enter valid start and end times in HH:MM format.');
      return;
    }
    
    if (endMins <= startMins) {
      Alert.alert('Invalid Time Order', 'End time must be after start time.');
      return;
    }
    // --- Time validation logic end ---
    
    try {
      // Create the new class entry
      const newClassEntry: ClassEntry = {
        subject: newSubject,
        startTime: start,
        endTime: end,
        room: newRoom,
        professor: newProfessor
      };
      
      // Find the day index or create a new day if it doesn't exist
      let dayIndex = timetableData.days.findIndex(day => day.day === selectedDay);
      
      const updatedTimetableData = { ...timetableData };
      
      if (dayIndex === -1) {
        // Create a new day if it doesn't exist
        updatedTimetableData.days.push({
          day: selectedDay,
          classes: [newClassEntry]
        });
      } else {
        // Add class to existing day
        updatedTimetableData.days[dayIndex].classes.push(newClassEntry);
        
        // Sort classes by start time
        updatedTimetableData.days[dayIndex].classes.sort((a, b) => {
          const aTime = parseTime(a.startTime);
          const bTime = parseTime(b.startTime);
          return aTime - bTime;
        });
      }
      
      // Update state
      setTimetableData(updatedTimetableData);
      
      // Update in Firestore if we have extracted timetables
      if (extractedTimetables.length > 0) {
        const timetableToUpdate = extractedTimetables[0]; // Use the most recent one
        const docRef = doc(db, EXTRACTED_TIMETABLES_COLLECTION, timetableToUpdate.id);
        await updateDoc(docRef, {
          extractedData: updatedTimetableData,
          updatedAt: Timestamp.now()
        });
        
        // Update local state
        const updatedExtracted = extractedTimetables.map(t =>
          t.id === timetableToUpdate.id ? { ...t, extractedData: updatedTimetableData } : t
        );
        setExtractedTimetables(updatedExtracted);
      }
      
      // Reset form and close modal
      setNewSubject('');
      setNewStartTime('');
      setNewEndTime('');
      setNewRoom('');
      setNewProfessor('');
      setShowAddClassModal(false);
      
      // Show success message
      showToast(`Added ${newSubject} to ${selectedDay}`, 'success');
      
      // Reschedule alarms if enabled
      if (alarmSettings.enabled) {
        scheduleClassAlarms();
      }
    } catch (error) {
      console.error('Error adding custom class:', error);
      Alert.alert('Error', 'Failed to add class. Please try again.');
    }
  };

  // Alarm-related functions
  const requestNotificationPermissions = async () => {
    try {
      const hasPermission = await notificationService.initializeNotifications();
      if (!hasPermission) {
        Alert.alert(
          'Notification Permission Required', 
          'Please enable notifications to receive class reminders with AI-generated motivational messages.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => console.log('Open settings') }
          ]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      Alert.alert('Error', 'Failed to initialize notifications. Please try again.');
      return false;
    }
  };

  const scheduleClassAlarms = async () => {
    if (!timetableData || !alarmSettings.enabled) return;

    try {
      // Use 20 minutes for user display, but service schedules 22 minutes for AI processing
      await notificationService.scheduleClassAlarms(timetableData, 20);
      console.log('AI-powered class notifications scheduled successfully');
    } catch (error) {
      console.error('Error scheduling notifications:', error);
      Alert.alert('Error', 'Failed to schedule AI-powered notifications. Please try again.');
    }
  };

  const handleAlarmToggle = async (enabled: boolean) => {
    if (enabled) {
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) return;
    }
    
    const newSettings = { ...alarmSettings, enabled };
    setAlarmSettings(newSettings);
    await saveAlarmSettings(newSettings);
    
    if (enabled) {
      await scheduleClassAlarms();
      Alert.alert(
        'AI Notifications Enabled! 🤖', 
        'You\'ll receive motivational AI-generated reminders 20 minutes before each class, with special "start of new day" messages for your first class!'
      );
    } else {
      await notificationService.cancelAllAlarms();
      Alert.alert('Notifications Disabled', 'All class reminders have been cancelled.');
    }
  };

  const handleReminderTimeChange = async (minutes: number) => {
    // Fixed at 20 minutes for AI processing, but user sees this as the reminder time
    const newSettings = { ...alarmSettings, reminderMinutes: 20 };
    setAlarmSettings(newSettings);
    await saveAlarmSettings(newSettings);
    
    // Re-schedule alarms if enabled
    if (alarmSettings.enabled) {
      await scheduleClassAlarms();
      Alert.alert('Reminder Updated', 'AI notifications will remind you 20 minutes before each class.');
    }
  };



  const renderAlarmModal = () => {
    return (
      <Modal
        visible={showAlarmModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAlarmModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.alarmModalContent}>
            <ThemedText style={styles.modalTitle}>🤖 AI Class Notifications</ThemedText>
            
            <View style={styles.alarmDescriptionContainer}>
              <ThemedText style={styles.alarmDescription}>
                Get motivational AI-generated reminders 20 minutes before each class!
              </ThemedText>
              <ThemedText style={styles.alarmFeatures}>
                ✨ Special "start of new day" messages for first classes{'\n'}
                🎯 Course-specific motivational content{'\n'}
                🧠 Powered by multiple AI models for reliability
              </ThemedText>
            </View>
            
            <View style={styles.alarmSettingItem}>
              <ThemedText style={styles.alarmSettingLabel}>Enable AI Notifications</ThemedText>
              <Switch
                value={alarmSettings.enabled}
                onValueChange={handleAlarmToggle}
                trackColor={{ false: '#767577', true: '#4285F4' }}
                thumbColor={alarmSettings.enabled ? '#fff' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.alarmSettingItem}>
              <ThemedText style={styles.alarmSettingLabel}>Reminder Time: 20 minutes before class</ThemedText>
              <ThemedText style={styles.alarmSettingNote}>
                (Fixed for optimal AI message generation)
              </ThemedText>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.closeAlarmModalButton}
                onPress={() => setShowAlarmModal(false)}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.buttonText}>Done</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEditClassModal = () => {
    if (!editingClass) return null;

    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingClass(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.editModalContent}>
            <ThemedText style={styles.modalTitle}>Edit Class</ThemedText>
            
            <TextInput
              style={styles.input}
              value={editSubject}
              onChangeText={setEditSubject}
              placeholder="Subject"
              placeholderTextColor="#999"
            />
            
            <View style={styles.timeRow}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                value={editStartTime}
                onChangeText={setEditStartTime}
                placeholder="Start Time"
                placeholderTextColor="#999"
              />
              <TextInput
                style={[styles.input, styles.timeInput]}
                value={editEndTime}
                onChangeText={setEditEndTime}
                placeholder="End Time"
                placeholderTextColor="#999"
              />
            </View>
            
            <TextInput
              style={styles.input}
              value={editRoom}
              onChangeText={setEditRoom}
              placeholder="Room (optional)"
              placeholderTextColor="#999"
            />
            
            <TextInput
              style={styles.input}
              value={editProfessor}
              onChangeText={setEditProfessor}
              placeholder="Professor (optional)"
              placeholderTextColor="#999"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditingClass(null)}
              >
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveEditedClass}
              >
                <ThemedText style={styles.buttonText}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderDayFilter = () => {
    if (!timetableData || !timetableData.days || timetableData.days.length === 0) {
      return null;
    }

    // Show all available days from the timetable data
    const availableDays = timetableData.days.filter(day => day.day && day.day.trim() !== '');
    
    if (availableDays.length === 0) {
      return null;
    }

    return (
      <View style={styles.dayFilterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayFilterContent}
        >
          {availableDays.map((daySchedule) => {
            const isSelected = selectedDay === daySchedule.day;
            
            return (
              <TouchableOpacity
                key={daySchedule.day}
                style={[
                  styles.dayFilterButton,
                  isSelected && styles.selectedDayFilterButton
                ]}
                onPress={() => setSelectedDay(daySchedule.day)}
              >
                <ThemedText style={[
                  styles.dayFilterText,
                  isSelected && styles.selectedDayFilterText
                ]}>
                  {daySchedule.day}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderClassCard = (classItem: ClassEntry, dayIndex: number, classIndex: number) => {
    const classId = getClassId(classItem, dayIndex, classIndex);
    const isReminderEnabled = classReminders[classId] || false;
    const animatedValue = animatedValues.get(classId) || new Animated.Value(1);
    
    return (
      <View
        key={`${classItem.subject}-${classIndex}`}
        style={[styles.classCard, { borderLeftColor: getTimeColor(classItem.startTime) }]}
      >
        <View style={styles.classHeader}>
          {/* Subject Icon and Main Info */}
          <View style={styles.classMainInfo}>
            <View style={[styles.subjectIconContainer, { backgroundColor: getTimeColor(classItem.startTime) + '20' }]}>
              <Ionicons 
                name={getSubjectIcon(classItem.subject) as any} 
                size={20} 
                color={getTimeColor(classItem.startTime)} 
              />
            </View>
            <View style={styles.classTextInfo}>
              <ThemedText style={styles.subjectText}>
                {classItem.subject}
              </ThemedText>
              <View style={styles.timeContainer}>
                <Ionicons name="time-outline" size={14} color={getTimeColor(classItem.startTime)} />
                <ThemedText style={[styles.timeText, { color: getTimeColor(classItem.startTime) }]}>
                  {formatTime(classItem.startTime)} - {formatTime(classItem.endTime)}
                </ThemedText>
              </View>
            </View>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.classActions}>
            {/* Individual Reminder Bell */}
            <Animated.View style={{ transform: [{ scale: animatedValue }] }}>
              <TouchableOpacity
                style={[
                  styles.reminderBell,
                  isReminderEnabled && styles.reminderBellActive
                ]}
                onPress={() => toggleClassReminder(classItem, dayIndex, classIndex)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={isReminderEnabled ? "notifications" : "notifications-outline"} 
                  size={18} 
                  color={isReminderEnabled ? "#FF6B35" : "#666"} 
                />
              </TouchableOpacity>
            </Animated.View>
            
            {/* Edit Button */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => editClass(dayIndex, classIndex, classItem)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color="#4285F4" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Class Details */}
        {(classItem.room || classItem.professor) && (
          <View style={styles.classDetails}>
            {classItem.room && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={12} color="#888" />
                <ThemedText style={styles.detailText}>
                  {classItem.room}
                </ThemedText>
              </View>
            )}
            {classItem.professor && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={12} color="#888" />
                <ThemedText style={styles.detailText}>
                  {classItem.professor}
                </ThemedText>
              </View>
            )}
          </View>
        )}
        
        {/* Reminder Status Indicator */}
        {isReminderEnabled && (
          <View style={styles.reminderIndicator}>
            <Ionicons name="alarm-outline" size={10} color="#FF6B35" />
            <ThemedText style={styles.reminderText}>20 min AI reminder</ThemedText>
          </View>
        )}
      </View>
    );
  };

  const renderCurrentDaySchedule = () => {
    const currentDay = getCurrentDay();
    
    if (!currentDay) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color="#CED4DA" />
          <ThemedText style={styles.emptyText}>No classes for {selectedDay}</ThemedText>
        </View>
      );
    }

    if (currentDay.classes.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-clear-outline" size={48} color="#CED4DA" />
          <ThemedText style={styles.emptyText}>No classes scheduled for {selectedDay}</ThemedText>
          <ThemedText style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
            Enjoy your free day! 🎉
          </ThemedText>
        </View>
      );
    }

    const dayIndex = timetableData?.days.findIndex(day => day.day === selectedDay) || 0;

    return (
      <ScrollView style={styles.classesContainer}>
        {currentDay.classes.map((classItem: ClassEntry, classIndex: number) => 
          renderClassCard(classItem, dayIndex, classIndex)
        )}
      </ScrollView>
    );
  };

  const renderToast = () => {
    if (!toastVisible) return null;
    
    const toastColors = {
      success: '#4CAF50',
      info: '#2196F3',
      warning: '#FF9800'
    };
    
    const toastIcons = {
      success: 'checkmark-circle-outline',
      info: 'information-circle-outline',
      warning: 'warning-outline'
    };
    
    return (
      <View style={[styles.toastContainer, { backgroundColor: toastColors[toastType] }]}>
        <Ionicons name={toastIcons[toastType] as any} size={20} color="white" />
        <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
      </View>
    );
  };

  // Render add custom class modal
  const renderAddClassModal = () => {
    return (
      <Modal
        visible={showAddClassModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddClassModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.editModalContent}>
            <ThemedText style={styles.modalTitle}>Add Custom Class</ThemedText>

            <TextInput
              style={styles.input}
              placeholder="Subject"
              value={newSubject}
              onChangeText={setNewSubject}
              placeholderTextColor="#999"
            />

            <View style={styles.timeRow}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="Start Time (HH:MM)"
                value={newStartTime}
                onChangeText={setNewStartTime}
                keyboardType="numbers-and-punctuation"
                placeholderTextColor="#999"
              />
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="End Time (HH:MM)"
                value={newEndTime}
                onChangeText={setNewEndTime}
                keyboardType="numbers-and-punctuation"
                placeholderTextColor="#999"
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Room (optional)"
              value={newRoom}
              onChangeText={setNewRoom}
              placeholderTextColor="#999"
            />

            <TextInput
              style={styles.input}
              placeholder="Professor (optional)"
              value={newProfessor}
              onChangeText={setNewProfessor}
              placeholderTextColor="#999"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddClassModal(false);
                  setNewSubject('');
                  setNewStartTime('');
                  setNewEndTime('');
                  setNewRoom('');
                  setNewProfessor('');
                }}
              >
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={addCustomClass}
              >
                <ThemedText style={styles.buttonText}>Add Class</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (!timetableData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back-outline" size={24} color="#4285F4" />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Daily Timetable</ThemedText>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#CED4DA" />
          <ThemedText style={styles.emptyText}>No timetable data available</ThemedText>
          <ThemedText style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
            Please upload your timetable first
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <ThemedView style={styles.container}>
        {/* Header section with logo, app name, and navigation */}
        <View style={styles.logoHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back-outline" size={24} color="#4285F4" />
          </TouchableOpacity>
          
          <View style={styles.centerContent}>
            <View style={styles.logoRow}>
              <Image 
                source={require('../../assets/images/YOGOCampus.jpg')}
                style={styles.logoImage}
                resizeMode="cover"
              />
              <View style={styles.textContent}>
                <ThemedText style={styles.appName}>YOGO Campus</ThemedText>
                <ThemedText style={styles.pageTitle}>Daily Time Table</ThemedText>
              </View>
            </View>
          </View>
          
          <View style={styles.headerRightButtons}>
            <TouchableOpacity
              style={styles.alarmButton}
              onPress={() => setShowAlarmModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={alarmSettings.enabled ? "notifications" : "notifications-outline"} 
                size={24} 
                color={alarmSettings.enabled ? "#FF6B35" : "#666"} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {renderDayFilter()}

        <View style={styles.scheduleContainer}>
          <View style={styles.dayTitleRow}>
            <ThemedText style={styles.dayTitle}>
              📅 {selectedDay}
            </ThemedText>
            <TouchableOpacity 
              style={styles.addClassButton}
              onPress={() => setShowAddClassModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={24} color="#4285F4" />
              <ThemedText style={styles.addClassText}>Add Class</ThemedText>
            </TouchableOpacity>
          </View>
          {renderCurrentDaySchedule()}
        </View>

        {renderEditClassModal()}
        {renderAlarmModal()}
        {renderAddClassModal()}
        {renderToast()}
      </ThemedView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 44,
  },
  dayFilterContainer: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  dayFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayFilterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  selectedDayFilterButton: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
    elevation: 3,
    shadowOpacity: 0.2,
  },
  dayFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
  },
  selectedDayFilterText: {
    color: 'white',
    fontWeight: '600',
  },
  scheduleContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  daySection: {
    marginBottom: 24,
  },
  dayTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dayTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingHorizontal: 4,
  },
  addClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  addClassText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4285F4',
    marginLeft: 4,
  },
  emptyDayState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  classesContainer: {
    flex: 1,
  },
  classCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  classMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subjectIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  classTextInfo: {
    flex: 1,
  },
  classActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderBell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reminderBellActive: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF6B35',
  },
  reminderIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 53, 0.1)',
  },
  reminderText: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: '500',
    marginLeft: 4,
  },
  classInfo: {
    flex: 1,
    marginRight: 8,
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
    color: '#666',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
  },
  classDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  detailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    width: '90%',
  },
  alarmModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 16,
  },
  cancelButton: {
    backgroundColor: '#757575',
    padding: 12,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 12,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  alarmSettingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  alarmSettingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  alarmSettingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  reminderOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 16,
  },
  reminderOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.3)',
  },
  selectedReminderOption: {
    backgroundColor: '#4285F4',
  },
  reminderOptionText: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '500',
  },
  selectedReminderOptionText: {
    color: 'white',
  },
  closeAlarmModalButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },

  alarmButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  alarmDescriptionContainer: {
    backgroundColor: 'rgba(66, 133, 244, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4285F4',
  },
  alarmDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  alarmFeatures: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  alarmSettingNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
  toastContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1000,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  logoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 8,
    borderRadius: 12,
  },
  textContent: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
    lineHeight: 18,
  },
  pageTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    lineHeight: 13,
    marginTop: 1,
  },
  spacer: {
    flex: 1,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

});

export default DailyTimetable;
