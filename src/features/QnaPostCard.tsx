import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, useColorScheme } from 'react-native';
import QnaVoteBar from './QnaVoteBar';

interface QnaPostCardProps {
  question: {
    id: string;
    title: string;
    description: string;
    authorId: string;
    authorName?: string;
    isAnonymous: boolean;
    tags: string[];
    timestamp: any;
    points: number;
    answersCount: number;
    viewsCount: number;
    imageUrl?: string;
  };
  upvotes: string[];
  downvotes: string[];
  currentUserId: string;
  onVoteChange: (upvotes: string[], downvotes: string[]) => void;
  onPress: () => void;
  onAuthorPress?: () => void;
  authorProfileImage?: string;
  authorPoints?: number;
}

const QnaPostCard: React.FC<QnaPostCardProps> = ({ question, upvotes, downvotes, currentUserId, onVoteChange, onPress, onAuthorPress, authorProfileImage, authorPoints }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDark && styles.cardDark,
        { flexDirection: 'row', alignItems: 'stretch' }
      ]}
      onPress={onPress}
      activeOpacity={0.95}
    >
      <QnaVoteBar
        questionId={question.id}
        upvotes={upvotes}
        downvotes={downvotes}
        currentUserId={currentUserId}
        onVoteChange={onVoteChange}
      />
      <View style={styles.contentColumn}>
        {/* Author and timestamp */}
        <View style={styles.authorRow}>
          {question.isAnonymous ? (
            <View style={styles.anonymousAuthor}>
              <Text style={[styles.authorText, isDark && styles.textDark]}>Anonymous</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.authorInfo} onPress={onAuthorPress} activeOpacity={0.7}>
              <Image source={{ uri: authorProfileImage || 'https://via.placeholder.com/20' }} style={styles.authorAvatar} />
              <Text style={[styles.authorText, isDark && styles.textDark]}>{question.authorName || 'Unknown User'}</Text>
              {typeof authorPoints === 'number' && (
                <Text style={[styles.authorText, { marginLeft: 8, color: '#FF6B35', fontWeight: 'bold' }]}>• {authorPoints} pts</Text>
              )}
            </TouchableOpacity>
          )}
          <Text style={[styles.timestamp, isDark && styles.textDark]}>{formatTimestamp(question.timestamp)}</Text>
        </View>
        {/* Title */}
        <Text style={[styles.title, isDark && styles.textDark]}>{question.title}</Text>
        {/* Description */}
        <Text style={[styles.description, isDark && styles.textDark]} numberOfLines={2}>{question.description}</Text>
        {/* Image */}
        {question.imageUrl && (
          <Image source={{ uri: question.imageUrl }} style={styles.previewImage} />
        )}
        {/* Tags */}
        <View style={styles.tagsRow}>
          {question.tags.slice(0, 3).map((tag, idx) => (
            <View key={idx} style={[styles.tagChip, isDark && styles.tagChipDark]}>
              <Text style={[styles.tagText, isDark && styles.textDark]}>{tag}</Text>
            </View>
          ))}
          {question.tags.length > 3 && (
            <Text style={[styles.tagText, isDark && styles.textDark]}>+{question.tags.length - 3} more</Text>
          )}
        </View>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statText, isDark && styles.textDark]}>{question.answersCount} answers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statText, isDark && styles.textDark]}>{question.viewsCount} views</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: '#2C2C2E',
  },
  contentColumn: {
    flex: 1,
    marginLeft: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  anonymousAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  authorText: {
    fontSize: 14,
    color: '#6E7B8B',
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    color: '#6E7B8B',
    marginBottom: 12,
    lineHeight: 20,
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tagText: {
    fontSize: 14,
    color: '#6E7B8B',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    color: '#6E7B8B',
    marginLeft: 4,
  },
  textDark: {
    color: '#FFFFFF',
  },
});

export default QnaPostCard; 