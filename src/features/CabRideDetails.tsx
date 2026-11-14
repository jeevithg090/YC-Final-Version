import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { db } from '../services/firebase';
import { getCurrentUserIdentity } from '../services/currentUser';
import type { RootStackParamList } from '../navigation/router';
import { calculateRideOccupancy } from '../utils/rides';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CabRideDetails'>;
type CabRideDetailsRoute = RouteProp<RootStackParamList, 'CabRideDetails'>;

interface Passenger {
  id: string;
  name: string;
  phoneNumber?: string;
}

interface CabRideData {
  id: string;
  date?: string;
  time?: string;
  pickupLocation: string;
  dropLocation: string;
  travelType?: string;
  cabService?: {
    name?: string;
    type?: string;
    driverName?: string;
    driverNumber?: string;
    carModel?: string;
    carNumber?: string;
  };
  passengers: Passenger[];
  totalCost: number;
  maxPassengers: number;
  createdBy?: string;
  status?: 'active' | 'completed' | 'cancelled';
}

/** Firestore collection written by the "Publish a cab share" flow. */
const CAB_RIDES_COLLECTION = 'cab_rides';

const CabRideDetails: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { params } = useRoute<CabRideDetailsRoute>();
  const insets = useSafeAreaInsets();
  const rideId = params?.rideId;

  const [ride, setRide] = useState<CabRideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!rideId) {
      setError('No ride was selected.');
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, CAB_RIDES_COLLECTION, rideId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRide(null);
          setError('This ride could not be found. It may have been removed.');
        } else {
          const data = snapshot.data();
          setRide({
            id: snapshot.id,
            pickupLocation: data.pickupLocation ?? 'Unknown',
            dropLocation: data.dropLocation ?? 'Unknown',
            date: data.date,
            time: data.time,
            travelType: data.travelType,
            cabService: data.cabService,
            passengers: Array.isArray(data.passengers) ? data.passengers : [],
            totalCost: Number(data.totalCost) || 0,
            maxPassengers: Number(data.maxPassengers) || 1,
            createdBy: data.createdBy,
            status: data.status,
          });
          setError(null);
        }
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Error loading cab ride:', snapshotError);
        setError('Could not load ride details. Check your connection and try again.');
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [rideId]);

  const identity = getCurrentUserIdentity();

  const handleJoin = async () => {
    if (!ride) return;
    if (!identity.id) {
      Alert.alert('Login Required', 'Please log in to join a ride.');
      return;
    }

    setJoining(true);
    try {
      await updateDoc(doc(db, CAB_RIDES_COLLECTION, ride.id), {
        passengers: arrayUnion({
          id: identity.id,
          name: identity.name,
          phoneNumber: identity.phoneNumber ?? '',
          // serverTimestamp() is not allowed inside arrays, so use a client timestamp.
          joinedAt: Timestamp.now(),
        }),
      });
      await addDoc(collection(db, 'user_rides'), {
        userId: identity.id,
        rideId: ride.id,
        role: 'passenger',
        joinedAt: serverTimestamp(),
        status: 'active',
      });
      Alert.alert('Joined!', 'You have joined this cab share.');
    } catch (joinError) {
      console.error('Error joining cab ride:', joinError);
      Alert.alert('Error', 'Failed to join the ride. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const renderHeader = (title: string) => (
    <LinearGradient
      colors={['#4E54C8', '#8B5CF6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.header, { paddingTop: insets.top + 12 }]}
    >
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.backButton} />
    </LinearGradient>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader('Ride Details')}
        <View style={styles.centered} accessibilityLabel="Loading ride details">
          <ActivityIndicator size="large" color="#4E54C8" />
        </View>
      </View>
    );
  }

  if (error || !ride) {
    return (
      <View style={styles.container}>
        {renderHeader('Ride Details')}
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={56} color="#FF3B30" />
          <Text style={styles.errorText}>{error ?? 'Ride unavailable.'}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const occupancy = calculateRideOccupancy(ride.totalCost, ride.maxPassengers, ride.passengers.length);
  const isCreator = !!identity.id && ride.createdBy === identity.id;
  const isPassenger = !!identity.id && ride.passengers.some((p) => p.id === identity.id);
  const isMember = isCreator || isPassenger;
  const canJoin = !isMember && !occupancy.isFull && ride.status !== 'cancelled' && ride.status !== 'completed';
  const driverNumber = ride.cabService?.driverNumber?.trim();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {renderHeader('Cab Share')}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.card}>
          <View style={styles.routeRow}>
            <Ionicons name="location" size={20} color="#4E54C8" />
            <Text style={styles.routeText}>{ride.pickupLocation}</Text>
          </View>
          <Ionicons name="arrow-down" size={18} color="#8E8E93" style={styles.routeArrow} />
          <View style={styles.routeRow}>
            <Ionicons name="flag" size={20} color="#8B5CF6" />
            <Text style={styles.routeText}>{ride.dropLocation}</Text>
          </View>
          <View style={styles.metaRow}>
            {ride.date ? <Text style={styles.metaText}>📅 {ride.date}</Text> : null}
            {ride.time ? <Text style={styles.metaText}>⏰ {ride.time}</Text> : null}
            {ride.travelType ? <Text style={styles.metaText}>✈️ {ride.travelType}</Text> : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>₹{occupancy.costPerPerson}</Text>
            <Text style={styles.statLabel}>per person</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{occupancy.occupants}</Text>
            <Text style={styles.statLabel}>riding</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{occupancy.seatsLeft}</Text>
            <Text style={styles.statLabel}>seats left</Text>
          </View>
        </View>

        {ride.cabService ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Cab</Text>
            <Text style={styles.bodyText}>{ride.cabService.name || 'To be decided'}</Text>
            {ride.cabService.carModel ? <Text style={styles.mutedText}>{ride.cabService.carModel}</Text> : null}
            {ride.cabService.carNumber ? <Text style={styles.mutedText}>{ride.cabService.carNumber}</Text> : null}
            {ride.cabService.driverName ? (
              <Text style={styles.mutedText}>Driver: {ride.cabService.driverName}</Text>
            ) : null}
            {driverNumber && isMember ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => Linking.openURL(`tel:${driverNumber}`)}
                accessibilityRole="button"
                accessibilityLabel="Call driver"
              >
                <Text style={styles.secondaryButtonText}>Call driver</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Passengers</Text>
          {ride.passengers.length === 0 ? (
            <Text style={styles.mutedText}>No one has joined yet.</Text>
          ) : (
            ride.passengers.map((passenger) => (
              <View key={passenger.id} style={styles.passengerRow}>
                <Ionicons name="person-circle" size={28} color="#C7C7CC" />
                <Text style={styles.bodyText}>{passenger.name}</Text>
              </View>
            ))
          )}
        </View>

        {canJoin ? (
          <TouchableOpacity
            style={[styles.primaryButton, joining && styles.disabled]}
            onPress={handleJoin}
            disabled={joining}
            accessibilityRole="button"
            accessibilityState={{ disabled: joining, busy: joining }}
          >
            {joining ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Join this ride</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {!isMember && occupancy.isFull ? <Text style={styles.mutedCenter}>This ride is full.</Text> : null}

        {isMember ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              navigation.navigate('CabRideGroupChat', {
                rideId: ride.id,
                rideName: `${ride.pickupLocation} → ${ride.dropLocation}`,
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Open group chat</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#3A3A3C',
    textAlign: 'center',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  routeArrow: {
    marginLeft: 1,
    marginVertical: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  metaText: {
    fontSize: 14,
    color: '#636366',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4E54C8',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    color: '#1C1C1E',
  },
  mutedText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  mutedCenter: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  primaryButton: {
    backgroundColor: '#4E54C8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#4E54C8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4E54C8',
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default CabRideDetails;
