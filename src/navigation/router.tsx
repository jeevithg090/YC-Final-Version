import React, { Suspense, useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';

// Direct imports for all components to avoid lazy loading issues
// We're focusing on the authentication flow
import Login from '../features/auth/Login';
import SignUp from '../features/auth/SignUp';
import Forgot from '../features/auth/Forgot';
import Dashboard from '../features/Dashboard';
import LandingScreen from '../features/LandingScreen';
import Pathway from '../features/Pathway';
import MessOption from '../features/MessOption';
import MessMenu from '../features/MessMenu';
import BuyMarketplace from '../features/BuyMarketplace';
import LostAndFound from '../features/LostAndFound';
import Restaurants from '../features/Restaurants';
import Marketplace from '../features/Marketplace';
import SellMarketplace from '../features/SellMarketplace';
import ClassNotification from '../features/ClassNotification';
import DailyTimetable from '../features/DailyTimetable';
import Weather from '../features/Weather';
import SportsPlace from '../features/SportsPlace';
import MyGroupSports from '../features/MyGroupSports';
import PreviousYearPapers from '../features/PreviousYearPapers';

import AutoShare from '../features/AutoShare';
import FindAnAutoShare from '../features/FindAnAutoShare';
import PublishAnAutoShare from '../features/PublishAnAutoShare';
import AutoRideDetails from '../features/AutoRideDetails';
import AutoRideGroupChat from '../features/AutoRideGroupChat';
import CabShare from '../features/CabShare';
import FindACabShare from '../features/FindACabShare';
import PublishACabShare from '../features/PublishACabShare';
import CabRideDetails from '../features/CabRideDetails';
import CabRideGroupChat from '../features/CabRideGroupChat';
import YourRides from '../features/YourRides';
import Events from '../features/Events';
import SmartSplit from '../features/SmartSplit';
import SmartBillSplitter from '../features/SmartBillSplitter';
import RoommateFinder from '../features/RoommateFinder';
import StudyGroups from '../features/StudyGroups';
import QnaForum from '../features/QnaForum';
import QnaForumPost from '../features/QnaForumPost';
import ClubRecruitment from '../features/ClubRecruitment';
import MessNotification from '../features/MessNotification';
import AskAIBot from '../features/AskAIBot';
import Profile from '../features/Profile';
import AnimatedEntry from '../features/AnimatedEntry';
import Chat from '../features/Chat';
import ProductChat from '../features/ProductChat';
import RoommateChat from '../features/RoommateChat';
import AcademicCalendar from '../features/AcademicCalendar';
import Alerts from '../features/Alerts';

// Import InitializeApiKeys component
import InitializeApiKeys from '../features/InitializeApiKeys';

// Import other components as needed, but for now, we're focusing on the auth flow

// Loading component for Suspense
const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#0000ff" />
  </View>
);

