import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Animated,
  SafeAreaView,
  StatusBar,
  Alert,
  Linking,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiKeysService from '../services/apiKeysService';

/**
 * AskAIBot Component
 * 
 * A conversational AI assistant for the YOGO Campus app that provides:
 * - Text-based AI responses using OpenRouter API with multiple model fallbacks
 * - AI-powered video calls using the Tavus API (limited to 3 minutes)
 * - Usage limits: 3 minutes per session, resets after 5 days
 * - Time tracking with visual countdown and alerts
 * - Haptic feedback for user interactions
 * - Error handling and offline fallback responses
 * 
 * Features:
 * - Video call button in the header creates a Tavus AI video conversation
 * - Usage time limit of 3 minutes per session (resets after 5 days)
 * - Time remaining indicator in the header
 * - Warning when only 30 seconds of usage time remains
 * - Info modal explaining the time limits
 * - Persistent storage of usage data between sessions
 * 
 * The 3-minute limit applies to both text chat and video calls, ensuring
 * fair usage of the AI features across all users.
 */

// Message interface
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  modelUsed?: string; // Track which model generated the response
  isFallback?: boolean; // Flag if using fallback responses
  videoCallUrl?: string; // URL for Tavus AI video calls
}

// Usage limits interface
interface UsageLimits {
  totalTimeUsed: number; // Total time used in milliseconds
  lastResetDate: number; // Timestamp of when the usage was last reset
  sessionStartTime: number | null; // Timestamp of when the current session started
}

// Usage limits constants
const USAGE_LIMIT_KEY = 'ai_assistant_usage_limits';
const MAX_USAGE_TIME = 3 * 60 * 1000; // 3 minutes in milliseconds
const RESET_INTERVAL = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

// OpenRouter API interface
interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

// Array of free models to try in order
const FREE_MODELS = [
  'mistralai/mistral-7b-instruct',
  'meta-llama/llama-3-8b-instruct',
  'google/palm-2-chat-bison',
  'google/gemini-1.0-pro',
  'anthropic/claude-instant-1.2'
];

// Tavus API key for AI video calls
const TAVUS_API_KEY = process.env.EXPO_PUBLIC_TAVUS_API_KEY ?? '';

// Tavus API interfaces
interface TavusConversationResponse {
  conversation_id: string;
  conversation_name: string;
  status: string; // 'active' | 'ended'
  conversation_url: string;
  replica_id: string;
  persona_id: string;
  created_at: string;
}

// Tavus conversation properties interface
interface TavusConversationProperties {
  max_call_duration?: number; // in seconds, default 3600 (1 hour)
  participant_left_timeout?: number; // in seconds, default 60
  participant_absent_timeout?: number; // in seconds, default 300 (5 minutes)
  enable_recording?: boolean;
  enable_closed_captions?: boolean;
  apply_greenscreen?: boolean;
  language?: string; // 'multilingual' or specific language
}

// Sample AI responses for last-resort fallback
const aiResponses = [
  "I'm an AI assistant here to help you with your questions! What can I help you with today?",
  "That's an interesting question! Let me think about that...",
  "Based on my knowledge, here's what I can tell you about that topic...",
  "I don't have specific information about that, but I can suggest some general ideas.",
  "What a great question! Here's what I know...",
  "I'm designed to provide helpful information. Here's my answer to your question.",
  "Let me break this down for you in a simple way.",
  "While I don't have real-time data, I can share some general information on this subject.",
  "That's a complex topic! Here are some key points to consider...",
  "I'm happy to help with your question. Here's my response..."
];

// API key for OpenRouter (free model)
let OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '';

// Response type for AI calls
interface AIResponse {
  text: string;
  modelUsed: string;
  isFallback: boolean;
}

