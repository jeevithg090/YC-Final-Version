import { useState, useEffect } from 'react';
import { realtimeDb } from '../services/firebase';
import { ref, onValue } from 'firebase/database';

// Weather data interface
export interface WeatherData {
  id: string;
  location: string;
  temperature: number;
  condition: string;
  icon: string;
  timestamp: number;
  feelsLike: number;
  dailyMessage: string;
}

export const useWeather = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const weatherRef = ref(realtimeDb, 'weather_data');
    
    const unsubscribe = onValue(
      weatherRef,
      (snapshot) => {
        const data = snapshot.val() as WeatherData | null;
        if (data) {
          setWeatherData(data);
          setError('');
        } else {
          setError('No weather data available. Please refresh to fetch latest weather.');
          console.log('No weather data found in Firebase');
        }
        setLoading(false);
      },
      (error) => {
        console.error('Weather Firebase connection failed:', error);
        setError('Failed to load weather data');
        setLoading(false);
        setWeatherData(null);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return { weatherData, loading, error };
};