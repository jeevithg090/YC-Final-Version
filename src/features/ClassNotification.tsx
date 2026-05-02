import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Alert, 
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
  Dimensions,
  TextInput,
  Switch,
  SafeAreaView,
  StatusBar,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { db } from '../services/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { GeminiTimetableService } from '../services/geminiTimetableService';
import { TimetableData, ExtractedTimetable, ClassEntry, DaySchedule, ClassNotificationSettings, UploadLimitData } from '../types/timetable';

interface ClassNotificationProps {
  navigation?: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Firestore collection names
const EXTRACTED_TIMETABLES_COLLECTION = 'extracted_timetables';
const NOTIFICATION_SETTINGS_COLLECTION = 'notification_settings';
const UPLOAD_LIMITS_COLLECTION = 'upload_limits';

// Remove or bypass upload limit logic
// Remove UPLOAD_LIMIT and canUploadMore usage

const ClassNotification: React.FC<ClassNotificationProps> = ({ navigation }) => {
  const [extractedTimetables, setExtractedTimetables] = useState<ExtractedTimetable[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [aiProcessing, setAiProcessing] = useState<boolean>(false);
  const [imageViewerVisible, setImageViewerVisible] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [timetableViewerVisible, setTimetableViewerVisible] = useState<boolean>(false);
  const [selectedTimetableData, setSelectedTimetableData] = useState<TimetableData | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<ClassNotificationSettings>({
    enabled: true,
    reminderMinutes: 15,
    soundEnabled: true
  });
  const [editingClass, setEditingClass] = useState<{ dayIndex: number; classIndex: number; classData: ClassEntry } | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  
  // Edit modal state
  const [editSubject, setEditSubject] = useState<string>('');
  const [editStartTime, setEditStartTime] = useState<string>('');
  const [editEndTime, setEditEndTime] = useState<string>('');
  const [editRoom, setEditRoom] = useState<string>('');
  const [editProfessor, setEditProfessor] = useState<string>('');
  
  // Settings modal state
  const [settingsEnabled, setSettingsEnabled] = useState<boolean>(true);
  const [settingsReminderMinutes, setSettingsReminderMinutes] = useState<string>('15');
  const [settingsSoundEnabled, setSettingsSoundEnabled] = useState<boolean>(true);
  
  // Hardcoded user ID (should be replaced with actual authentication)
  const userId = "user123";
  
  // Initialize Gemini service
  const geminiService = new GeminiTimetableService();

  // --- Upload Limit State ---
  const [uploadLimitData, setUploadLimitData] = useState<UploadLimitData | null>(null);
  const [canUpload, setCanUpload] = useState<boolean>(true);
  const [uploadLimitMessage, setUploadLimitMessage] = useState<string>('');

  // --- Upload Limit Helpers ---
  const UPLOAD_LIMIT = 2;
  const UPLOAD_RESET_DAYS = 30;

  const fetchUploadLimit = async () => {
    try {
      const limitRef = doc(db, UPLOAD_LIMITS_COLLECTION, userId);
      const docSnap = await getDoc(limitRef);
      let data: UploadLimitData;
      const now = Date.now();
      if (docSnap.exists()) {
        data = docSnap.data() as UploadLimitData;
        // Check if reset needed
        const daysSinceReset = Math.floor((now - data.lastResetDate) / (1000 * 60 * 60 * 24));
        if (daysSinceReset >= UPLOAD_RESET_DAYS) {
          // Reset
          data.uploadsThisMonth = 0;
          data.lastResetDate = now;
          data.uploadDates = [];
          await updateDoc(limitRef, {
            uploadsThisMonth: 0,
            lastResetDate: now,
            uploadDates: [],
          });
        }
      } else {
        // Create new
        data = {
          userId,
          uploadsThisMonth: 0,
          lastResetDate: now,
          uploadDates: [],
        };
        await setDoc(limitRef, data);
      }
      setUploadLimitData(data);
      setCanUpload(data.uploadsThisMonth < UPLOAD_LIMIT);
      if (data.uploadsThisMonth >= UPLOAD_LIMIT) {
        const daysLeft = UPLOAD_RESET_DAYS - Math.floor((now - data.lastResetDate) / (1000 * 60 * 60 * 24));
        setUploadLimitMessage(`Upload limit reached. Try again in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`);
      } else {
        setUploadLimitMessage(`${UPLOAD_LIMIT - data.uploadsThisMonth} upload${UPLOAD_LIMIT - data.uploadsThisMonth !== 1 ? 's' : ''} left this month.`);
      }
    } catch (error) {
      setUploadLimitMessage('Error loading upload limit.');
      setCanUpload(false);
    }
  };

  const incrementUploadCount = async () => {
    if (!uploadLimitData) return;
    const limitRef = doc(db, UPLOAD_LIMITS_COLLECTION, userId);
    const now = Date.now();
    const newUploads = (uploadLimitData.uploadsThisMonth || 0) + 1;
    const newUploadDates = [...(uploadLimitData.uploadDates || []), now];
    await updateDoc(limitRef, {
      uploadsThisMonth: newUploads,
      uploadDates: newUploadDates,
    });
    setUploadLimitData({ ...uploadLimitData, uploadsThisMonth: newUploads, uploadDates: newUploadDates });
    setCanUpload(newUploads < UPLOAD_LIMIT);
    if (newUploads >= UPLOAD_LIMIT) {
      setUploadLimitMessage('Upload limit reached. Try again in 30 days.');
    } else {
      setUploadLimitMessage(`${UPLOAD_LIMIT - newUploads} upload${UPLOAD_LIMIT - newUploads !== 1 ? 's' : ''} left this month.`);
    }
  };

  // --- Place the new handleCameraCapture and handleGallerySelect here, before render ---
  const handleCameraCapture = async () => {
    if (!canUpload) {
      Alert.alert('Upload Limit', uploadLimitMessage);
      return;
    }
    if (!await requestPermissions()) return;
    try {
      setLoading(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        aspect: [3, 4]
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        setLoading(false);
        return;
      }
      const timestamp = new Date().getTime();
      const filename = `timetable_${timestamp}.jpg`;
      await processWithAI(result.assets[0].uri, filename);
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'Failed to capture image');
      setLoading(false);
    }
  };

  const handleGallerySelect = async () => {
    if (!canUpload) {
      Alert.alert('Upload Limit', uploadLimitMessage);
      return;
    }
    if (!await requestPermissions()) return;
    try {
      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        aspect: [3, 4]
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        setLoading(false);
        return;
      }
      const timestamp = new Date().getTime();
      const filename = `timetable_${timestamp}.jpg`;
      await processWithAI(result.assets[0].uri, filename);
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image');
      setLoading(false);
    }
  };

