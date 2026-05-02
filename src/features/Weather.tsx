import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  StatusBar,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWeather } from '../hooks/useWeather';
import WeatherFetcher from './WeatherFetcher';

const { width } = Dimensions.get('window');

const Weather: React.FC = () => {
  const { weatherData, loading, error } = useWeather();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Background colors based on time of day and weather condition
  const getGradientColors = (): readonly [string, string, ...string[]] => {
    if (!weatherData) return ['#4c669f', '#3b5998', '#192f6a'] as const;
    
    const hours = new Date().getHours();
    const condition = weatherData.condition.toLowerCase();
    
    if (hours >= 18 || hours < 6) {
      // Night
      return condition.includes('cloud') 
        ? ['#172941', '#1F3B60', '#3A4A7A'] as const  // Cloudy night
        : ['#0F2027', '#203A43', '#2C5364'] as const; // Clear night
    } else {
      // Day
      if (condition.includes('rain')) {
        return ['#3E5A7B', '#515B7A', '#626B88'] as const; // Rainy 
      } else if (condition.includes('cloud')) {
        return ['#5888AA', '#799FB7', '#A1B5C5'] as const; // Cloudy
      } else if (condition.includes('sunny') || condition.includes('clear')) {
        return ['#56CCF2', '#3A95EE', '#2F80ED'] as const; // Sunny/Clear
      } else {
        return ['#4c669f', '#3b5998', '#192f6a'] as const; // Default
      }
    }
  };

  // Get formatted date
  const getFormattedDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long', 
      day: 'numeric'
    });
  };

  // Get time since last update
  const getTimeSinceUpdate = () => {
    if (!weatherData) return '';
    
    const now = Date.now();
    const diff = now - weatherData.timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  // Handle refresh
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // WeatherFetcher will update Firebase, which will trigger useWeather hook
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  }, []);

  // Weather icon mapping
  const getWeatherIconName = (condition: string): string => {
    const conditionLower = condition?.toLowerCase() || '';
    
    if (conditionLower.includes('sunny') || conditionLower.includes('clear')) {
      return 'sunny-outline';
    } else if (conditionLower.includes('partly cloudy')) {
      return 'partly-sunny-outline';
    } else if (conditionLower.includes('cloudy')) {
      return 'cloud-outline';
    } else if (conditionLower.includes('rain')) {
      return 'rainy-outline';
    } else if (conditionLower.includes('thunder')) {
      return 'thunderstorm-outline';
    } else if (conditionLower.includes('snow')) {
      return 'snow-outline';
    } else {
      return 'partly-sunny-outline';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Loading weather data...</Text>
      </View>
    );
  }

  if (error || !weatherData) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="cloud-offline-outline" size={60} color="#666" />
        <Text style={styles.errorText}>
          {error || "Couldn't load weather data"}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <WeatherFetcher />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <WeatherFetcher />
      <LinearGradient
        colors={getGradientColors()}
        style={styles.background}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ffffff"
            />
          }
        >
          {/* Card Container */}
          <View style={styles.weatherCard}>
            {/* Location Header */}
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={getWeatherIconName(weatherData.condition) as any} 
                  size={32} 
                  color="#F9C74F" 
                />
              </View>
              <View>
                <Text style={styles.cardTitle}>Today's Weather</Text>
                <Text style={styles.locationText}>{weatherData.location}</Text>
              </View>
            </View>

            {/* Weather Icon */}
            <View style={styles.iconDisplay}>
              <Ionicons 
                name={getWeatherIconName(weatherData.condition) as any} 
                size={120} 
                color="#333" 
              />
            </View>

            {/* Weather Message */}
            <View style={styles.messageContainer}>
              <Text style={styles.dailyMessage}>{weatherData.dailyMessage}</Text>
            </View>
          </View>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4c669f',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },
  weatherCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    margin: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 199, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  iconDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#4c669f',
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  background: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  header: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  locationText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '400',
  },
  dateText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  mainWeather: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  temperatureContainer: {
    alignItems: 'center',
  },
  temperature: {
    fontSize: 80,
    fontWeight: '200',
    color: '#fff',
  },
  condition: {
    fontSize: 22,
    color: '#fff',
    marginTop: -5,
  },
  messageContainer: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(249, 249, 249, 0.9)',
    borderRadius: 12,
  },
  dailyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontWeight: '400',
  },
  additionalInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  infoText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
  },
  lastUpdated: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 30,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
});

export default Weather;
