import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Animated,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { db } from '../services/firebase';
import { collection, addDoc } from 'firebase/firestore';

const { width, height } = Dimensions.get('window');

// TypeScript Interfaces
interface Sport {
  id: string;
  name: string;
  icon: string;
  color: [string, string];
  maxPlayers: number;
  minPlayers: number;
}

interface CreateGroupForm {
  sport: string;
  title: string;
  date: Date;
  time: Date;
  duration: number;
  location: string;
  skillLevel: 'beginner' | 'amateur' | 'intermediate' | 'professional';
  matchFormat: string;
  playerCount: number;
  gameType: string;
  allowRandomJoiners: boolean;
  notes: string;
  // Sport-specific fields
  ballType?: string;
  purpose?: string;
  gameFormat?: string;
  courtType?: string;
  maxParticipants?: number;
  overFormat?: string;
}

interface CreateSportsGroupProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedSport?: string;
}

const SPORTS: Sport[] = [
  { id: 'basketball', name: 'Basketball', icon: 'basketball-ball', color: ['#FF6B35', '#F7931E'], maxPlayers: 10, minPlayers: 6 },
  { id: 'badminton', name: 'Badminton', icon: 'badminton', color: ['#4ECDC4', '#44A08D'], maxPlayers: 4, minPlayers: 2 },
  { id: 'swimming', name: 'Swimming', icon: 'swimmer', color: ['#667eea', '#764ba2'], maxPlayers: 15, minPlayers: 2 },
  { id: 'tennis', name: 'Tennis', icon: 'table-tennis', color: ['#fdbb2d', '#22c1c3'], maxPlayers: 4, minPlayers: 2 },
  { id: 'football', name: 'Football', icon: 'futbol', color: ['#56ab2f', '#a8e6cf'], maxPlayers: 22, minPlayers: 10 },
  { id: 'hockey', name: 'Hockey', icon: 'hockey-puck', color: ['#e96443', '#904e95'], maxPlayers: 22, minPlayers: 10 },
  { id: 'cricket', name: 'Cricket', icon: 'baseball-ball', color: ['#FF8008', '#FFC837'], maxPlayers: 22, minPlayers: 6 },
];

const SKILL_LEVELS = [
  { key: 'beginner', label: 'Beginner', color: '#34C759', icon: 'leaf' },
  { key: 'amateur', label: 'Amateur', color: '#007AFF', icon: 'star' },
  { key: 'intermediate', label: 'Intermediate', color: '#FF9500', icon: 'flame' },
  { key: 'professional', label: 'Professional', color: '#FF3B30', icon: 'trophy' },
];

// Sport-specific configurations
const SPORT_CONFIGS = {
  basketball: {
    matchFormats: [
      { key: '3v3', label: '3v3 (6 players total)', players: 6 },
      { key: '5v5', label: '5v5 (10 players total)', players: 10 },
    ],
    gameTypes: ['Friendly', 'Competitive'],
    locations: ['Court 1', 'Court 2', 'Court 3', 'Outdoor Court'],
    durations: [30, 45, 60, 90, 120],
  },
  badminton: {
    matchFormats: [
      { key: 'singles', label: 'Singles (2 players)', players: 2 },
      { key: 'doubles', label: 'Doubles (4 players)', players: 4 },
    ],
    gameTypes: ['Casual', 'Tournament'],
    locations: ['Court A', 'Court B', 'Court C', 'Court D'],
    durations: [30, 45, 60, 90],
  },
  swimming: {
    purposes: ['Free Swim', 'Training Session', 'Race Practice', 'Water Aerobics'],
    maxParticipants: [8, 10, 12, 15],
    locations: ['Main Pool', 'Olympic Pool', 'Training Pool'],
    durations: [30, 45, 60, 90, 120],
  },
  tennis: {
    matchFormats: [
      { key: 'singles', label: 'Singles (2 players)', players: 2 },
      { key: 'doubles', label: 'Doubles (4 players)', players: 4 },
    ],
    gameFormats: ['Tie-break', 'First to 4 games', 'Best of 3 sets', 'First to 6 games'],
    locations: ['Court 1', 'Court 2', 'Court 3', 'Clay Court'],
    durations: [45, 60, 90, 120],
  },
  football: {
    matchFormats: [
      { key: '5v5', label: '5-a-side (10 total)', players: 10 },
      { key: '7v7', label: '7-a-side (14 total)', players: 14 },
      { key: '11v11', label: '11-a-side (22 total)', players: 22 },
    ],
    gameTypes: ['Friendly', 'Competitive', 'League Match'],
    locations: ['Main Field', 'Training Ground', 'Artificial Turf', 'Natural Grass'],
    durations: [45, 60, 90, 120],
  },
  hockey: {
    matchFormats: [
      { key: '5v5', label: '5-a-side (10 total)', players: 10 },
      { key: '11v11', label: '11-a-side (22 total)', players: 22 },
    ],
    gameTypes: ['Friendly', 'Competitive', 'Training'],
    locations: ['Main Field', 'Practice Field', 'Synthetic Turf'],
    durations: [60, 70, 90, 120],
  },
  cricket: {
    matchFormats: [
      { key: 'box', label: 'Box Cricket (6-a-side)', players: 12 },
      { key: 'tennis', label: 'Tennis Ball Match (8-10-a-side)', players: 18 },
      { key: 'full', label: 'Full Ground (11-a-side)', players: 22 },
    ],
    ballTypes: ['Tennis Ball', 'Leather Ball', 'Wind Ball'],
    locations: ['Main Ground', 'Practice Net', 'Indoor Arena', 'Box Cricket Court'],
    durations: [60, 90, 120, 180, 240, 300], // in minutes for overs
    overOptions: ['10 overs', '20 overs', 'T20', 'One Day'],
  },
};

