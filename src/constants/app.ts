// Constants for the YOGO Campus app

// Import API keys service
import apiKeysService from '../services/apiKeysService';

// Gemini AI API Key - will be fetched from Firestore
export let GEMINI_API_KEY = '';
const DEFAULT_GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

// Initialize API keys
(async () => {
  try {
    GEMINI_API_KEY = await apiKeysService.getApiKey('GEMINI_API_KEY', DEFAULT_GEMINI_API_KEY);
    if (!GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not configured. Set EXPO_PUBLIC_GEMINI_API_KEY or store it in Firestore.');
    }
    console.log('API keys initialized in constants/app.ts');
  } catch (error) {
    console.error('Failed to initialize API keys:', error);
    // Fallback to env default if fetch fails
    GEMINI_API_KEY = DEFAULT_GEMINI_API_KEY;
  }
})();

// Other app constants
export const SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const SUPPORTED_DOCUMENT_FORMATS = ['application/pdf'];

// Firebase Collections
export const FIREBASE_COLLECTIONS = {
  CLASS_TIMETABLES: 'class_timetables',
  EXTRACTED_TIMETABLES: 'extracted_timetables',
  NOTIFICATION_SETTINGS: 'notification_settings',
  USERS: 'users'
};

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  reminderMinutes: 15,
  soundEnabled: true
};

// Time formats
export const TIME_FORMAT_12H = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;
export const TIME_FORMAT_24H = /^\d{1,2}:\d{2}$/;

// Days of the week
export const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Maximum file size for uploads (in bytes)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Image processing settings
export const IMAGE_PROCESSING = {
  MAX_DIMENSION: 1024,
  COMPRESSION_QUALITY: 0.85,
  DEFAULT_CROP_RATIO: 1.414 // A4 aspect ratio
};

// AI Processing settings
export const AI_PROCESSING = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000, // 30 seconds
  MIN_CONFIDENCE_THRESHOLD: 0.7
};

// Error messages
export const ERROR_MESSAGES = {
  GEMINI_API_KEY_MISSING: 'Gemini API key not configured. Please add your API key to src/constants/app.ts',
  IMAGE_TOO_LARGE: 'Image file is too large. Please select a smaller image.',
  UNSUPPORTED_FORMAT: 'Unsupported file format. Please select a valid image or PDF file.',
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  AI_PROCESSING_FAILED: 'Failed to extract timetable data. Please try with a clearer image.'
};

// Success messages
export const SUCCESS_MESSAGES = {
  TIMETABLE_UPLOADED: 'Timetable uploaded successfully!',
  AI_PROCESSING_COMPLETE: 'Timetable processed successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!'
};
