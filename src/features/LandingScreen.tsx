import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  SafeAreaView,
  Platform,
  StatusBar,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type LandingScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const LandingScreen: React.FC = () => {
  const navigation = useNavigation<LandingScreenNavigationProp>();
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground 
        source={require('../../assets/images/campus-life.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
          style={styles.gradient}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.topSection}>
              <TouchableOpacity 
                style={styles.skipButton}
                onPress={() => navigation.navigate('Dashboard')}
              >
                <Ionicons name="arrow-forward-circle" size={40} color="#ffffff" />
              </TouchableOpacity>
              <Image 
                source={require('../../assets/images/favicon.png')} 
                style={styles.logo} 
                resizeMode="contain"
              />
            </View>
            
            <View style={styles.middleSection}>
              <Text style={styles.title}>YOGO Campus</Text>
              <Text style={styles.tagline}>Simplifying Student Life on Campus</Text>
            </View>
            
            <View style={styles.bottomSection}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate('Pathway')}
              >
                <LinearGradient
                  colors={['#4e54c8', '#8f94fb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Get Started</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Direct Dashboard Navigation Button */}
              <TouchableOpacity
                style={styles.dashboardButton}
                onPress={() => navigation.navigate('Dashboard')}
              >
                <View style={styles.dashboardButtonContent}>
                  <Text style={styles.dashboardButtonText}>Skip to Dashboard</Text>
                  <Ionicons name="arrow-forward" size={20} color="#4e54c8" />
                </View>
              </TouchableOpacity>

              {/* Button to AnimatedEntry Splash */}
              <TouchableOpacity
                style={[styles.dashboardButton, { backgroundColor: '#4e54c8', marginTop: 10 }]}
                onPress={() => navigation.navigate('AnimatedEntry')}
              >
                <View style={styles.dashboardButtonContent}>
                  <Text style={[styles.dashboardButtonText, { color: '#fff' }]}>Show Animated Splash</Text>
                  <Ionicons name="star" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  skipButton: {
    padding: 5,
    opacity: 0.8,
  },
  logo: {
    width: 40,
    height: 40,
  },
  middleSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  tagline: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bottomSection: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  button: {
    width: width * 0.7,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  dashboardButton: {
    marginTop: 10,
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30,
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  dashboardButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4e54c8',
    marginRight: 5,
  },
});

export default LandingScreen;