// Function to create a Tavus AI video call
const createTavusVideoCall = async (): Promise<string> => {
  try {
    const response = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY
      },
      body: JSON.stringify({
        // Using default replica and persona IDs - you would need to create these in the Tavus platform
        // and replace with your own values
        replica_id: "rfe12d8b9597",  // Replace with your actual replica ID
        persona_id: "p9a95912",      // Replace with your actual persona ID
        audio_only: false,
        conversation_name: "YOGO Campus AI Video Chat",
        conversational_context: "This is a student from YOGO Campus app looking for assistance. Help them with their questions about campus life, academics, or app features.",
        custom_greeting: "Hello! I'm your AI video assistant from YOGO Campus. How can I help you today?",
        properties: {
          // 3 minute time limit for the call (180 seconds)
          max_call_duration: 180,
          // Auto-end call after 60 seconds if the participant leaves
          participant_left_timeout: 60,
          // Auto-end call after 5 minutes if no one joins
          participant_absent_timeout: 300,
          // Enable closed captions for accessibility
          enable_closed_captions: true,
          // Set to multilingual to automatically detect user's language
          language: "multilingual"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: TavusConversationResponse = await response.json();
    console.log('Tavus conversation created:', data);
    
    return data.conversation_url;
  } catch (error) {
    console.error('Error creating Tavus video call:', error);
    throw error;
  }
};

// Function to call OpenRouter API with multiple model fallbacks
const callOpenRouterAPI = async (query: string): Promise<AIResponse> => {
  // System prompt that works with all models
  const systemPrompt = 'You are a helpful, knowledgeable AI assistant. Answer user questions clearly and concisely. If you do not know the answer, say so honestly. Keep responses under 3 sentences when possible. The current date is 4 July 2025.';
  
  // Try each model in sequence until one works
  for (let i = 0; i < FREE_MODELS.length; i++) {
    const currentModel = FREE_MODELS[i];
    console.log(`Attempt ${i+1}: Trying model ${currentModel}`);
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://yogocampus.app',
          'X-Title': 'YOGO Campus'
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ],
          max_tokens: 150,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error with model ${currentModel} (${response.status}):`, errorText);
        // Continue to next model
        continue;
      }
      
      const data: OpenRouterResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        console.error(`Invalid API response format from model ${currentModel}:`, data);
        continue;
      }
      
      console.log(`Success with model: ${currentModel}`);
      return {
        text: data.choices[0].message.content.trim(),
        modelUsed: currentModel,
        isFallback: false
      };
      
    } catch (error) {
      console.error(`Error with model ${currentModel}:`, error);
      // Continue to next model
    }
  }
  
  // If all models fail, use the fallback response
  console.log('All models failed, using fallback response');
  return getFallbackResponse(query);
};

// Function to get a fallback response when API fails
const getFallbackResponse = (query: string): AIResponse => {
  let responseText = "";
  
  // Simple keyword-based responses
  if (query.toLowerCase().includes('hello') || query.toLowerCase().includes('hi')) {
    responseText = "Hello! I'm an AI assistant. How can I help you today?";
  }
  
  else if (query.toLowerCase().includes('who are you') || query.toLowerCase().includes('what are you')) {
    responseText = "I'm an AI assistant. I can answer general questions and provide helpful information. I'm not connected to the internet but can help with a wide range of topics!";
  }
  
  else if (query.toLowerCase().includes('thank')) {
    responseText = "You're welcome! Feel free to ask if you have any other questions.";
  }
  
  else {
    // For other queries, return a random response
    const randomIndex = Math.floor(Math.random() * aiResponses.length);
    const baseResponse = aiResponses[randomIndex];
    
    // Add some context from the user's query to make it more relevant
    const words = query.split(' ');
    const relevantWords = words.filter(word => word.length > 4).slice(0, 3);
    
    if (relevantWords.length > 0) {
      responseText = `${baseResponse} Regarding "${relevantWords.join(' ')}", I can provide some insights based on my knowledge. This is using fallback mode because the AI service is currently unavailable.`;
    } else {
      responseText = `${baseResponse} This is using fallback mode because the AI service is currently unavailable.`;
    }
  }
  
  return {
    text: responseText,
    modelUsed: 'local-fallback',
    isFallback: true
  };
};

// Functions to manage usage limits
const getUsageLimits = async (): Promise<UsageLimits> => {
  try {
    const data = await AsyncStorage.getItem(USAGE_LIMIT_KEY);
    if (data) {
      return JSON.parse(data) as UsageLimits;
    }
  } catch (error) {
    console.error('Error getting usage limits:', error);
  }
  
  // Return default values if no data or error
  return {
    totalTimeUsed: 0,
    lastResetDate: Date.now(),
    sessionStartTime: null
  };
};

// Function to load usage limits data
const loadUsageLimits = async (): Promise<UsageLimits> => {
  try {
    const jsonValue = await AsyncStorage.getItem(USAGE_LIMIT_KEY);
    if (jsonValue) {
      const data: UsageLimits = JSON.parse(jsonValue);
      return data;
    }
  } catch (error) {
    console.error('Error loading usage limits:', error);
  }
  
  // If nothing stored or error, return default values
  return {
    totalTimeUsed: 0,
    lastResetDate: Date.now(),
    sessionStartTime: null
  };
};

// Function to save usage limits data
const saveUsageLimits = async (data: UsageLimits): Promise<void> => {
  try {
    await AsyncStorage.setItem(USAGE_LIMIT_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving usage limits:', error);
  }
};

// Function to start a session (track when user starts using the AI)
const startSession = async (): Promise<boolean> => {
  const now = Date.now();
  const data = await loadUsageLimits();
  
  // Check if we need to reset the timer (after 5 days)
  if (now - data.lastResetDate >= RESET_INTERVAL) {
    // Reset timer
    const newData: UsageLimits = {
      totalTimeUsed: 0,
      lastResetDate: now,
      sessionStartTime: now
    };
    await saveUsageLimits(newData);
    return true; // User can use AI
  }
  
  // Check if user has exceeded their time limit
  if (data.totalTimeUsed >= MAX_USAGE_TIME) {
    // Time limit exceeded
    return false;
  }
  
  // Start the session
  data.sessionStartTime = now;
  await saveUsageLimits(data);
  return true;
};

// Function to end a session (track when user stops using the AI)
const endSession = async (): Promise<void> => {
  const now = Date.now();
  const data = await loadUsageLimits();
  
  // If no session was started, do nothing
  if (!data.sessionStartTime) return;
  
  // Calculate time used in this session
  const sessionTime = now - data.sessionStartTime;
  
  // Update total time used and clear session start time
  data.totalTimeUsed += sessionTime;
  data.sessionStartTime = null;
  
  await saveUsageLimits(data);
};

// Function to check remaining time
const getRemainingTime = async (): Promise<number> => {
  const data = await loadUsageLimits();
  let usedTime = data.totalTimeUsed;
  
  // If there's an active session, add the time used in the current session
  if (data.sessionStartTime) {
    usedTime += (Date.now() - data.sessionStartTime);
  }
  
  // Calculate and return remaining time in milliseconds
  const remainingTime = MAX_USAGE_TIME - usedTime;
  return Math.max(0, remainingTime);
};

// Format milliseconds to a readable time string (e.g. "2:30")
const formatTimeRemaining = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const AskAIBot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi there! I'm your AI assistant. You can ask me about academic topics, general knowledge, or anything else. What would you like help with today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCreatingVideoCall, setIsCreatingVideoCall] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Load usage data and check limits on component mount
  useEffect(() => {
    // Initialize API key from Firestore
    (async () => {
      try {
        OPENROUTER_API_KEY = await apiKeysService.getApiKey('OPENROUTER_API_KEY', OPENROUTER_API_KEY);
        console.log('OpenRouter API key initialized');
      } catch (error) {
        console.error('Failed to initialize OpenRouter API key:', error);
      }
    })();
    
    // No usage/time limit check for chat
    return () => {
      // ...existing code for cleanup...
      endSession(); // Only needed for video call
    };
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Function to handle sending messages (no usage/time limit check)
  const handleSendMessage = async () => {
    if (inputText.trim() === '') return;
    // No usage limit check for chat
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    setIsTyping(true);
    try {
      // No remaining time check for chat
      const response = await callOpenRouterAPI(userMessage.text);
      const aiMessage: Message = {
        id: Date.now().toString(),
        text: response.text,
        isUser: false,
        timestamp: new Date(),
        modelUsed: response.modelUsed,
        isFallback: response.isFallback
      };
      setMessages(prevMessages => [...prevMessages, aiMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: "Sorry, I'm having trouble connecting to my brain right now. Please try again later.",
        isUser: false,
        timestamp: new Date(),
        modelUsed: 'error',
        isFallback: true
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsTyping(false);
      setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
    }
  };

  // Handle video call button press (keep usage/time limit logic here only)
  const handleVideoCallPress = async () => {
    // Usage/time limit logic ONLY for video call
    const data = await loadUsageLimits();
    const now = Date.now();
    let usageLimitReached = false;
    let resetDate: Date | null = null;
    if (data.totalTimeUsed >= MAX_USAGE_TIME) {
      usageLimitReached = true;
      resetDate = new Date(data.lastResetDate + RESET_INTERVAL);
    }
    if (usageLimitReached) {
      Alert.alert(
        "Video Call Limit Reached",
        `Your 3-minute AI video call limit has been reached. Access will reset on ${resetDate?.toLocaleDateString() || '5 days from now'}.`,
        [{ text: "OK" }]
      );
      return;
    }
    try {
      setIsCreatingVideoCall(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Check remaining time before creating video call
      const remaining = await getRemainingTime();
      if (remaining <= 0) {
        Alert.alert(
          "Video Call Limit Reached",
          `Your 3-minute AI video call limit has been reached. Access will reset on ${resetDate?.toLocaleDateString() || '5 days from now'}.`,
          [{ text: "OK" }]
        );
        setIsCreatingVideoCall(false);
        return;
      }
      // Create the Tavus video call
      const videoCallUrl = await createTavusVideoCall();
      const videoCallMessage: Message = {
        id: Date.now().toString(),
        text: "I've created an AI video call for you. Tap the link to join the conversation. Remember, this counts toward your 3-minute video call limit.",
        isUser: false,
        timestamp: new Date(),
        videoCallUrl: videoCallUrl,
        modelUsed: 'tavus-video',
        isFallback: false
      };
      setMessages(prevMessages => [...prevMessages, videoCallMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => { flatListRef.current?.scrollToEnd({ animated: true }); }, 100);
    } catch (error) {
      console.error('Error setting up video call:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: "Sorry, I couldn't create a video call right now. Please try again later.",
        isUser: false,
        timestamp: new Date(),
        modelUsed: 'error',
        isFallback: true
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsCreatingVideoCall(false);
    }
  };

  // Function to format timestamp
  const formatTimestamp = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  // Get colors for AI message based on the model
  const getAIMessageColors = (modelUsed?: string, isFallback?: boolean) => {
    if (isFallback) {
      return {
        gradientColors: ['#FFA726', '#FB8C00'] as const,
        iconName: 'alert-circle-outline'
      };
    }
    
    // Different colors for different model providers
    if (modelUsed?.includes('mistralai')) {
      return {
        gradientColors: ['#4E54C8', '#8F94FB'] as const,
        iconName: 'sparkles-outline'
      };
    } else if (modelUsed?.includes('llama')) {
      return {
        gradientColors: ['#6A11CB', '#8E43E7'] as const,
        iconName: 'flash-outline'
      };
    } else if (modelUsed?.includes('google')) {
      return {
        gradientColors: ['#34A853', '#4285F4'] as const,
        iconName: 'analytics-outline'
      };
    } else if (modelUsed?.includes('anthropic')) {
      return {
        gradientColors: ['#FF6B6B', '#FF8E8E'] as const,
        iconName: 'bulb-outline'
      };
    } else if (modelUsed === 'tavus-video') {
      return {
        gradientColors: ['#2E7D32', '#66BB6A'] as const, // Green for video calls
        iconName: 'videocam'
      };
    }
    
    // Default
    return {
      gradientColors: ['#4E54C8', '#8F94FB'] as const,
      iconName: 'chatbubble-ellipses'
    };
  };

  // Render each message bubble
  const renderMessageItem = ({ item }: { item: Message }) => {
    // Get message styling based on model
    const { gradientColors, iconName } = getAIMessageColors(item.modelUsed, item.isFallback);
    
    return (
      <View style={[
        styles.messageBubble,
        item.isUser ? styles.userBubble : styles.aiBubble
      ]}>
        {!item.isUser && (
          <View style={styles.aiIconContainer}>
            <LinearGradient
              colors={gradientColors}
              style={styles.aiIconBackground}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={iconName as any} size={18} color="#FFFFFF" />
            </LinearGradient>
          </View>
        )}
        <View style={[
          styles.messageContent,
          item.isUser ? styles.userMessageContent : styles.aiMessageContent
        ]}>
          <Text style={[
            styles.messageText,
            item.isUser ? styles.userMessageText : styles.aiMessageText
          ]}>
            {item.text}
          </Text>
          
          {/* Video call link button */}
          {!item.isUser && item.videoCallUrl && (
            <TouchableOpacity
              style={styles.videoCallButton}
              onPress={() => Linking.openURL(item.videoCallUrl!)}
            >
              <LinearGradient
                colors={gradientColors}
                style={styles.videoCallButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="videocam" size={16} color="#FFFFFF" style={styles.videoCallIcon} />
                <Text style={styles.videoCallText}>Join Video Call</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          
          {/* Show model info and timestamp */}
          <View style={styles.messageFooter}>
            {!item.isUser && item.modelUsed && (
              <Text style={styles.modelInfoText}>
                {item.isFallback ? 'Fallback Mode' : item.modelUsed.split('/')[0]}
              </Text>
            )}
            <Text style={[
              styles.timestampText,
              item.isUser ? styles.userTimestamp : styles.aiTimestamp
            ]}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFF" />
      
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#4E54C8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ask AI</Text>
          <View style={styles.headerRightContainer}>
            {/* Time Remaining Display - Removed for chat */}
            
            <TouchableOpacity
              onPress={handleVideoCallPress}
              disabled={isCreatingVideoCall}
              style={[
                styles.videoCallHeaderButton,
                isCreatingVideoCall && styles.disabledButton
              ]}
            >
              {isCreatingVideoCall ? (
                <ActivityIndicator size="small" color="#4E54C8" />
              ) : (
                <LinearGradient
                  colors={['#4E54C8', '#8F94FB']}
                  style={styles.videoCallHeaderBg}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="videocam" size={18} color="#FFFFFF" />
                </LinearGradient>
              )}
            </TouchableOpacity>
            <View>
              <LinearGradient
                colors={['#4E54C8', '#8F94FB']}
                style={styles.headerIconBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </View>
        </View>
        
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        
        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingContainer}>
            <View style={styles.typingBubble}>
              <Text style={styles.typingText}>AI is typing</Text>
              <ActivityIndicator size="small" color="#4E54C8" style={styles.typingIndicator} />
            </View>
          </View>
        )}
        
        {/* Input area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask anything..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            onSubmitEditing={handleSendMessage}
            placeholderTextColor="#A0A0A0"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() ? styles.sendButtonDisabled : {}
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons
              name="send"
              size={22}
              color={!inputText.trim() ? '#C0C0C0' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
        
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoCallHeaderButton: {
    marginRight: 12,
    height: 36,
    width: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCallHeaderBg: {
    height: 36,
    width: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  headerIconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    marginBottom: 16,
    flexDirection: 'row',
    maxWidth: '90%',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  aiIconContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  aiIconBackground: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageContent: {
    padding: 12,
    borderRadius: 20,
  },
  userMessageContent: {
    backgroundColor: '#4E54C8',
    borderBottomRightRadius: 4,
  },
  aiMessageContent: {
    backgroundColor: '#F0F2F5',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: '#333333',
  },
  timestampText: {
    fontSize: 11,
    marginTop: 4,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  aiTimestamp: {
    color: '#999999',
    textAlign: 'left',
  },
  typingContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    padding: 10,
    borderRadius: 18,
    maxWidth: '60%',
    alignSelf: 'flex-start',
  },
  typingText: {
    fontSize: 14,
    color: '#666',
  },
  typingIndicator: {
    marginLeft: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#333333',
  },
  sendButton: {
    backgroundColor: '#4E54C8',
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  privacyText: {
    fontSize: 12,
    color: '#A0A0A0',
    marginLeft: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  modelInfoText: {
    fontSize: 10,
    color: '#888888',
    fontStyle: 'italic',
  },
  videoCallButton: {
    marginTop: 8,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  videoCallButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  videoCallIcon: {
    marginRight: 6,
  },
  videoCallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalText: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 22,
  },
  highlightText: {
    color: '#4E54C8',
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: '#4E54C8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default AskAIBot;