// Define the navigation parameter types for our auth flow
export type RootStackParamList = {
  LandingScreen: undefined;
  Pathway: undefined;
  Login: undefined;
  SignUp: undefined;
  Forgot: undefined;
  Dashboard: undefined;
  MessOption: undefined;
  MessMenu: { messName: string; mealType: 'veg' | 'non-veg' }; // Added MessMenu route with parameters
  MessNotification: undefined; // Added MessNotification route
  Marketplace: undefined;
  BuyMarketplace: undefined;
  SellMarketplace: undefined;
  LostAndFound: undefined;
  Restaurants: undefined;
  ClassNotification: undefined;
  Weather: undefined;
  SportsPlace: undefined;
  PreviousYearPapers: undefined;
  DailyTimetable: {
    timetableData?: any;
    extractedId?: string;
  };
  MyGroupSports: { groupId: string };
  AutoShare: undefined;
  FindAnAutoShare: undefined;
  PublishAnAutoShare: undefined;
  AutoRideDetails: { rideId: string };
  AutoRideGroupChat: { rideId: string; rideName?: string };
  CabShare: undefined;
  FindACabShare: undefined;
  PublishACabShare: undefined;
  CabRideDetails: { rideId: string };
  CabRideGroupChat: { rideId: string; rideName?: string };
  YourRides: undefined;
  Events: undefined;
  SmartSplit: undefined;
  SmartBillSplitter: undefined;
  RoommateFinder: undefined;
  StudyGroups: undefined;
  QnaForum: undefined;
  QnaForumPost: { questionId: string };
  ClubRecruitment: undefined;
  AskAIBot: undefined;
  Profile: undefined;
  AnimatedEntry: undefined;
  Chat: {
    currentUser: any;
    selectedUser: any;
  };
  ProductChat: {
    chatId: string;
    product: any;
    buyer: any;
    seller: any;
  };
  RoommateChat: {
    chatId: string;
    listing: any;
    userA: any;
    userB: any;
  };
  AcademicCalendar: undefined;
  Alerts: undefined; // Added Alerts route
  // Other screens can be added back as needed
  InitializeApiKeys: undefined; // Added InitializeApiKeys route
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Stack Navigator instance

const Router: React.FC = () => {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  if (checkingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={user ? 'Dashboard' : 'AnimatedEntry'}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#f5f5f5',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: { backgroundColor: '#fff' },
      }}
    >
      <Stack.Screen
        name="LandingScreen"
        component={LandingScreen}
        options={{
          title: 'Welcome to YOGO Campus',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Pathway"
        component={Pathway}
        options={{
          title: 'Get Started',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Login"
        component={Login}
        options={{
          title: 'Login',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#333333',
        }}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUp}
        options={{
          title: 'Create Account',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#333333',
        }}
      />
      <Stack.Screen
        name="Forgot"
        component={Forgot}
        options={{
          title: 'Forgot Password',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#333333',
        }}
      />
      <Stack.Screen
        name="Dashboard"
        component={Dashboard}
        options={{
          headerShown: false, // Hide the header for Dashboard
          title: 'YOGO Campus',
        }}
      />
      <Stack.Screen
        name="MessOption"
        component={MessOption}
        options={{
          headerShown: false, // Hide the header as it has its own custom header
          title: 'Mess Options',
        }}
      />
      <Stack.Screen
        name="MessMenu"
        component={MessMenu}
        options={{
          headerShown: false, // Hide the header as it has its own custom header
          title: 'Mess Menu',
        }}
      />
      <Stack.Screen
        name="MessNotification"
        component={MessNotification}
        options={{
          headerShown: false, // Hide the header as it has its own custom header
          title: 'Mess Notification',
        }}
      />
      <Stack.Screen
        name="Marketplace"
        component={Marketplace}
        options={{
          headerShown: false, // Hide the header as it has its own custom header
          title: 'Marketplace',
        }}
      />
      <Stack.Screen
        name="BuyMarketplace"
        component={BuyMarketplace}
        options={{
          headerShown: false, // Hide the header as it has its own custom header
          title: 'Buy Items',
        }}
      />
      <Stack.Screen
        name="SellMarketplace"
        component={SellMarketplace}
        options={{
          headerShown: false, // Hide the header as it has its own custom header
          title: 'Sell Item',
        }}
      />
      <Stack.Screen
        name="LostAndFound"
        component={LostAndFound}
        options={{
          headerShown: false, // Hide the header as it has its own custom header
          title: 'Lost & Found',
        }}
      />
      <Stack.Screen
        name="Restaurants"
        component={Restaurants}
        options={{
          headerShown: false, // Hide the header as it has its own custom header
          title: 'Restaurants',
        }}
      />
      <Stack.Screen
        name="ClassNotification"
        component={ClassNotification}
        options={{
          headerShown: false,
          title: 'Class Notifications',
        }}
      />
      <Stack.Screen
        name="Weather"
        component={Weather}
        options={{
          headerShown: false,
          title: 'Weather',
        }}
      />
      <Stack.Screen
        name="DailyTimetable"
        component={DailyTimetable}
        options={{
          headerShown: false,
          title: 'Daily Timetable',
        }}
      />
      <Stack.Screen
        name="SportsPlace"
        component={SportsPlace}
        options={{
          headerShown: false,
          title: 'Sports Place',
        }}
      />
      <Stack.Screen
        name="MyGroupSports"
        component={MyGroupSports}
        options={{
          headerShown: false,
          title: 'My Group Sports',
        }}
      />
      <Stack.Screen
        name="PreviousYearPapers"
        component={PreviousYearPapers}
        options={{
          headerShown: false,
          title: 'Previous Year Papers',
        }}
      />

      <Stack.Screen
        name="AutoShare"
        component={AutoShare}
        options={{
          headerShown: false,
          title: 'Auto Share',
        }}
      />
      <Stack.Screen
        name="FindAnAutoShare"
        component={FindAnAutoShare}
        options={{
          headerShown: false,
          title: 'Find An Auto Share',
        }}
      />
      <Stack.Screen
        name="PublishAnAutoShare"
        component={PublishAnAutoShare}
        options={{
          headerShown: false,
          title: 'Publish An Auto Share',
        }}
      />
      <Stack.Screen
        name="AutoRideDetails"
        component={AutoRideDetails}
        options={{
          headerShown: false,
          title: 'Auto Ride Details',
        }}
      />
      <Stack.Screen
        name="AutoRideGroupChat"
        component={AutoRideGroupChat}
        options={{
          headerShown: false,
          title: 'Auto Group Chat',
        }}
      />
      <Stack.Screen
        name="CabShare"
        component={CabShare}
        options={{
          headerShown: false,
          title: 'Cab Share',
        }}
      />
      <Stack.Screen
        name="FindACabShare"
        component={FindACabShare}
        options={{
          headerShown: false,
          title: 'Find A Cab Share',
        }}
      />
      <Stack.Screen
        name="PublishACabShare"
        component={PublishACabShare}
        options={{
          headerShown: false,
          title: 'Publish A Cab Share',
        }}
      />
      <Stack.Screen
        name="CabRideDetails"
        component={CabRideDetails}
        options={{
          headerShown: false,
          title: 'Cab Ride Details',
        }}
      />
      <Stack.Screen
        name="CabRideGroupChat"
        component={CabRideGroupChat}
        options={{
          headerShown: false,
          title: 'Group Chat',
        }}
      />
      <Stack.Screen
        name="YourRides"
        component={YourRides}
        options={{
          headerShown: false,
          title: 'Your Rides',
          // Ensure this screen can navigate back to Dashboard
          gestureEnabled: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="Events"
        component={Events}
        options={{
          headerShown: false,
          title: 'Campus Events',
          // Ensure this screen can navigate back to Dashboard
          gestureEnabled: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="SmartSplit"
        component={SmartSplit}
        options={{
          headerShown: false,
          title: 'Smart Split',
        }}
      />
      <Stack.Screen
        name="SmartBillSplitter"
        component={SmartBillSplitter}
        options={{
          headerShown: false,
          title: 'Smart Bill Splitter',
        }}
      />
      <Stack.Screen
        name="RoommateFinder"
        component={RoommateFinder}
        options={{
          headerShown: false,
          title: 'Roommate Finder',
        }}
      />
      <Stack.Screen
        name="StudyGroups"
        component={StudyGroups}
        options={{
          headerShown: false,
          title: 'Study Groups',
          // Ensure this screen can navigate back to Dashboard
          gestureEnabled: true,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="QnaForum"
        component={QnaForum}
        options={{
          headerShown: false,
          title: 'Q&A Forum',
        }}
      />
      <Stack.Screen
        name="QnaForumPost"
        component={QnaForumPost}
        options={{
          headerShown: false,
          title: 'Q&A Post',
        }}
      />
      <Stack.Screen
        name="ClubRecruitment"
        component={ClubRecruitment}
        options={{
          headerShown: false,
          title: 'Club Recruitment',
        }}
      />
      <Stack.Screen
        name="AskAIBot"
        component={AskAIBot}
        options={{
          headerShown: false,
          title: 'Ask AI',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={Profile}
        options={{
          headerShown: false,
          title: 'Profile',
        }}
      />
      <Stack.Screen
        name="AnimatedEntry"
        component={AnimatedEntry}
        options={{
          headerShown: false,
          title: 'Animated Splash',
        }}
      />
      <Stack.Screen
        name="Chat"
        component={Chat}
        options={{
          headerShown: false,
          title: 'Chat',
        }}
      />
      <Stack.Screen
        name="ProductChat"
        component={ProductChat}
        options={{
          headerShown: false,
          title: 'Product Chat',
        }}
      />
      <Stack.Screen
        name="RoommateChat"
        component={RoommateChat}
        options={{
          headerShown: false,
          title: 'Roommate Chat',
        }}
      />
      <Stack.Screen
        name="AcademicCalendar"
        component={AcademicCalendar}
        options={{
          headerShown: true,
          title: 'Academic Calendar',
          headerStyle: { backgroundColor: '#F8FAFF' },
          headerTitleStyle: { color: '#00B894', fontWeight: 'bold', fontSize: 22 },
          headerTintColor: '#00B894',
        }}
      />
      <Stack.Screen
        name="InitializeApiKeys"
        component={InitializeApiKeys}
        options={{
          headerShown: true,
          title: 'Initialize API Keys',
          headerStyle: { backgroundColor: '#F8FAFF' },
          headerTitleStyle: { color: '#4E54C8', fontWeight: 'bold', fontSize: 18 },
          headerTintColor: '#4E54C8',
        }}
      />
      <Stack.Screen
        name="Alerts"
        component={Alerts}
        options={{
          headerShown: false, // Hide the header as it has its own custom header
          title: 'Alerts',
        }}
      />
    </Stack.Navigator>
  );
};

export default Router;