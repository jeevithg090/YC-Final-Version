import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Swipeable } from 'react-native-gesture-handler';
// import { GiphyDialog, GiphyDialogEvent, GiphyMedia } from '@giphy/react-native-sdk'; // You need to install and configure this package

interface GroupChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: number;
  type: 'text' | 'gif' | 'sticker' | 'reply';
  mediaUrl?: string;
  replyTo?: string;
}

interface GroupChatProps {
  groupId: string;
  groupName: string;
  onBack: () => void;
}

const GroupChat: React.FC<GroupChatProps> = ({ groupId, groupName, onBack }) => {
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showGiphy, setShowGiphy] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [replyingTo, setReplyingTo] = useState<GroupChatMessage | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{ description: string; members: { id: string; name: string; avatar?: string }[] }>({ description: '', members: [] });

  useEffect(() => {
    const chatRef = collection(db, `groups/${groupId}/messages`);
    const q = query(chatRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: GroupChatMessage[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupChatMessage));
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsubscribe();
  }, [groupId]);

  // Fetch group description and members from messages
  useEffect(() => {
    // Fetch group description (if you have it in Firestore, fetch here; else, use groupName only)
    // For now, just set description to groupName for demo
    // For members, get unique userId/userName from messages
    const membersMap: { [id: string]: { id: string; name: string; avatar?: string } } = {};
    messages.forEach(msg => {
      if (!membersMap[msg.userId]) {
        membersMap[msg.userId] = { id: msg.userId, name: msg.userName, avatar: msg.userAvatar };
      }
    });
    setGroupInfo({ description: groupName + ' group', members: Object.values(membersMap) });
  }, [messages, groupName]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    const chatRef = collection(db, `groups/${groupId}/messages`);
    const msg: Omit<GroupChatMessage, 'id'> = {
      userId: 'current_user', // Replace with actual user ID
      userName: 'John Doe', // Replace with actual user name
      content: newMessage.trim(),
      createdAt: Date.now(),
      type: replyingTo ? 'reply' : 'text',
      ...(replyingTo ? { replyTo: replyingTo.id } : {}),
    };
    await addDoc(chatRef, msg);
    setNewMessage('');
    setReplyingTo(null);
  };

  // Remove handleSendGif and GiphyDialog usage, add placeholder
  const handleSendGif = async (mediaUrl: string) => {
    const chatRef = collection(db, `groups/${groupId}/messages`);
    const msg: Omit<GroupChatMessage, 'id'> = {
      userId: 'current_user',
      userName: 'John Doe',
      content: '',
      createdAt: Date.now(),
      type: 'gif',
      mediaUrl,
    };
    await addDoc(chatRef, msg);
  };

  // Dummy stickers array (replace with your own sticker assets)
  const stickers = [
    require('../../assets/images/campus-life.png'),
    require('../../assets/images/campus-life.png'),
    require('../../assets/images/react-logo.png'),
  ];

  const handleSendSticker = async (stickerUri: string) => {
    const chatRef = collection(db, `groups/${groupId}/messages`);
    const msg: Omit<GroupChatMessage, 'id'> = {
      userId: 'current_user',
      userName: 'John Doe',
      content: '',
      createdAt: Date.now(),
      type: 'sticker',
      mediaUrl: stickerUri,
    };
    await addDoc(chatRef, msg);
    setShowStickers(false);
  };

  // Swipeable message
  const renderMessage = ({ item }: { item: GroupChatMessage }) => {
    const isOwn = item.userId === 'current_user';
    const repliedMsg = item.replyTo ? messages.find(m => m.id === item.replyTo) : null;
    return (
      <Swipeable
        renderLeftActions={() => null}
        renderRightActions={() => null}
        onSwipeableOpen={() => setReplyingTo(item)}
      >
        <View style={[styles.messageRow, isOwn && styles.ownMessageRow]}>
          {!isOwn && (
            <View style={styles.avatar}>
              {item.userAvatar ? (
                <Image source={{ uri: item.userAvatar }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person-circle" size={32} color="#C7C7CC" />
              )}
            </View>
          )}
          <View style={[styles.bubble, isOwn && styles.ownBubble]}>
            {item.type === 'reply' && repliedMsg && (
              <View style={styles.replyPreviewBubble}>
                <Text style={styles.replyPreviewText}>Replying to {repliedMsg.userName}: {repliedMsg.content.slice(0, 40)}{repliedMsg.content.length > 40 ? '...' : ''}</Text>
              </View>
            )}
            {item.type === 'text' && <Text style={[styles.text, isOwn && styles.ownText]}>{item.content}</Text>}
            {item.type === 'gif' && item.mediaUrl && (
              <Image source={{ uri: item.mediaUrl }} style={styles.gifImg} />
            )}
            {item.type === 'sticker' && item.mediaUrl && (
              <Image source={{ uri: item.mediaUrl }} style={styles.stickerImg} />
            )}
          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#4E54C8" />
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowGroupInfo(true)}>
            <Text style={styles.headerTitle}>{groupName}</Text>
          </TouchableOpacity>
          <View style={{ width: 32 }} />
        </View>
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />
        {/* Reply Preview */}
        {replyingTo && (
          <View style={styles.replyPreviewBar}>
            <Text style={styles.replyPreviewBarText}>Replying to {replyingTo.userName}: {replyingTo.content.slice(0, 40)}{replyingTo.content.length > 40 ? '...' : ''}</Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ marginLeft: 8 }}>
              <Ionicons name="close" size={18} color="#4E54C8" />
            </TouchableOpacity>
          </View>
        )}
        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <View style={styles.inputBar}>
            <TouchableOpacity onPress={() => setShowGiphy(true)} style={styles.iconBtn}>
              <Ionicons name="images" size={24} color="#4E54C8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowStickers(true)} style={styles.iconBtn}>
              <Ionicons name="happy" size={24} color="#4E54C8" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#8E8E93"
              multiline
            />
            <TouchableOpacity onPress={handleSend} style={styles.sendBtn} disabled={!newMessage.trim()}>
              <Ionicons name="send" size={22} color={newMessage.trim() ? '#4E54C8' : '#C7C7CC'} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        {/* Group Info Modal */}
        <Modal visible={showGroupInfo} animationType="slide" onRequestClose={() => setShowGroupInfo(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => setShowGroupInfo(false)} style={{ marginRight: 12 }}>
                <Ionicons name="close" size={28} color="#4E54C8" />
              </TouchableOpacity>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#4E54C8', flex: 1 }}>{groupName}</Text>
            </View>
            <Text style={{ color: '#8E8E93', marginBottom: 12 }}>{groupInfo.description}</Text>
            <Text style={{ fontWeight: '600', marginBottom: 8 }}>Members ({groupInfo.members.length})</Text>
            <FlatList
              data={groupInfo.members}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
                  ) : (
                    <Ionicons name="person-circle" size={32} color="#C7C7CC" style={{ marginRight: 10 }} />
                  )}
                  <Text style={{ fontSize: 16 }}>{item.name}</Text>
                </View>
              )}
              style={{ maxHeight: 180, marginBottom: 16 }}
            />
            <TouchableOpacity style={{ backgroundColor: '#FF3B30', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 }} onPress={() => alert('Report group feature coming soon!')}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Report Group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: '#F2F2F7', borderRadius: 8, padding: 14, alignItems: 'center' }} onPress={() => alert('Exit group feature coming soon!')}>
              <Text style={{ color: '#4E54C8', fontWeight: 'bold' }}>Exit Group</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
        {/* Giphy Dialog */}
        {/*
<Modal visible={showGiphy} animationType="slide" onRequestClose={() => setShowGiphy(false)}>
  <GiphyDialog
    onMediaSelect={(e: GiphyDialogEvent) => {
      if (e.media) handleSendGif(e.media);
      setShowGiphy(false);
    }}
    onDismiss={() => setShowGiphy(false)}
  />
</Modal>
*/}
        {/* Placeholder for GIF picker integration */}
        <Modal visible={showGiphy} animationType="slide" onRequestClose={() => setShowGiphy(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <Text style={{ fontSize: 18, color: '#4E54C8', marginBottom: 16 }}>GIF Picker Integration Coming Soon</Text>
            <TouchableOpacity onPress={() => {
              // Example: handleSendGif('https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif');
              setShowGiphy(false);
            }} style={{ padding: 12, backgroundColor: '#4E54C8', borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </Modal>
        {/* Stickers Modal */}
        <Modal visible={showStickers} animationType="slide" onRequestClose={() => setShowStickers(false)} transparent>
          <View style={styles.stickersModalOverlay}>
            <View style={styles.stickersModalContent}>
              <Text style={styles.stickersTitle}>Choose a Sticker</Text>
              <FlatList
                data={stickers}
                horizontal
                keyExtractor={(_, idx) => idx.toString()}
                contentContainerStyle={styles.stickersRow}
                renderItem={({ item, index }) => (
                  <TouchableOpacity key={index} onPress={() => handleSendSticker(Image.resolveAssetSource(item).uri)}>
                    <Image source={item} style={styles.stickerOption} />
                  </TouchableOpacity>
                )}
                showsHorizontalScrollIndicator={false}
              />
              <TouchableOpacity onPress={() => setShowStickers(false)} style={styles.closeStickersBtn}>
                <Ionicons name="close" size={24} color="#4E54C8" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#4E54C8', flex: 1, textAlign: 'center' },
  messagesList: { padding: 16, paddingBottom: 80 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  ownMessageRow: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  avatarImg: { width: 32, height: 32, borderRadius: 16 },
  bubble: { maxWidth: '75%', backgroundColor: '#F2F2F7', borderRadius: 16, padding: 12 },
  ownBubble: { backgroundColor: '#4E54C8' },
  text: { fontSize: 15, color: '#1C1C1E' },
  ownText: { color: '#fff' },
  gifImg: { width: 180, height: 180, borderRadius: 12 },
  stickerImg: { width: 100, height: 100, borderRadius: 12 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', padding: 12, borderTopWidth: 1, borderTopColor: '#F2F2F7', paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  iconBtn: { padding: 6, marginRight: 4 },
  input: { flex: 1, fontSize: 16, color: '#1C1C1E', backgroundColor: '#F2F2F7', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 4 },
  sendBtn: { padding: 8 },
  stickersModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end' },
  stickersModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, alignItems: 'center', minHeight: 220 },
  stickersTitle: { fontSize: 18, fontWeight: '700', color: '#4E54C8', marginBottom: 16 },
  stickersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 12 },
  stickerOption: { width: 80, height: 80, marginHorizontal: 8 },
  closeStickersBtn: { marginTop: 12, padding: 8 },
  replyPreviewBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', padding: 8, paddingHorizontal: 16 },
  replyPreviewBarText: { color: '#4E54C8', fontWeight: '600', flex: 1 },
  replyPreviewBubble: { backgroundColor: 'rgba(78,84,200,0.08)', borderRadius: 8, padding: 6, marginBottom: 4 },
  replyPreviewText: { color: '#8E8E93', fontSize: 13, fontStyle: 'italic' },
});

export default GroupChat; 