  // Helper to request camera/gallery permissions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'You need to grant permission to access your camera or gallery.');
      return false;
    }
    return true;
  };

  useEffect(() => {
    fetchUploadLimit();
    // Load data from Firebase
    loadExtractedTimetables();
    loadNotificationSettings();
    
    // Animate components in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Load extracted timetables from Firestore
  const loadExtractedTimetables = async () => {
    try {
      const timetablesRef = collection(db, EXTRACTED_TIMETABLES_COLLECTION);
      const q = query(timetablesRef, orderBy('extractionDate', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const extractedList: ExtractedTimetable[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        extractedList.push({
          id: doc.id,
          userId: data.userId || userId,
          originalImageUrl: data.originalImageUrl || data.imageUri || '',
          extractedData: data.extractedData,
          extractionDate: data.extractionDate,
          confidence: data.confidence
        });
      });
      
      setExtractedTimetables(extractedList);
      if (extractedList.length > 0 && !selectedTimetableData) {
        const mostRecent = extractedList[0];
        setSelectedTimetableData(mostRecent.extractedData);
      }
    } catch (error) {
      console.error('Error loading extracted timetables:', error);
      Alert.alert('Error', 'Failed to load extracted timetables from Firebase');
    }
  };

  // Load notification settings from Firestore
  const loadNotificationSettings = async () => {
    try {
      const settingsRef = doc(db, NOTIFICATION_SETTINGS_COLLECTION, userId);
      const docSnap = await getDoc(settingsRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNotificationSettings({
          enabled: data.enabled,
          reminderMinutes: data.reminderMinutes,
          soundEnabled: data.soundEnabled
        });
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings from Firebase');
    }
  };

  // Save notification settings to Firestore
  const saveNotificationSettings = async (settings: ClassNotificationSettings) => {
    try {
      const settingsRef = doc(db, NOTIFICATION_SETTINGS_COLLECTION, userId);
      await updateDoc(settingsRef, {
        enabled: settings.enabled,
        reminderMinutes: settings.reminderMinutes,
        soundEnabled: settings.soundEnabled,
        updatedAt: Timestamp.now()
      }).catch(async () => {
        // If document doesn't exist, create it
        await addDoc(collection(db, NOTIFICATION_SETTINGS_COLLECTION), {
          userId: userId,
          enabled: settings.enabled,
          reminderMinutes: settings.reminderMinutes,
          soundEnabled: settings.soundEnabled,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      });
      
      setNotificationSettings(settings);
      Alert.alert('Success', 'Notification settings saved!');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert('Error', 'Failed to save notification settings to Firebase');
    }
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Process uploaded image with AI
  const processWithAI = async (imageUri: string, filename: string) => {
    try {
      setAiProcessing(true);
      console.log('Starting AI processing for:', filename);

      // Process directly with Gemini AI
      const extractedData = await geminiService.processTimetableImage(imageUri);
      if (extractedData) {
        
        // Save to Firestore
        const docRef = await addDoc(collection(db, EXTRACTED_TIMETABLES_COLLECTION), {
          userId,
          originalImageUrl: imageUri,
          extractedData,
          extractionDate: Date.now(),
          confidence: 0.85,
          createdAt: Timestamp.now()
        });
        
        const newExtracted: ExtractedTimetable = {
          id: docRef.id,
          userId,
          originalImageUrl: imageUri,
          extractedData,
          extractionDate: Date.now(),
          confidence: 0.85,
        };
        
        const updatedExtracted = [...extractedTimetables, newExtracted];
        setExtractedTimetables(updatedExtracted);
        await incrementUploadCount();
        
        Alert.alert(
          'Success!',
          `Timetable processed successfully! Found ${extractedData.days.reduce((total, day) => total + day.classes.length, 0)} classes across ${extractedData.days.length} days.`,
          [
            {
              text: 'View Schedule',
              onPress: () => viewTimetableData(extractedData, newExtracted.id),
              style: 'default'
            },
            {
              text: 'OK',
              style: 'cancel'
            }
          ]
        );
      } else {
        Alert.alert('Processing Failed', 'Could not extract timetable data from image. Please try again with a clearer image.');
      }
    } catch (error) {
      console.error('Error processing image with AI:', error);
      Alert.alert('Processing Error', 'An error occurred while processing the image. Please try again.');
    } finally {
      setAiProcessing(false);
      setLoading(false);
    }
  };

  // View extracted timetable data
  const viewTimetableData = (timetableData: TimetableData, extractedId?: string) => {
    if (navigation) {
      navigation.navigate('DailyTimetable', {
        timetableData,
        extractedId
      });
    } else {
      setSelectedTimetableData(timetableData);
      setTimetableViewerVisible(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Custom Header */}
      <LinearGradient
        colors={['#4285F4', '#6A7FFA']}
        style={styles.headerGradient}
      >
        <View style={styles.customHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation?.goBack?.() || console.log('Back pressed')}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Class Notifications</Text>
            <Text style={styles.headerSubtitle}>AI-Powered Timetable Scanner</Text>
          </View>
          
        </View>
      </LinearGradient>

      <Animated.ScrollView 
        style={[styles.scrollContainer, { opacity: fadeAnim }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Upload Section */}
        <Animated.View style={[styles.uploadSection, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={['#F8F9FF', '#FFFFFF']}
            style={styles.uploadCard}
          >
            <View style={styles.uploadHeader}>
              <Ionicons name="cloud-upload-outline" size={32} color="#4285F4" />
              <Text style={styles.uploadTitle}>Upload Your Timetable</Text>
              <Text style={styles.uploadSubtitle}>
                Take a photo or select from gallery to extract your class schedule
              </Text>
              <Text style={{ color: canUpload ? '#4285F4' : 'red', marginTop: 8, fontWeight: 'bold' }}>{uploadLimitMessage}</Text>
            </View>

            <View style={styles.uploadButtons}>
              <TouchableOpacity 
                style={[styles.uploadButton, (!canUpload || loading || aiProcessing) && styles.uploadButtonDisabled]}
                onPress={handleCameraCapture}
                disabled={!canUpload || loading || aiProcessing}
              >
                <LinearGradient
                  colors={['#4285F4', '#6A7FFA']}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="camera" size={24} color="#fff" />
                  <Text style={styles.uploadButtonText}>Take Photo</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.uploadButton, (!canUpload || loading || aiProcessing) && styles.uploadButtonDisabled]}
                onPress={handleGallerySelect}
                disabled={!canUpload || loading || aiProcessing}
              >
                <LinearGradient
                  colors={['#34A853', '#5DD65A']}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="images" size={24} color="#fff" />
                  <Text style={styles.uploadButtonText}>From Gallery</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {(loading || aiProcessing) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>
                  {aiProcessing ? 'Processing with AI...' : 'Loading...'}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Timetables List */}
        {extractedTimetables.length > 0 && (
          <View style={styles.timetablesSection}>
            <Text style={styles.sectionTitle}>Your Timetables</Text>
            {extractedTimetables.map((timetable, index) => (
              <TouchableOpacity
                key={timetable.id}
                style={styles.timetableCard}
                onPress={() => viewTimetableData(timetable.extractedData, timetable.id)}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F8F9FF']}
                  style={styles.timetableCardGradient}
                >
                  <View style={styles.timetableCardHeader}>
                    <View style={styles.timetableCardInfo}>
                      <Text style={styles.timetableCardTitle}>
                        Timetable #{index + 1}
                      </Text>
                      <Text style={styles.timetableCardDate}>
                        {formatDate(timetable.extractionDate)}
                      </Text>
                    </View>
                    <View style={styles.timetableCardStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>
                          {timetable.extractedData.days.length}
                        </Text>
                        <Text style={styles.statLabel}>Days</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>
                          {timetable.extractedData.days.reduce((total, day) => total + day.classes.length, 0)}
                        </Text>
                        <Text style={styles.statLabel}>Classes</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.timetableCardFooter}>
                    <Ionicons name="calendar-outline" size={16} color="#4285F4" />
                    <Text style={styles.confidenceText}>
                      Confidence: {Math.round((timetable.confidence || 0.85) * 100)}%
                    </Text>
                  </View>
                  {/* View Timetable Button */}
                  <TouchableOpacity
                    style={{
                      marginTop: 12,
                      backgroundColor: '#4285F4',
                      borderRadius: 8,
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}
                    onPress={() => viewTimetableData(timetable.extractedData, timetable.id)}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>View Timetable</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty State */}
        {extractedTimetables.length === 0 && !loading && !aiProcessing && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyStateTitle}>No Timetables Yet</Text>
            <Text style={styles.emptyStateText}>
              Upload your first timetable image to get started with AI-powered schedule extraction
            </Text>
          </View>
        )}
      </Animated.ScrollView>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.settingsModal}>
            <LinearGradient
              colors={['#4285F4', '#6A7FFA']}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>Notification Settings</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowSettings(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={styles.modalContent}>
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Enable Notifications</Text>
                  <Text style={styles.settingDescription}>
                    Get reminders before your classes
                  </Text>
                </View>
                <Switch 
                  value={settingsEnabled} 
                  onValueChange={setSettingsEnabled}
                  trackColor={{ false: '#CCCCCC', true: '#4285F4' }}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Sound Alerts</Text>
                  <Text style={styles.settingDescription}>
                    Play sound with notifications
                  </Text>
                </View>
                <Switch 
                  value={settingsSoundEnabled} 
                  onValueChange={setSettingsSoundEnabled}
                  trackColor={{ false: '#CCCCCC', true: '#4285F4' }}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Reminder Time</Text>
                  <Text style={styles.settingDescription}>
                    Minutes before class
                  </Text>
                </View>
                <TextInput
                  style={styles.settingInput}
                  value={settingsReminderMinutes}
                  onChangeText={setSettingsReminderMinutes}
                  keyboardType="numeric"
                  placeholder="15"
                />
              </View>

              <TouchableOpacity
                style={styles.saveSettingsButton}
                onPress={async () => {
                  const settings: ClassNotificationSettings = {
                    enabled: settingsEnabled,
                    reminderMinutes: parseInt(settingsReminderMinutes) || 15,
                    soundEnabled: settingsSoundEnabled
                  };
                  await saveNotificationSettings(settings);
                  setShowSettings(false);
                }}
              >
                <LinearGradient
                  colors={['#4285F4', '#6A7FFA']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.saveButtonText}>Save Settings</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 0 : 0,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    height: 80,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerSettingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  scrollContainer: {
    flex: 1,
  },
  uploadSection: {
    margin: 16,
  },
  uploadCard: {
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  uploadHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  uploadButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#4285F4',
    marginTop: 12,
    fontWeight: '500',
  },
  timetablesSection: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  timetableCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  timetableCardGradient: {
    padding: 20,
  },
  timetableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  timetableCardInfo: {
    flex: 1,
  },
  timetableCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  timetableCardDate: {
    fontSize: 14,
    color: '#666',
  },
  timetableCardStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  timetableCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confidenceText: {
    fontSize: 12,
    color: '#4285F4',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    width: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_HEIGHT * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  settingInput: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 80,
    textAlign: 'center',
    fontSize: 16,
  },
  saveSettingsButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ClassNotification;
