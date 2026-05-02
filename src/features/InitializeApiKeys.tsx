import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { db, doc, setDoc } from '../services/firebase';

/**
 * Component to initialize API keys in Firestore
 * This should be run once to set up the API keys collection
 */
const InitializeApiKeys: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const initializeKeys = async () => {
      try {
        // API keys to store in Firestore
        const apiKeys = {
          "GEMINI_API_KEY": process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
          "OPENROUTER_API_KEY": process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '',
          "OCR_API_KEY": process.env.EXPO_PUBLIC_OCR_API_KEY ?? '',
          "TAVUS_API_KEY": process.env.EXPO_PUBLIC_TAVUS_API_KEY ?? ''
        };

        const missingKeys = Object.entries(apiKeys)
          .filter(([, value]) => !value)
          .map(([key]) => key);

        if (missingKeys.length > 0) {
          throw new Error(`Missing environment variables for: ${missingKeys.join(', ')}`);
        }

        // Create or update the API keys document
        await setDoc(doc(db, 'api_keys', 'keys'), apiKeys);
        
        console.log('API keys initialized in Firestore');
        setSuccess(true);
      } catch (err) {
        console.error('Error initializing API keys:', err);
        setError('Failed to initialize API keys. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    initializeKeys();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4E54C8" />
        <Text style={styles.loadingText}>Initializing API keys...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.successText}>API keys initialized successfully!</Text>
      <Text style={styles.infoText}>
        The following keys have been stored in Firestore:
      </Text>
      <Text style={styles.keyItem}>• GEMINI_API_KEY</Text>
      <Text style={styles.keyItem}>• OPENROUTER_API_KEY</Text>
      <Text style={styles.keyItem}>• OCR_API_KEY</Text>
      <Text style={styles.keyItem}>• TAVUS_API_KEY</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4E54C8',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  successText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 20,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  keyItem: {
    fontSize: 14,
    color: '#666',
    marginVertical: 4,
  },
});

export default InitializeApiKeys;