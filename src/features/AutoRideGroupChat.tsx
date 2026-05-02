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

const AutoRideGroupChat: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { rideId, rideName } = route.params as { rideId: string; rideName?: string };
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<FlatList>(null);
  
  // Mock user data - in real app, this would come from auth
  const user = auth.currentUser;
  const currentUser = {
    id: user?.uid || 'user123',
    name: user?.displayName || user?.email?.split('@')[0] || 'John Doe'
  };
  
  // Quick message options
  const quickMessages: QuickMessageOption[] = [
    { id: 'status-1', text: 'I\'m ready to go', icon: '✅', color: '#28a745', category: 'status' },
    { id: 'status-2', text: 'I\'ll be late by 5 mins', icon: '⏰', color: '#ffc107', category: 'status' },
    { id: 'status-3', text: 'I\'m waiting at the pickup spot', icon: '📍', color: '#17a2b8', category: 'status' },
    { id: 'reminder-1', text: 'Don\'t forget to bring exact change', icon: '💰', color: '#fd7e14', category: 'reminder' },
    { id: 'request-1', text: 'Can we leave earlier?', icon: '🔄', color: '#6f42c1', category: 'request' },
    { id: 'request-2', text: 'Can you share your location?', icon: '🗺️', color: '#20c997', category: 'request' },
  ];
  
  useEffect(() => {
    const messagesRef = collection(db, 'auto_rides', rideId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: ChatMessage[] = [];
      snapshot.forEach(doc => {
        fetchedMessages.push({
          id: doc.id,
          ...doc.data()
        } as ChatMessage);
      });
      
      setMessages(fetchedMessages);
      setLoading(false);
      
      // Scroll to bottom on new messages
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }, (error) => {
      console.error('Error fetching messages:', error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [rideId]);
  
  const scrollToBottom = () => {
    if (scrollViewRef.current && messages.length > 0) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };
  
  const sendMessage = async (text: string, isQuickMessage: boolean = false) => {
    if (!text.trim()) return;
    
    try {
      const messagesRef = collection(db, 'auto_rides', rideId, 'messages');
      await addDoc(messagesRef, {
        text,
        senderId: currentUser.id,
        senderName: currentUser.name,
        timestamp: serverTimestamp(),
        type: isQuickMessage ? 'quick_message' : 'text',
        isQuickMessage
      });
      
      // Update ride document with unread message count for other users
      const rideRef = doc(db, 'auto_rides', rideId);
      await updateDoc(rideRef, {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        // In a real app, you'd increment unread count for specific users
        // This is just a placeholder implementation
        unreadCount: increment(1)
      });
      
      setNewMessage('');
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };
  
  const sendQuickMessage = (message: QuickMessageOption) => {
    sendMessage(message.text, true);
    setShowQuickMessages(false);
  };
  
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMyMessage = item.senderId === currentUser.id;
    
    return (
      <View 
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
        ]}
      >
        {!isMyMessage && <Text style={styles.senderName}>{item.senderName}</Text>}
        
        <View 
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            item.isQuickMessage && styles.quickMessageBubble
          ]}
        >
          <Text 
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
              item.isQuickMessage && styles.quickMessageTextStyle
            ]}
          >
            {item.text}
          </Text>
          <Text 
            style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime
            ]}
          >
            {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
          </Text>
        </View>
      </View>
    );
  };
  
  const renderQuickMessage = ({ item }: { item: QuickMessageOption }) => (
    <TouchableOpacity 
      style={styles.quickMessageButton}
      onPress={() => sendQuickMessage(item)}
    >
      <View style={[styles.quickMessageIcon, { backgroundColor: item.color }]}>
        <Text style={{ fontSize: 16 }}>{item.icon}</Text>
      </View>
      <Text style={styles.quickMessageText}>{item.text}</Text>
    </TouchableOpacity>
  );
  
  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{rideName || 'Auto Ride Chat'}</Text>
          <Text style={styles.headerSubtitle}>
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.quickMessageToggle}
          onPress={() => setShowQuickMessages(!showQuickMessages)}
        >
          <Text style={{ fontSize: 16 }}>⚡</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        {/* Quick Messages Panel */}
        {showQuickMessages && (
          <View style={styles.quickMessagesContainer}>
            <View style={styles.quickMessagesHeader}>
              <Text style={{ fontSize: 14, color: '#007bff' }}>⚡</Text>
              <Text style={styles.quickMessagesTitle}>Quick Messages</Text>
            </View>
            <View style={styles.quickMessagesList}>
              {quickMessages.map(message => (
                <TouchableOpacity 
                  key={message.id}
                  style={styles.quickMessageButton}
                  onPress={() => sendQuickMessage(message)}
                >
                  <View style={[styles.quickMessageIcon, { backgroundColor: message.color }]}>
                    <Text style={{ fontSize: 16 }}>{message.icon}</Text>
                  </View>
                  <Text style={styles.quickMessageText}>{message.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        
        {/* Messages List */}
        {loading ? (
          <View style={[styles.messagesList, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text>Loading messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <ScrollView 
            style={styles.messagesList}
            contentContainerStyle={styles.emptyChat}
          >
            <Text style={{ fontSize: 48 }}>💬</Text>
            <Text style={styles.emptyChatText}>No messages yet</Text>
            <Text style={styles.emptyChatSubtext}>
              Be the first to send a message to this auto ride chat
            </Text>
          </ScrollView>
        ) : (
          <FlatList
            ref={scrollViewRef}
            style={styles.messagesList}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            onContentSizeChange={scrollToBottom}
            onLayout={scrollToBottom}
          />
        )}
      </View>
      
      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#adb5bd"
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !newMessage.trim() && styles.sendButtonDisabled
              ]}
              disabled={!newMessage.trim()}
              onPress={() => sendMessage(newMessage)}
            >
              <Text style={{ fontSize: 16, color: '#fff' }}>➤</Text>
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

export default AutoRideGroupChat;

// Firebase Console Action: Create subcollection 'messages' under each 'auto_rides' document
// with the following structure:
// - id: string (auto-generated)
// - text: string
// - senderId: string
// - senderName: string
// - timestamp: timestamp
// - type: 'text' | 'quick_message' | 'system'
// - isQuickMessage: boolean (optional)
