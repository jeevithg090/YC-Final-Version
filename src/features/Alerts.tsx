import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/router';
import { db, collection, onSnapshot, orderBy, query, doc, updateDoc, auth } from '../services/firebase';

// Notification type for Alerts
interface AlertNotification {
  id: string;
  type: 'event' | 'study' | 'roommate' | 'mess' | 'mentions' | 'system';
  title: string;
  body?: string;
  icon: string;
  time: string;
  read: boolean;
  meal?: string;
  day?: string;
  messName?: string;
  // Class notification specific fields
  subject?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  professor?: string;
  dayName?: string;
  isFirstClass?: boolean;
  userId?: string;
}

type AlertFilter = 'all' | 'mentions' | 'system' | 'club' | 'class';

type AlertsNavigationProp = StackNavigationProp<RootStackParamList>;

const Alerts: React.FC = () => {
  const navigation = useNavigation<AlertsNavigationProp>();
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<AlertFilter>('all');

  // Remove mock currentUser, use real auth user
  const user = auth.currentUser;
  const currentUser = user
    ? {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        avatar: user.photoURL || undefined,
      }
    : null;

  // Format time to readable string
  const formatTime = (iso: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], options)}`;
    }
    return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}, ${date.toLocaleTimeString([], options)}`;
  };

  // Mark a single notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'alerts', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });
      console.log(`Marked notification ${notificationId} as read`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(notification => !notification.read);
      const updatePromises = unreadNotifications.map(notification => 
        updateDoc(doc(db, 'alerts', notification.id), { read: true })
      );
      await Promise.all(updatePromises);
      console.log(`Marked ${unreadNotifications.length} notifications as read`);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Handle notification tap
  const handleNotificationTap = async (notification: AlertNotification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
    
    // For now, just mark as read. Navigation can be added later if needed
    console.log(`Tapped on ${notification.type} notification: ${notification.title}`);
  };

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: AlertNotification[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type || 'mess',
          title: data.title || '',
          body: data.body || '',
          icon: data.icon || 'notifications-outline',
          time: data.time || '',
          read: data.read || false,
          meal: data.meal,
          day: data.day,
          messName: data.messName,
          subject: data.subject,
          startTime: data.startTime,
          endTime: data.endTime,
          room: data.room,
          professor: data.professor,
          dayName: data.dayName,
          isFirstClass: data.isFirstClass,
          userId: data.userId // include userId for filtering
        };
      });
      setNotifications(fetched);
    });
    return () => unsubscribe();
  }, []);

  // Filter notifications based on selected filter and userId
  const filteredNotifications = notifications.filter(notification => {
    if (!currentUser) return false;
    if (notification.userId && notification.userId !== currentUser.id) return false;
    switch (notificationFilter) {
      case 'all':
        return true;
      case 'mentions':
        return notification.type === 'mentions';
      case 'system':
        return notification.type === 'system';
      case 'club':
        return notification.type === 'event';
      case 'class':
        return notification.type === 'study';
      default:
        return true;
    }
  });

  // Check if there are unread notifications
  const hasUnreadNotifications = notifications.some(notification => !notification.read);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.reset({
            index: 0,
            routes: [{ name: 'Dashboard' }],
          })}
        >
          <Ionicons name="arrow-back" size={24} color="#4E54C8" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Alerts</Text>
        <View style={styles.navSpacer} />
      </View>

      <View style={styles.tabContentTransparent}>
        <View style={styles.notificationFilters}>
          {(['all', 'mentions', 'system', 'club', 'class'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                notificationFilter === filter && styles.activeFilterButton,
              ]}
              onPress={() => setNotificationFilter(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  notificationFilter === filter && styles.activeFilterText,
                ]}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mark all as read button */}
        {hasUnreadNotifications && (
          <TouchableOpacity
            style={styles.markAllReadButton}
            onPress={markAllNotificationsAsRead}
          >
            <Text style={styles.markAllReadText}>Mark all as read</Text>
          </TouchableOpacity>
        )}

        <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationItem, !notification.read && styles.unreadNotificationItem]}
                onPress={() => handleNotificationTap(notification)}
                activeOpacity={0.7}
              >  
                <View style={styles.notificationIconContainer}>
                  <Ionicons name={notification.icon as any} size={20} color="#4E54C8" />
                </View>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  {notification.body ? (
                    <Text style={styles.notificationBody}>{notification.body}</Text>
                  ) : null}
                  {/* Show meal, day, messName for mess notifications */}
                  {notification.type === 'mess' && (notification.meal || notification.day || notification.messName) && (
                    <Text style={styles.notificationMeta}>
                      {notification.meal ? `${notification.meal.charAt(0).toUpperCase() + notification.meal.slice(1)}` : ''}
                      {notification.day ? ` • ${notification.day.charAt(0).toUpperCase() + notification.day.slice(1)}` : ''}
                      {notification.messName ? ` • ${notification.messName}` : ''}
                    </Text>
                  )}
                  {/* Show class details for study notifications */}
                  {notification.type === 'study' && notification.subject && (
                    <Text style={styles.notificationMeta}>
                      {notification.subject}
                      {notification.startTime ? ` • ${notification.startTime}` : ''}
                      {notification.room ? ` • Room ${notification.room}` : ''}
                      {notification.professor ? ` • ${notification.professor}` : ''}
                      {notification.dayName && notification.dayName !== 'Test' ? ` • ${notification.dayName}` : ''}
                    </Text>
                  )}
                  <Text style={styles.notificationTime}>{formatTime(notification.time)}</Text>
                </View>
                {!notification.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyNotifications}>
              <Ionicons name="notifications-off-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyNotificationsText}>No notifications yet</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  navSpacer: {
    width: 40,
  },
  tabContentTransparent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  notificationFilters: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
  },
  activeFilterButton: {
    backgroundColor: '#4E54C8',
  },
  filterText: {
    color: '#8E8E93',
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  notificationsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8EAF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  notificationBody: {
    fontSize: 14,
    color: '#444',
    marginTop: 2,
    marginBottom: 2,
  },
  notificationMeta: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  notificationTime: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  unreadNotificationItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#4E54C8',
    backgroundColor: '#F5F7FF',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4E54C8',
    marginLeft: 8,
  },
  emptyNotifications: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyNotificationsText: {
    color: '#C7C7CC',
    fontSize: 16,
    marginTop: 12,
  },
  markAllReadButton: {
    backgroundColor: '#4E54C8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  markAllReadText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Alerts;
