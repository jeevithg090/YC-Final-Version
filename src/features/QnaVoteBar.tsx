import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface QnaVoteBarProps {
  questionId: string;
  upvotes: string[];
  downvotes: string[];
  currentUserId: string;
  onVoteChange?: (upvotes: string[], downvotes: string[]) => void;
}

const QnaVoteBar: React.FC<QnaVoteBarProps> = ({ questionId, upvotes, downvotes, currentUserId, onVoteChange }) => {
  const [loading, setLoading] = useState(false);
  const hasUpvoted = upvotes.includes(currentUserId);
  const hasDownvoted = downvotes.includes(currentUserId);
  const points = (upvotes?.length || 0) - (downvotes?.length || 0);

  const handleVote = async (type: 'up' | 'down') => {
    if (loading) return;
    setLoading(true);
    try {
      const questionRef = doc(db, 'qna_questions', questionId);
      const questionSnap = await getDoc(questionRef);
      if (!questionSnap.exists()) return;
      const data = questionSnap.data();
      let updates: any = {};
      if (type === 'up') {
        if (hasUpvoted) {
          updates.upvotes = arrayRemove(currentUserId);
          updates.points = increment(-1);
        } else {
          updates.upvotes = arrayUnion(currentUserId);
          updates.points = increment(1);
          if (hasDownvoted) {
            updates.downvotes = arrayRemove(currentUserId);
            updates.points = increment(1); // Remove downvote penalty
          }
        }
      } else {
        if (hasDownvoted) {
          updates.downvotes = arrayRemove(currentUserId);
          updates.points = increment(1);
        } else {
          updates.downvotes = arrayUnion(currentUserId);
          updates.points = increment(-1);
          if (hasUpvoted) {
            updates.upvotes = arrayRemove(currentUserId);
            updates.points = increment(-1); // Remove upvote bonus
          }
        }
      }
      await updateDoc(questionRef, updates);
      // Optionally, call onVoteChange to update parent state
      if (onVoteChange) {
        const updatedSnap = await getDoc(questionRef);
        const updated = updatedSnap.data();
        if (updated) {
          onVoteChange(updated.upvotes || [], updated.downvotes || []);
        }
      }
    } catch (e) {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.voteBar}>
      <TouchableOpacity
        style={[styles.voteButton, hasUpvoted && styles.activeUpvote]}
        onPress={() => handleVote('up')}
        disabled={loading}
      >
        <Ionicons name="arrow-up" size={20} color={hasUpvoted ? '#FF6B35' : '#8E8E93'} />
      </TouchableOpacity>
      <Text style={styles.voteCount}>{points}</Text>
      <TouchableOpacity
        style={[styles.voteButton, hasDownvoted && styles.activeDownvote]}
        onPress={() => handleVote('down')}
        disabled={loading}
      >
        <Ionicons name="arrow-down" size={20} color={hasDownvoted ? '#7C3AED' : '#8E8E93'} />
      </TouchableOpacity>
      {loading && <ActivityIndicator size="small" color="#FF6B35" style={{ marginTop: 4 }} />}
    </View>
  );
};

const styles = StyleSheet.create({
  voteBar: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    minWidth: 48,
  },
  voteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    marginVertical: 2,
  },
  activeUpvote: {
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
  },
  activeDownvote: {
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  voteCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginVertical: 2,
    textAlign: 'center',
  },
});

export default QnaVoteBar; 