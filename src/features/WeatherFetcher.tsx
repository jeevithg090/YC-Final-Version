import React, { useEffect, useState } from 'react';
import { Alert, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { realtimeDb } from '../services/firebase';
import { ref, set } from 'firebase/database';

interface WeatherData {
  id: string;
  location: string;
  temperature: number;
  condition: string;
  icon: string;
  timestamp: number;
  feelsLike: number;
  dailyMessage: string;
}

const WEATHER_API_KEY = 'd99bbcddd6ad4b05b4d132735251606'; // Get this from https://www.weatherapi.com/
const BASE_URL = 'http://api.weatherapi.com/v1';

const WeatherFetcher: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');

  useEffect(() => {
    fetchWeatherData();
    
    // Set up interval to refresh weather data every 30 minutes
    const weatherInterval = setInterval(fetchWeatherData, 30 * 60 * 1000);
    
    return () => {
      clearInterval(weatherInterval);
    };
  }, []);

  const fetchWeatherData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Request location permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission denied');
        // Use default Manipal location if permission denied
        await fetchWeatherForLocation(13.3475, 74.7869);
        return;
      }

      // Get current location
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      
      console.log(`Using phone location: ${lat}, ${lon}`);
      await fetchWeatherForLocation(lat, lon);
    } catch (error) {
      console.error('Error getting location:', error);
      setError('Failed to get location');
      // Fallback to Manipal location
      await fetchWeatherForLocation(13.3475, 74.7869);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherForLocation = async (lat: number, lon: number) => {
    try {
      // Use real API call with your valid key
      const url = `${BASE_URL}/current.json?key=${WEATHER_API_KEY}&q=${lat},${lon}&aqi=yes`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Enhanced daily messages based on temperature and conditions
      const temp = data.current.temp_c;
      const condition = data.current.condition.text.toLowerCase();
      let dailyMessage = '';
      
      if (temp > 35) {
        dailyMessage = '🔥 Extreme heat! Stay hydrated and in shade.';
      } else if (temp > 30) {
        dailyMessage = '🔆 Hot day! Remember to drink water regularly.';
      } else if (temp > 25) {
        dailyMessage = '☀️ Perfect weather for outdoor activities! Don\'t forget to stay hydrated.';
      } else if (temp > 20) {
        dailyMessage = '🌤️ Comfortable weather, perfect for outdoor activities.';
      } else if (temp > 15) {
        dailyMessage = '🧥 A bit cool today, consider bringing a light jacket.';
      } else {
        dailyMessage = '❄️ Cold weather today! Bundle up.';
      }
      
      // Add condition-specific messages
      if (condition.includes('rain')) {
        dailyMessage = '☔ Rain expected. Don\'t forget an umbrella!';
      } else if (condition.includes('thunder')) {
        dailyMessage = '⚡ Thunderstorms possible. Stay safe indoors.';
      } else if (condition.includes('fog') || condition.includes('mist')) {
        dailyMessage = '🌫️ Foggy conditions. Take care when traveling.';
      }

      // Format date for last update time
      const now = new Date();
      const formattedTime = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
      setLastUpdateTime(formattedTime);

      const weatherData: WeatherData = {
        id: `weather_${Date.now()}`,
        location: `${data.location.name}, ${data.location.region}`,
        temperature: Math.round(data.current.temp_c),
        condition: data.current.condition.text,
        icon: getWeatherIcon(data.current.condition.text),
        timestamp: Date.now(),
        feelsLike: Math.round(data.current.feelslike_c),
        dailyMessage
      };

      // Save to Firebase
      await set(ref(realtimeDb, 'weather_data'), weatherData);
      console.log('Weather data saved to Firebase:', weatherData.location);
      
    } catch (error) {
      console.error('Error fetching weather:', error);
      setError('Failed to fetch weather data');
      Alert.alert('Weather Error', 'Could not fetch weather data. Please try again later.');
    }
  };

  const getWeatherIcon = (condition: string): string => {
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('sunny') || conditionLower.includes('clear')) {
      return 'sunny-outline';
    } else if (conditionLower.includes('partly cloudy')) {
      return 'partly-sunny-outline';
    } else if (conditionLower.includes('cloudy') || conditionLower.includes('overcast')) {
      return 'cloud-outline';
    } else if (conditionLower.includes('rain') || conditionLower.includes('drizzle') || conditionLower.includes('shower')) {
      return 'rainy-outline';
    } else if (conditionLower.includes('thunder') || conditionLower.includes('storm') || conditionLower.includes('lightning')) {
      return 'thunderstorm-outline';
    } else if (conditionLower.includes('snow') || conditionLower.includes('blizzard') || conditionLower.includes('sleet')) {
      return 'snow-outline';
    } else if (conditionLower.includes('fog') || conditionLower.includes('mist') || conditionLower.includes('haze')) {
      return 'cloud-outline';
    } else {
      // Default to partly-sunny-outline as shown in the mockup
      return 'partly-sunny-outline';
    }
  };

  // Only show UI when there's an error or loading
  if (error || loading) {
    return (
      <View style={styles.container}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color="#4E54C8" />
            <Text style={styles.loadingText}>Fetching weather data...</Text>
          </>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </View>
    );
  }
  
  // Otherwise return null since this is a background service component
  return null;
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
  },
  updateInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  }
});

export default WeatherFetcher;

// Firebase Console Action: Create 'weather_data' node in Realtime Database with read/write rules
