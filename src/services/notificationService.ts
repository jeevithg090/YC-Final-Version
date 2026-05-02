import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc,
  doc,
  orderBy,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { ClassEntry, TimetableData } from '../types/timetable';
import * as Notifications from 'expo-notifications';
import aiNotificationService from './aiNotificationService';

// Firestore collection for scheduled notifications (now unused but kept for data integrity)
const SCHEDULED_NOTIFICATIONS_COLLECTION = 'scheduled_notifications';
// Firestore collection for alerts (used by Alerts.tsx)
const ALERTS_COLLECTION = 'alerts';

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

export interface ScheduledNotification {
  id?: string;
  userId: string;
  classData: ClassEntry;
  scheduledTime: Date;
  dayName: string;
  reminderMinutes: number;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
}

class NotificationService {
  private userId: string = 'user123'; // Replace with actual user authentication
  private scheduledNotificationIds: string[] = [];

  // Initialize Expo notifications
  async initializeNotifications(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      console.log('Expo Notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  // Schedule class alarms with AI-generated messages
  async scheduleClassAlarms(
    timetableData: TimetableData, 
    reminderMinutes: number = 20
  ): Promise<void> {
    try {
      console.log('Scheduling class alarms with AI-generated messages...');
      
      // Cancel existing notifications first
      await this.cancelAllAlarms();
      
      const hasPermission = await this.initializeNotifications();
      if (!hasPermission) {
        throw new Error('Notification permissions not granted');
      }

      const today = new Date();
      const currentTime = today.getHours() * 60 + today.getMinutes();
      
      // Get day names mapping
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayAbbreviations: { [key: string]: string } = {
        'SUN': 'Sunday', 'SUNDAY': 'Sunday',
        'MON': 'Monday', 'MONDAY': 'Monday',
        'TUE': 'Tuesday', 'TUESDAY': 'Tuesday', 'TUES': 'Tuesday',
        'WED': 'Wednesday', 'WEDNESDAY': 'Wednesday',
        'THU': 'Thursday', 'THURSDAY': 'Thursday', 'THURS': 'Thursday',
        'FRI': 'Friday', 'FRIDAY': 'Friday',
        'SAT': 'Saturday', 'SATURDAY': 'Saturday'
      };

      const scheduledNotifications: string[] = [];

      for (const daySchedule of timetableData.days) {
        if (!daySchedule.classes || daySchedule.classes.length === 0) continue;

        // Convert day abbreviation to full name
        const fullDayName = dayAbbreviations[daySchedule.day.toUpperCase()] || daySchedule.day;
        const dayIndex = dayNames.indexOf(fullDayName);
        if (dayIndex === -1) continue;

        // Sort classes by time to identify first class
        const sortedClasses = [...daySchedule.classes].sort((a, b) => {
          const timeA = this.parseTime(a.startTime);
          const timeB = this.parseTime(b.startTime);
          return timeA - timeB;
        });

        // Only schedule notification for the first class of the day
        if (sortedClasses.length > 0) {
          const classEntry = sortedClasses[0];
          const isFirstClass = true;

          // Calculate next occurrence of this day
          let daysUntilClass = (dayIndex - today.getDay() + 7) % 7;
          if (daysUntilClass === 0) {
            // It's today - check if class hasn't started yet
            const classTimeMinutes = this.parseTime(classEntry.startTime) / (1000 * 60);
            if (classTimeMinutes <= currentTime) {
              daysUntilClass = 7; // Schedule for next week
            }
          }

          const classDate = new Date(today);
          classDate.setDate(today.getDate() + daysUntilClass);

          // Set notification time (22 minutes before class for AI processing, but show as 20 min)
          const classTimeMs = this.parseTime(classEntry.startTime);
          const classTime = new Date(classDate);
          classTime.setHours(0, 0, 0, 0);
          classTime.setTime(classTime.getTime() + classTimeMs);

          const notificationTime = new Date(classTime.getTime() - (22 * 60 * 1000)); // 22 minutes before

          // Only schedule if notification time is in the future
          if (notificationTime > new Date()) {
            try {
              // Generate AI message (with 2-minute buffer for processing)
              const aiMessage = await aiNotificationService.generateClassReminder(classEntry, isFirstClass);

              // Save to alerts collection for Alerts.tsx
              await this.saveClassAlertToFirestore(classEntry, aiMessage, isFirstClass, fullDayName);

              const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                  title: '🌅 New Day Begins!',
                  body: aiMessage,
                  sound: 'default',
                  data: {
                    classId: `${daySchedule.day}_0`,
                    subject: classEntry.subject,
                    startTime: classEntry.startTime,
                    isFirstClass: isFirstClass
                  }
                },
                trigger: {
                  type: 'date',
                  date: notificationTime,
                } as Notifications.DateTriggerInput
              });

              scheduledNotifications.push(notificationId);
              console.log(`Scheduled first class notification for ${classEntry.subject} on ${fullDayName} at ${notificationTime.toLocaleTimeString()}`);
            } catch (aiError) {
              console.error('AI message generation failed, using fallback:', aiError);

              // Fallback notification without AI
              const fallbackMessage = `🌅 Good morning! Time to start your day with ${classEntry.subject} at ${classEntry.startTime}`;

              // Save fallback alert to Firestore
              await this.saveClassAlertToFirestore(classEntry, fallbackMessage, isFirstClass, fullDayName);

              const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                  title: '🌅 New Day Begins!',
                  body: fallbackMessage,
                  sound: 'default',
                  data: {
                    classId: `${daySchedule.day}_0`,
                    subject: classEntry.subject,
                    startTime: classEntry.startTime,
                    isFirstClass: isFirstClass
                  }
                },
                trigger: {
                  type: 'date',
                  date: notificationTime,
                } as Notifications.DateTriggerInput
              });

              scheduledNotifications.push(notificationId);
            }
          }
        }
      }

      this.scheduledNotificationIds = scheduledNotifications;
      console.log(`Successfully scheduled ${scheduledNotifications.length} notifications`);
      
    } catch (error) {
      console.error('Error scheduling class alarms:', error);
      throw error;
    }
  }

  // Clear existing scheduled notifications for this user
  private async clearScheduledNotifications(): Promise<void> {
    try {
      const notificationsRef = collection(db, SCHEDULED_NOTIFICATIONS_COLLECTION);
      const q = query(notificationsRef, where('userId', '==', this.userId), where('status', '==', 'pending'));
      const querySnapshot = await getDocs(q);
      
      const deletePromises: Promise<void>[] = [];
      querySnapshot.forEach((docSnapshot) => {
        deletePromises.push(deleteDoc(doc(db, SCHEDULED_NOTIFICATIONS_COLLECTION, docSnapshot.id)));
      });
      
      await Promise.all(deletePromises);
      console.log('Cleared existing scheduled notifications');
    } catch (error) {
      console.error('Error clearing scheduled notifications:', error);
    }
  }

  // Parse time string to milliseconds from midnight
  private parseTime(timeString: string): number {
    let cleanTime = timeString.replace(/\s?(AM|PM|am|pm)\s?/g, '');
    const isPM = timeString.toLowerCase().includes('pm');
    const isAM = timeString.toLowerCase().includes('am');
    
    const timeParts = cleanTime.split(':');
    if (timeParts.length !== 2) return 0;
    
    let hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    // Handle 12-hour format conversion
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (isAM && hours === 12) {
      hours = 0;
    }
    
    // Validate hours and minutes
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return 0;
    }
    
    return (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
  }

  // Cancel all scheduled alarms
  async cancelAllAlarms(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduledNotificationIds = [];
      await this.clearScheduledNotifications();
      console.log('All scheduled notifications cancelled');
    } catch (error) {
      console.error('Error cancelling alarms:', error);
      throw error;
    }
  }

  // Send test notification with AI-generated message
  async sendTestNotification(classData: ClassEntry, reminderMinutes: number = 20): Promise<void> {
    try {
      const hasPermission = await this.initializeNotifications();
      if (!hasPermission) {
        throw new Error('Notification permissions not granted');
      }

      // Generate AI message for test
      const aiMessage = await aiNotificationService.generateClassReminder(classData, true);
      
      // Save test notification to alerts collection
      await this.saveClassAlertToFirestore(classData, aiMessage, true, 'Test');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Notification',
          body: aiMessage,
          sound: 'default',
          data: {
            test: true,
            subject: classData.subject,
            startTime: classData.startTime
          }
        },
        trigger: {
          type: 'date',
          date: new Date(Date.now() + 3000), // 3 seconds from now
        } as Notifications.DateTriggerInput
      });

      console.log('Test notification scheduled successfully');
    } catch (error) {
      console.error('Error sending test notification:', error);
      
      // Fallback test notification
      const fallbackMessage = `Test reminder for ${classData.subject} at ${classData.startTime}`;
      
      // Save fallback test notification to alerts collection
      await this.saveClassAlertToFirestore(classData, fallbackMessage, true, 'Test');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Notification',
          body: fallbackMessage,
          sound: 'default',
          data: {
            test: true,
            subject: classData.subject,
            startTime: classData.startTime
          }
        },
        trigger: {
          type: 'date',
          date: new Date(Date.now() + 3000),
        } as Notifications.DateTriggerInput
      });
    }
  }

  // Save class notification to alerts collection for Alerts.tsx
  private async saveClassAlertToFirestore(
    classEntry: ClassEntry, 
    message: string, 
    isFirstClass: boolean = false,
    dayName?: string
  ): Promise<void> {
    try {
      const alertData = {
        type: 'study' as const, // Use 'study' type for class notifications
        title: isFirstClass ? '🌅 New Day Begins!' : '📚 Class Reminder',
        body: message,
        icon: 'school-outline',
        time: new Date().toISOString(),
        read: false,
        // Class-specific data
        subject: classEntry.subject,
        startTime: classEntry.startTime,
        endTime: classEntry.endTime,
        room: classEntry.room || '',
        professor: classEntry.professor || '',
        dayName: dayName || '',
        isFirstClass: isFirstClass,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, ALERTS_COLLECTION), alertData);
      console.log(`Class alert saved to Firestore for ${classEntry.subject}`);
    } catch (error) {
      console.error('Error saving class alert to Firestore:', error);
    }
  }

  // Public method to manually save a class alert (for testing)
  async saveClassAlert(
    classEntry: ClassEntry, 
    message: string, 
    isFirstClass: boolean = false,
    dayName?: string
  ): Promise<void> {
    return this.saveClassAlertToFirestore(classEntry, message, isFirstClass, dayName);
  }

  // Get notification history for debugging
  async getNotificationHistory(): Promise<ScheduledNotification[]> {
    try {
      const notificationsRef = collection(db, SCHEDULED_NOTIFICATIONS_COLLECTION);
      const q = query(
        notificationsRef, 
        where('userId', '==', this.userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const notifications: ScheduledNotification[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          userId: data.userId,
          classData: data.classData,
          scheduledTime: data.scheduledTime.toDate(),
          dayName: data.dayName,
          reminderMinutes: data.reminderMinutes,
          status: data.status,
          createdAt: data.createdAt.toDate()
        });
      });
      
      return notifications;
    } catch (error) {
      console.error('Error getting notification history:', error);
      return [];
    }
  }

  // Send a generic alert to a user (for QnA upvotes, replies, etc)
  async sendUserAlert({
    userId,
    type = 'system',
    title,
    body,
    icon = 'notifications-outline',
    extra = {},
  }: {
    userId: string;
    type?: string;
    title: string;
    body: string;
    icon?: string;
    extra?: Record<string, any>;
  }): Promise<void> {
    try {
      const alertData = {
        userId,
        type,
        title,
        body,
        icon,
        time: new Date().toISOString(),
        read: false,
        createdAt: serverTimestamp(),
        ...extra,
      };
      await addDoc(collection(db, ALERTS_COLLECTION), alertData);
      console.log(`Alert sent to user ${userId}: ${title}`);
    } catch (error) {
      console.error('Error sending user alert:', error);
    }
  }
}

export default new NotificationService();

/*
 * EXPO NOTIFICATIONS IMPLEMENTATION:
 * ==================================
 * 
 * This service now uses Expo Notifications with AI-powered message generation.
 * 
 * Features:
 * - AI-generated motivational messages using OpenRouter API
 * - Special "start of new day" messages for first classes
 * - 22-minute scheduling buffer (2 min for AI processing, shown as 20 min to user)
 * - Multiple AI model fallbacks for reliability
 * - Expo-compatible local notifications
 * 
 * AI Models Used (in priority order):
 * 1. meta-llama/llama-3.2-3b-instruct:free (primary)
 * 2. microsoft/phi-3-mini-128k-instruct:free (backup)
 * 3. google/gemma-2-9b-it:free (backup)
 * 4. qwen/qwen-2-7b-instruct:free (backup)
 * 
 * Requirements:
 * - expo-notifications package (already installed)
 * - OpenRouter API key (configured in aiNotificationService.ts)
 * - Notification permissions from user
 * 
 * Usage:
 * - Schedule alarms: await notificationService.scheduleClassAlarms(timetableData, 20)
 * - Test notifications: await notificationService.sendTestNotification(classData)
 * - Cancel all: await notificationService.cancelAllAlarms()
 */
