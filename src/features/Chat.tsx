import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../services/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/router';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width: screenWidth } = Dimensions.get('window');

// User profile interface (from Profile.tsx)
interface UserProfile {
  id: string;
  name: string;
  username: string;
  bio?: string;
  college?: string;
  branch?: string;
  profileImage?: string;
  email?: string;
  yearOfStudy?: string;
}

// Chat message interface
interface DMMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: number;
  type: 'text';
}

// Helper to get deterministic chatId for two user IDs
const getChatId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

const Chat: React.FC = () => {
  // Get navigation params for direct chat
  const route = useRoute();
  const params = (route as any).params || {};
  console.log('Chat screen received params:', params);
  // Only set currentUser/selectedUser if params are present and valid
  const [currentUser, setCurrentUser] = useState<any>(params.currentUser && params.currentUser.id ? params.currentUser : null);
  const [selectedUser, setSelectedUser] = useState<any>(params.selectedUser && params.selectedUser.id ? params.selectedUser : null);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  // State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Fetch users (excluding self) if not in direct chat mode
  useEffect(() => {
    if (currentUser && selectedUser) return; // Skip if direct chat
    setLoadingUsers(true);
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        const userList: UserProfile[] = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
          .filter(u => currentUser && u.id !== currentUser.id);
        setUsers(userList);
      } catch (error) {
        console.error('Error fetching users:', error);
        Alert.alert('Error', 'Failed to load users.');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [currentUser, selectedUser]);

  // Listen to DM messages when a user is selected
  useEffect(() => {
    if (!currentUser || !selectedUser) return;
    setLoadingMessages(true);
    const chatId = getChatId(currentUser.id, selectedUser.id);
    const messagesRef = collection(db, 'direct_chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: DMMessage[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DMMessage));
      setMessages(msgs);
      setLoadingMessages(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, (error) => {
      console.error('Error loading messages:', error);
      setLoadingMessages(false);
    });
    return () => unsubscribe();
  }, [currentUser, selectedUser]);

  // Start or continue a DM (for search/select UI)
  const handleSelectUser = async (user: UserProfile) => {
    setSelectedUser(user);
    // Optionally: create the chat doc if it doesn't exist
    const chatId = getChatId(currentUser.id, user.id);
    const chatDocRef = doc(db, 'direct_chats', chatId);
    const chatDoc = await getDoc(chatDocRef);
    if (!chatDoc.exists()) {
      await setDoc(chatDocRef, {
        users: [currentUser.id, user.id],
        createdAt: Date.now(),
      });
    }
  };

  // Send a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    if (currentUser.id === selectedUser.id) {
      Alert.alert('Invalid Chat', 'You cannot chat with yourself.');
      return;
    }
    setSending(true);
    try {
      const chatId = getChatId(currentUser.id, selectedUser.id);
      const messagesRef = collection(db, 'direct_chats', chatId, 'messages');
      const msg: any = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        content: newMessage.trim(),
        createdAt: Date.now(),
        type: 'text',
      };
      if (currentUser.profileImage) {
        msg.senderAvatar = currentUser.profileImage;
      }
      await addDoc(messagesRef, msg);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // UI: User search and list
  const filteredUsers = users.filter(u =>
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // UI: Message bubble
  const renderMessage = ({ item }: { item: DMMessage }) => {
    const isOwn = item.senderId === currentUser.id;
    return (
      <View style={[styles.messageContainer, isOwn ? styles.ownMessage : styles.themMessage]}>
        {!isOwn && (
          <View style={styles.messageAvatar}>
            {item.senderAvatar ? (
              <Image source={{ uri: item.senderAvatar }} style={styles.messageAvatarImage} />
            ) : (
              <Ionicons name="person-circle" size={32} color="#C7C7CC" />
            )}
          </View>
        )}
        <View style={[styles.messageBubble, isOwn ? styles.ownMessageBubble : styles.themMessageBubble]}>
          {!isOwn && <Text style={styles.messageUserName}>{item.senderName}</Text>}
          <Text style={[styles.messageText, isOwn ? styles.ownMessageText : styles.themMessageText]}>{item.content}</Text>
          <Text style={styles.messageTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  // Helper: format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  };

  // UI: Main
  if (!currentUser || !currentUser.id) {
    // No user context: show a friendly message or fallback UI
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#4E54C8", "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Direct Messages</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={64} color="#C7C7CC" />
          <Text style={{ color: '#8E8E93', fontSize: 18, marginTop: 16, textAlign: 'center' }}>
            Select a conversation from the chat list to start messaging.
          </Text>
        </View>
      </View>
    );
  }
  if (!selectedUser || !selectedUser.id || currentUser.id === selectedUser.id) {
    // No selected user or self-chat: show error or fallback
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#4E54C8", "#8B5CF6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat Error</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={{ color: '#FF3B30', fontSize: 18, marginTop: 16, textAlign: 'center' }}>
            {currentUser.id === selectedUser?.id
              ? 'You cannot chat with yourself. Please select another user.'
              : 'Unable to start chat. User information is missing or invalid. Please try again from the chat list or marketplace.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <LinearGradient
        colors={["#4E54C8", "#8B5CF6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => selectedUser ? setSelectedUser(null) : navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedUser ? selectedUser.name : 'Direct Messages'}</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      {/* User Search/List */}
      {!selectedUser && (
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users by name or username..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          {loadingUsers ? (
            <ActivityIndicator size="large" color="#4E54C8" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.userCard} onPress={() => handleSelectUser(item)}>
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={styles.userAvatar} />
                  ) : (
                    <Ionicons name="person-circle" size={44} color="#C7C7CC" />
                  )}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userUsername}>{item.username}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="person-add-outline" size={64} color="#C7C7CC" />
                  <Text style={styles.emptyTitle}>No users found</Text>
                  <Text style={styles.emptySubtitle}>Try a different search</Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 40 }}
            />
          )}
        </View>
      )}

      {/* DM Chat UI */}
      {selectedUser && (
        <View style={styles.chatSection}>
          {loadingMessages ? (
            <ActivityIndicator size="large" color="#4E54C8" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.chatContainer}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}
          {/* Message Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.messageInputContainer, { minHeight: 64, paddingBottom: Platform.OS === 'ios' ? 34 : 16 }]}
          >
            <View style={styles.messageInputWrapper}>
              <TextInput
                style={[styles.messageInput, { minHeight: 48, maxHeight: 120, fontSize: 17, paddingVertical: 12 }]}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor="#8E8E93"
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim() || sending}
              >
                <Ionicons name="send" size={22} color={newMessage.trim() ? "#4E54C8" : "#C7C7CC"} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  backButton: {
    marginRight: 12,
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  searchSection: {
    flex: 1,
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#F2F2F7',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  userUsername: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  chatSection: {
    flex: 1,
    padding: 0,
    justifyContent: 'flex-end',
  },
  chatContainer: {
    padding: 20,
    paddingBottom: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    gap: 8,
  },
  ownMessage: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubble: {
    maxWidth: screenWidth * 0.7,
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    padding: 12,
  },
  ownMessageBubble: {
    backgroundColor: '#4E54C8',
  },
  messageUserName: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 4,
  },
  messageInputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  messageInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  messageInput: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  themMessage: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
    gap: 8,
    justifyContent: 'flex-start',
  },
  themMessageBubble: {
    backgroundColor: '#F2F2F7',
    alignSelf: 'flex-start',
  },
  themMessageText: {
    color: '#1C1C1E',
  },
});

export default Chat; 