const CreateSportsGroup: React.FC<CreateSportsGroupProps> = ({
  visible,
  onClose,
  onSuccess,
  preSelectedSport = '',
}) => {
  // Animation values
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Form state
  const [form, setForm] = useState<CreateGroupForm>({
    sport: preSelectedSport,
    title: '',
    date: new Date(),
    time: new Date(),
    duration: 60,
    location: '',
    skillLevel: 'amateur',
    matchFormat: '',
    playerCount: 4,
    gameType: '',
    allowRandomJoiners: true,
    notes: '',
  });

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const selectedSport = SPORTS.find(s => s.id === form.sport);
  const sportConfig = form.sport ? SPORT_CONFIGS[form.sport as keyof typeof SPORT_CONFIGS] : null;

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setForm({
        sport: preSelectedSport,
        title: '',
        date: new Date(),
        time: new Date(),
        duration: 60,
        location: '',
        skillLevel: 'amateur',
        matchFormat: '',
        playerCount: 4,
        gameType: '',
        allowRandomJoiners: true,
        notes: '',
      });
      setCurrentStep(0);
      
      // Animate modal in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate modal out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const updateForm = (field: keyof CreateGroupForm, value: CreateGroupForm[keyof CreateGroupForm]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSportSelect = (sportId: string) => {
    updateForm('sport', sportId);
    const sport = SPORTS.find(s => s.id === sportId);
    const config = SPORT_CONFIGS[sportId as keyof typeof SPORT_CONFIGS];
    
    // Auto-set defaults based on sport
    if (config && 'matchFormats' in config && config.matchFormats.length > 0) {
      updateForm('matchFormat', config.matchFormats[0].key);
      updateForm('playerCount', config.matchFormats[0].players);
    }
    if (config && 'locations' in config && config.locations.length > 0) {
      updateForm('location', config.locations[0]);
    }
    if (config && 'durations' in config && config.durations.length > 0) {
      updateForm('duration', config.durations[1] || config.durations[0]);
    }
    if (config && 'gameTypes' in config && config.gameTypes.length > 0) {
      updateForm('gameType', config.gameTypes[0]);
    }
  };

  const handleMatchFormatSelect = (formatKey: string) => {
    updateForm('matchFormat', formatKey);
    
    if (sportConfig && 'matchFormats' in sportConfig) {
      const format = sportConfig.matchFormats.find(f => f.key === formatKey);
      if (format) {
        updateForm('playerCount', format.players);
      }
    }
  };

  const createGroup = async () => {
    if (!form.sport) {
      Alert.alert('Error', 'Please select a sport');
      return;
    }

    setLoading(true);
    try {
      const groupData = {
        sport: form.sport,
        title: form.title || `${selectedSport?.name} Game`,
        description: form.notes || `Join us for a ${form.gameType?.toLowerCase() || 'fun'} ${selectedSport?.name} session!`,
        maxPlayers: form.playerCount,
        currentPlayers: 1,
        skillLevel: form.skillLevel,
        dateTime: new Date(form.date.getFullYear(), form.date.getMonth(), form.date.getDate(), 
                          form.time.getHours(), form.time.getMinutes()).toISOString(),
        duration: form.duration,
        location: form.location || 'Sports Center',
        status: 'open',
        createdBy: 'current_user_id', // Replace with actual user ID
        creatorName: 'Current User', // Replace with actual user name
        players: [{
          id: 'current_user_id',
          name: 'Current User',
          level: form.skillLevel,
          rating: 1200
        }],
        createdAt: Date.now(),
        // Sport-specific data
        matchFormat: form.matchFormat,
        gameType: form.gameType,
        allowRandomJoiners: form.allowRandomJoiners,
        ...(form.ballType && { ballType: form.ballType }),
        ...(form.purpose && { purpose: form.purpose }),
        ...(form.gameFormat && { gameFormat: form.gameFormat }),
        ...(form.maxParticipants && { maxParticipants: form.maxParticipants }),
        ...(form.overFormat && { overFormat: form.overFormat }),
      };

      const docRef = await addDoc(collection(db, 'sports_groups'), groupData);
      console.log('Group created successfully with ID:', docRef.id);
      
      Alert.alert(
        'Success! 🎉',
        `Your ${selectedSport?.name} group has been created successfully!`,
        [{ text: 'OK', onPress: () => { onSuccess(); onClose(); } }]
      );
    } catch (error) {
      console.error('Error creating group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to create group: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    const totalSteps = form.sport ? 4 : 3;
    
    return (
      <View style={styles.stepIndicator}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <View key={index} style={styles.stepContainer}>
            <View style={[
              styles.stepCircle,
              index <= currentStep && styles.activeStepCircle,
              index < currentStep && styles.completedStepCircle
            ]}>
              {index < currentStep ? (
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              ) : (
                <Text style={[styles.stepText, index <= currentStep && styles.activeStepText]}>
                  {index + 1}
                </Text>
              )}
            </View>
            {index < totalSteps - 1 && (
              <View style={[styles.stepLine, index < currentStep && styles.completedStepLine]} />
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderSportSelection = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Choose Your Sport 🏆</Text>
      <Text style={styles.stepSubtitle}>Select the sport you want to organize</Text>
      
      <View style={styles.sportsGrid}>
        {SPORTS.map((sport) => (
          <TouchableOpacity
            key={sport.id}
            style={[styles.sportCard, form.sport === sport.id && styles.selectedSportCard]}
            onPress={() => handleSportSelect(sport.id)}
          >
            <LinearGradient colors={sport.color} style={styles.sportCardGradient}>
              <FontAwesome5 name={sport.icon} size={24} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.sportCardText, form.sport === sport.id && styles.selectedSportCardText]}>
              {sport.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderBasicDetails = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Basic Details 📝</Text>
      <Text style={styles.stepSubtitle}>Set up your game details</Text>
      
      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>Group Title</Text>
        <TextInput
          style={styles.textInput}
          placeholder={`${selectedSport?.name} Game`}
          value={form.title}
          onChangeText={(text) => updateForm('title', text)}
          placeholderTextColor="#A0A0A0"
        />
      </View>

      <View style={styles.formRow}>
        <View style={styles.formHalf}>
          <Text style={styles.fieldLabel}>📅 Date</Text>
          <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateTimeText}>
              {form.date.toLocaleDateString()}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#4E54C8" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.formHalf}>
          <Text style={styles.fieldLabel}>🕒 Time</Text>
          <TouchableOpacity style={styles.dateTimeButton} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.dateTimeText}>
              {form.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Ionicons name="time-outline" size={20} color="#4E54C8" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>⏱ Duration (minutes)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.durationScroll}>
          {sportConfig && 'durations' in sportConfig && sportConfig.durations.map((duration) => (
            <TouchableOpacity
              key={duration}
              style={[styles.durationChip, form.duration === duration && styles.selectedDurationChip]}
              onPress={() => updateForm('duration', duration)}
            >
              <Text style={[styles.durationChipText, form.duration === duration && styles.selectedDurationChipText]}>
                {duration}m
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>📍 Location</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationScroll}>
          {sportConfig && 'locations' in sportConfig && sportConfig.locations.map((location) => (
            <TouchableOpacity
              key={location}
              style={[styles.locationChip, form.location === location && styles.selectedLocationChip]}
              onPress={() => updateForm('location', location)}
            >
              <Text style={[styles.locationChipText, form.location === location && styles.selectedLocationChipText]}>
                {location}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* iOS Date Picker Modal */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={form.date}
                mode="date"
                display="spinner"
                onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                  if (selectedDate) updateForm('date', selectedDate);
                }}
                minimumDate={new Date()}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* iOS Time Picker Modal */}
      {showTimePicker && Platform.OS === 'ios' && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showTimePicker}
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Select Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={form.time}
                mode="time"
                display="spinner"
                onChange={(event: DateTimePickerEvent, selectedTime?: Date) => {
                  if (selectedTime) updateForm('time', selectedTime);
                }}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android Date Picker */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={form.date}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowDatePicker(false);
            if (selectedDate) updateForm('date', selectedDate);
          }}
          minimumDate={new Date()}
        />
      )}

      {/* Android Time Picker */}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={form.time}
          mode="time"
          display="default"
          onChange={(event: DateTimePickerEvent, selectedTime?: Date) => {
            setShowTimePicker(false);
            if (selectedTime) updateForm('time', selectedTime);
          }}
        />
      )}
    </ScrollView>
  );

  const renderSportSpecificDetails = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Game Setup ⚡</Text>
      <Text style={styles.stepSubtitle}>Configure sport-specific options</Text>
      
      {/* Match Format */}
      {sportConfig && 'matchFormats' in sportConfig && (
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>🔢 Match Format</Text>
          <View style={styles.formatGrid}>
            {sportConfig.matchFormats.map((format) => (
              <TouchableOpacity
                key={format.key}
                style={[styles.formatCard, form.matchFormat === format.key && styles.selectedFormatCard]}
                onPress={() => handleMatchFormatSelect(format.key)}
              >
                <Text style={[styles.formatCardTitle, form.matchFormat === format.key && styles.selectedFormatCardTitle]}>
                  {format.label}
                </Text>
                <View style={[styles.playersIndicator, form.matchFormat === format.key && styles.selectedPlayersIndicator]}>
                  <Ionicons name="people" size={16} color={form.matchFormat === format.key ? "#FFFFFF" : "#4E54C8"} />
                  <Text style={[styles.playersText, form.matchFormat === format.key && styles.selectedPlayersText]}>
                    {format.players} players
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Swimming Purpose */}
      {form.sport === 'swimming' && sportConfig && 'purposes' in sportConfig && (
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>🏊 Purpose</Text>
          <View style={styles.optionsGrid}>
            {sportConfig.purposes.map((purpose) => (
              <TouchableOpacity
                key={purpose}
                style={[styles.optionChip, form.purpose === purpose && styles.selectedOptionChip]}
                onPress={() => updateForm('purpose', purpose)}
              >
                <Text style={[styles.optionChipText, form.purpose === purpose && styles.selectedOptionChipText]}>
                  {purpose}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Swimming Max Participants */}
      {form.sport === 'swimming' && sportConfig && 'maxParticipants' in sportConfig && (
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>🔢 Max Participants</Text>
          <View style={styles.optionsGrid}>
            {sportConfig.maxParticipants.map((count) => (
              <TouchableOpacity
                key={count}
                style={[styles.optionChip, form.maxParticipants === count && styles.selectedOptionChip]}
                onPress={() => {
                  updateForm('maxParticipants', count);
                  updateForm('playerCount', count);
                }}
              >
                <Text style={[styles.optionChipText, form.maxParticipants === count && styles.selectedOptionChipText]}>
                  {count} people
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Cricket Ball Type */}
      {form.sport === 'cricket' && sportConfig && 'ballTypes' in sportConfig && (
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>🏏 Ball Type</Text>
          <View style={styles.optionsGrid}>
            {sportConfig.ballTypes.map((ballType) => (
              <TouchableOpacity
                key={ballType}
                style={[styles.optionChip, form.ballType === ballType && styles.selectedOptionChip]}
                onPress={() => updateForm('ballType', ballType)}
              >
                <Text style={[styles.optionChipText, form.ballType === ballType && styles.selectedOptionChipText]}>
                  {ballType}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Cricket Over Format */}
      {form.sport === 'cricket' && sportConfig && 'overOptions' in sportConfig && (
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>⏱ Match Duration</Text>
          <View style={styles.optionsGrid}>
            {sportConfig.overOptions.map((overFormat) => (
              <TouchableOpacity
                key={overFormat}
                style={[styles.optionChip, form.overFormat === overFormat && styles.selectedOptionChip]}
                onPress={() => updateForm('overFormat', overFormat)}
              >
                <Text style={[styles.optionChipText, form.overFormat === overFormat && styles.selectedOptionChipText]}>
                  {overFormat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Tennis Game Format */}
      {form.sport === 'tennis' && sportConfig && 'gameFormats' in sportConfig && (
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>🎾 Game Format</Text>
          <View style={styles.optionsGrid}>
            {sportConfig.gameFormats.map((gameFormat) => (
              <TouchableOpacity
                key={gameFormat}
                style={[styles.optionChip, form.gameFormat === gameFormat && styles.selectedOptionChip]}
                onPress={() => updateForm('gameFormat', gameFormat)}
              >
                <Text style={[styles.optionChipText, form.gameFormat === gameFormat && styles.selectedOptionChipText]}>
                  {gameFormat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Game Type */}
      {sportConfig && 'gameTypes' in sportConfig && (
        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>⚔️ Game Type</Text>
          <View style={styles.optionsGrid}>
            {sportConfig.gameTypes.map((gameType) => (
              <TouchableOpacity
                key={gameType}
                style={[styles.optionChip, form.gameType === gameType && styles.selectedOptionChip]}
                onPress={() => updateForm('gameType', gameType)}
              >
                <Text style={[styles.optionChipText, form.gameType === gameType && styles.selectedOptionChipText]}>
                  {gameType}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Skill Level */}
      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>🧠 Skill Level</Text>
        <View style={styles.skillGrid}>
          {SKILL_LEVELS.map((skill) => (
            <TouchableOpacity
              key={skill.key}
              style={[styles.skillCard, form.skillLevel === skill.key && styles.selectedSkillCard]}
              onPress={() => updateForm('skillLevel', skill.key)}
            >
              <View style={[styles.skillIcon, { backgroundColor: skill.color }, 
                form.skillLevel === skill.key && styles.selectedSkillIcon]}>
                <FontAwesome5 name={skill.icon} size={16} color="#FFFFFF" />
              </View>
              <Text style={[styles.skillCardText, form.skillLevel === skill.key && styles.selectedSkillCardText]}>
                {skill.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderFinalDetails = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Final Touch ✨</Text>
      <Text style={styles.stepSubtitle}>Add notes and preferences</Text>
      
      <View style={styles.formSection}>
        <View style={styles.toggleContainer}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>🔄 Allow Random Joiners</Text>
            <Text style={styles.toggleSubtitle}>Let anyone join your group</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, form.allowRandomJoiners && styles.activeToggle]}
            onPress={() => updateForm('allowRandomJoiners', !form.allowRandomJoiners)}
          >
            <View style={[styles.toggleSlider, form.allowRandomJoiners && styles.activeToggleSlider]} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>📝 Notes & Custom Rules</Text>
        <TextInput
          style={[styles.textInput, styles.notesInput]}
          placeholder="Add any special instructions, equipment needed, or custom rules..."
          value={form.notes}
          onChangeText={(text) => updateForm('notes', text)}
          multiline
          textAlignVertical="top"
          placeholderTextColor="#A0A0A0"
        />
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>📋 Group Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sport:</Text>
          <Text style={styles.summaryValue}>{selectedSport?.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Date & Time:</Text>
          <Text style={styles.summaryValue}>
            {form.date.toLocaleDateString()} at {form.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Duration:</Text>
          <Text style={styles.summaryValue}>{form.duration} minutes</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Players:</Text>
          <Text style={styles.summaryValue}>{form.playerCount} players</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Location:</Text>
          <Text style={styles.summaryValue}>{form.location}</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderSportSelection();
      case 1:
        return renderBasicDetails();
      case 2:
        return form.sport ? renderSportSpecificDetails() : renderFinalDetails();
      case 3:
        return renderFinalDetails();
      default:
        return renderSportSelection();
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return form.sport !== '';
      case 1:
        return true; // Basic details are optional
      case 2:
        return form.sport ? true : true; // Sport-specific details are optional
      case 3:
        return true; // Final details are optional
      default:
        return false;
    }
  };

  const nextStep = () => {
    const totalSteps = form.sport ? 4 : 3;
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 0: return 'Select Sport';
      case 1: return 'Basic Details';
      case 2: return form.sport ? 'Game Setup' : 'Final Details';
      case 3: return 'Final Details';
      default: return 'Create Group';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.modalContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* Header */}
        <SafeAreaView style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{getStepTitle()}</Text>
              {selectedSport && (
                <LinearGradient colors={selectedSport.color} style={styles.headerSportIcon}>
                  <FontAwesome5 name={selectedSport.icon} size={16} color="#FFFFFF" />
                </LinearGradient>
              )}
            </View>
            
            <TouchableOpacity 
              onPress={currentStep === (form.sport ? 3 : 2) ? createGroup : nextStep}
              style={[styles.actionButton, !canProceed() && styles.disabledButton]}
              disabled={!canProceed() || loading}
            >
              <Text style={[styles.actionButtonText, !canProceed() && styles.disabledButtonText]}>
                {loading ? 'Creating...' : currentStep === (form.sport ? 3 : 2) ? 'Create' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {renderStepIndicator()}
        </SafeAreaView>

        {/* Content */}
        <View style={styles.content}>
          {renderStepContent()}
        </View>

        {/* Bottom Navigation */}
        {currentStep > 0 && (
          <View style={styles.bottomNav}>
            <TouchableOpacity onPress={prevStep} style={styles.backButton}>
              <Ionicons name="chevron-back" size={20} color="#4E54C8" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  headerSportIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#4E54C8',
  },
  disabledButton: {
    backgroundColor: '#F2F2F7',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  disabledButtonText: {
    color: '#A0A0A0',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStepCircle: {
    backgroundColor: '#4E54C8',
  },
  completedStepCircle: {
    backgroundColor: '#34C759',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A0A0A0',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  activeStepText: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#F2F2F7',
    marginHorizontal: 8,
  },
  completedStepLine: {
    backgroundColor: '#34C759',
  },
  content: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 32,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  sportCard: {
    width: (width - 60) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  selectedSportCard: {
    borderColor: '#4E54C8',
    backgroundColor: '#F0F1FF',
  },
  sportCardGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  sportCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  selectedSportCardText: {
    color: '#4E54C8',
  },
  formSection: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  formHalf: {
    flex: 1,
  },
  dateTimeButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  durationScroll: {
    paddingVertical: 8,
  },
  durationChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  selectedDurationChip: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  durationChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  selectedDurationChipText: {
    color: '#FFFFFF',
  },
  locationScroll: {
    paddingVertical: 8,
  },
  locationChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  selectedLocationChip: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  locationChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  selectedLocationChipText: {
    color: '#FFFFFF',
  },
  formatGrid: {
    gap: 12,
  },
  formatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F2F2F7',
  },
  selectedFormatCard: {
    borderColor: '#4E54C8',
    backgroundColor: '#F0F1FF',
  },
  formatCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  selectedFormatCardTitle: {
    color: '#4E54C8',
  },
  playersIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedPlayersIndicator: {
    // No additional styles needed
  },
  playersText: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  selectedPlayersText: {
    color: '#4E54C8',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  selectedOptionChip: {
    backgroundColor: '#4E54C8',
    borderColor: '#4E54C8',
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  selectedOptionChipText: {
    color: '#FFFFFF',
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skillCard: {
    flex: 1,
    minWidth: (width - 76) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F2F2F7',
  },
  selectedSkillCard: {
    borderColor: '#4E54C8',
    backgroundColor: '#F0F1FF',
  },
  skillIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedSkillIcon: {
    // No additional styles needed
  },
  skillCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  selectedSkillCardText: {
    color: '#4E54C8',
  },
  toggleContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  activeToggle: {
    backgroundColor: '#4E54C8',
  },
  toggleSlider: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeToggleSlider: {
    alignSelf: 'flex-end',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    marginTop: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  bottomNav: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  // Date/Time Picker Styles
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#8E8E93',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E54C8',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  iosPicker: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
  },
});

export default CreateSportsGroup;
