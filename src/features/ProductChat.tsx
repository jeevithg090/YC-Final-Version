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
import { db, auth } from '../services/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/router';

const { width: screenWidth } = Dimensions.get('window');

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: number;
  type: 'text';
}

const ProductChat: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  // @ts-ignore
  const { chatId, product, buyer, seller } = route.params || {};
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Determine current user (buyer or seller) based on logged-in user
  const loggedInUserId = auth.currentUser?.uid;
  const currentUser = buyer?.id === loggedInUserId ? buyer : seller;
  const otherUser = buyer?.id === loggedInUserId ? seller : buyer;

  // Listen to messages in real-time
  useEffect(() => {
    if (!chatId) return;
    setLoadingMessages(true);
    const messagesRef = collection(db, 'product_chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
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
  }, [chatId]);

  // Send a message
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const messagesRef = collection(db, 'product_chats', chatId, 'messages');
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

  // UI: Message bubble
  const renderMessage = ({ item }: { item: Message }) => {
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

  // UI: Product info at the top
  const renderProductInfo = () => (
    <View style={styles.productInfoContainer}>
      <Image source={{ uri: product?.images?.[0] }} style={styles.productImage} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.productTitle}>{product?.title}</Text>
        <Text style={styles.productPrice}>₹{product?.price}</Text>
        <Text style={styles.productMeta}>Seller: {seller?.name}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#4E54C8", "#8B5CF6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Chat</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>
      {renderProductInfo()}
      {/* Chat messages */}
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
  productInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  productPrice: {
    fontSize: 15,
    color: '#4E54C8',
    fontWeight: '600',
    marginTop: 2,
  },
  productMeta: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
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
  themMessage: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
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
  themMessageBubble: {
    backgroundColor: '#F2F2F7',
    alignSelf: 'flex-start',
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
  themMessageText: {
    color: '#1C1C1E',
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
});

export default ProductChat; 