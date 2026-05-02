import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/router';

type MessNotificationNavigationProp = StackNavigationProp<RootStackParamList>;

const MessVegorNon: React.FC = () => {
  const navigation = useNavigation<MessNotificationNavigationProp>();

  // Redirect to MessNotification screen when component mounts
  useEffect(() => {
    // We'll use setTimeout to make the transition look smoother
    const timer = setTimeout(() => {
      navigation.navigate('MessNotification');
    }, 300);

    // Clean up the timer if the component unmounts
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3498db" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
});

export default MessVegorNon;