import { doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PointTransaction {
  id: string;
  action: string;
  points: number;
  timestamp: number;
  category: string;
  description: string;
}

export interface UserPoints {
  totalPoints: number;
  currentLevel: number;
  streak: number;
  lastLoginDate: string;
  pointsHistory: PointTransaction[];
  badges: string[];
  achievements: any[];
  timetableStreak?: number;
  lastTimetableUseDate?: string;
}

/**
 * Awards points to the current user for a specific action
 * @param actionKey - The key identifying the action
 * @param points - Number of points to award
 * @param category - Category of the action
 * @param description - Human-readable description
 */
export const awardPoints = async (
  actionKey: string, 
  points: number, 
  category: string = 'General', 
  description: string = 'Points earned'
): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid || await AsyncStorage.getItem('userId') || 'default_user';
    if (userId === 'default_user') {
      console.warn('[PointsService] Awarding points to default_user! This should only happen for anonymous/test users.');
    }
    const userDocRef = doc(db, 'user_points', userId);
    
    // Get current user data
    const userDoc = await getDoc(userDocRef);
    let userData: UserPoints;
    
    if (userDoc.exists()) {
      userData = userDoc.data() as UserPoints;
    } else {
      // Initialize new user
      userData = {
        totalPoints: 0,
        currentLevel: 0,
        streak: 0,
        lastLoginDate: new Date().toDateString(),
        pointsHistory: [],
        badges: [],
        achievements: []
      };
      await setDoc(userDocRef, userData);
    }

    const transaction: PointTransaction = {
      id: Date.now().toString(),
      action: actionKey,
      points,
      timestamp: Date.now(),
      category,
      description
    };

    const updatedHistory = [...userData.pointsHistory, transaction].slice(-50); // Keep last 50

    await updateDoc(userDocRef, {
      totalPoints: increment(points),
      pointsHistory: updatedHistory
    });

    console.log(`Awarded ${points} points for ${actionKey}`);
  } catch (error) {
    console.error('Error awarding points:', error);
  }
};

/**
 * Quick functions for common point actions
 */
export const quickAwardPoints = {
  // Daily actions
  dailyLogin: () => awardPoints('daily_login', 5, 'Daily', 'Daily login bonus'),
  
  // Mess actions
  messMenuCheck: () => awardPoints('mess_menu_check', 3, 'Mess', 'Checked mess menu'),
  dishFeedback: () => awardPoints('dish_feedback', 2, 'Mess', 'Gave feedback on a dish'),
  
  // Study actions
  timetableUpload: () => awardPoints('timetable_upload', 10, 'Study', 'Uploaded timetable'),
  classReminderSet: () => awardPoints('class_reminder_set', 5, 'Study', 'Set class reminder'),
  aiQnaUsage: () => awardPoints('ai_qna_usage', 8, 'Study', 'Used AI or QnA Forum'),
  
  // Social actions
  eventAttendance: () => awardPoints('event_attendance', 25, 'Events', 'Attended campus event'),
  friendReferral: () => awardPoints('friend_referral', 50, 'Social', 'Referred a friend'),
  
  // Marketplace actions
  itemListed: () => awardPoints('item_listed', 8, 'Marketplace', 'Listed an item for sale'),
  itemSold: () => awardPoints('successful_sale', 20, 'Marketplace', 'Item successfully sold'),
  seniorPurchase: () => awardPoints('senior_purchase', 10, 'Marketplace', 'Bought from a senior'),
  
  // Forum actions
  doubtAsked: () => awardPoints('doubt_asked', 5, 'Forum', 'Asked a question'),
  solutionPosted: () => awardPoints('solution_posted', 20, 'Forum', 'Posted helpful solution'),
  
  // Community actions
  feedbackSubmitted: () => awardPoints('feedback_submitted', 10, 'Community', 'Submitted feedback'),
  foundItemReported: () => awardPoints('found_item_reported', 15, 'Community', 'Reported found item'),
  itemRecovered: () => awardPoints('item_recovered', 10, 'Community', 'Recovered lost item'),
  
  // Sports actions
  matchPlayed: () => awardPoints('match_played', 10, 'Sports', 'Played a match'),
  gameWon: () => awardPoints('game_won', 15, 'Sports', 'Won a game'),
  
  // Transport actions
  rideOffered: () => awardPoints('ride_offered', 10, 'Transport', 'Offered a ride'),
  rideTaken: () => awardPoints('ride_taken', 5, 'Transport', 'Took a ride'),
  
  // Custom action
  custom: (action: string, points: number, category: string, description: string) => 
    awardPoints(action, points, category, description)
};

/**
 * Get user's current points data
 */
export const getUserPoints = async (): Promise<UserPoints | null> => {
  try {
    const userId = auth.currentUser?.uid || await AsyncStorage.getItem('userId') || 'default_user';
    const userDocRef = doc(db, 'user_points', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserPoints;
    }
    return null;
  } catch (error) {
    console.error('Error getting user points:', error);
    return null;
  }
};

/**
 * Updates the user's streak and lastLoginDate if they visit the dashboard on a new day
 */
export const updateStreakOnDashboardVisit = async (): Promise<void> => {
  try {
    const userId = auth.currentUser?.uid || await AsyncStorage.getItem('userId') || 'default_user';
    const userDocRef = doc(db, 'user_points', userId);
    const userDoc = await getDoc(userDocRef);
    let userData: UserPoints;
    const today = new Date();
    const todayStr = today.toDateString();
    if (userDoc.exists()) {
      userData = userDoc.data() as UserPoints;
      const lastLogin = userData.lastLoginDate || '';
      if (lastLogin !== todayStr) {
        // Calculate difference in days
        const lastDate = lastLogin ? new Date(lastLogin) : null;
        let newStreak = 1;
        if (lastDate) {
          const diff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diff === 1) {
            newStreak = (userData.streak || 0) + 1;
          } else {
            newStreak = 1;
          }
        }
        await updateDoc(userDocRef, {
          streak: newStreak,
          lastLoginDate: todayStr
        });
      }
    } else {
      // Initialize new user
      userData = {
        totalPoints: 0,
        currentLevel: 0,
        streak: 1,
        lastLoginDate: todayStr,
        pointsHistory: [],
        badges: [],
        achievements: []
      };
      await setDoc(userDocRef, userData);
    }
  } catch (error) {
    console.error('Error updating streak on dashboard visit:', error);
  }
};

// Firebase Console Action: Create 'user_points' collection in Firestore with the following security rules:
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /user_points/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
*/
