import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';

// TypeScript interfaces
interface MatchNotification {
  id: string;
  userId: string;
  rideId: string;
  matchedWithUserId: string;
  matchedWithUserName: string;
  rideDetails: {
    pickupLocation: string;
    dropLocation: string;
    travelDate: any;
    cabTravelTime: any;
  };
  createdAt: any;
  status: 'pending' | 'accepted' | 'declined';
}

interface RideMatchNotifierProps {
  userId: string; // Current user ID
  onMatchFound?: (notification: MatchNotification) => void;
}

const RideMatchNotifier: React.FC<RideMatchNotifierProps> = ({ 
  userId, 
  onMatchFound 
}) => {
  const [notifications, setNotifications] = useState<MatchNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for new match notifications for this user
    const notificationsQuery = query(
      collection(db, 'ride_match_notifications'),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const newNotifications: MatchNotification[] = [];
      
      snapshot.forEach((doc) => {
        const notificationData = { id: doc.id, ...doc.data() } as MatchNotification;
        newNotifications.push(notificationData);
      });

      setNotifications(newNotifications);
      setLoading(false);

      // Call callback for new notifications
      if (newNotifications.length > 0 && onMatchFound) {
        newNotifications.forEach(notification => {
          onMatchFound(notification);
        });
      }
    });

    return () => unsubscribe();
  }, [userId, onMatchFound]);

  // Function to create a match notification
  const createMatchNotification = async (
    targetUserId: string,
    rideId: string,
    matchedWithUserId: string,
    matchedWithUserName: string,
    rideDetails: any
  ) => {
    try {
      await addDoc(collection(db, 'ride_match_notifications'), {
        userId: targetUserId,
        rideId: rideId,
        matchedWithUserId: matchedWithUserId,
        matchedWithUserName: matchedWithUserName,
        rideDetails: rideDetails,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
    } catch (error) {
      console.error('Error creating match notification:', error);
    }
  };

  const formatDateTime = (date: any, time: any) => {
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    const timeObj = time.toDate ? time.toDate() : new Date(time);
    
    const dateStr = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    const timeStr = timeObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    return `${dateStr} at ${timeStr}`;
  };

  const handleAcceptMatch = async (notification: MatchNotification) => {
    Alert.alert(
      'Accept Ride Match',
      `Accept ride match with ${notification.matchedWithUserName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => {
            // Handle acceptance logic here
            Alert.alert('Match Accepted!', 'You can now chat with other passengers.');
          }
        }
      ]
    );
  };

  const handleDeclineMatch = async (notification: MatchNotification) => {
    Alert.alert(
      'Decline Ride Match',
      'Are you sure you want to decline this match?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            // Handle decline logic here
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#007bff" />
      </View>
    );
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      {notifications.map((notification) => (
        <View key={notification.id} style={styles.notificationCard}>
          <LinearGradient
            colors={['#e3f2fd', '#ffffff']}
            style={styles.cardGradient}
          >
            <View style={styles.notificationHeader}>
              <Ionicons name="car" size={20} color="#007bff" />
              <Text style={styles.notificationTitle}>Ride Match Found! 🎉</Text>
            </View>
            
            <Text style={styles.notificationText}>
              {notification.matchedWithUserName} wants to share a ride with you
            </Text>
            
            <View style={styles.rideInfo}>
              <Text style={styles.routeText}>
                {notification.rideDetails.pickupLocation} → {notification.rideDetails.dropLocation}
              </Text>
              <Text style={styles.dateTimeText}>
                {formatDateTime(notification.rideDetails.travelDate, notification.rideDetails.cabTravelTime)}
              </Text>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={() => handleDeclineMatch(notification)}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAcceptMatch(notification)}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      ))}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  notificationCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardGradient: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 8,
  },
  notificationText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 12,
  },
  rideInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  dateTimeText: {
    fontSize: 12,
    color: '#6c757d',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default RideMatchNotifier;
// Firebase Console Action: Create 'ride_match_notifications' collection with read/write rules
