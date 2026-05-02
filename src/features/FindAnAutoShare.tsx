import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { db, auth, collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, arrayUnion } from '../services/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<any>;

// TypeScript interfaces
interface PublishedRide {
  id: string;
  pickupLocation: string;
  dropLocation: string;
  travelDate: Timestamp | Date;
  autoTravelTime: Timestamp | Date;
  flexibilityMinutes: string;
  createdBy: string;
  passengers: Passenger[];
  maxPassengers: number;
  status: 'active' | 'matched' | 'completed';
  createdAt: any;
}

interface Passenger {
  id: string;
  name: string;
  phoneNumber: string;
  joinedAt: any;
}

// 1. Update FormData type to allow string for autoTravelTime
interface FormData {
  pickupLocation: string;
  dropLocation: string;
  travelDate: Date;
  autoTravelTime: Date | 'immediate-5min';
  flexibilityMinutes: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface LocationOption {
  id: string;
  name: string;
  description?: string;
}

// 1. Add the new location array (replace LOCATION_OPTIONS):
const LOCATION_LIST: string[] = [
  'Block 16,17,18,19,20-Faster Match',
  'Basic Science Building',
  'Interact Lecture Hall',
  'School of Allied Health Sciences',
  'Food Court (KMC campus)',
  'UNIVERSITY BUILDING & Health Sciences Library',
  'Indira Block',
  'Sonia Block',
  'PG Block',
  'New Sarojini Hostel',
  'New International Hostel',
  'Melaka Manipal Medical College',
  'Manipal College of Pharmaceutical Sciences',
  'Sharada Hostel',
  'New BQ / MU Guest House',
  'Khurana Block / RKHS mess',
  'Valley Flat',
  'Sharada Basket Ball Court',
  'Day Care Centre',
  'Rajaji Block',
  'Kamaraj Block',
  'KMC Greens',
  'Dr TMA Pai Hall',
  'Old Sarojini Block',
  'Manipal College of Nursing',
  'MARENA sports complex',
  'Fortune Inn Valley View',
  'Welcomgroup Graduate School of Hotel Administration (WGSHA)',
  'Dept. of Culinary Arts',
  'WGSHA Hostels',
  'Manipal College of Dental Sciences',
  'Kasturba Hospital - OPD',
  'Trauma and Emergency',
  'Syndicate Bank - KMC Branch',
  'ICICI - Manipal Branch',
  'Shirdi Sai Baba Cancer Hospital',
  'Kasturba Medical College',
  'Smriti Bhavan - Dr TMA Pai Museum',
  'State Bank of India - Manipal Branch',
  'Manipal Amphitheater',
  'Syndicate Bank Golden Jubilee Hall',
  'School of Communication',
  'Dr TMA Pai Planetarium and Manipal Centre for Natural Sciences',
  'School of Life Sciences',
  'Manipal Centre for Philosophy & Humanities',
  'MIT Hostel - 12th Block',
  'MIT Hostel - 11th Block',
  'MIT Hostel - 10th Block',
  'New Management Block',
  'School of Management',
  'Department of Commerce',
  'School of Jewellery Management',
  'MIT Hostel - 9th Block',
  'MIT Hostel - 14th Block',
  'MIT Hostel - 15th Block',
  'MIT Hostel - 16th Block',
  'MIT Hostel - 17th Block',
  'MIT Hostel - 7th Block',
  'MIT Hostel - 8th Block',
  'MIT Hostel - 6th Block',
  'MIT Hostel - 5th Block',
  'Kamath Circle',
  'Food Court - MIT campus',
  'MIT Hostel - 4th Block',
  'MIT Hostel - 3rd Block',
  'MIT Hostel - 13th Block',
  'MIT Hostel - 2nd Block',
  'MIT Hostel - 1st Block',
  'New Lecture Hall (Academic Block 3) - MIT',
  'Innovation Centre (Academic Block 4) - MIT',
  'Library - MIT',
  'Dr TMA Pai Polytechnic',
  'Faculty of Architecture',
  'Academic Block 5 - MIT',
  'International Centre for Applied Science',
  'School of Information Science',
  'Dept. of Atomic & Molecular Physics',
  'MIT administrative block (Academic Block 1)',
  'Hotel Green Park',
  'Chandrashekar Hostel',
  'Dept. of Virus Research',
  'New Chandrashekar Hostel',
  'New AC - Ladies Hostel',
  'Amartya Sen Hostel',
  'Nehru Block',
  'Charaka Block',
  'RT Block',
  'Raman Block',
  'Dept. of European Studies, Geopolitics and Public Health',
  'Police Station & Post Office',
];

// Academic Block short name mapping
// Update AB_SHORTNAMES to allow flexible matching (ab1, ab-1, ab 1)
const AB_SHORTNAMES: { [key: string]: string } = {
  'ab-1': 'MIT administrative block (Academic Block 1)',
  'ab1': 'MIT administrative block (Academic Block 1)',
  'ab 1': 'MIT administrative block (Academic Block 1)',
  'ab-2': 'MIT Hostel - 2nd Block',
  'ab2': 'MIT Hostel - 2nd Block',
  'ab 2': 'MIT Hostel - 2nd Block',
  'ab-3': 'New Lecture Hall (Academic Block 3) - MIT',
  'ab3': 'New Lecture Hall (Academic Block 3) - MIT',
  'ab 3': 'New Lecture Hall (Academic Block 3) - MIT',
  'ab-4': 'Innovation Centre (Academic Block 4) - MIT',
  'ab4': 'Innovation Centre (Academic Block 4) - MIT',
  'ab 4': 'Innovation Centre (Academic Block 4) - MIT',
  'ab-5': 'Academic Block 5 - MIT',
  'ab5': 'Academic Block 5 - MIT',
  'ab 5': 'Academic Block 5 - MIT',
};

const FindAnAutoShare: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState<FormData>({
    pickupLocation: '',
    dropLocation: '',
    travelDate: new Date(),
    autoTravelTime: new Date(),
    flexibilityMinutes: '15',
  });
  
