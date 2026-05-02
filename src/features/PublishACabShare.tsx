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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<any>;

interface FormData {
  pickupLocation: string;
  dropLocation: string;
  travelType: 'departure' | 'arrival';
  travelDate: Date;
  flightTime: Date;
  cabTravelTime: Date;
  flexibilityMinutes: string;
  cabCost: string;
  numberOfPassengers: string;
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
  { id: 'manipal-bus-stand', name: 'Manipal Bus Stand', description: 'Main Bus Terminal' },
  { id: 'city-center-mall', name: 'City Center Mall', description: 'Shopping Mall' },
];

const PublishACabShare: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    pickupLocation: '',
    dropLocation: '',
    travelType: 'departure',
    travelDate: new Date(),
    flightTime: new Date(),
    cabTravelTime: new Date(),
    flexibilityMinutes: '15',
    cabCost: '',
    numberOfPassengers: '1',
    carryOnBags: '0',
    checkinBags: '0',
    laptopBags: '0',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDropDropdown, setShowDropDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFlightTimePicker, setShowFlightTimePicker] = useState(false);
  const [showCabTimePicker, setShowCabTimePicker] = useState(false);
  const [showFlexibilityPicker, setShowFlexibilityPicker] = useState(false);

  // Calculate progress based on filled fields and current step
  const calculateProgress = (): number => {
    const step1Fields = ['pickupLocation', 'dropLocation', 'travelType'];
    const step2Fields = ['travelDate', 'flightTime', 'cabTravelTime', 'flexibilityMinutes'];
    const step3Fields = ['cabCost', 'numberOfPassengers', 'carryOnBags', 'checkinBags', 'laptopBags'];
    
    let filledFields = 0;
    let totalFields = 0;
    
    if (currentStep >= 1) {
      totalFields += step1Fields.length;
      step1Fields.forEach(field => {
        if (formData[field as keyof FormData] && String(formData[field as keyof FormData]).trim() !== '') {
          filledFields++;
        }
      });
    }
    
    if (currentStep >= 2) {
      totalFields += step2Fields.length;
      step2Fields.forEach(field => {
        if (field === 'travelDate' || field === 'flightTime' || field === 'cabTravelTime') {
          filledFields++; // Dates are always filled
        } else if (formData[field as keyof FormData] && String(formData[field as keyof FormData]).trim() !== '') {
          filledFields++;
        }
      });
    }
    
    if (currentStep >= 3) {
      totalFields += step3Fields.length;
      step3Fields.forEach(field => {
        // Cab cost is optional, so count it as filled even if empty
        if (field === 'cabCost' || (formData[field as keyof FormData] && String(formData[field as keyof FormData]).trim() !== '')) {
          filledFields++;
        }
      });
    }
    
    return totalFields > 0 ? (filledFields / totalFields) * 100 : 0;
  };

  const validateStep = (step: number): boolean => {
    const newErrors: ValidationErrors = {};
    
    if (step === 1) {
      if (!formData.pickupLocation.trim()) {
        newErrors.pickupLocation = 'Pickup location is required';
      }
      if (!formData.dropLocation.trim()) {
        newErrors.dropLocation = 'Drop location is required';
      }
      if (formData.pickupLocation === formData.dropLocation && formData.pickupLocation.trim()) {
        newErrors.dropLocation = 'Drop location must be different from pickup location';
      }
    } else if (step === 2) {
      if (!formData.flexibilityMinutes.trim()) {
        newErrors.flexibilityMinutes = 'Flexibility time is required';
      }
    } else if (step === 3) {
      // Cab cost is optional, but if provided, it should be valid
      if (formData.cabCost.trim() && (isNaN(Number(formData.cabCost)) || Number(formData.cabCost) <= 0)) {
        newErrors.cabCost = 'Please enter a valid cost amount';
      }
      if (!formData.numberOfPassengers.trim()) {
        newErrors.numberOfPassengers = 'Number of passengers is required';
      } else if (isNaN(Number(formData.numberOfPassengers)) || Number(formData.numberOfPassengers) < 1 || Number(formData.numberOfPassengers) > 6) {
        newErrors.numberOfPassengers = 'Number of passengers must be between 1 and 6';
      }
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

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    
    setIsSubmitting(true);
    
    try {
      // Create data for published_rides collection (for matching functionality)
      const publishedRideData = {
        pickupLocation: formData.pickupLocation,
        dropLocation: formData.dropLocation,
        travelType: formData.travelType,
        travelDate: formData.travelDate,
        cabTravelTime: formData.cabTravelTime,
        flexibilityMinutes: formData.flexibilityMinutes,
        createdBy: 'current-user-id', // Replace with actual user ID from auth
        passengers: [], // Empty initially, will be populated when users join
        maxPassengers: parseInt(formData.numberOfPassengers),
        status: 'active',
        createdAt: serverTimestamp(),
        // Additional ride details
        cabCost: formData.cabCost.trim() ? parseFloat(formData.cabCost) : 500,
        luggage: {
          carryOnBags: parseInt(formData.carryOnBags),
          checkinBags: parseInt(formData.checkinBags),
          laptopBags: parseInt(formData.laptopBags),
        }
      };

      // Create data for cab_rides collection (for ride details display)
      const cabShareData = {
        date: formData.travelDate.toISOString().split('T')[0],
        time: formData.cabTravelTime.toISOString().split('T')[1].slice(0, 5),
        pickupLocation: formData.pickupLocation,
        dropLocation: formData.dropLocation,
        travelType: formData.travelType,
        travelDate: formData.travelDate.toISOString(),
        flightTime: formData.flightTime.toISOString(),
        cabTravelTime: formData.cabTravelTime.toISOString(),
        flexibilityMinutes: parseInt(formData.flexibilityMinutes),
        totalCost: formData.cabCost.trim() ? parseFloat(formData.cabCost) : 500,
        maxPassengers: parseInt(formData.numberOfPassengers),
        passengers: [], // Empty initially
        luggage: {
          smallBags: parseInt(formData.carryOnBags),
          mediumBags: parseInt(formData.checkinBags),
          largeBags: parseInt(formData.laptopBags),
        },
        cabService: {
          name: 'Default Cab Service',
          type: 'Sedan',
          driverName: 'TBD',
          driverNumber: 'TBD',
          arrivalTime: formData.cabTravelTime.toISOString().split('T')[1].slice(0, 5),
          carModel: 'Maruti Dzire',
          carNumber: 'KA-20-AB-1234',
        },
        createdAt: serverTimestamp(),
        status: 'active',
        createdBy: 'current-user-id', // Replace with actual user ID from auth
      };

      // Save to both collections
      const publishedRideRef = await addDoc(collection(db, 'published_rides'), publishedRideData);
      const cabRideRef = await addDoc(collection(db, 'cab_rides'), cabShareData);
      
      // Create a user ride record for "Your Rides" feature
      await addDoc(collection(db, 'user_rides'), {
        userId: 'current-user-id', // Replace with actual user ID
        rideId: cabRideRef.id,
        publishedRideId: publishedRideRef.id,
        role: 'creator',
        createdAt: serverTimestamp(),
        status: 'active'
      });
      
      Alert.alert(
        'Success!',
        'Your cab share has been published successfully. Other students can now find and join your ride.',
        [
          {
            text: 'View Ride Details',
            onPress: () => navigation.navigate('CabRideDetails' as any, { rideId: cabRideRef.id }),
          },
        ]
      );
    } catch (error) {
      console.error('Error publishing cab share:', error);
      Alert.alert(
        'Error',
        'Failed to publish your cab share. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
    // Firebase Console Action: Create 'published_rides' collection for matching functionality
    // Firebase Console Action: Create 'user_rides' collection to track user's ride history  
  };

  const updateFormData = (field: keyof FormData, value: string | Date) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Helper functions for date/time formatting
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Generate flexibility options in 5-minute intervals
  const flexibilityOptions = Array.from({ length: 24 }, (_, i) => {
    const minutes = (i + 1) * 5;
    return {
      value: minutes.toString(),
      label: `${minutes} minutes`,
    };
  });

  const handleLocationSelect = (field: 'pickupLocation' | 'dropLocation', location: LocationOption) => {
    updateFormData(field, location.name);
    if (field === 'pickupLocation') {
      setShowPickupDropdown(false);
    } else {
      setShowDropDropdown(false);
    }
  };

  const updateCounter = (field: keyof FormData, increment: boolean) => {
    const currentValue = parseInt(String(formData[field])) || 0;
    const newValue = increment ? currentValue + 1 : Math.max(0, currentValue - 1);
    updateFormData(field, newValue.toString());
  };

  const renderFlexibilityPicker = () => (
    <Modal visible={showFlexibilityPicker} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.flexibilityPickerContainer}>
          <Text style={styles.flexibilityPickerTitle}>Select Flexibility Time</Text>
          <ScrollView style={styles.flexibilityScrollView}>
            {flexibilityOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.flexibilityOption,
                  formData.flexibilityMinutes === option.value && styles.flexibilityOptionSelected,
                ]}
                onPress={() => {
                  updateFormData('flexibilityMinutes', option.value);
                  setShowFlexibilityPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.flexibilityOptionText,
                    formData.flexibilityMinutes === option.value && styles.flexibilityOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.flexibilityCloseButton}
            onPress={() => setShowFlexibilityPicker(false)}
          >
            <Text style={styles.flexibilityCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Travel Details</Text>
      <Text style={styles.stepSubtitle}>Where are you traveling from and to?</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Pickup Location *</Text>
        <TouchableOpacity
          style={[
            styles.input,
            styles.inputTouchable,
            errors.pickupLocation ? styles.inputError : formData.pickupLocation ? styles.inputFilled : {},
          ]}
          onPress={() => setShowPickupDropdown(true)}
        >
          <Text style={[styles.inputText, !formData.pickupLocation && styles.placeholderText]}>
            {formData.pickupLocation || 'Select pickup location'}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
        {errors.pickupLocation && <Text style={styles.errorText}>{errors.pickupLocation}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Drop Location *</Text>
        <TouchableOpacity
          style={[
            styles.input,
            styles.inputTouchable,
            errors.dropLocation ? styles.inputError : formData.dropLocation ? styles.inputFilled : {},
          ]}
          onPress={() => setShowDropDropdown(true)}
        >
          <Text style={[styles.inputText, !formData.dropLocation && styles.placeholderText]}>
            {formData.dropLocation || 'Select drop location'}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
        {errors.dropLocation && <Text style={styles.errorText}>{errors.dropLocation}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Travel Type *</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, formData.travelType === 'departure' && styles.toggleButtonActive]}
            onPress={() => updateFormData('travelType', 'departure')}
          >
            <Text style={[styles.toggleText, formData.travelType === 'departure' && styles.toggleTextActive]}>
              Departure
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, formData.travelType === 'arrival' && styles.toggleButtonActive]}
            onPress={() => updateFormData('travelType', 'arrival')}
          >
            <Text style={[styles.toggleText, formData.travelType === 'arrival' && styles.toggleTextActive]}>
              Arrival
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>
          Select "Departure" if you're leaving from campus, "Arrival" if you're coming to campus
        </Text>
      </View>

      {/* Location Dropdowns */}
      <Modal visible={showPickupDropdown} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownTitle}>Select Pickup Location</Text>
            <ScrollView>
              {LOCATION_OPTIONS.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={styles.dropdownItem}
                  onPress={() => handleLocationSelect('pickupLocation', location)}
                >
                  <Text style={styles.dropdownItemName}>{location.name}</Text>
                  {location.description && (
                    <Text style={styles.dropdownItemDescription}>{location.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.dropdownCloseButton}
              onPress={() => setShowPickupDropdown(false)}
            >
              <Text style={styles.dropdownCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDropDropdown} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownTitle}>Select Drop Location</Text>
            <ScrollView>
              {LOCATION_OPTIONS.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={styles.dropdownItem}
                  onPress={() => handleLocationSelect('dropLocation', location)}
                >
                  <Text style={styles.dropdownItemName}>{location.name}</Text>
                  {location.description && (
                    <Text style={styles.dropdownItemDescription}>{location.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.dropdownCloseButton}
              onPress={() => setShowDropDropdown(false)}
            >
              <Text style={styles.dropdownCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Schedule & Timing</Text>
      <Text style={styles.stepSubtitle}>When do you plan to travel?</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Date of Cab Ride *</Text>
        <TouchableOpacity
          style={[styles.dateTimeButton, styles.dateTimeButtonFilled]}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateTimeButtonText}>{formatDate(formData.travelDate)}</Text>
          <Text style={styles.dateTimeButtonIcon}>📅</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Flight {formData.travelType === 'departure' ? 'Departure' : 'Arrival'} Time *
        </Text>
        <TouchableOpacity
          style={[styles.dateTimeButton, styles.dateTimeButtonFilled]}
          onPress={() => setShowFlightTimePicker(true)}
        >
          <Text style={styles.dateTimeButtonText}>{formatTime(formData.flightTime)}</Text>
          <Text style={styles.dateTimeButtonIcon}>✈️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Cab Travel Time *</Text>
        <TouchableOpacity
          style={[styles.dateTimeButton, styles.dateTimeButtonFilled]}
          onPress={() => setShowCabTimePicker(true)}
        >
          <Text style={styles.dateTimeButtonText}>{formatTime(formData.cabTravelTime)}</Text>
          <Text style={styles.dateTimeButtonIcon}>🚗</Text>
        </TouchableOpacity>
        <Text style={styles.helperText}>
          What time do you want the cab to {formData.travelType === 'departure' ? 'leave' : 'arrive'}?
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Flexibility Time *
        </Text>
        <TouchableOpacity
          style={[
            styles.input,
            styles.inputTouchable,
            errors.flexibilityMinutes ? styles.inputError : formData.flexibilityMinutes ? styles.inputFilled : {},
          ]}
          onPress={() => setShowFlexibilityPicker(true)}
        >
          <Text style={[styles.inputText, !formData.flexibilityMinutes && styles.placeholderText]}>
            {formData.flexibilityMinutes ? `${formData.flexibilityMinutes} minutes` : 'Select flexibility time'}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
        {errors.flexibilityMinutes && <Text style={styles.errorText}>{errors.flexibilityMinutes}</Text>}
        <Text style={styles.helperText}>
          {formData.travelType === 'departure' 
            ? 'How many minutes are you flexible to leave before cab time?' 
            : 'How many minutes are you flexible to wait after your preferred cab time?'}
        </Text>
      </View>

      {/* Date/Time Pickers */}
      {showDatePicker && (
        <Modal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.dateTimePickerModal}>
            <View style={styles.dateTimePickerContainer}>
              <Text style={styles.dateTimePickerTitle}>Select Date</Text>
              <DateTimePicker
                value={formData.travelDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                onChange={(event, selectedDate) => {
                  console.log('Date picker onChange:', { event, selectedDate });
                  if (Platform.OS === 'android') {
                    setShowDatePicker(false);
                  }
                  if (selectedDate && event.type !== 'dismissed') {
                    updateFormData('travelDate', selectedDate);
                  }
                }}
                minimumDate={new Date()}
                style={styles.dateTimePicker}
              />
              {Platform.OS === 'ios' && (
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
                    <Text style={styles.dateTimePickerButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {showFlightTimePicker && (
        <Modal visible={showFlightTimePicker} transparent animationType="fade">
          <View style={styles.dateTimePickerModal}>
            <View style={styles.dateTimePickerContainer}>
              <Text style={styles.dateTimePickerTitle}>
                Select Flight {formData.travelType === 'departure' ? 'Departure' : 'Arrival'} Time
              </Text>
              <DateTimePicker
                value={formData.flightTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                onChange={(event, selectedTime) => {
                  console.log('Flight time picker onChange:', { event, selectedTime });
                  if (Platform.OS === 'android') {
                    setShowFlightTimePicker(false);
                  }
                  if (selectedTime && event.type !== 'dismissed') {
                    updateFormData('flightTime', selectedTime);
                  }
                }}
                style={styles.dateTimePicker}
              />
              {Platform.OS === 'ios' && (
                <View style={styles.dateTimePickerButtons}>
                  <TouchableOpacity
                    style={[styles.dateTimePickerButton, styles.dateTimePickerCancelButton]}
                    onPress={() => setShowFlightTimePicker(false)}
                  >
                    <Text style={styles.dateTimePickerButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateTimePickerButton, styles.dateTimePickerConfirmButton]}
                    onPress={() => setShowFlightTimePicker(false)}
                  >
                    <Text style={styles.dateTimePickerButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {showCabTimePicker && (
        <Modal visible={showCabTimePicker} transparent animationType="fade">
          <View style={styles.dateTimePickerModal}>
            <View style={styles.dateTimePickerContainer}>
              <Text style={styles.dateTimePickerTitle}>Select Cab Travel Time</Text>
              <DateTimePicker
                value={formData.cabTravelTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                onChange={(event, selectedTime) => {
                  console.log('Cab time picker onChange:', { event, selectedTime });
                  if (Platform.OS === 'android') {
                    setShowCabTimePicker(false);
                  }
                  if (selectedTime && event.type !== 'dismissed') {
                    updateFormData('cabTravelTime', selectedTime);
                  }
                }}
                style={styles.dateTimePicker}
              />
              {Platform.OS === 'ios' && (
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
                    <Text style={styles.dateTimePickerButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {renderFlexibilityPicker()}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Cost & Passengers</Text>
      <Text style={styles.stepSubtitle}>Share the details about cost and luggage</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Cab Cost (₹) (Optional)</Text>
        <TextInput
          style={[
            styles.input,
            errors.cabCost ? styles.inputError : formData.cabCost ? styles.inputFilled : {},
          ]}
          value={formData.cabCost}
          onChangeText={(value) => updateFormData('cabCost', value)}
          placeholder="Enter total cab cost (optional)"
          placeholderTextColor="#adb5bd"
          keyboardType="numeric"
        />
        {errors.cabCost && <Text style={styles.errorText}>{errors.cabCost}</Text>}
        <Text style={styles.helperText}>Total cost that will be split among all passengers (you can negotiate this later)</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Number of Passengers (Excluding You) *</Text>
        <TextInput
          style={[
            styles.input,
            errors.numberOfPassengers ? styles.inputError : formData.numberOfPassengers ? styles.inputFilled : {},
          ]}
          value={formData.numberOfPassengers}
          onChangeText={(value) => updateFormData('numberOfPassengers', value)}
          placeholder="Enter number of passengers"
          placeholderTextColor="#adb5bd"
          keyboardType="numeric"
        />
        {errors.numberOfPassengers && <Text style={styles.errorText}>{errors.numberOfPassengers}</Text>}
        <Text style={styles.helperText}>How many additional passengers can join? (Max: 6)</Text>
      </View>

      <View style={styles.luggageContainer}>
        <Text style={styles.inputLabel}>Your Luggage Details</Text>
        
        <View style={styles.luggageItem}>
          <Text style={styles.luggageLabel}>Carry-On Bags</Text>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateCounter('carryOnBags', false)}
            >
              <Text style={styles.counterButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{formData.carryOnBags}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateCounter('carryOnBags', true)}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.luggageItem}>
          <Text style={styles.luggageLabel}>Check-in Bags</Text>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateCounter('checkinBags', false)}
            >
              <Text style={styles.counterButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{formData.checkinBags}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateCounter('checkinBags', true)}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.luggageItem}>
          <Text style={styles.luggageLabel}>Laptop Bags</Text>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateCounter('laptopBags', false)}
            >
              <Text style={styles.counterButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{formData.laptopBags}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => updateCounter('laptopBags', true)}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>🎯 Ride Summary</Text>
        
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>📍 Route</Text>
          <View style={styles.summaryRouteContainer}>
            <View style={styles.summaryLocationContainer}>
              <Text style={styles.summaryLocationLabel}>From</Text>
              <Text style={styles.summaryLocationText}>{formData.pickupLocation}</Text>
            </View>
            <View style={styles.summaryArrow}>
              <Text style={styles.summaryArrowText}>→</Text>
            </View>
            <View style={styles.summaryLocationContainer}>
              <Text style={styles.summaryLocationLabel}>To</Text>
              <Text style={styles.summaryLocationText}>{formData.dropLocation}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>📅 Schedule</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Travel Date:</Text>
            <Text style={styles.summaryValue}>{formatDate(formData.travelDate)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Flight {formData.travelType === 'departure' ? 'Departure' : 'Arrival'}:</Text>
            <Text style={styles.summaryValue}>{formatTime(formData.flightTime)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Cab {formData.travelType === 'departure' ? 'Departure' : 'Arrival'}:</Text>
            <Text style={styles.summaryValue}>{formatTime(formData.cabTravelTime)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Flexibility:</Text>
            <Text style={styles.summaryValue}>{formData.flexibilityMinutes} minutes</Text>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>👥 Passengers & Cost</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Available Seats:</Text>
            <Text style={styles.summaryValue}>{formData.numberOfPassengers} passengers</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Travelers:</Text>
            <Text style={styles.summaryValue}>{parseInt(formData.numberOfPassengers) + 1} (including you)</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estimated Cost:</Text>
            <Text style={styles.summaryValue}>
              {formData.cabCost ? `₹${formData.cabCost}` : 'To be discussed'}
            </Text>
          </View>
          {formData.cabCost && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Per Person:</Text>
              <Text style={styles.summaryValueHighlight}>
                ₹{Math.round(parseFloat(formData.cabCost) / (parseInt(formData.numberOfPassengers) + 1))}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>🧳 Your Luggage</Text>
          <View style={styles.summaryLuggageGrid}>
            <View style={styles.summaryLuggageItem}>
              <Text style={styles.summaryLuggageNumber}>{formData.carryOnBags}</Text>
              <Text style={styles.summaryLuggageLabel}>Carry-On</Text>
            </View>
            <View style={styles.summaryLuggageItem}>
              <Text style={styles.summaryLuggageNumber}>{formData.checkinBags}</Text>
              <Text style={styles.summaryLuggageLabel}>Check-in</Text>
            </View>
            <View style={styles.summaryLuggageItem}>
              <Text style={styles.summaryLuggageNumber}>{formData.laptopBags}</Text>
              <Text style={styles.summaryLuggageLabel}>Laptop</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Publish Cab Share</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Completion Progress</Text>
          <Text style={[styles.progressText, { color: calculateProgress() === 100 ? '#28a745' : '#007bff' }]}>
            {Math.round(calculateProgress())}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={calculateProgress() === 100 ? ['#28a745', '#20c997'] : ['#007bff', '#0056b3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${calculateProgress()}%` }]}
          />
        </View>
        <View style={styles.progressSteps}>
          <Text style={styles.progressStepText}>
            {currentStep === 1 && 'Step 1: Enter travel details'}
            {currentStep === 2 && 'Step 2: Set schedule and timing'}
            {currentStep === 3 && 'Step 3: Add cost and passenger info'}
          </Text>
        </View>
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        {[1, 2, 3].map((step, index) => (
          <View key={step} style={styles.stepContainer}>
            {index > 0 && (
              <View
                style={[
                  styles.stepConnector,
                  currentStep > step && styles.stepConnectorCompleted,
                ]}
              />
            )}
            <View
              style={[
                styles.stepCircle,
                currentStep === step && styles.stepCircleActive,
                currentStep > step && styles.stepCircleCompleted,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  currentStep === step && styles.stepNumberActive,
                  currentStep > step && styles.stepNumberCompleted,
                ]}
              >
                {currentStep > step ? '✓' : step}
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                currentStep === step && styles.stepLabelActive,
                currentStep > step && styles.stepLabelCompleted,
              ]}
            >
              {step === 1 && 'Travel Details'}
              {step === 2 && 'Schedule'}
              {step === 3 && 'Cost & Passengers'}
            </Text>
          </View>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigationContainer}>
        {currentStep > 1 && (
          <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>
        )}
        
        {currentStep < 3 ? (
          <TouchableOpacity style={[styles.nextButton, currentStep === 1 && styles.fullWidthButton]} onPress={handleNext}>
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Publish Cab Share</Text>
            )}
          </TouchableOpacity>
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
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginRight: 40,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  summarySection: {
    marginBottom: 16,
  },
  summarySectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingBottom: 8,
  },
  summaryRouteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  summaryLocationContainer: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLocationLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryLocationText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  summaryArrow: {
    marginHorizontal: 16,
  },
  summaryArrowText: {
    fontSize: 20,
    color: '#007bff',
    fontWeight: 'bold',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    textAlign: 'right',
  },
  summaryValueHighlight: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  summaryLuggageGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  summaryLuggageItem: {
    alignItems: 'center',
  },
  summaryLuggageNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 4,
  },
  summaryLuggageLabel: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
    textAlign: 'center',
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

export default PublishACabShare;

// Firebase Console Action: Create 'published_cab_shares' collection in Firestore with the following document structure:
// {
//   pickupLocation: string,
//   dropLocation: string,
//   travelType: 'departure' | 'arrival',
//   travelDate: timestamp,
//   flightTime: timestamp,
//   cabTravelTime: timestamp,
//   flexibilityMinutes: number,
//   cabCost: number,
//   numberOfPassengers: number,
//   luggage: {
//     carryOnBags: number,
//     checkinBags: number,
//     laptopBags: number
//   },
//   createdAt: timestamp,
//   status: 'active',
//   publisherId: string
// }