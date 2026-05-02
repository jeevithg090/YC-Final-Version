import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  Linking,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// TypeScript interface for Event data
interface Event {
  id: string;
  title: string;
  description: string;
  fullDescription: string;
  date: Date;
  time: string;
  location: string;
  category: 'tech' | 'cultural' | 'sports' | 'literary' | 'social';
  organizer: string;
  organizingClub?: string;
  organizingDepartment?: string;
  imageUrl?: string;
  posterUrl?: string;
  registrationRequired: boolean;
  registrationDeadline?: Date;
  registrationLink?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  contactPerson: {
    name: string;
    phone: string;
    email: string;
  };
  objectives?: string;
  theme?: string;
  rules?: string;
  prizes?: string;
  tags: string[];
  venue: {
    name: string;
    mapUrl?: string;
    address?: string;
  };
  pastEventPhotos?: string[];
  isOnline: boolean;
  meetingLink?: string;
}

interface EventsDetailsProps {
  visible: boolean;
  selectedEvent: Event | null;
  onClose: () => void;
  onShare: (event: Event) => void;
  onRegister: (event: Event) => void;
  onContactPerson: (contactPerson: Event['contactPerson']) => void;
  getCategoryColor: (category: string) => string;
  formatDate: (date: Date) => string;
  categories: Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
  }>;
}

