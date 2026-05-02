import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth, collection, query, where, getDocs, doc, getDoc, updateDoc } from '../services/firebase';
import { 
} from 'firebase/firestore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// TypeScript interfaces
interface UserRide {
  id: string;
  userId: string;
  rideId: string;
  publishedRideId?: string;
  role: 'creator' | 'passenger';
  createdAt: any;
  status: 'active' | 'completed' | 'cancelled';
}

interface RideDetails {
  id: string;
  pickupLocation: string;
  dropLocation: string;
  travelDate: any;
  cabTravelTime: any;
  passengers: any[];
  maxPassengers: number;
  totalCost: number;
  status: string;
  role: 'creator' | 'passenger';
  createdAt?: any;
}

interface AutoRideDetails {
  id: string;
  pickupLocation: string;
  dropLocation: string;
  travelDate: any;
  autoTravelTime: any;
  passengers: any[];
  maxPassengers: number;
  autoCost: string;
  status: string;
  role: 'creator' | 'passenger';
  createdAt?: any;
}

const YourRides: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [userRides, setUserRides] = useState<RideDetails[]>([]);
  const [userAutoRides, setUserAutoRides] = useState<AutoRideDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'cab' | 'auto'>('cab');

  const fetchUserRides = async () => {
    try {
      // Check if user is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Login Required', 'Please log in to view your rides.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get user rides - simplified query to avoid index requirements
      const userRidesQuery = query(
        collection(db, 'user_rides'),
        where('userId', '==', currentUser.uid)
      );
      
      const userRidesSnapshot = await getDocs(userRidesQuery);
      const rideDetailsPromises: Promise<RideDetails | null>[] = [];
      
      userRidesSnapshot.forEach((doc) => {
        const userRideData = { id: doc.id, ...doc.data() } as UserRide;
        
        // Filter for active rides on the client side to avoid index requirements
        if (userRideData.status === 'active') {
          // Fetch ride details
          const rideDetailPromise = fetchRideDetails(userRideData.rideId, userRideData.role);
          rideDetailsPromises.push(rideDetailPromise);
        }
      });
      
      const rideDetailsResults = await Promise.all(rideDetailsPromises);
      const validRideDetails = rideDetailsResults.filter((ride): ride is RideDetails => ride !== null);
      
      // Sort by created date on client side (simple fallback sorting)
      validRideDetails.sort((a, b) => {
        try {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
        } catch (error) {
          // Fallback: sort by ID if date parsing fails
          return b.id.localeCompare(a.id);
        }
      });
      
      setUserRides(validRideDetails);
    } catch (error) {
      console.error('Error fetching user rides:', error);
      Alert.alert('Error', 'Failed to load your rides. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserAutoRides = async () => {
    try {
      // Check if user is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Login Required', 'Please log in to view your rides.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get user auto rides
      const userRidesQuery = query(
        collection(db, 'user_auto_rides'),
        where('userId', '==', currentUser.uid)
      );
      
      const userRidesSnapshot = await getDocs(userRidesQuery);
      const rideDetailsPromises: Promise<AutoRideDetails | null>[] = [];
      
      userRidesSnapshot.forEach((doc) => {
        const userRideData = { id: doc.id, ...doc.data() } as UserRide;
        
        // Filter for active rides on the client side to avoid index requirements
        if (userRideData.status === 'active') {
          // Fetch ride details
          const rideDetailPromise = fetchAutoRideDetails(userRideData.rideId, userRideData.role);
          rideDetailsPromises.push(rideDetailPromise);
        }
      });
      
      const rideDetailsResults = await Promise.all(rideDetailsPromises);
      const validRideDetails = rideDetailsResults.filter((ride): ride is AutoRideDetails => ride !== null);
      
      // Sort by created date on client side (simple fallback sorting)
      validRideDetails.sort((a, b) => {
        try {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
        } catch (error) {
          // Fallback: sort by ID if date parsing fails
          return b.id.localeCompare(a.id);
        }
      });
      
      setUserAutoRides(validRideDetails);
    } catch (error) {
      console.error('Error fetching user auto rides:', error);
      Alert.alert('Error', 'Failed to load your auto rides. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRideDetails = async (rideId: string, role: 'creator' | 'passenger'): Promise<RideDetails | null> => {
    try {
      const rideDoc = await getDoc(doc(db, 'cab_rides', rideId));
      
      if (rideDoc.exists()) {
        const rideData = { id: rideDoc.id, ...rideDoc.data() } as any;
        return {
          ...rideData,
          role: role,
          createdAt: rideData.createdAt || rideData.timestamp // Include createdAt from the document
        } as RideDetails;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching ride details:', error);
      return null;
    }
  };

  const fetchAutoRideDetails = async (rideId: string, role: 'creator' | 'passenger'): Promise<AutoRideDetails | null> => {
    try {
      const rideDoc = await getDoc(doc(db, 'auto_rides', rideId));
      
      if (rideDoc.exists()) {
        const rideData = { id: rideDoc.id, ...rideDoc.data() } as any;
        return {
          ...rideData,
          role: role,
          createdAt: rideData.createdAt || rideData.timestamp // Include createdAt from the document
        } as AutoRideDetails;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching auto ride details:', error);
      return null;
    }
  };

  useEffect(() => {
    if (viewMode === 'cab') {
      fetchUserRides();
    } else {
      fetchUserAutoRides();
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    if (viewMode === 'cab') {
      fetchUserRides();
    } else {
      fetchUserAutoRides();
    }
  };

  const formatDate = (date: any): string => {
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time: any): string => {
    const timeObj = time.toDate ? time.toDate() : new Date(time);
    return timeObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getRoleIcon = (role: 'creator' | 'passenger') => {
    return role === 'creator' ? '👨‍✈️' : '🧳';
  };

  const getRoleText = (role: 'creator' | 'passenger') => {
    return role === 'creator' ? 'Ride Creator' : 'Passenger';
  };

  const toggleViewMode = (mode: 'cab' | 'auto') => {
    if (mode !== viewMode) {
      setViewMode(mode);
      setLoading(true);
      if (mode === 'cab') {
        fetchUserRides();
      } else {
        fetchUserAutoRides();
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#28a745';
      case 'completed':
        return '#6c757d';
      case 'cancelled':
        return '#dc3545';
      default:
        return '#007bff';
    }
  };

  const renderRideCard = (ride: RideDetails) => (
    <TouchableOpacity
      key={ride.id}
      style={styles.rideCard}
      onPress={() => navigation.navigate('CabRideDetails', { rideId: ride.id })}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#ffffff', '#f8f9fa']}
        style={styles.cardGradient}
      >
        {/* Header with role and status */}
        <View style={styles.cardHeader}>
          <View style={styles.roleContainer}>
            <Text style={styles.roleIcon}>{getRoleIcon(ride.role)}</Text>
            <Text style={styles.roleText}>{getRoleText(ride.role)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
            <Text style={styles.statusText}>{ride.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Route Information */}
        <View style={styles.routeContainer}>
          <View style={styles.locationRow}>
            <Ionicons name="radio-button-on" size={16} color="#28a745" />
            <Text style={styles.locationText} numberOfLines={1}>
              {ride.pickupLocation}
            </Text>
          </View>
          
          <View style={styles.routeLine} />
          
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#dc3545" />
            <Text style={styles.locationText} numberOfLines={1}>
              {ride.dropLocation}
            </Text>
          </View>
        </View>

        {/* Date and Time */}
        <View style={styles.dateTimeContainer}>
          <View style={styles.dateTimeItem}>
            <Ionicons name="calendar" size={14} color="#6c757d" />
            <Text style={styles.dateTimeText}>{formatDate(ride.travelDate)}</Text>
          </View>
          <View style={styles.dateTimeItem}>
            <Ionicons name="time" size={14} color="#6c757d" />
            <Text style={styles.dateTimeText}>{formatTime(ride.cabTravelTime)}</Text>
          </View>
        </View>

        {/* Passengers and Cost */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailItem}>
            <Ionicons name="people" size={14} color="#007bff" />
            <Text style={styles.detailText}>
              {ride.passengers.length}/{ride.maxPassengers} seats
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={14} color="#28a745" />
            <Text style={styles.detailText}>₹{ride.totalCost}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderAutoRideCard = (ride: AutoRideDetails) => (
    <TouchableOpacity
      key={ride.id}
      style={styles.rideCard}
      onPress={() => navigation.navigate('AutoRideDetails', { rideId: ride.id })}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['#ffffff', '#f8f9fa']}
        style={styles.cardGradient}
      >
        {/* Header with role and status */}
        <View style={styles.cardHeader}>
          <View style={styles.roleContainer}>
            <Text style={styles.roleIcon}>{getRoleIcon(ride.role)}</Text>
            <Text style={styles.roleText}>{getRoleText(ride.role)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
            <Text style={styles.statusText}>{ride.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Route Information */}
        <View style={styles.routeContainer}>
          <View style={styles.locationRow}>
            <Ionicons name="radio-button-on" size={16} color="#28a745" />
            <Text style={styles.locationText} numberOfLines={1}>
              {ride.pickupLocation}
            </Text>
          </View>
          
          <View style={styles.routeLine} />
          
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#dc3545" />
            <Text style={styles.locationText} numberOfLines={1}>
              {ride.dropLocation}
            </Text>
          </View>
        </View>

        {/* Date and Time */}
        <View style={styles.dateTimeContainer}>
          <View style={styles.dateTimeItem}>
            <Ionicons name="calendar" size={14} color="#6c757d" />
            <Text style={styles.dateTimeText}>{formatDate(ride.travelDate)}</Text>
          </View>
          <View style={styles.dateTimeItem}>
            <Ionicons name="time" size={14} color="#6c757d" />
            <Text style={styles.dateTimeText}>{formatTime(ride.autoTravelTime)}</Text>
          </View>
        </View>

        {/* Passengers and Cost */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailItem}>
            <Ionicons name="people" size={14} color="#007bff" />
            <Text style={styles.detailText}>
              {ride.passengers.length}/{ride.maxPassengers} seats
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={14} color="#28a745" />
            <Text style={styles.detailText}>₹{ride.autoCost}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              // If coming from bottom tab in Dashboard, reset to Dashboard
              // This ensures we don't end up on a blank screen
              navigation.navigate('Dashboard');
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Rides</Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading your rides...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // If coming from bottom tab in Dashboard, reset to Dashboard
            // This ensures we don't end up on a blank screen
            navigation.navigate('Dashboard');
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Rides</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#007bff" />
          ) : (
            <Ionicons name="refresh" size={20} color="#007bff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Toggle View Mode */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'cab' && styles.activeToggleButton]}
          onPress={() => toggleViewMode('cab')}
        >
          <Ionicons name="car" size={18} color={viewMode === 'cab' ? "#fff" : "#6c757d"} />
          <Text style={[styles.toggleButtonText, viewMode === 'cab' && styles.activeToggleButtonText]}>
            Cab Rides
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'auto' && styles.activeToggleButton]}
          onPress={() => toggleViewMode('auto')}
        >
          <Ionicons name="car-sport" size={18} color={viewMode === 'auto' ? "#fff" : "#6c757d"} />
          <Text style={[styles.toggleButtonText, viewMode === 'auto' && styles.activeToggleButtonText]}>
            Auto Rides
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007bff']}
            tintColor="#007bff"
          />
        }
      >
        {(viewMode === 'cab' ? userRides.length === 0 : userAutoRides.length === 0) ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{viewMode === 'cab' ? '🚗' : '🛺'}</Text>
            <Text style={styles.emptyTitle}>No Rides Yet</Text>
            <Text style={styles.emptyMessage}>
              You haven't created or joined any {viewMode === 'cab' ? 'cab' : 'auto'} rides yet. Start by publishing a ride or finding one to join!
            </Text>
            <TouchableOpacity
              style={styles.createRideButton}
              onPress={() => navigation.navigate(viewMode === 'cab' ? 'CabShare' : 'AutoShare')}
            >
              <Text style={styles.createRideButtonText}>Find or Create a {viewMode === 'cab' ? 'Cab' : 'Auto'} Ride</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ridesContainer}>
            <Text style={styles.sectionTitle}>
              {viewMode === 'cab' ? userRides.length : userAutoRides.length} {viewMode === 'cab' ? 'Cab' : 'Auto'} Ride{(viewMode === 'cab' ? userRides.length : userAutoRides.length) !== 1 ? 's' : ''}
            </Text>
            
            {viewMode === 'cab' 
              ? userRides.map(renderRideCard)
              : userAutoRides.map(renderAutoRideCard)
            }
          </View>
        )}
        
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    margin: 16,
    marginTop: 0,
    marginBottom: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 8,
  },
  activeToggleButton: {
    backgroundColor: '#007bff',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  activeToggleButtonText: {
    color: '#fff',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  createRideButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createRideButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ridesContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  rideCard: {
    marginBottom: 16,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#007bff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  routeContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#2c3e50',
    marginLeft: 8,
    flex: 1,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e9ecef',
    marginLeft: 7,
    marginVertical: 4,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateTimeText: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 6,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 6,
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 32,
  },
});

export default YourRides;
// Firebase Console Action: Ensure 'user_rides' and 'cab_rides' collections exist with proper read/write rules