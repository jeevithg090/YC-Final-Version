import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { db, auth, collection, addDoc, serverTimestamp } from '../services/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<any>;

interface FormData {
  pickupLocation: string;
  dropLocation: string;
  travelDate: Date;
  autoTravelTime: Date;
  flexibilityMinutes: string;
  autoCost: string;
  numberOfPassengers: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface LocationOption {
  id: string;
  name: string;
  description?: string;
}

// 1. Import LOCATION_LIST and AB_SHORTNAMES from FindAnAutoShare (or copy them here if not shared)
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

const LOCATION_OPTIONS: LocationOption[] = [
  { id: 'mit-manipal', name: 'MIT Manipal', description: 'Manipal Institute of Technology' },
  { id: 'kmc', name: 'KMC', description: 'Kasturba Medical College' },
  { id: 'mangalore-airport', name: 'Mangaluru International Airport (IXE)', description: 'International Airport' },
  { id: 'udupi-railway', name: 'Udupi Railway Station', description: 'Railway Station' },
];

const PublishAnAutoShare: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState<FormData>({
    pickupLocation: '',
    dropLocation: '',
    travelDate: new Date(),
    autoTravelTime: new Date(),
    flexibilityMinutes: '15',
    autoCost: '',
    numberOfPassengers: '3',
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  // 2. Add state for autocomplete and input for pickup/drop
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropQuery, setDropQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<string[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<string[]>([]);
  const [showPickupOptions, setShowPickupOptions] = useState(false);
  const [showDropOptions, setShowDropOptions] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formProgress, setFormProgress] = useState(0);

  // Calculate form progress
  useEffect(() => {
    let filledFields = 0;
    const totalFields = 7; // Total number of required fields

    if (formData.pickupLocation) filledFields++;
    if (formData.dropLocation) filledFields++;
    if (formData.travelDate) filledFields++;
    if (formData.autoTravelTime) filledFields++;
    if (formData.flexibilityMinutes) filledFields++;
    if (formData.autoCost) filledFields++;
    if (formData.numberOfPassengers) filledFields++;

    const progress = Math.round((filledFields / totalFields) * 100);
    setFormProgress(progress);
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
      // Always show 'Block 16,17,18,19,20-Faster Match' first
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
            if (alias === 'ab-1' || alias === 'ab1' || alias === 'ab 1') {
              ab1Match = true;
            } else {
              filtered.unshift(fullname);
            }
          }
        }
      });
      // Always show 'AB-1 (Last Point of Drop)' first
      filtered = [
        'AB-1 (Last Point of Drop)',
        ...filtered.filter(l => l !== 'AB-1 (Last Point of Drop)')
      ];
      setDropSuggestions(filtered);
    }
  }, [dropQuery, showDropOptions]);

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

  const validateForm = () => {
    const newErrors: ValidationErrors = {};

    if (!formData.pickupLocation) {
      newErrors.pickupLocation = 'Please select a pickup location';
    }

    if (!formData.dropLocation) {
      newErrors.dropLocation = 'Please select a drop location';
    } else if (formData.dropLocation === formData.pickupLocation) {
      newErrors.dropLocation = 'Pickup and drop locations cannot be the same';
    }

    if (!formData.travelDate) {
      newErrors.travelDate = 'Please select a travel date';
    }

    if (!formData.autoTravelTime) {
      newErrors.autoTravelTime = 'Please select your auto travel time';
    }

    if (!formData.flexibilityMinutes) {
      newErrors.flexibilityMinutes = 'Please specify your time flexibility';
    } else if (isNaN(Number(formData.flexibilityMinutes)) || Number(formData.flexibilityMinutes) < 0) {
      newErrors.flexibilityMinutes = 'Please enter a valid number of minutes';
    }

    if (!formData.autoCost) {
      newErrors.autoCost = 'Please enter the estimated auto cost';
    } else if (isNaN(Number(formData.autoCost)) || Number(formData.autoCost) <= 0) {
      newErrors.autoCost = 'Please enter a valid cost amount';
    }

    if (!formData.numberOfPassengers) {
      newErrors.numberOfPassengers = 'Please select the maximum number of passengers';
    } else if (isNaN(Number(formData.numberOfPassengers)) || Number(formData.numberOfPassengers) < 1) {
      newErrors.numberOfPassengers = 'Please enter a valid number of passengers';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const publishRide = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Check if user is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Login Required', 'Please log in to publish an auto share.');
        setLoading(false);
        return;
      }

      // Get user details
      const userId = currentUser.uid;
      const userName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
      const phoneNumber = currentUser.phoneNumber || 'No phone number';
      
      // Add ride to Firestore
      const autoRidesRef = collection(db, 'auto_rides');
      // Create a current timestamp (as a Date object) to use instead of serverTimestamp in the array
      const currentTimestamp = new Date();
      
      const newRide = {
        pickupLocation: formData.pickupLocation,
        dropLocation: formData.dropLocation,
        travelDate: formData.travelDate,
        autoTravelTime: formData.autoTravelTime,
        flexibilityMinutes: formData.flexibilityMinutes,
        autoCost: formData.autoCost,
        maxPassengers: Number(formData.numberOfPassengers),
        createdBy: userId,
        passengers: [
          {
            id: userId,
            name: userName,
            phoneNumber: phoneNumber,
            joinedAt: currentTimestamp, // Using Date object instead of serverTimestamp()
          }
        ],
        status: 'active',
        createdAt: serverTimestamp(),
        lastPassengerJoined: serverTimestamp(), // Adding this as a top-level field to track when the last passenger joined
      };

      const docRef = await addDoc(autoRidesRef, newRide);

      // Create a user_auto_rides document to track this user's ride
      const userAutoRidesRef = collection(db, 'user_auto_rides');
      await addDoc(userAutoRidesRef, {
        userId: userId,
        rideId: docRef.id,
        role: 'creator',
        status: 'active',
        createdAt: serverTimestamp()
      });

      Alert.alert(
        'Success',
        'Your auto share has been published!',
        [
          {
            text: 'View Details',
            onPress: () => navigation.navigate('AutoRideDetails', { rideId: docRef.id }),
          },
        ]
      );
    } catch (error) {
      console.error('Error publishing ride:', error);
      Alert.alert('Error', 'Failed to publish the auto share. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = (locationId: string) => {
    const location = LOCATION_OPTIONS.find(opt => opt.id === locationId);
    return location ? location.name : locationId;
  };

  return (
    <SafeAreaView style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: '#fff' }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Publish an Auto Share</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.formContainer}>
            <LinearGradient
              colors={['#f8f9fa', '#e9ecef']}
              style={styles.formHeader}
            >
              <Text style={styles.formHeaderTitle}>Create a New Auto Share</Text>
              <Text style={styles.formHeaderSubtitle}>
                Fill in the details to publish your auto share
              </Text>
            </LinearGradient>

            {/* Form Progress */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressBar, { width: `${formProgress}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{formProgress}% Complete</Text>
            </View>

            {/* Locations Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Locations</Text>

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
            </View>

            {/* Schedule Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Schedule</Text>

              {/* Date of Travel */}
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

              {/* Auto Travel Time */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Auto Travel Time</Text>
                <TouchableOpacity
                  style={[styles.input, errors.autoTravelTime ? styles.inputError : null]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.inputText}>
                    {formData.autoTravelTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
                {errors.autoTravelTime && <Text style={styles.errorText}>{errors.autoTravelTime}</Text>}
              </View>

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
            </View>

            {/* Auto Details Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Auto Details</Text>

              {/* Auto Cost */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Estimated Auto Cost (₹)</Text>
                <TextInput
                  style={[styles.input, errors.autoCost ? styles.inputError : null]}
                  value={formData.autoCost}
                  onChangeText={(value) => handleInputChange('autoCost', value)}
                  placeholder="150"
                  placeholderTextColor="#adb5bd"
                  keyboardType="numeric"
                />
                {errors.autoCost && <Text style={styles.errorText}>{errors.autoCost}</Text>}
              </View>

              {/* Number of Passengers */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Maximum Passengers (including you)</Text>
                <TextInput
                  style={[styles.input, errors.numberOfPassengers ? styles.inputError : null]}
                  value={formData.numberOfPassengers}
                  onChangeText={(value) => handleInputChange('numberOfPassengers', value)}
                  placeholder="3"
                  placeholderTextColor="#adb5bd"
                  keyboardType="numeric"
                />
                {errors.numberOfPassengers && <Text style={styles.errorText}>{errors.numberOfPassengers}</Text>}
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.publishButton,
                formProgress < 100 && styles.publishButtonDisabled,
              ]}
              onPress={publishRide}
              disabled={formProgress < 100 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.publishButtonText}>Publish Auto Share</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Date Picker Modal */}
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

        {/* Time Picker Modal */}
        {showTimePicker && (
          <DateTimePicker
            value={formData.autoTravelTime}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(event, selectedTime) => {
              setShowTimePicker(false);
              if (selectedTime) {
                handleInputChange('autoTravelTime', selectedTime);
              }
            }}
          />
        )}
      </View>
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
  formContainer: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formHeader: {
    padding: 20,
  },
  formHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  formHeaderSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  progressContainer: {
    padding: 16,
    paddingTop: 0,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
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
  formSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    marginTop: 8,
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
  publishButton: {
    backgroundColor: '#28a745',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  publishButtonDisabled: {
    backgroundColor: '#adb5bd',
    shadowOpacity: 0,
    elevation: 1,
  },
  publishButtonText: {
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
  autocompleteContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    padding: 5,
  },
  clearSearchButtonText: {
    fontSize: 18,
    color: '#adb5bd',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  suggestionText: {
    fontSize: 14,
    color: '#343a40',
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
});

export default PublishAnAutoShare;

// Firebase Console Action: Use the same 'auto_rides' collection in Firestore as mentioned in FindAnAutoShare.tsx
