import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';

// Import the RootStackParamList type from router
type RootStackParamList = {
  FindACabShare: undefined;
  PublishACabShare: undefined;
  // Add other screen types as needed
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CabShare: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  
  const features = [
    {
      icon: '🚗',
      title: 'Share Ride Costs',
      description: 'Split cab fares with fellow students and save money on transportation.'
    },
    {
      icon: '📍',
      title: 'Campus & City Routes',
      description: 'Find rides to popular destinations around campus and the city.'
    },
    {
      icon: '⏰',
      title: 'Flexible Timing',
      description: 'Schedule rides according to your convenience and class timings.'
    },
    {
      icon: '👥',
      title: 'Connect with Students',
      description: 'Travel safely with verified students from your campus community.'
    },
    {
      icon: '💰',
      title: 'Transparent Pricing',
      description: 'Know the exact cost per person before joining any cab share.'
    },
    {
      icon: '🔒',
      title: 'Safe & Secure',
      description: 'All rides are within the trusted campus community network.'
    }
  ];

  const handleFindCab = async () => {
    setLoading(true);
    try {
      // Check if user is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Login Required', 'Please log in to find a cab share');
        return;
      }
      
      // Navigate to FindACabShare screen
      navigation.navigate('FindACabShare');
    } catch (error) {
      console.error('Error navigating to FindACabShare:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishCab = async () => {
    setLoading(true);
    try {
      // Check if user is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Login Required', 'Please log in to publish a cab share');
        return;
      }
      
      // Navigate to PublishACabShare screen
      navigation.navigate('PublishACabShare');
    } catch (error) {
      console.error('Error navigating to PublishACabShare:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image 
            source={require('../../assets/images/campus-life.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>YOGO Campus</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.title}>🚕 Cab Share</Text>
          <Text style={styles.subtitle}>
            Share rides, split costs, and connect with your campus community
          </Text>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleFindCab}>
            <Text style={styles.primaryButtonIcon}>🔍</Text>
            <View style={styles.buttonContent}>
              <Text style={styles.primaryButtonTitle}>Find A Cab Share</Text>
              <Text style={styles.primaryButtonSubtitle}>Join existing rides in your area</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handlePublishCab}>
            <Text style={styles.secondaryButtonIcon}>📝</Text>
            <View style={styles.buttonContent}>
              <Text style={styles.secondaryButtonTitle}>Publish A Cab Share</Text>
              <Text style={styles.secondaryButtonSubtitle}>Create a new ride request</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom Spacing */}
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: 40,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
  },
  welcomeSection: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 18,
  },
  featuresSection: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 10,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 12,
  },
  actionSection: {
    padding: 16,
  },
  primaryButton: {
    backgroundColor: '#007bff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  buttonContent: {
    flex: 1,
  },
  primaryButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  primaryButtonSubtitle: {
    fontSize: 12,
    color: '#e3f2fd',
  },
  secondaryButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  secondaryButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  secondaryButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  secondaryButtonSubtitle: {
    fontSize: 12,
    color: '#e8f5e8',
  },
  bottomSpacing: {
    height: 16,
  },
});

export default CabShare;