import React, { useState } from 'react';
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
  travelType: 'departure' | 'arrival';
  travelDate: Timestamp | Date;
  cabTravelTime: Timestamp | Date;
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
  luggage: {
    carryOnBags: string;
    checkinBags: string;
    laptopBags: string;
  };
}

interface FormData {
  pickupLocation: string;
  dropLocation: string;
  travelType: 'departure' | 'arrival';
  travelDate: Date;
  cabTravelTime: Date;
  flexibilityMinutes: string;
  carryOnBags: string;
  checkinBags: string;
  laptopBags: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface LocationOption {
  id: string;
  name: string;
  description?: string;
}

const LOCATION_OPTIONS: LocationOption[] = [
  { id: 'mit-manipal', name: 'MIT Manipal', description: 'Manipal Institute of Technology' },
  { id: 'kmc', name: 'KMC', description: 'Kasturba Medical College' },
  { id: 'mangalore-airport', name: 'Mangaluru International Airport (IXE)', description: 'International Airport' },
  { id: 'udupi-railway', name: 'Udupi Railway Station', description: 'Railway Station' },
];

const FindACabShare: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    pickupLocation: '',
    dropLocation: '',
    travelType: 'departure',
    travelDate: new Date(),
    cabTravelTime: new Date(),
    flexibilityMinutes: '15',
    carryOnBags: '0',
    checkinBags: '0',
    laptopBags: '0',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDropDropdown, setShowDropDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCabTimePicker, setShowCabTimePicker] = useState(false);
  const [showFlexibilityPicker, setShowFlexibilityPicker] = useState(false);

  // Calculate progress based on filled fields
  const calculateProgress = (): number => {
    const totalFields = 7; // Excluding travelType as it has default value
    let filledFields = 0;
    
    if (formData.pickupLocation.trim()) filledFields++;
    if (formData.dropLocation.trim()) filledFields++;
    if (formData.travelDate) filledFields++;
    if (formData.cabTravelTime) filledFields++;
    if (formData.flexibilityMinutes.trim()) filledFields++;
    if (formData.carryOnBags !== '0') filledFields++;
    if (formData.checkinBags !== '0') filledFields++;
    if (formData.laptopBags !== '0') filledFields++;
    
    return (filledFields / totalFields) * 100;
  };

  const validateStep = (step: number): boolean => {
    const newErrors: ValidationErrors = {};
    
    switch (step) {
      case 1:
        if (!formData.pickupLocation.trim()) {
          newErrors.pickupLocation = 'Please enter your pickup location';
        }
        if (!formData.dropLocation.trim()) {
          newErrors.dropLocation = 'Please enter your drop-off location';
        }
        break;
      case 2:
        if (!formData.travelDate) {
          newErrors.travelDate = 'Please select your travel date';
        }
        if (!formData.cabTravelTime) {
          newErrors.cabTravelTime = 'Please select your preferred cab time';
        }
        if (!formData.flexibilityMinutes.trim()) {
          newErrors.flexibilityMinutes = 'Please specify your time flexibility';
        } else if (isNaN(Number(formData.flexibilityMinutes)) || Number(formData.flexibilityMinutes) < 0) {
          newErrors.flexibilityMinutes = 'Please enter a valid number of minutes';
        }
        break;
      case 3:
        // All luggage fields have default values, so no validation needed
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
    setErrors({});
  };

  // Function to check if two times match within flexibility
  const isTimeWithinFlexibility = (
    publishedTime: Date, 
    searchTime: Date, 
    publishedFlexibility: number, 
    searchFlexibility: number,
    publishedType: 'departure' | 'arrival',
    searchType: 'departure' | 'arrival'
  ): boolean => {
    const publishedTimeMs = publishedTime.getTime();
    const searchTimeMs = searchTime.getTime();
    
    // Calculate total flexibility window in milliseconds
    const publishedFlexMs = publishedFlexibility * 60 * 1000;
    const searchFlexMs = searchFlexibility * 60 * 1000;
    
    // For departure: can go earlier (prepone)
    // For arrival: can go later (postpone)
    let publishedEarliest = publishedTimeMs;
    let publishedLatest = publishedTimeMs;
    let searchEarliest = searchTimeMs;
    let searchLatest = searchTimeMs;
    
    if (publishedType === 'departure') {
      publishedEarliest = publishedTimeMs - publishedFlexMs; // Can leave earlier
      publishedLatest = publishedTimeMs + publishedFlexMs; // Can leave later
    } else {
      publishedEarliest = publishedTimeMs - publishedFlexMs; // Can arrive earlier
      publishedLatest = publishedTimeMs + publishedFlexMs; // Can arrive later
    }
    
    if (searchType === 'departure') {
      searchEarliest = searchTimeMs - searchFlexMs; // Can leave earlier
      searchLatest = searchTimeMs + searchFlexMs; // Can leave later
    } else {
      searchEarliest = searchTimeMs - searchFlexMs; // Can arrive earlier
      searchLatest = searchTimeMs + searchFlexMs; // Can arrive later
    }
    
    // Check if time windows overlap
    return !(publishedLatest < searchEarliest || searchLatest < publishedEarliest);
  };

  // Function to check if dates are the same
  const isSameDate = (date1: Date, date2: Date): boolean => {
    return date1.toDateString() === date2.toDateString();
  };

  // Function to find matching rides
  const findMatchingRides = async (searchData: FormData): Promise<PublishedRide[]> => {
    try {
      // Query published rides collection - simplified to avoid index requirements
      const publishedRidesRef = collection(db, 'published_rides');
      const q = query(
        publishedRidesRef,
        where('pickupLocation', '==', searchData.pickupLocation),
        where('dropLocation', '==', searchData.dropLocation)
      );
      
      const querySnapshot = await getDocs(q);
      const matchingRides: PublishedRide[] = [];
      
      querySnapshot.forEach((doc) => {
        const rideData = { id: doc.id, ...doc.data() } as PublishedRide;
        
        // Filter for active rides on client side to avoid index requirements
        if (rideData.status !== 'active') {
          return; // Skip non-active rides
        }
        
        // Convert Firestore timestamps to Date objects
        const publishedDate = rideData.travelDate instanceof Timestamp ? rideData.travelDate.toDate() : rideData.travelDate;
        const publishedTime = rideData.cabTravelTime instanceof Timestamp ? rideData.cabTravelTime.toDate() : rideData.cabTravelTime;
        
        // Check if dates match
        if (isSameDate(publishedDate, searchData.travelDate)) {
          // Check if times match within flexibility
          const publishedFlexibility = parseInt(rideData.flexibilityMinutes);
          const searchFlexibility = parseInt(searchData.flexibilityMinutes);
          
          if (isTimeWithinFlexibility(
            publishedTime,
            searchData.cabTravelTime,
            publishedFlexibility,
            searchFlexibility,
            rideData.travelType,
            searchData.travelType
          )) {
            // Check if ride has available seats
            const currentPassengers = rideData.passengers?.length || 0;
            const maxPassengers = rideData.maxPassengers || 4;
            
            if (currentPassengers < maxPassengers) {
              matchingRides.push(rideData);
            }
          }
        }
      });
      
      return matchingRides;
    } catch (error) {
      console.error('Error finding matching rides:', error);
      return [];
    }
  };

  // Function to join a ride
  const joinRide = async (rideId: string, passengerData: Passenger) => {
    try {
      const rideRef = doc(db, 'published_rides', rideId);
      await updateDoc(rideRef, {
        passengers: arrayUnion(passengerData)
      });
      
      // Also create a user ride record for "Your Rides" feature
      await addDoc(collection(db, 'user_rides'), {
        userId: 'current_user_id', // Replace with actual user ID
        rideId: rideId,
        role: 'passenger',
        joinedAt: serverTimestamp(),
        status: 'active'
      });
      
      return true;
    } catch (error) {
      console.error('Error joining ride:', error);
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    
    setIsSubmitting(true);
    try {
      // First, find matching rides
      const matchingRides = await findMatchingRides(formData);
      
      if (matchingRides.length > 0) {
        // Show matching rides to user
        Alert.alert(
          'Match Found! 🎉',
          `We found ${matchingRides.length} ride(s) that match your preferences. Would you like to join one of these rides?`,
          [
            {
              text: 'View Rides',
              onPress: () => {
                // Navigate to ride selection screen with matching rides
                navigation.navigate('CabRideDetails', { 
                  rideId: matchingRides[0].id,
                  isJoining: true,
                  passengerData: {
                    id: 'current_user_id', // Replace with actual user ID
                    name: 'Current User', // Replace with actual user name
                    phoneNumber: '+91 9876543210', // Replace with actual user phone
                    joinedAt: serverTimestamp(),
                    luggage: {
                      carryOnBags: formData.carryOnBags,
                      checkinBags: formData.checkinBags,
                      laptopBags: formData.laptopBags
                    }
                  },
                  matchingRides: matchingRides
                });
              }
            },
            {
              text: 'Create New Request',
              onPress: async () => {
                // If user doesn't want to join existing rides, create a new request
                await addDoc(collection(db, 'cab_share_requests'), {
                  ...formData,
                  createdAt: serverTimestamp(),
                  status: 'active',
                  userId: 'current_user_id',
                });
                
                Alert.alert(
                  'Request Created!',
                  'Your cab share request has been posted. We\'ll notify you when someone matches your route.',
                  [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
              }
            }
          ]
        );
      } else {
        // No matches found, create a new request
        await addDoc(collection(db, 'cab_share_requests'), {
          ...formData,
          createdAt: serverTimestamp(),
          status: 'active',
          userId: 'current_user_id',
        });
        
        Alert.alert(
          'Request Created!',
          'No matching rides found at the moment. Your request has been posted and we\'ll notify you when someone matches your route.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Error processing cab share request:', error);
      Alert.alert('Error', 'Failed to process your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
    // Firebase Console Action: Create 'cab_share_requests' and 'published_rides' collections in Firestore with read/write rules
    // Firebase Console Action: Create 'user_rides' collection to track user's ride history
  };

  const updateFormData = (field: keyof FormData, value: string | Date) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Show encouraging feedback as user fills the form
    const newProgress = calculateProgress();
    if (newProgress === 100 && field !== 'travelType') {
      // Could add haptic feedback here for completion
      console.log('Form completed! 🎉');
    }
  };

  // Helper functions for date/time formatting
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Generate flexibility options in 5-minute intervals
  const flexibilityOptions = Array.from({ length: 24 }, (_, i) => {
    const minutes = (i + 1) * 5;
    return { label: `${minutes} minutes`, value: minutes.toString() };
  });

  const handleLocationSelect = (field: 'pickupLocation' | 'dropLocation', location: LocationOption) => {
    updateFormData(field, location.name);
    if (field === 'pickupLocation') {
      setShowPickupDropdown(false);
    } else {
      setShowDropDropdown(false);
    }
  };

  const renderFlexibilityPicker = () => (
    <Modal
      visible={showFlexibilityPicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFlexibilityPicker(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={() => setShowFlexibilityPicker(false)}
      >
        <View style={styles.flexibilityPickerContainer}>
          <Text style={styles.flexibilityPickerTitle}>
            Select Flexibility ({formData.travelType === 'departure' ? 'Prepone' : 'Postpone'})
          </Text>
          <ScrollView style={styles.flexibilityScrollView} showsVerticalScrollIndicator={false}>
            {flexibilityOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.flexibilityOption,
                  formData.flexibilityMinutes === option.value && styles.flexibilityOptionSelected
                ]}
                onPress={() => {
                  updateFormData('flexibilityMinutes', option.value);
                  setShowFlexibilityPicker(false);
                }}
              >
                <Text style={[
                  styles.flexibilityOptionText,
                  formData.flexibilityMinutes === option.value && styles.flexibilityOptionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity 
            style={styles.flexibilityCloseButton} 
            onPress={() => setShowFlexibilityPicker(false)}
          >
            <Text style={styles.flexibilityCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderLocationDropdown = (
    visible: boolean,
    onClose: () => void,
    onSelect: (location: LocationOption) => void,
    title: string
  ) => (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.dropdownContainer}>
          <Text style={styles.dropdownTitle}>{title}</Text>
          <FlatList
            data={LOCATION_OPTIONS}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.dropdownItemName}>{item.name}</Text>
                {item.description && (
                  <Text style={styles.dropdownItemDescription}>{item.description}</Text>
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
          <TouchableOpacity style={styles.dropdownCloseButton} onPress={onClose}>
            <Text style={styles.dropdownCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderProgressBar = () => {
    const progress = calculateProgress();
    const progressColor = progress === 0 ? '#e9ecef' : 
                         progress < 50 ? '#ffc107' : 
                         progress < 100 ? '#17a2b8' : '#28a745';
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Completion Progress</Text>
          <Text style={[styles.progressText, { color: progressColor }]}>
            {Math.round(progress)}% Complete
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[
            styles.progressFill, 
            { 
              width: `${progress}%`,
              backgroundColor: progressColor
            }
          ]} />
        </View>
        <View style={styles.progressSteps}>
          <Text style={styles.progressStepText}>
            {progress === 0 ? 'Let\'s get started!' : 
             progress < 33 ? 'Great start! Keep going...' :
             progress < 66 ? 'You\'re halfway there!' :
             progress < 100 ? 'Almost done!' : 'Perfect! Ready to submit 🎉'}
          </Text>
        </View>
      </View>
    );
  };

  const renderStepIndicator = () => {
    const getStepStatus = (step: number) => {
      if (step < currentStep) return 'completed';
      if (step === currentStep) return 'active';
      return 'inactive';
    };

    const getStepIcon = (step: number) => {
      const status = getStepStatus(step);
      if (status === 'completed') return '✓';
      return step.toString();
    };

    return (
      <View style={styles.stepIndicator}>
        {[1, 2, 3].map((step) => {
          const status = getStepStatus(step);
          return (
            <View key={step} style={styles.stepContainer}>
              <View style={[
                styles.stepCircle,
                status === 'active' && styles.stepCircleActive,
                status === 'completed' && styles.stepCircleCompleted
              ]}>
                <Text style={[
                  styles.stepNumber,
                  status === 'active' && styles.stepNumberActive,
                  status === 'completed' && styles.stepNumberCompleted
                ]}>
                  {getStepIcon(step)}
                </Text>
              </View>
              <Text style={[
                styles.stepLabel,
                status === 'active' && styles.stepLabelActive,
                status === 'completed' && styles.stepLabelCompleted
              ]}>
                {step === 1 ? 'Locations' : step === 2 ? 'Timing' : 'Luggage'}
              </Text>
              {step < 3 && (
                <View style={[
                  styles.stepConnector,
                  status === 'completed' && styles.stepConnectorCompleted
                ]} />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📍 Where are you traveling?</Text>
      <Text style={styles.stepSubtitle}>Enter your pickup and drop locations</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Pick Up Location</Text>
        <TouchableOpacity
          style={[
            styles.input,
            styles.inputTouchable,
            errors.pickupLocation && styles.inputError,
            formData.pickupLocation.trim() && styles.inputFilled
          ]}
          onPress={() => setShowPickupDropdown(true)}
        >
          <Text style={[
            styles.inputText,
            !formData.pickupLocation && styles.placeholderText
          ]}>
            {formData.pickupLocation || 'Select pickup location'}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
        {errors.pickupLocation && (
          <Text style={styles.errorText}>{errors.pickupLocation}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Drop Location</Text>
        <TouchableOpacity
          style={[
            styles.input,
            styles.inputTouchable,
            errors.dropLocation && styles.inputError,
            formData.dropLocation.trim() && styles.inputFilled
          ]}
          onPress={() => setShowDropDropdown(true)}
        >
          <Text style={[
            styles.inputText,
            !formData.dropLocation && styles.placeholderText
          ]}>
            {formData.dropLocation || 'Select drop location'}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
        {errors.dropLocation && (
          <Text style={styles.errorText}>{errors.dropLocation}</Text>
        )}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>⏰ Travel Timing</Text>
      <Text style={styles.stepSubtitle}>Set your travel preferences and flexibility</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Travel Type</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              formData.travelType === 'departure' && styles.toggleButtonActive
            ]}
            onPress={() => updateFormData('travelType', 'departure')}
          >
            <Text style={[
              styles.toggleText,
              formData.travelType === 'departure' && styles.toggleTextActive
            ]}>
              ✈️ Departure
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              formData.travelType === 'arrival' && styles.toggleButtonActive
            ]}
            onPress={() => updateFormData('travelType', 'arrival')}
          >
            <Text style={[
              styles.toggleText,
              formData.travelType === 'arrival' && styles.toggleTextActive
            ]}>
              🛬 Arrival
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Travel Date</Text>
        <TouchableOpacity
          style={[
            styles.dateTimeButton,
            formData.travelDate && styles.dateTimeButtonFilled,
            errors.travelDate && styles.inputError
          ]}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={[
            styles.dateTimeButtonText,
            !formData.travelDate && styles.dateTimeButtonPlaceholder
          ]}>
            {formData.travelDate ? formatDate(formData.travelDate) : 'Select travel date'}
          </Text>
          <Text style={styles.dateTimeButtonIcon}>📅</Text>
        </TouchableOpacity>
        {errors.travelDate && (
          <Text style={styles.errorText}>{errors.travelDate}</Text>
        )}
      </View>



      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Cab Travel Time</Text>
        <TouchableOpacity
          style={[
            styles.dateTimeButton,
            formData.cabTravelTime && styles.dateTimeButtonFilled,
            errors.cabTravelTime && styles.inputError
          ]}
          onPress={() => setShowCabTimePicker(true)}
        >
          <Text style={[
            styles.dateTimeButtonText,
            !formData.cabTravelTime && styles.dateTimeButtonPlaceholder
          ]}>
            {formData.cabTravelTime ? formatTime(formData.cabTravelTime) : 'Select cab time'}
          </Text>
          <Text style={styles.dateTimeButtonIcon}>🚗</Text>
        </TouchableOpacity>
        {errors.cabTravelTime && (
          <Text style={styles.errorText}>{errors.cabTravelTime}</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Flexibility ({formData.travelType === 'departure' ? 'Prepone' : 'Postpone'})
        </Text>
        <TouchableOpacity
          style={[
            styles.dateTimeButton,
            formData.flexibilityMinutes && styles.dateTimeButtonFilled,
            errors.flexibilityMinutes && styles.inputError
          ]}
          onPress={() => setShowFlexibilityPicker(true)}
        >
          <Text style={[
            styles.dateTimeButtonText,
            !formData.flexibilityMinutes && styles.dateTimeButtonPlaceholder
          ]}>
            {formData.flexibilityMinutes ? `${formData.flexibilityMinutes} minutes` : 'Select flexibility'}
          </Text>
          <Text style={styles.dateTimeButtonIcon}>⏱️</Text>
        </TouchableOpacity>
        <Text style={styles.helperText}>
          How many minutes are you flexible to {formData.travelType === 'departure' ? 'leave before' : 'wait after'} your preferred cab time?
        </Text>
        {errors.flexibilityMinutes && (
          <Text style={styles.errorText}>{errors.flexibilityMinutes}</Text>
        )}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>🧳 Luggage Details</Text>
      <Text style={styles.stepSubtitle}>Help us find the right cab size for your needs</Text>
      
      <View style={styles.luggageContainer}>
        <View style={styles.luggageItem}>
          <Text style={styles.luggageLabel}>✈️ Carry-On Bags</Text>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateFormData('carryOnBags', Math.max(0, parseInt(formData.carryOnBags) - 1).toString())}
            >
              <Text style={styles.counterButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{formData.carryOnBags}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateFormData('carryOnBags', (parseInt(formData.carryOnBags) + 1).toString())}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.luggageItem}>
          <Text style={styles.luggageLabel}>🎒 Check-In Bags</Text>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateFormData('checkinBags', Math.max(0, parseInt(formData.checkinBags) - 1).toString())}
            >
              <Text style={styles.counterButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{formData.checkinBags}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateFormData('checkinBags', (parseInt(formData.checkinBags) + 1).toString())}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.luggageItem}>
          <Text style={styles.luggageLabel}>💻 Laptop Bags</Text>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateFormData('laptopBags', Math.max(0, parseInt(formData.laptopBags) - 1).toString())}
            >
              <Text style={styles.counterButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{formData.laptopBags}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateFormData('laptopBags', (parseInt(formData.laptopBags) + 1).toString())}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>📋 Summary</Text>
        <Text style={styles.summaryText}>From: {formData.pickupLocation || 'Not specified'}</Text>
        <Text style={styles.summaryText}>To: {formData.dropLocation || 'Not specified'}</Text>
        <Text style={styles.summaryText}>Travel Date: {formData.travelDate ? formatDate(formData.travelDate) : 'Not specified'}</Text>
        <Text style={styles.summaryText}>Cab Time: {formData.cabTravelTime ? formatTime(formData.cabTravelTime) : 'Not specified'}</Text>
        <Text style={styles.summaryText}>
          Total Bags: {parseInt(formData.carryOnBags) + parseInt(formData.checkinBags) + parseInt(formData.laptopBags)}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: '#fff' }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Find A Cab Share</Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderProgressBar()}
          {renderStepIndicator()}
          
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          {/* Navigation Buttons */}
          <View style={styles.navigationContainer}>
            {currentStep > 1 && (
              <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
                <Text style={styles.previousButtonText}>← Previous</Text>
              </TouchableOpacity>
            )}
            
            {currentStep < 3 ? (
              <TouchableOpacity 
                style={[styles.nextButton, currentStep === 1 && styles.fullWidthButton]} 
                onPress={handleNext}
              >
                <Text style={styles.nextButtonText}>Next →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Posting...' : '🚀 Post Cab Share Request'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>

        {/* Location Dropdowns */}
        {renderLocationDropdown(
          showPickupDropdown,
          () => setShowPickupDropdown(false),
          (location) => handleLocationSelect('pickupLocation', location),
          'Select Pickup Location'
        )}
        
        {renderLocationDropdown(
          showDropDropdown,
          () => setShowDropDropdown(false),
          (location) => handleLocationSelect('dropLocation', location),
          'Select Drop Location'
        )}

        {renderFlexibilityPicker()}

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableOpacity 
            style={styles.dateTimePickerModal} 
            activeOpacity={1} 
            onPress={() => setShowDatePicker(false)}
          >
            <View style={styles.dateTimePickerContainer}>
              <Text style={styles.dateTimePickerTitle}>Select Travel Date</Text>
              <DateTimePicker
                value={formData.travelDate}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    updateFormData('travelDate', selectedDate);
                  }
                }}
                minimumDate={new Date()}
                style={styles.dateTimePicker}
              />
              <View style={styles.dateTimePickerButtons}>
                <TouchableOpacity
                  style={[styles.dateTimePickerButton, styles.dateTimePickerCancelButton]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.dateTimePickerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateTimePickerButton, styles.dateTimePickerConfirmButton]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.dateTimePickerButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>



        {/* Cab Time Picker Modal */}
        <Modal
          visible={showCabTimePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCabTimePicker(false)}
        >
          <TouchableOpacity 
            style={styles.dateTimePickerModal} 
            activeOpacity={1} 
            onPress={() => setShowCabTimePicker(false)}
          >
            <View style={styles.dateTimePickerContainer}>
              <Text style={styles.dateTimePickerTitle}>Select Cab Travel Time</Text>
              <DateTimePicker
                value={formData.cabTravelTime}
                mode="time"
                display="spinner"
                onChange={(event, selectedTime) => {
                  if (selectedTime) {
                    updateFormData('cabTravelTime', selectedTime);
                  }
                }}
                style={styles.dateTimePicker}
              />
              <View style={styles.dateTimePickerButtons}>
                <TouchableOpacity
                  style={[styles.dateTimePickerButton, styles.dateTimePickerCancelButton]}
                  onPress={() => setShowCabTimePicker(false)}
                >
                  <Text style={styles.dateTimePickerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateTimePickerButton, styles.dateTimePickerConfirmButton]}
                  onPress={() => setShowCabTimePicker(false)}
                >
                  <Text style={styles.dateTimePickerButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
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
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginRight: 40, // Compensate for back button
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  progressSteps: {
    alignItems: 'center',
  },
  progressStepText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  stepContainer: {
    alignItems: 'center',
    position: 'relative',
    flex: 1,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  stepCircleActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  stepCircleCompleted: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6c757d',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepNumberCompleted: {
    color: '#fff',
    fontSize: 16,
  },
  stepLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#007bff',
    fontWeight: '600',
  },
  stepLabelCompleted: {
    color: '#28a745',
    fontWeight: '600',
  },
  stepConnector: {
    position: 'absolute',
    top: 18,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#e9ecef',
    zIndex: -1,
  },
  stepConnectorCompleted: {
    backgroundColor: '#28a745',
  },
  stepContent: {
    backgroundColor: '#fff',
    margin: 8,
    padding: 16,
    borderRadius: 12,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#2c3e50',
  },
  inputError: {
    borderColor: '#dc3545',
    backgroundColor: '#fff5f5',
  },
  inputFilled: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },
  inputTouchable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputText: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  placeholderText: {
    color: '#adb5bd',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
    fontStyle: 'italic',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#007bff',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  toggleTextActive: {
    color: '#fff',
  },
  luggageContainer: {
    marginBottom: 20,
  },
  luggageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  luggageLabel: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  counterButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  counterValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginHorizontal: 20,
    minWidth: 24,
    textAlign: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
  },
  navigationContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  previousButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6c757d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  previousButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#007bff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  fullWidthButton: {
    flex: 2,
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#28a745',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  bottomSpacing: {
    height: 20,
  },
  // Dropdown styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 400,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    textAlign: 'center',
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
    backgroundColor: '#fff',
  },
  dropdownItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  dropdownItemDescription: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  dropdownCloseButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  dropdownCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  flexibilityPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 400,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  flexibilityPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    textAlign: 'center',
  },
  flexibilityScrollView: {
    maxHeight: 250,
  },
  flexibilityOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
    backgroundColor: '#fff',
  },
  flexibilityOptionSelected: {
    backgroundColor: '#e3f2fd',
  },
  flexibilityOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    textAlign: 'center',
  },
  flexibilityOptionTextSelected: {
    color: '#007bff',
    fontWeight: '600',
  },
  flexibilityCloseButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: '#f8f9fa',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  flexibilityCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
  },
  dateTimeButton: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTimeButtonFilled: {
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  dateTimeButtonPlaceholder: {
    color: '#adb5bd',
  },
  dateTimeButtonIcon: {
    fontSize: 14,
    color: '#6c757d',
  },
  dateTimePicker: {
    width: '100%',
    backgroundColor: '#fff',
  },
  dateTimePickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dateTimePickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dateTimePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  dateTimePickerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  dateTimePickerButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateTimePickerCancelButton: {
    backgroundColor: '#6c757d',
  },
  dateTimePickerConfirmButton: {
    backgroundColor: '#007bff',
  },
  dateTimePickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default FindACabShare;