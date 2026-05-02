import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';

// Import the RootStackParamList type from router
type RootStackParamList = {
  FindAnAutoShare: undefined;
  PublishAnAutoShare: undefined;
  // Add other screen types as needed
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AutoShare: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  
  const features = [
    {
      icon: '🛺',
      title: 'Share Ride Costs',
      description: 'Split auto fares with fellow students and save money on transportation.'
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
    }
  ];

  const handleFindAuto = async () => {
    setLoading(true);
    try {
      // Check if user is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Login Required', 'Please log in to find an auto share');
        return;
      }
      
      // Navigate to FindAnAutoShare screen
      navigation.navigate('FindAnAutoShare');
    } catch (error) {
      console.error('Error navigating to FindAnAutoShare:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishAuto = async () => {
    setLoading(true);
    try {
      // Check if user is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Login Required', 'Please log in to publish an auto share');
        return;
      }
      
      // Navigate to PublishAnAutoShare screen
      navigation.navigate('PublishAnAutoShare');
    } catch (error) {
      console.error('Error navigating to PublishAnAutoShare:', error);
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
          <Text style={styles.title}>🛺 Auto Share</Text>
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
          <TouchableOpacity style={styles.primaryButton} onPress={handleFindAuto}>
            <Text style={styles.primaryButtonIcon}>🔍</Text>
            <View style={styles.buttonContent}>
              <Text style={styles.primaryButtonTitle}>Find An Auto Share</Text>
              <Text style={styles.primaryButtonSubtitle}>Join existing rides in your area</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handlePublishAuto}>
            <Text style={styles.secondaryButtonIcon}>📝</Text>
            <View style={styles.buttonContent}>
              <Text style={styles.secondaryButtonTitle}>Publish An Auto Share</Text>
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
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 2,
  },
  featuresSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#f4f7fb',
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 16,
  },
  actionSection: {
    padding: 20,
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
    height: 24,
  },
});

export default AutoShare;
