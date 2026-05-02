import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  FlatList,
  TextInput,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { db, auth } from '../services/firebase';
import { 
  collection, doc, getDoc, onSnapshot, updateDoc, arrayRemove,
  arrayUnion, addDoc, serverTimestamp, query, where, getDocs
} from 'firebase/firestore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// TypeScript interfaces
interface AutoRideData {
  id: string;
  travelDate: any;
  autoTravelTime: any;
  pickupLocation: string;
  dropLocation: string;
  autoService?: {
    name?: string;
    driverName?: string;
    driverNumber?: string;
    vehicleNumber?: string;
    autoNumber?: string;
  };
  status: 'active' | 'matched' | 'completed' | 'cancelled';
  flexibilityMinutes: string;
  autoCost: string;
  maxPassengers: number;
  createdBy: string;
  passengers: Passenger[];
  createdAt: any;
}

interface Passenger {
  id: string;
  name: string;
  phoneNumber: string;
  joinedAt: any;
}

interface DriverService {
  name?: string;
  driverName?: string;
  driverNumber?: string;
  autoNumber?: string;
}

const AutoRideDetails: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { rideId } = route.params as { rideId: string };
  
  const [rideData, setRideData] = useState<AutoRideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showPassengersModal, setShowPassengersModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [driverInfo, setDriverInfo] = useState<DriverService>({
    name: '',
    driverName: '',
    driverNumber: '',
    autoNumber: ''
  });
  
  // Get the current user ID from Firebase Auth
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  useEffect(() => {
    // Check if user is logged in
    const user = auth.currentUser;
    if (user) {
      setCurrentUserId(user.uid);
    } else {
      Alert.alert('Login Required', 'Please log in to view ride details.');
      navigation.goBack();
    }
  }, [navigation]);
  
  useEffect(() => {
    const fetchRideDetails = async () => {
      try {
        const rideRef = doc(db, 'auto_rides', rideId);
        
        // Set up real-time listener for ride data
        const unsubscribe = onSnapshot(rideRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() } as AutoRideData;
            setRideData(data);
          } else {
            Alert.alert('Error', 'This auto ride no longer exists');
            navigation.goBack();
          }
          setLoading(false);
        }, (error) => {
          console.error('Error fetching ride details:', error);
          Alert.alert('Error', 'Failed to load auto ride details');
          setLoading(false);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up listener:', error);
        setLoading(false);
      }
    };
    
    fetchRideDetails();
  }, [rideId, navigation]);
  
  const isCreator = rideData?.createdBy === currentUserId;
  const isParticipant = rideData?.passengers.some(p => p.id === currentUserId);
  const canJoin = !isParticipant && (rideData?.passengers?.length || 0) < (rideData?.maxPassengers || 0);
  
  const handleContactDriver = () => {
    if (rideData?.autoService?.driverNumber) {
      Linking.openURL(`tel:${rideData.autoService.driverNumber}`);
    } else {
      Alert.alert('No Driver Info', 'Driver contact information has not been added yet.');
    }
  };
  
  const handleAddDriverInfo = async () => {
    if (!driverInfo.driverName || !driverInfo.driverNumber || !driverInfo.autoNumber) {
      Alert.alert('Missing Information', 'Please fill in all driver information fields.');
      return;
    }
    
    try {
      const rideRef = doc(db, 'auto_rides', rideId);
      await updateDoc(rideRef, {
        autoService: driverInfo,
        status: 'matched'
      });
      
      setShowDriverModal(false);
      Alert.alert('Success', 'Driver information has been added.');
    } catch (error) {
      console.error('Error adding driver info:', error);
      Alert.alert('Error', 'Failed to add driver information. Please try again.');
    }
  };
  
  const handleLeaveRide = async () => {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to leave this ride.');
      return;
    }
    
    try {
      const passenger = rideData?.passengers.find(p => p.id === currentUserId);
      if (!passenger) return;
      
      // Remove passenger from auto_rides document
      const rideRef = doc(db, 'auto_rides', rideId);
      await updateDoc(rideRef, {
        passengers: arrayRemove(passenger)
      });
      
      // Find and update the user_auto_rides document
      const userAutoRidesQuery = query(
        collection(db, 'user_auto_rides'),
        where('userId', '==', currentUserId),
        where('rideId', '==', rideId)
      );
      
      const querySnapshot = await getDocs(userAutoRidesQuery);
      querySnapshot.forEach(async (doc) => {
        await updateDoc(doc.ref, {
          status: 'cancelled'
        });
      });
      
      Alert.alert('Success', 'You have left the auto ride.');
      navigation.goBack();
    } catch (error) {
      console.error('Error leaving ride:', error);
      Alert.alert('Error', 'Failed to leave the auto ride. Please try again.');
    }
  };
  
  const handleJoinRide = async () => {
    if (!canJoin) return;
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to join this ride.');
      return;
    }
    
    try {
      // Use a Date object instead of serverTimestamp() for array elements
      const currentTimestamp = new Date();
      
      // Get user details
      const user = auth.currentUser;
      const userName = user?.displayName || user?.email?.split('@')[0] || 'Anonymous User';
      
      // Add current user as a passenger
      const newPassenger: Passenger = {
        id: currentUserId,
        name: userName,
        phoneNumber: user?.phoneNumber || 'No phone number',
        joinedAt: currentTimestamp,
      };
      
      const rideRef = doc(db, 'auto_rides', rideId);
      await updateDoc(rideRef, {
        passengers: arrayUnion(newPassenger),
        lastPassengerJoined: serverTimestamp() // Update this top-level field instead
      });
      
      // Create a user_auto_rides document to track this user's ride
      if (rideData) {
        const userAutoRidesRef = collection(db, 'user_auto_rides');
        await addDoc(userAutoRidesRef, {
          userId: currentUserId,
          rideId: rideId,
          role: 'passenger',
          status: 'active',
          joinedAt: serverTimestamp(),
          pickupLocation: rideData.pickupLocation,
          dropLocation: rideData.dropLocation,
          travelDate: rideData.travelDate,
          autoTravelTime: rideData.autoTravelTime
        });
      }
      
      Alert.alert('Success', 'You have joined the auto ride.');
    } catch (error) {
      console.error('Error joining ride:', error);
      Alert.alert('Error', 'Failed to join the auto ride. Please try again.');
    }
  };
  
  const handleCancelRide = async () => {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to cancel this ride.');
      return;
    }
    
    try {
      // Update the auto_rides document
      const rideRef = doc(db, 'auto_rides', rideId);
      await updateDoc(rideRef, {
        status: 'cancelled'
      });
      
      // Update all user_auto_rides documents related to this ride
      const userAutoRidesQuery = query(
        collection(db, 'user_auto_rides'),
        where('rideId', '==', rideId)
      );
      
      const querySnapshot = await getDocs(userAutoRidesQuery);
      const updatePromises: Promise<void>[] = [];
      
      querySnapshot.forEach((doc) => {
        updatePromises.push(
          updateDoc(doc.ref, {
            status: 'cancelled'
          })
        );
      });
      
      await Promise.all(updatePromises);
      
      setShowCancelModal(false);
      Alert.alert('Ride Cancelled', 'This auto ride has been cancelled.');
      navigation.goBack();
    } catch (error) {
      console.error('Error cancelling ride:', error);
      Alert.alert('Error', 'Failed to cancel the auto ride. Please try again.');
    }
  };
  
  const handleCompleteRide = async () => {
    if (!currentUserId) {
      Alert.alert('Login Required', 'Please log in to complete this ride.');
      return;
    }
    
    try {
      // Update the auto_rides document
      const rideRef = doc(db, 'auto_rides', rideId);
      await updateDoc(rideRef, {
        status: 'completed'
      });
      
      // Update all user_auto_rides documents related to this ride
      const userAutoRidesQuery = query(
        collection(db, 'user_auto_rides'),
        where('rideId', '==', rideId)
      );
      
      const querySnapshot = await getDocs(userAutoRidesQuery);
      const updatePromises: Promise<void>[] = [];
      
      querySnapshot.forEach((doc) => {
        updatePromises.push(
          updateDoc(doc.ref, {
            status: 'completed'
          })
        );
      });
      
      await Promise.all(updatePromises);
      
      Alert.alert('Ride Completed', 'This auto ride has been marked as completed.');
    } catch (error) {
      console.error('Error completing ride:', error);
      Alert.alert('Error', 'Failed to complete the auto ride. Please try again.');
    }
  };

  const handleOpenChat = () => {
    if (rideData) {
      navigation.navigate('AutoRideGroupChat', { 
        rideId: rideId,
        rideName: `${getLocationName(rideData.pickupLocation)} → ${getLocationName(rideData.dropLocation)}`
      });
    }
  };
  
  const getLocationName = (locationId: string) => {
    // This would ideally come from a centralized location options list
    const locationMap: {[key: string]: string} = {
      'mit-manipal': 'MIT Manipal',
      'kmc': 'KMC',
      'mangalore-airport': 'Mangaluru Airport',
      'udupi-railway': 'Udupi Railway'
    };
    
    return locationMap[locationId] || locationId;
  };
  
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading auto ride details...</Text>
      </View>
    );
  }
  
  if (!rideData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Auto ride not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  const statusColors = {
    active: '#28a745',
    matched: '#007bff',
    completed: '#6c757d',
    cancelled: '#dc3545'
  };
  
  const statusText = {
    active: 'Looking for passengers',
    matched: 'Auto assigned',
    completed: 'Ride completed',
    cancelled: 'Ride cancelled'
  };
  
  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auto Share Details</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView style={styles.content}>
        {/* Status Card */}
        <LinearGradient
          colors={['#f8f9fa', '#e9ecef']}
          style={styles.statusCard}
        >
          <View style={styles.statusContainer}>
            <View 
              style={[
                styles.statusIndicator,
                { backgroundColor: statusColors[rideData.status] }
              ]}
            />
            <Text style={styles.statusText}>
              {statusText[rideData.status]}
            </Text>
          </View>
          
          <View style={styles.routeContainer}>
            <Text style={styles.routeText}>
              {getLocationName(rideData.pickupLocation)} → {getLocationName(rideData.dropLocation)}
            </Text>
          </View>
          
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Date</Text>
              <Text style={styles.dateValue}>{formatDate(rideData.travelDate)}</Text>
            </View>
            <View style={styles.timeContainer}>
              <Text style={styles.timeLabel}>Auto Time</Text>
              <Text style={styles.timeValue}>{formatTime(rideData.autoTravelTime)}</Text>
            </View>
          </View>
        </LinearGradient>
        
        {/* Auto Details Card */}
        <View style={styles.detailCard}>
          <Text style={styles.cardTitle}>Auto Details</Text>
          
          {rideData.status === 'matched' && rideData.autoService ? (
            <View style={styles.driverInfo}>
              <View style={styles.driverDetail}>
                <Text style={styles.driverLabel}>Auto Number</Text>
                <Text style={styles.driverValue}>{rideData.autoService.autoNumber || 'N/A'}</Text>
              </View>
              
              <View style={styles.driverDetail}>
                <Text style={styles.driverLabel}>Driver Name</Text>
                <Text style={styles.driverValue}>{rideData.autoService.driverName || 'N/A'}</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.contactButton}
                onPress={handleContactDriver}
              >
                <Text style={styles.contactButtonText}>Contact Driver</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noDriverContainer}>
              <Text style={styles.noDriverText}>
                {isCreator ? 
                  'Add auto and driver details once confirmed' : 
                  'Auto details will be added by the ride creator'}
              </Text>
              
              {isCreator && rideData.status === 'active' && (
                <TouchableOpacity 
                  style={styles.addDriverButton}
                  onPress={() => setShowDriverModal(true)}
                >
                  <Text style={styles.addDriverButtonText}>Add Auto Details</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          <View style={styles.rideDetailsList}>
            <View style={styles.rideDetailItem}>
              <Text style={styles.detailItemIcon}>💰</Text>
              <Text style={styles.detailItemLabel}>Estimated Cost:</Text>
              <Text style={styles.detailItemValue}>₹{rideData.autoCost}</Text>
            </View>
            
            <View style={styles.rideDetailItem}>
              <Text style={styles.detailItemIcon}>⚡</Text>
              <Text style={styles.detailItemLabel}>Flexibility:</Text>
              <Text style={styles.detailItemValue}>±{rideData.flexibilityMinutes} mins</Text>
            </View>
            
            <View style={styles.rideDetailItem}>
              <Text style={styles.detailItemIcon}>👥</Text>
              <Text style={styles.detailItemLabel}>Passengers:</Text>
              <Text style={styles.detailItemValue}>
                {rideData.passengers.length} / {rideData.maxPassengers}
              </Text>
              <TouchableOpacity onPress={() => setShowPassengersModal(true)}>
                <Text style={styles.viewText}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.chatButton}
            onPress={handleOpenChat}
          >
            <Text style={styles.chatButtonIcon}>💬</Text>
            <Text style={styles.chatButtonText}>Group Chat</Text>
          </TouchableOpacity>
          
          {isParticipant && !isCreator && rideData.status === 'active' && (
            <TouchableOpacity 
              style={styles.leaveButton}
              onPress={handleLeaveRide}
            >
              <Text style={styles.leaveButtonText}>Leave Ride</Text>
            </TouchableOpacity>
          )}
          
          {!isParticipant && canJoin && rideData.status === 'active' && (
            <TouchableOpacity 
              style={styles.joinButton}
              onPress={handleJoinRide}
            >
              <Text style={styles.joinButtonText}>Join Ride</Text>
            </TouchableOpacity>
          )}
          
          {isCreator && (rideData.status === 'active' || rideData.status === 'matched') && (
            <View style={styles.creatorButtons}>
              {rideData.status === 'matched' && (
                <TouchableOpacity 
                  style={styles.completeButton}
                  onPress={handleCompleteRide}
                >
                  <Text style={styles.completeButtonText}>Mark as Completed</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowCancelModal(true)}
              >
                <Text style={styles.cancelButtonText}>Cancel Ride</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Driver Info Modal */}
      <Modal
        visible={showDriverModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDriverModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Auto Details</Text>
              <TouchableOpacity onPress={() => setShowDriverModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Auto Number</Text>
                <TextInput
                  style={styles.input}
                  value={driverInfo.autoNumber}
                  onChangeText={(text) => setDriverInfo({...driverInfo, autoNumber: text})}
                  placeholder="KA-19-AB-1234"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Driver Name</Text>
                <TextInput
                  style={styles.input}
                  value={driverInfo.driverName}
                  onChangeText={(text) => setDriverInfo({...driverInfo, driverName: text})}
                  placeholder="Driver's name"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Driver Phone</Text>
                <TextInput
                  style={styles.input}
                  value={driverInfo.driverNumber}
                  onChangeText={(text) => setDriverInfo({...driverInfo, driverNumber: text})}
                  placeholder="Driver's phone number"
                  keyboardType="phone-pad"
                />
              </View>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleAddDriverInfo}
              >
                <Text style={styles.saveButtonText}>Save Auto Details</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Passengers Modal */}
      <Modal
        visible={showPassengersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPassengersModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Passengers</Text>
              <TouchableOpacity onPress={() => setShowPassengersModal(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={rideData.passengers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.passengerItem}>
                  <View style={styles.passengerAvatar}>
                    <Text style={styles.avatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.passengerInfo}>
                    <Text style={styles.passengerName}>{item.name}</Text>
                    <Text style={styles.passengerPhone}>{item.phoneNumber}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.callButton}
                    onPress={() => Linking.openURL(`tel:${item.phoneNumber}`)}
                     accessibilityLabel={`Call ${item.name}`}
                  >
                    <Text style={styles.callButtonText}>Call</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>No passengers yet</Text>
              }
            />
          </View>
        </View>
      </Modal>
      
      {/* Cancel Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.confirmModalContainer}>
          <BlurView intensity={50} style={StyleSheet.absoluteFill} />
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Cancel Auto Ride?</Text>
            <Text style={styles.confirmModalText}>
              Are you sure you want to cancel this auto ride? This action cannot be undone.
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={styles.confirmModalCancel}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.confirmModalCancelText}>No, Keep It</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmModalConfirm}
                onPress={handleCancelRide}
              >
                <Text style={styles.confirmModalConfirmText}>Yes, Cancel Ride</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    color: '#6c757d',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
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
  backButtonText: {
    fontSize: 20,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  statusCard: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  routeContainer: {
    marginBottom: 12,
  },
  routeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  timeContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  detailCard: {
    margin: 16,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  driverInfo: {
    marginBottom: 16,
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
  },
  driverDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  driverLabel: {
    fontSize: 14,
    color: '#495057',
  },
  driverValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  contactButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  noDriverContainer: {
    marginBottom: 16,
    alignItems: 'center',
    padding: 12,
  },
  noDriverText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 10,
  },
  addDriverButton: {
    backgroundColor: '#28a745',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addDriverButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  rideDetailsList: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
  },
  rideDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailItemIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  detailItemLabel: {
    fontSize: 14,
    color: '#495057',
    flex: 1,
  },
  detailItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginRight: 8,
  },
  viewText: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '600',
  },
  actionButtons: {
    margin: 16,
    marginTop: 8,
  },
  chatButton: {
    backgroundColor: '#17a2b8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  chatButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  leaveButton: {
    backgroundColor: '#ffc107',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
  },
  joinButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  creatorButtons: {
    marginTop: 8,
  },
  completeButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalClose: {
    fontSize: 24,
    color: '#6c757d',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
    maxHeight: '60%',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  passengerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  passengerPhone: {
    fontSize: 14,
    color: '#6c757d',
  },
  callButton: {
    backgroundColor: '#28a745',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyListText: {
    textAlign: 'center',
    padding: 20,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  confirmModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 12,
  },
  confirmModalText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 20,
    lineHeight: 20,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmModalCancel: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  confirmModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  confirmModalConfirm: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmModalConfirmText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default AutoRideDetails;

// Firebase Console Action: Use the same 'auto_rides' collection in Firestore as mentioned in FindAnAutoShare.tsx
