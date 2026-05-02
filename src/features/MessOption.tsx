import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Platform,
  StatusBar,
  Modal,
  Animated,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/router';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Interfaces for the component's state
interface MessFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

type MessOptionNavigationProp = StackNavigationProp<RootStackParamList, 'MessOption'>;

const MessOption: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<MessOptionNavigationProp>();
  const [selectedMess, setSelectedMess] = useState<string>('Food Court 2');
  const [mealType, setMealType] = useState<'veg' | 'non-veg'>('veg');
  const [showMessPicker, setShowMessPicker] = useState<boolean>(false);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Animation effect when component mounts
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // Sample features of the Mess Notification system with colors
  const messFeatures: MessFeature[] = [
    {
      id: '1',
      title: 'Daily Menu Updates',
      description: 'Get daily updates about mess menu changes and special items',
      icon: 'restaurant-outline',
      color: '#FF6B6B'
    },
    {
      id: '2',
      title: 'Meal Time Notifications',
      description: 'Receive timely alerts before meal serving hours begin',
      icon: 'time-outline',
      color: '#4ECDC4'
    },
    {
      id: '3',
      title: 'Special Event Meals',
      description: 'Be informed about festival specials and themed food days',
      icon: 'calendar-outline',
      color: '#45B7D1'
    },
  ];

  // List of available mess options with icons
  const messOptions = [
    { name: 'Food Court 2', icon: 'restaurant', color: '#FF6B6B' },
    { name: 'Aditya Mess', icon: 'home', color: '#4ECDC4' },
    { name: 'Apoorva Mess', icon: 'leaf', color: '#45B7D1' }
  ];

  const handleViewMenu = () => {
    // Add haptic feedback and animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to the MessMenu screen with the selected mess and meal type
    navigation.navigate('MessMenu', {
      messName: selectedMess,
      mealType: mealType
    });
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mess Menu</Text>
          {/* Empty view for balanced alignment */}
          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView style={styles.contentContainer}>
          {/* Title Section */}
          <Animated.View style={[styles.titleSection, { opacity: fadeAnim }]}>
            <View style={styles.titleIconContainer}>
              <Ionicons name="restaurant" size={32} color="#fff" />
            </View>
            <Text style={styles.title}>Mess Menu</Text>
            <Text style={styles.subtitle}>
              🍽️ Explore your campus dining experience
            </Text>
          </Animated.View>

          {/* Features Section */}
          <View style={styles.featuresContainer}>
            <Animated.Text style={[styles.sectionTitle, { opacity: fadeAnim }]}>✨ Features</Animated.Text>
            {messFeatures.map((feature, index) => (
              <Animated.View 
                key={feature.id} 
                style={[
                  styles.featureItem,
                  { 
                    opacity: fadeAnim,
                    transform: [{ translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0]
                    }) }],
                    borderLeftWidth: 4,
                    borderLeftColor: feature.color
                  }
                ]}
              >
                <View style={[styles.featureIconContainer, { backgroundColor: feature.color + '20' }]}>
                  <Ionicons name={feature.icon as any} size={24} color={feature.color} />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          {/* Mess Selection Section */}
          <View style={styles.selectionContainer}>
            <Animated.Text style={[styles.sectionTitle, { opacity: fadeAnim }]}>🏢 Select Your Mess</Animated.Text>
            
            <View style={styles.pickerContainer}>
              <TouchableOpacity 
                style={styles.customPicker}
                onPress={() => setShowMessPicker(true)}
              >
                <View style={styles.pickerContent}>
                  <View style={styles.pickerIcon}>
                    <Ionicons name="location" size={18} color="#667eea" />
                  </View>
                  <Text style={styles.pickerText}>{selectedMess}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#667eea" />
              </TouchableOpacity>
            </View>
            
            {/* Custom Picker Modal */}
            <Modal
              visible={showMessPicker}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowMessPicker(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select a Mess</Text>
                  {messOptions.map((mess) => (
                    <TouchableOpacity
                      key={mess.name}
                      style={[
                        styles.modalOption,
                        selectedMess === mess.name && styles.modalOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedMess(mess.name);
                        setShowMessPicker(false);
                      }}
                    >
                      <View style={styles.modalOptionContent}>
                        <View style={[styles.modalOptionIcon, { backgroundColor: mess.color }]}>
                          <Ionicons name={mess.icon as any} size={20} color="#fff" />
                        </View>
                        <Text style={[
                          styles.modalOptionText,
                          selectedMess === mess.name && styles.modalOptionTextSelected
                        ]}>
                          {mess.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowMessPicker(false)}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Veg/Non-Veg Selection */}
            <Animated.Text style={[styles.sectionSubtitle, { opacity: fadeAnim }]}>🥗 Meal Preference</Animated.Text>
            <View style={styles.preferenceContainer}>
              <TouchableOpacity
                style={[
                  styles.preferenceButton,
                  mealType === 'veg' && styles.preferenceButtonActive
                ]}
                onPress={() => setMealType('veg')}
              >
                <View style={styles.vegIndicator} />
                <Text style={[
                  styles.preferenceText,
                  mealType === 'veg' && styles.preferenceTextActive
                ]}>
                  Vegetarian
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.preferenceButton,
                  mealType === 'non-veg' && styles.preferenceButtonActive
                ]}
                onPress={() => setMealType('non-veg')}
              >
                <View style={styles.nonVegIndicator} />
                <Text style={[
                  styles.preferenceText,
                  mealType === 'non-veg' && styles.preferenceTextActive
                ]}>
                  Non-Vegetarian
                </Text>
              </TouchableOpacity>
            </View>

            {/* View Menu Button */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity style={styles.viewMenuButton} onPress={handleViewMenu}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.viewMenuButtonText}>Explore Menu</Text>
                  <Ionicons name="restaurant-outline" size={20} color="#fff" style={{marginLeft: 8}} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    zIndex: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginLeft: 8,
  },
  backButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 44, // Width matching backButton (10px padding on each side + 24px icon)
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    paddingBottom: 32,
  },
  titleSection: {
    marginBottom: 24,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  titleIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ rotate: '-5deg' }],
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
    maxWidth: '90%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#2c3e50',
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 16,
    color: '#34495e',
  },
  featuresContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  featureIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
  selectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  pickerContainer: {
    borderWidth: 1.5,
    borderColor: '#e9ecef',
    borderRadius: 16,
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 8,
  },
  customPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 56,
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#667eea20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pickerText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    color: '#2c3e50',
    textAlign: 'center',
  },
  modalOption: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalOptionSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#3498db20',
  },
  modalOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  modalOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  modalOptionTextSelected: {
    color: '#3498db',
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 120,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  preferenceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
    marginTop: 8,
  },
  preferenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#e9ecef',
    borderRadius: 16,
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  preferenceButtonActive: {
    borderColor: '#3498db',
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  preferenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  preferenceTextActive: {
    color: '#3498db',
  },
  vegIndicator: {
    width: 16,
    height: 16,
    backgroundColor: '#27ae60',
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  nonVegIndicator: {
    width: 16,
    height: 16,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#e74c3c',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  viewMenuButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    marginTop: 16,
  },
  gradientButton: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  viewMenuButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default MessOption;
