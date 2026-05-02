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
import { db } from '../services/firebase';
import { 
  collection, doc, getDoc, onSnapshot, updateDoc, arrayRemove,
  arrayUnion, addDoc, serverTimestamp, query, where, getDocs
} from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// TypeScript interfaces
interface CabRideData {
  id: string;
  date: string;
  time?: string;
  pickupLocation: string;
  dropLocation: string;
  cabService: {
    name: string;
    type: string;
    driverName: string;
    driverNumber: string;
    carModel?: string;
    carNumber?: string;
    travelTime?: string;
  };
  passengers: Passenger[];
  totalCost: number;
  maxPassengers: number;
  luggage: {
    smallBags: number;
    mediumBags: number;
    largeBags: number;
  };
  createdBy: string;
  status: 'active' | 'completed' | 'cancelled';
  timestamp: any;
}

interface Passenger {
  id: string;
  name: string;
  phoneNumber: string;
  luggage: {
    smallBags: number;
    mediumBags: number;
    largeBags: number;
  };
  joinedAt: any;
}

interface DriverService {
  id: string;
  name: string;
  phoneNumber: string;
  rating: number;
  reviewCount: number;
  carType: string;
  carModel: string;
  experience: string;
  routes: string[];
  pricePerKm: number;
  isAvailable: boolean;
}

const CabRideDetails: React.FC = () => {
  // ... rest of the component code ...
};

const styles = StyleSheet.create({
  // ... styles object ...
});

export default CabRideDetails;

// Firebase Console Action: Create 'cab_rides' collection in Firestore with the following structure:
// - id: string (auto-generated)
// - date: string
// - time: string  
// - pickupLocation: string
// - dropLocation: string
// - cabService: object with name, type, driverName, driverNumber, arrivalTime
// - passengers: array of passenger objects
// - totalCost: number
// - maxPassengers: number
// - luggage: object with smallBags, mediumBags, largeBags
// - createdBy: string
// - status: string
// - timestamp: timestamp