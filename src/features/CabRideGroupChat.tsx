import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  db, collection, doc, addDoc, onSnapshot, query, orderBy, serverTimestamp, updateDoc, auth
} from '../services/firebase';
import { increment } from 'firebase/firestore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// TypeScript interfaces
interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
  type: 'text' | 'quick_message' | 'system';
  isQuickMessage?: boolean;
}

interface QuickMessageOption {
  id: string;
  text: string;
  icon: string;
  color: string;
  category: 'status' | 'reminder' | 'request';
}

const CabRideGroupChat: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { rideId, rideName } = route.params as { rideId: string; rideName?: string };
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const currentUserId = 'current-user-id'; // Replace with actual user ID from auth
  const currentUserName = 'Current User'; // Replace with actual user name from auth
  const user = auth.currentUser;
  const currentUser = {
    id: user?.uid || 'user123',
    name: user?.displayName || user?.email?.split('@')[0] || 'John Doe'
  };

  const quickMessageOptions: QuickMessageOption[] = [
    {
      id: 'cab_on_way',
      text: '🚗 Cab is on the way!',
      icon: 'car-outline',
      color: '#28a745',
      category: 'status',
    },
    {
      id: 'please_be_on_time',
      text: '⏰ Please be on time',
      icon: 'time-outline',
      color: '#ffc107',
      category: 'reminder',
    },
    {
      id: 'running_late',
      text: '⏱️ Running 5 minutes late',
      icon: 'timer-outline',
      color: '#dc3545',
      category: 'status',
    },
    {
      id: 'reached_pickup',
      text: '📍 Reached pickup location',
      icon: 'location-outline',
      color: '#17a2b8',
      category: 'status',
    },
    {
      id: 'waiting_pickup',
      text: '⏳ Waiting at pickup point',
      icon: 'pause-circle-outline',
      color: '#6f42c1',
      category: 'status',
    },
    {
      id: 'share_location',
      text: '🗺️ Please share your location',
      icon: 'navigate-outline',
      color: '#fd7e14',
      category: 'request',
    },
    {
      id: 'luggage_ready',
      text: '🎒 Please keep luggage ready',
      icon: 'bag-outline',
      color: '#20c997',
      category: 'reminder',
    },
    {
      id: 'payment_reminder',
      text: '💰 Payment reminder: ₹{amount} per person',
      icon: 'card-outline',
      color: '#e83e8c',
      category: 'reminder',
    },
  ];

  useEffect(() => {
    if (rideId) {
      setupChatListener();
      markMessagesAsRead();
    }
    return () => {
      // Cleanup will be handled by onSnapshot unsubscribe
    };
  }, [rideId]);

  const markMessagesAsRead = async () => {
    try {
      const rideRef = doc(db, 'cab_rides', rideId);
      await updateDoc(rideRef, {
        unreadCount: 0,
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const setupChatListener = () => {
    try {
      const chatRef = collection(db, 'cab_rides', rideId, 'messages');
      const q = query(chatRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messagesList: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          messagesList.push({
            id: doc.id,
            ...data,
          } as ChatMessage);
        });
        
        setMessages(messagesList);
        setLoading(false);
        
        // Scroll to bottom when new message arrives
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, (error) => {
        console.error('Error listening to chat messages:', error);
        Alert.alert('Error', 'Failed to load chat messages');
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up chat listener:', error);
      setLoading(false);
    }
  };

  const sendMessage = async (messageText: string, isQuickMessage: boolean = false) => {
    if (!messageText.trim() && !isQuickMessage) return;
    
    setSendingMessage(true);
    try {
      const chatRef = collection(db, 'cab_rides', rideId, 'messages');
      
      const messageData: Omit<ChatMessage, 'id'> = {
        text: messageText.trim(),
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: serverTimestamp(),
        type: isQuickMessage ? 'quick_message' : 'text',
        isQuickMessage,
      };

      await addDoc(chatRef, messageData);
      
      // Update ride document with last message info and increment unread count
      const rideRef = doc(db, 'cab_rides', rideId);
      await updateDoc(rideRef, {
        lastMessage: {
          text: messageText.trim(),
          senderName: currentUserName,
          timestamp: serverTimestamp(),
        },
        unreadCount: increment(1),
      });
      
      setInputText('');
      setShowQuickMessages(false);
      
      // Hide keyboard
      Keyboard.dismiss();
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const sendQuickMessage = (option: QuickMessageOption) => {
    let messageText = option.text;
    
    // Replace placeholders if any
    if (option.id === 'payment_reminder') {
      // You can calculate the actual amount from ride data
      messageText = messageText.replace('{amount}', '125'); // Example amount
    }
    
    sendMessage(messageText, true);
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  };

  const renderQuickMessageOption = ({ item }: { item: QuickMessageOption }) => (
    <TouchableOpacity
      style={[styles.quickMessageButton, { borderColor: item.color }]}
      onPress={() => sendQuickMessage(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.quickMessageIcon, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon as any} size={20} color={item.color} />
      </View>
      <Text style={[styles.quickMessageText, { color: item.color }]}>
        {item.text}
      </Text>
    </TouchableOpacity>
  );

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMyMessage = item.senderId === currentUserId;
    const showName = index === 0 || messages[index - 1]?.senderId !== item.senderId;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        {!isMyMessage && showName && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          item.isQuickMessage && styles.quickMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText,
            item.isQuickMessage && styles.quickMessageTextStyle
          ]}>
            {item.text}
          </Text>
          
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime
          ]}>
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Group Chat</Text>
          <Text style={styles.headerSubtitle}>
            {rideName || 'Cab Ride Chat'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.quickMessageToggle}
          onPress={() => setShowQuickMessages(!showQuickMessages)}
        >
          <Ionicons 
            name={showQuickMessages ? "chevron-down" : "flash-outline"} 
            size={24} 
            color="#007bff" 
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Quick Messages Section */}
        {showQuickMessages && (
          <View style={styles.quickMessagesContainer}>
            <LinearGradient
              colors={['#f8f9fa', '#e9ecef']}
              style={styles.quickMessagesHeader}
            >
              <Ionicons name="flash" size={20} color="#007bff" />
              <Text style={styles.quickMessagesTitle}>Quick Messages</Text>
            </LinearGradient>
            
            <FlatList
              data={quickMessageOptions}
              renderItem={renderQuickMessageOption}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.quickMessagesList}
            />
          </View>
        )}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={64} color="#dee2e6" />
              <Text style={styles.emptyChatText}>Start the conversation!</Text>
              <Text style={styles.emptyChatSubtext}>
                Use quick messages or type your own message
              </Text>
            </View>
          )}
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
              maxLength={500}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || sendingMessage) && styles.sendButtonDisabled
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || sendingMessage}
            >
              {sendingMessage ? (
                <Ionicons name="hourglass" size={20} color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  quickMessageToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  quickMessagesContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    maxHeight: 200,
  },
  quickMessagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  quickMessagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007bff',
    marginLeft: 8,
  },
  quickMessagesList: {
    padding: 12,
  },
  quickMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickMessageIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickMessageText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyChatText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6c757d',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myMessageBubble: {
    backgroundColor: '#007bff',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  quickMessageBubble: {
    borderWidth: 1,
    borderColor: '#28a745',
    backgroundColor: '#f8fff8',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#2c3e50',
  },
  quickMessageTextStyle: {
    fontWeight: '500',
    color: '#28a745',
  },
  messageTime: {
    fontSize: 11,
    fontWeight: '400',
  },
  myMessageTime: {
    color: '#e3f2fd',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#adb5bd',
    textAlign: 'left',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8f9fa',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    maxHeight: 100,
    paddingVertical: 8,
    paddingRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#adb5bd',
    shadowOpacity: 0,
    elevation: 0,
  },
});

export default CabRideGroupChat;

// Firebase Console Action: Create subcollection 'messages' under each 'cab_rides' document
// with the following structure:
// - id: string (auto-generated)
// - text: string
// - senderId: string
// - senderName: string
// - timestamp: timestamp
// - type: 'text' | 'quick_message' | 'system'
// - isQuickMessage: boolean (optional)