  const [availableRides, setAvailableRides] = useState<PublishedRide[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPickupOptions, setShowPickupOptions] = useState<boolean>(false);
  const [showDropOptions, setShowDropOptions] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showTimePicker, setShowTimePicker] = useState<boolean>(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [searchProgress, setSearchProgress] = useState<number>(0);
  
  // 2. Add state for autocomplete and input for pickup/drop
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropQuery, setDropQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<string[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<string[]>([]);
  
  const [showCustomTimePicker, setShowCustomTimePicker] = useState(false);
  
  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear the error for this field if it exists
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  const handleSearchProgress = () => {
    let filledFields = 0;
    const totalFields = 5; // Total number of fields in the form
    
    if (formData.pickupLocation.trim()) filledFields++;
    if (formData.dropLocation.trim()) filledFields++;
    if (formData.travelDate) filledFields++;
    if (formData.autoTravelTime) filledFields++;
    if (formData.flexibilityMinutes.trim()) filledFields++;
    
    const progress = Math.round((filledFields / totalFields) * 100);
    setSearchProgress(progress);
  };
  
  useEffect(() => {
    handleSearchProgress();
  }, [formData]);

  // 3. Autocomplete logic for pickup
  useEffect(() => {
    if (showPickupOptions) {
      const query = pickupQuery.trim().toLowerCase();
      let filtered = LOCATION_LIST.filter(loc =>
        loc.toLowerCase().includes(query)
      );
      // Add AB-x alias matches
      Object.entries(AB_SHORTNAMES).forEach(([alias, fullname]) => {
        if (query && alias.startsWith(query.replace(/\s+/g, ''))) {
          if (!filtered.includes(fullname)) {
            filtered.unshift(fullname); // Only show full name
          }
        }
      });
      // Only for pickup: Always show 'Block 16,17,18,19,20-Faster Match' first
      filtered = [
        'Block 16,17,18,19,20-Faster Match',
        ...filtered.filter(l => l !== 'Block 16,17,18,19,20-Faster Match')
      ];
      setPickupSuggestions(filtered);
    }
  }, [pickupQuery, showPickupOptions]);

  // 4. Autocomplete logic for drop
  useEffect(() => {
    if (showDropOptions) {
      const query = dropQuery.trim().toLowerCase();
      let filtered = LOCATION_LIST.filter(loc =>
        loc.toLowerCase().includes(query)
      );
      let ab1Match = false;
      Object.entries(AB_SHORTNAMES).forEach(([alias, fullname]) => {
        if (query && alias.startsWith(query.replace(/\s+/g, ''))) {
          if (!filtered.includes(fullname)) {
            // For AB-1, show as 'AB-1 (Last Point of Drop)' only if not already present
            if (alias === 'ab-1' || alias === 'ab1' || alias === 'ab 1') {
              ab1Match = true;
            } else {
              filtered.unshift(fullname); // Only show full name
            }
          }
        }
      });
      // Only for drop: Always show 'AB-1 (Last Point of Drop)' first
      filtered = [
        'AB-1 (Last Point of Drop)',
        ...filtered.filter(l => l !== 'AB-1 (Last Point of Drop)')
      ];
      setDropSuggestions(filtered);
    }
  }, [dropQuery, showDropOptions]);
  
  const validateForm = () => {
    const newErrors: ValidationErrors = {};
    
    if (!formData.pickupLocation.trim()) {
      newErrors.pickupLocation = 'Please select a pickup location';
    }
    
    if (!formData.dropLocation.trim()) {
      newErrors.dropLocation = 'Please select a drop location';
    } else if (formData.dropLocation === formData.pickupLocation) {
      newErrors.dropLocation = 'Pickup and drop locations cannot be the same';
    }
    
    if (!formData.travelDate) {
      newErrors.travelDate = 'Please select a travel date';
    }
    
    if (!formData.autoTravelTime) {
      newErrors.autoTravelTime = 'Please select your preferred auto time';
    }
    
    if (!formData.flexibilityMinutes.trim()) {
      newErrors.flexibilityMinutes = 'Please specify your time flexibility';
    } else if (isNaN(Number(formData.flexibilityMinutes)) || Number(formData.flexibilityMinutes) < 0) {
      newErrors.flexibilityMinutes = 'Please enter a valid number of minutes';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const findRides = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Query Firestore to find matching rides
      const ridesRef = collection(db, 'auto_rides');
      const q = query(
        ridesRef,
        where('pickupLocation', '==', formData.pickupLocation),
        where('dropLocation', '==', formData.dropLocation),
        // Note: Additional filtering by date will be done client-side
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      const rides: PublishedRide[] = [];
      
      const selectedDate = formData.travelDate;
      const selectedDateStr = selectedDate.toDateString();
      const now = new Date();
      let userStartTime: Date, userEndTime: Date;
      if (formData.autoTravelTime === 'immediate-5min') {
        userStartTime = now;
        userEndTime = new Date(now.getTime() + 5 * 60000);
      } else {
        userStartTime = formData.autoTravelTime as Date;
        userEndTime = formData.autoTravelTime as Date;
      }
      const userFlex = Number(formData.flexibilityMinutes) || 0;
      
      querySnapshot.forEach((doc) => {
        const rideData = { id: doc.id, ...doc.data() } as PublishedRide;
        const rideDate = rideData.travelDate instanceof Timestamp 
          ? rideData.travelDate.toDate() 
          : rideData.travelDate;
        
        // Check if the ride date matches the selected date
        if (rideDate.toDateString() === selectedDateStr) {
          // Check if there's space available
          if (rideData.passengers.length < rideData.maxPassengers) {
            // Check time match logic
            const rideTime = rideData.autoTravelTime instanceof Timestamp
              ? rideData.autoTravelTime.toDate()
              : rideData.autoTravelTime;
            const rideFlex = Number(rideData.flexibilityMinutes) || 0;
            // User is willing to go anytime between userStartTime and userEndTime, considering both flexibilities
            const minAcceptable = new Date(userStartTime.getTime() - userFlex * 60000 - rideFlex * 60000);
            const maxAcceptable = new Date(userEndTime.getTime() + userFlex * 60000 + rideFlex * 60000);
            if (rideTime >= minAcceptable && rideTime <= maxAcceptable) {
              rides.push(rideData);
            }
          }
        }
      });
      
      setAvailableRides(rides);
      
      if (rides.length === 0) {
        Alert.alert(
          'No Matching Rides',
          'No auto shares match your criteria. Would you like to publish a new auto share?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Publish New', onPress: () => navigation.navigate('PublishAnAutoShare', formData) }
          ]
        );
      }
    } catch (error) {
      console.error('Error finding rides:', error);
      Alert.alert('Error', 'Failed to search for auto shares. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const joinRide = async (ride: PublishedRide) => {
    // Logic to join a ride
    Alert.alert(
      'Join Auto Share',
      'Would you like to join this auto share?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Join', 
          onPress: async () => {
            try {
              const rideRef = doc(db, 'auto_rides', ride.id);
              
              // Use a Date object instead of serverTimestamp() for array elements
              const currentTimestamp = new Date();
              
              // Add current user as a passenger
              const currentUser = auth.currentUser;
              const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Anonymous User';
              const phoneNumber = currentUser?.phoneNumber || 'No phone number';
              
              const newPassenger: Passenger = {
                id: currentUser.uid,
                name: userName,
                phoneNumber: phoneNumber,
                joinedAt: currentTimestamp,
              };
              
              await updateDoc(rideRef, {
                passengers: arrayUnion(newPassenger),
                lastPassengerJoined: serverTimestamp() // Update this top-level field instead
              });
              
              // Create a user_auto_rides document to track user's rides
              await addDoc(collection(db, 'user_auto_rides'), {
                userId: currentUser.uid,
                rideId: ride.id,
                role: 'passenger',
                joinedAt: serverTimestamp(),
                status: 'active',
                pickupLocation: ride.pickupLocation,
                dropLocation: ride.dropLocation,
                travelDate: ride.travelDate,
                autoTravelTime: ride.autoTravelTime
              });
              
              // Navigate to auto ride details page
              navigation.navigate('AutoRideDetails', { rideId: ride.id });
              
            } catch (error) {
              console.error('Error joining ride:', error);
              Alert.alert('Error', 'Failed to join the auto share. Please try again.');
            }
          } 
        }
      ]
    );
  };
  
  const renderRideItem = ({ item }: { item: PublishedRide }) => {
    const rideDate = item.travelDate instanceof Timestamp 
      ? item.travelDate.toDate() 
      : item.travelDate;
    
    const publishedTime = item.autoTravelTime instanceof Timestamp 
      ? item.autoTravelTime.toDate() 
      : item.autoTravelTime;
    
    const availableSeats = item.maxPassengers - item.passengers.length;
    
    return (
      <TouchableOpacity style={styles.rideCard} onPress={() => joinRide(item)}>
        <View style={styles.rideHeader}>
          <View style={styles.rideInfo}>
            <Text style={styles.rideRoute}>
              {getLocationName(item.pickupLocation)} → {getLocationName(item.dropLocation)}
            </Text>
            <Text style={styles.rideDate}>
              {rideDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.rideSeats}>
            <Text style={styles.rideSeatsText}>{availableSeats}</Text>
            <Text style={styles.rideSeatsLabel}>seats</Text>
          </View>
        </View>
        
        <View style={styles.rideDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>⏰</Text>
            <Text style={styles.detailText}>
              Auto Time: {publishedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>⚡</Text>
            <Text style={styles.detailText}>
              Flexibility: ±{item.flexibilityMinutes} mins
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>👥</Text>
            <Text style={styles.detailText}>
              {item.passengers.length} passenger{item.passengers.length !== 1 ? 's' : ''} joined
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.joinButton}>
          <Text style={styles.joinButtonText}>Join Auto Share</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };
  
  const getLocationName = (locationId: string) => {
    // This function is no longer needed as location names are directly displayed
    // but keeping it for now in case it's called elsewhere or for future use.
    return locationId;
  };
  
  return (
    <SafeAreaView style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find an Auto Share</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Search Form */}
        <View style={styles.searchForm}>
          <Text style={styles.formTitle}>Search for Auto Shares</Text>
          
          {/* Pickup Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Pickup Location</Text>
            <TouchableOpacity
              style={[styles.input, errors.pickupLocation ? styles.inputError : null]}
              onPress={() => setShowPickupOptions(true)}
              activeOpacity={1}
            >
              <Text style={formData.pickupLocation ? styles.inputText : styles.inputPlaceholder}>
                {formData.pickupLocation || 'Select pickup location'}
              </Text>
            </TouchableOpacity>
            {errors.pickupLocation && <Text style={styles.errorText}>{errors.pickupLocation}</Text>}
          </View>
          {showPickupOptions && (
            <View style={styles.autocompleteContainer}>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={styles.input}
                  placeholder="Type to search..."
                  value={pickupQuery}
                  onChangeText={setPickupQuery}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => {
                    setPickupQuery('');
                    setShowPickupOptions(false);
                  }}
                  style={styles.clearSearchButton}
                >
                  <Text style={styles.clearSearchButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 200 }}>
                {pickupSuggestions.map((loc, idx) => (
                  <TouchableOpacity
                    key={loc}
                    style={styles.suggestionItem}
                    onPress={() => {
                      let value = loc.replace(/ \(AB-\d\)$/i, '');
                      if (value === 'Block 16,17,18,19,20-Faster Match') {
                        handleInputChange('pickupLocation', value);
                      } else if (value.includes('Academic Block 1')) {
                        handleInputChange('pickupLocation', 'MIT administrative block (Academic Block 1)');
                      } else {
                        handleInputChange('pickupLocation', value);
                      }
                      setShowPickupOptions(false);
                      setPickupQuery('');
                    }}
                  >
                    <Text style={styles.suggestionText}>{loc}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Drop Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Drop Location</Text>
            <TouchableOpacity
              style={[styles.input, errors.dropLocation ? styles.inputError : null]}
              onPress={() => setShowDropOptions(true)}
              activeOpacity={1}
            >
              <Text style={formData.dropLocation ? styles.inputText : styles.inputPlaceholder}>
                {formData.dropLocation || 'Select drop location'}
              </Text>
            </TouchableOpacity>
            {errors.dropLocation && <Text style={styles.errorText}>{errors.dropLocation}</Text>}
          </View>
          {showDropOptions && (
            <View style={styles.autocompleteContainer}>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={styles.input}
                  placeholder="Type to search..."
                  value={dropQuery}
                  onChangeText={setDropQuery}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => {
                    setDropQuery('');
                    setShowDropOptions(false);
                  }}
                  style={styles.clearSearchButton}
                >
                  <Text style={styles.clearSearchButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 200 }}>
                {dropSuggestions.map((loc, idx) => (
                  <TouchableOpacity
                    key={loc}
                    style={styles.suggestionItem}
                    onPress={() => {
                      let value = loc.replace(/ \(AB-\d\)$/i, '');
                      if (loc === 'AB-1 (Last Point of Drop)') {
                        handleInputChange('dropLocation', 'MIT administrative block (Academic Block 1)');
                      } else if (value.includes('Academic Block 1')) {
                        handleInputChange('dropLocation', 'MIT administrative block (Academic Block 1)');
                      } else {
                        handleInputChange('dropLocation', value);
                      }
                      setShowDropOptions(false);
                      setDropQuery('');
                    }}
                  >
                    <Text style={styles.suggestionText}>{loc}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Date Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date of Travel</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.input, errors.travelDate ? styles.inputError : null, { flex: 1 }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.inputText}>
                  {formData.travelDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.todayButton}
                onPress={() => handleInputChange('travelDate', new Date())}
              >
                <Text style={styles.todayButtonText}>Today</Text>
              </TouchableOpacity>
            </View>
            {errors.travelDate && <Text style={styles.errorText}>{errors.travelDate}</Text>}
          </View>
          
          {/* Auto Time */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Auto Time</Text>
            <TouchableOpacity
              style={[styles.input, errors.autoTravelTime ? styles.inputError : null]}
              onPress={() => setShowCustomTimePicker(true)}
            >
              <Text style={styles.inputText}>
                {formData.autoTravelTime === 'immediate-5min'
                  ? 'Immediately - In 5 Mins'
                  : formData.autoTravelTime instanceof Date
                    ? formData.autoTravelTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Select time'}
              </Text>
            </TouchableOpacity>
            {errors.autoTravelTime && <Text style={styles.errorText}>{errors.autoTravelTime}</Text>}
          </View>
          {/* Custom Time Picker Modal */}
          <Modal
            visible={showCustomTimePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCustomTimePicker(false)}
          >
            <View style={styles.modalContainer}>
              <View style={[styles.modalContent, { padding: 0 }]}> {/* Remove extra padding for picker */}
                <TouchableOpacity
                  style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#e9ecef' }}
                  onPress={() => {
                    handleInputChange('autoTravelTime', 'immediate-5min');
                    setShowCustomTimePicker(false);
                  }}
                >
                  <Text style={{ fontSize: 18, color: '#007bff', fontWeight: 'bold' }}>Immediately - In 5 Mins</Text>
                </TouchableOpacity>
                <View style={{ borderBottomWidth: 1, borderBottomColor: '#e9ecef' }} />
                <DateTimePicker
                  value={formData.autoTravelTime instanceof Date ? formData.autoTravelTime : new Date()}
                  mode="time"
                  is24Hour={false}
                  display="spinner"
                  onChange={(event, selectedTime) => {
                    if (selectedTime) {
                      handleInputChange('autoTravelTime', selectedTime);
                      setShowCustomTimePicker(false);
                    }
                  }}
                  style={{ backgroundColor: '#fff' }}
                />
                <TouchableOpacity
                  style={{ alignItems: 'center', padding: 16 }}
                  onPress={() => setShowCustomTimePicker(false)}
                >
                  <Text style={{ color: '#dc3545', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
          
          {/* Time Flexibility */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Time Flexibility (minutes)</Text>
            <TextInput
              style={[styles.input, errors.flexibilityMinutes ? styles.inputError : null]}
              value={formData.flexibilityMinutes}
              onChangeText={(value) => handleInputChange('flexibilityMinutes', value)}
              placeholder="15"
              placeholderTextColor="#adb5bd"
              keyboardType="numeric"
            />
            {errors.flexibilityMinutes && <Text style={styles.errorText}>{errors.flexibilityMinutes}</Text>}
          </View>
          
          {/* Search Progress */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${searchProgress}%` }]} />
            <Text style={styles.progressText}>{searchProgress}% Complete</Text>
          </View>
          
          {/* Search Button */}
          <TouchableOpacity 
            style={[styles.searchButton, searchProgress < 100 && styles.searchButtonDisabled]}
            onPress={findRides}
            disabled={searchProgress < 100}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>Find Auto Shares</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Search Results */}
        {availableRides.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Available Auto Shares</Text>
            {availableRides.map((ride) => renderRideItem({ item: ride }))}
          </View>
        )}
      </ScrollView>
      
      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={formData.travelDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              handleInputChange('travelDate', selectedDate);
            }
          }}
          minimumDate={new Date()}
        />
      )}
      
      {/* Time Picker - Removed unused component */}
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
  searchForm: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
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
    backgroundColor: '#f8f9fa',
  },
  inputError: {
    borderColor: '#dc3545',
  },
  inputText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  inputPlaceholder: {
    fontSize: 16,
    color: '#adb5bd',
  },
  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 4,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    marginVertical: 16,
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#28a745',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 4,
  },
  searchButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  searchButtonDisabled: {
    backgroundColor: '#adb5bd',
    shadowOpacity: 0,
    elevation: 1,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  resultsContainer: {
    padding: 16,
    paddingTop: 0,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  rideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rideInfo: {
    flex: 1,
  },
  rideRoute: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  rideDate: {
    fontSize: 14,
    color: '#6c757d',
  },
  rideSeats: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideSeatsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
  },
  rideSeatsLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  rideDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    fontSize: 16,
    marginRight: 8,
    width: 24,
    textAlign: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#495057',
  },
  joinButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: 14,
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
    paddingBottom: 24,
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
  modalCloseButton: {
    fontSize: 24,
    color: '#6c757d',
    fontWeight: 'bold',
  },
  locationOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  locationDescription: {
    fontSize: 14,
    color: '#6c757d',
  },
  ActivityIndicator: {
    color: '#fff',
  },
  autocompleteContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 120, // adjust as needed
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100,
    padding: 8,
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  suggestionText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  closeAutocomplete: {
    alignItems: 'flex-end',
    padding: 8,
  },
  todayButton: {
    marginLeft: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  todayButtonText: {
    color: '#007bff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    zIndex: 10,
  },
  clearSearchButtonText: {
    fontSize: 22,
    color: '#adb5bd',
    fontWeight: 'bold',
  },
});

export default FindAnAutoShare;

// Firebase Console Action: Create 'auto_rides' collection in Firestore with the following structure:
// - id: string (auto-generated)
// - pickupLocation: string
// - dropLocation: string
// - travelDate: timestamp
// - autoTravelTime: timestamp
// - flexibilityMinutes: string
// - createdBy: string (user ID)
// - passengers: array of Passenger objects
// - maxPassengers: number
// - status: 'active' | 'matched' | 'completed'
// - createdAt: timestamp