const EventsDetails: React.FC<EventsDetailsProps> = ({
  visible,
  selectedEvent,
  onClose,
  onShare,
  onRegister,
  onContactPerson,
  getCategoryColor,
  formatDate,
  categories,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
    setRetryCount(0);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
    if (selectedEvent) {
      console.error('Failed to load event image:', selectedEvent.posterUrl || selectedEvent.imageUrl);
    }
  };

  const retryImageLoad = () => {
    if (retryCount < 3) {
      setImageLoading(true);
      setImageError(false);
      setRetryCount(prev => prev + 1);
    } else {
      Alert.alert('Image Load Error', 'Unable to load event image after multiple attempts.');
    }
  };

  if (!selectedEvent) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity 
            onPress={onClose}
            style={styles.modalCloseButton}
          >
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Event Details</Text>
          <TouchableOpacity 
            onPress={() => onShare(selectedEvent)}
            style={styles.modalShareButton}
          >
            <Ionicons name="share-outline" size={24} color="#667eea" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Modern Card Design */}
          <View style={styles.modernCard}>
            {/* Event Image */}
            <View style={styles.imageContainer}>
              {imageLoading && !imageError && (
                <ActivityIndicator 
                  size="large" 
                  color="#667eea" 
                  style={styles.imageLoader} 
                />
              )}
              
              {imageError && (
                <View style={styles.imageErrorContainer}>
                  <Ionicons name="image-outline" size={48} color="#999" />
                  <Text style={styles.imageErrorText}>Failed to load image</Text>
                  <TouchableOpacity 
                    style={styles.retryButton} 
                    onPress={retryImageLoad}
                    disabled={retryCount >= 3}
                  >
                    <Text style={styles.retryButtonText}>
                      {retryCount >= 3 ? 'Max retries reached' : 'Retry'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {!imageError && (
                <Image 
                  key={retryCount}
                  source={{ 
                    uri: selectedEvent.posterUrl || selectedEvent.imageUrl || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400'
                  }}
                  style={styles.cardImage}
                  resizeMode="cover"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              )}
              
              {/* Status Badge */}
              <View style={styles.statusBadgeContainer}>
                {selectedEvent.registrationRequired && (
                  <View style={[styles.statusBadge, { 
                    backgroundColor: selectedEvent.maxParticipants && (selectedEvent.currentParticipants || 0) >= selectedEvent.maxParticipants 
                      ? '#ff6b6b' 
                      : '#51cf66' 
                  }]}>
                    <Ionicons 
                      name={selectedEvent.maxParticipants && (selectedEvent.currentParticipants || 0) >= selectedEvent.maxParticipants 
                        ? "close-circle" 
                        : "checkmark-circle"
                      } 
                      size={12} 
                      color="#fff" 
                    />
                    <Text style={styles.statusText}>
                      {selectedEvent.maxParticipants && (selectedEvent.currentParticipants || 0) >= selectedEvent.maxParticipants 
                        ? 'FULL' 
                        : 'OPEN'
                      }
                    </Text>
                  </View>
                )}
                
                <View style={[styles.statusBadge, { backgroundColor: '#667eea' }]}>
                  <Ionicons 
                    name={categories.find(c => c.id === selectedEvent.category)?.icon as any || 'apps'} 
                    size={12} 
                    color="#fff" 
                  />
                  <Text style={styles.statusText}>{selectedEvent.category.toUpperCase()}</Text>
                </View>
              </View>
              
              {/* Gradient Overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.imageGradient}
              />
              
              {/* Card Header Info */}
              <View style={styles.cardHeaderInfo}>
                <Text style={styles.cardTitle}>{selectedEvent.title}</Text>
                <Text style={styles.cardSubtitle}>{selectedEvent.description}</Text>
                
                <View style={styles.cardDetailsRow}>
                  <View style={styles.cardDetailItem}>
                    <Ionicons name="location" size={16} color="#fff" />
                    <Text style={styles.cardDetailText}>{selectedEvent.venue.name}</Text>
                  </View>
                  
                  <View style={styles.cardDetailItem}>
                    <Ionicons name="calendar" size={16} color="#fff" />
                    <Text style={styles.cardDetailText}>{formatDate(selectedEvent.date)}</Text>
                  </View>
                  
                  <View style={styles.cardDetailItem}>
                    <Ionicons name="bookmark" size={16} color="#fff" />
                    <Text style={styles.cardDetailText}>{selectedEvent.category}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.detailContent}>

            {/* Info Grid */}
            <View style={styles.detailInfoGrid}>
              {/* Date & Time */}
              <View style={styles.detailInfoCard}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="calendar-outline" size={20} color="#667eea" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.detailInfoLabel}>Date & Time</Text>
                  <Text style={styles.detailInfoValue}>
                    {formatDate(selectedEvent.date)}
                  </Text>
                  <Text style={styles.detailInfoSubValue}>{selectedEvent.time}</Text>
                </View>
              </View>

              {/* Venue */}
              <View style={styles.detailInfoCard}>
                <View style={styles.infoIconContainer}>
                  <Ionicons 
                    name={selectedEvent.isOnline ? "videocam" : "location"} 
                    size={20} 
                    color="#667eea" 
                  />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.detailInfoLabel}>
                    {selectedEvent.isOnline ? 'Platform' : 'Venue'}
                  </Text>
                  <Text style={styles.detailInfoValue}>{selectedEvent.venue.name}</Text>
                  {selectedEvent.venue.address && (
                    <Text style={styles.detailInfoSubValue}>{selectedEvent.venue.address}</Text>
                  )}
                </View>
              </View>

              {/* Organizer */}
              <View style={styles.detailInfoCard}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="people" size={20} color="#667eea" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.detailInfoLabel}>Organizer</Text>
                  <Text style={styles.detailInfoValue}>
                    {selectedEvent.organizingClub || selectedEvent.organizer}
                  </Text>
                  {selectedEvent.organizingDepartment && (
                    <Text style={styles.detailInfoSubValue}>{selectedEvent.organizingDepartment}</Text>
                  )}
                </View>
              </View>

              {/* Contact */}
              <View style={styles.detailInfoCard}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="person-circle" size={20} color="#667eea" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.detailInfoLabel}>Contact</Text>
                  <TouchableOpacity onPress={() => onContactPerson(selectedEvent.contactPerson)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.detailInfoValue, styles.contactLink]}>
                      {selectedEvent.contactPerson.name}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={styles.detailInfoSubValue}>{selectedEvent.contactPerson.phone}</Text>
                    <TouchableOpacity
                      style={{ marginLeft: 8 }}
                      onPress={() => {
                        const phone = selectedEvent.contactPerson.phone.replace(/[^\d]/g, '');
                        const url = `https://wa.me/${phone}`;
                        Linking.openURL(url);
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Tags Section */}
            {selectedEvent.tags.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Tags</Text>
                <View style={styles.detailTagsContainer}>
                  {selectedEvent.tags.map((tag, index) => (
                    <View key={index} style={styles.detailTag}>
                      <Text style={styles.detailTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Description */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Description</Text>
              <Text style={styles.detailDescription}>
                {selectedEvent.fullDescription || selectedEvent.description}
              </Text>
            </View>

            {/* Objectives */}
            {selectedEvent.objectives && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Objectives</Text>
                <Text style={styles.detailDescription}>{selectedEvent.objectives}</Text>
              </View>
            )}

            {/* Rules & Guidelines */}
            {selectedEvent.rules && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Rules & Guidelines</Text>
                <Text style={styles.detailDescription}>{selectedEvent.rules}</Text>
              </View>
            )}

            {/* Prizes & Perks */}
            {selectedEvent.prizes && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Prizes & Perks</Text>
                <Text style={styles.detailDescription}>{selectedEvent.prizes}</Text>
              </View>
            )}

            {/* Registration Details */}
            {selectedEvent.registrationRequired && (
              <View style={styles.detailRegistrationCard}>
                <View style={styles.registrationHeader}>
                  <Ionicons name="clipboard-outline" size={20} color="#10b981" />
                  <Text style={styles.detailRegistrationTitle}>Registration Details</Text>
                </View>
                {selectedEvent.registrationDeadline && (
                  <Text style={styles.detailRegistrationDeadline}>
                    Deadline: {formatDate(selectedEvent.registrationDeadline)}
                  </Text>
                )}
                {selectedEvent.maxParticipants && (
                  <Text style={styles.detailRegistrationParticipants}>
                    {selectedEvent.currentParticipants || 0}/{selectedEvent.maxParticipants} registered
                  </Text>
                )}
              </View>
            )}

            {/* Past Event Gallery */}
            {selectedEvent.pastEventPhotos && selectedEvent.pastEventPhotos.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Past Event Gallery</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryContainer}>
                  {selectedEvent.pastEventPhotos.map((photo, index) => (
                    <Image 
                      key={index}
                      source={{ uri: photo }}
                      style={styles.pastEventPhoto}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.modalFooter}>
          {selectedEvent.registrationRequired && (
            <TouchableOpacity 
              style={[
                styles.modalActionButton, 
                styles.registerModalButton,
                (selectedEvent.maxParticipants && (selectedEvent.currentParticipants || 0) >= selectedEvent.maxParticipants) ? styles.disabledButton : null
              ]}
              onPress={() => onRegister(selectedEvent)}
              disabled={selectedEvent.maxParticipants ? (selectedEvent.currentParticipants || 0) >= selectedEvent.maxParticipants : false}
            >
              <Ionicons name="person-add" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.registerModalButtonText}>
                Register Now
              </Text>
            </TouchableOpacity>
          )}

          {selectedEvent.venue.mapUrl && (
            <TouchableOpacity 
              style={[styles.modalActionButton, styles.mapButton]}
              onPress={() => Linking.openURL(selectedEvent.venue.mapUrl!)}
            >
              <Ionicons name="map-outline" size={16} color="#10b981" style={{ marginRight: 8 }} />
              <Text style={styles.mapButtonText}>View on Map</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Add zIndex to ensure modal content stays on top
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    zIndex: 1  // Add this line
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  modalShareButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    zIndex: 1  // Add this line
  },
  detailPosterImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#e9ecef',
  },
  detailContent: {
    backgroundColor: '#fff',
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  detailHeader: {
    marginBottom: 24,
  },
  detailCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  detailCategoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    lineHeight: 32,
  },
  detailTheme: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  detailInfoGrid: {
    marginBottom: 24,
  },
  detailInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  detailInfoLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailInfoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailInfoSubValue: {
    fontSize: 14,
    color: '#666',
  },
  contactLink: {
    color: '#667eea',
    textDecorationLine: 'underline',
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  detailTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailTag: {
    backgroundColor: '#e3f2fd',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  detailTagText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  detailDescription: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  detailRegistrationCard: {
    backgroundColor: '#f1f8e9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  registrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailRegistrationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginLeft: 8,
  },
  detailRegistrationDeadline: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  detailRegistrationParticipants: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  galleryContainer: {
    marginTop: 8,
  },
  pastEventPhoto: {
    width: 120,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#e9ecef',
  },
  modalFooter: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  registerModalButton: {
    backgroundColor: '#10b981',
  },
  disabledButton: {
    backgroundColor: '#e9ecef',
  },
  registerModalButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  mapButton: {
    backgroundColor: '#f8f9fa',
    borderColor: '#10b981',
    borderWidth: 1.5,
  },
  mapButtonText: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  modernCard: {
    margin: 20,
    marginTop: 0,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  imageContainer: {
    position: 'relative',
    height: 300,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1,
  },
  statusBadgeContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ff6b6b',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  cardHeaderInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
    lineHeight: 22,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardDetailText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  imageErrorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  imageErrorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EventsDetails;
