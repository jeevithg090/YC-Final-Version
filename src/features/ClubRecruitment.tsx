import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Linking,
  Platform,
  Dimensions,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import {
  getFirestore,
  collection,
  query,
  getDocs,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  getDownloadURL,
} from 'firebase/storage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from '../navigation/router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Define TypeScript interfaces for data
interface ClubRecruitment {
  id?: string;
  clubName?: string;
  domains?: string[];
  responsibilities?: string[];
  deadline?: string;
  applyUrl?: string;
  imageUrl?: string;
  imageLoaded?: boolean;
  role?: string;
  requirements?: string[];
  aboutClub?: string;
  accomplishments?: string[];
  perks?: string[];
  contactPerson?: {
    name: string;
    email: string;
    phone?: string;
  };
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ClubRecruitmentNavigationProp = StackNavigationProp<RootStackParamList>;

const ClubRecruitment: React.FC = () => {
  const navigation = useNavigation<ClubRecruitmentNavigationProp>();
  const [recruitments, setRecruitments] = useState<ClubRecruitment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedClub, setSelectedClub] = useState<ClubRecruitment | null>(null);
  const [detailsVisible, setDetailsVisible] = useState<boolean>(false);
  const insets = useSafeAreaInsets();
  
  // Firestore and Storage
  const db = getFirestore();
  const storage = getStorage();
  
  const loadRecruitments = async () => {
    try {
      setLoading(true);
      console.log('Loading recruitment data...');
      
      // Get recruitment data from Firestore
      const recruitmentRef = collection(db, 'club_recruitment');
      const q = query(recruitmentRef, orderBy('deadline', 'asc'));
      
      // Add a timeout for the Firebase query
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.error('Firestore query timed out');
        setLoading(false);
        alert('Failed to load data. Please check your internet connection and try again.');
      }, 15000);
      
      const querySnapshot = await getDocs(q);
      clearTimeout(timeoutId);
      
      console.log('Received data from Firestore');
      const recruitmentData: ClubRecruitment[] = [];
      const loadImagePromises: Promise<void>[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<ClubRecruitment, 'id'>;
        const recruitment: ClubRecruitment = {
          id: doc.id,
          clubName: data.clubName,
          domains: data.domains || [],
          responsibilities: data.responsibilities || [],
          deadline: data.deadline,
          applyUrl: data.applyUrl,
          role: data.role || '',
          requirements: data.requirements || [],
          aboutClub: data.aboutClub || '',
          accomplishments: data.accomplishments || [],
          perks: data.perks || [],
          contactPerson: data.contactPerson || { name: '', email: '' },
          imageLoaded: false
        };
        
        recruitmentData.push(recruitment);
        
        // Load club image from Firebase Storage
        if (doc.id) {
          const imageLoadPromise = (async () => {
            try {
              const imageRef = storageRef(storage, `club_images/${doc.id}`);
              const url = await getDownloadURL(imageRef);
              
              // Update recruitment with image URL
              const index = recruitmentData.findIndex((r) => r.id === doc.id);
              if (index !== -1) {
                recruitmentData[index] = {
                  ...recruitmentData[index],
                  imageUrl: url,
                  imageLoaded: true
                };
              }
            } catch (error) {
              console.error(`Failed to load image for ${doc.id}:`, error);
              // Use default image if club image not found
              const index = recruitmentData.findIndex((r) => r.id === doc.id);
              if (index !== -1) {
                recruitmentData[index] = {
                  ...recruitmentData[index],
                  imageUrl: 'https://via.placeholder.com/400x200?text=Club+Image',
                  imageLoaded: true
                };
              }
            }
          })();
          
          loadImagePromises.push(imageLoadPromise);
        }
      });
      
      // Wait for all images to load or fail, with timeout
      try {
        const timeoutId = setTimeout(() => {
          console.warn('Image loading timed out, proceeding with partial data');
          setRecruitments(recruitmentData);
          setLoading(false);
        }, 10000);
        
        await Promise.all(loadImagePromises);
        clearTimeout(timeoutId);
        
        console.log('All images loaded successfully');
      } catch (imageError) {
        console.warn('Some images failed to load:', imageError);
      } finally {
        setRecruitments(recruitmentData);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading club recruitment data:', error);
      setLoading(false);
      alert('Failed to load recruitment data. Please check your internet connection and try again.');
    }
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecruitments();
    setRefreshing(false);
  };
  
  // Load recruitment data on component mount
  useEffect(() => {
    loadRecruitments();
  }, []);
  
  // View detailed information for a club
  const viewClubDetails = async (clubId: string) => {
    try {
      console.log('Loading details for club:', clubId);
      const loadingToast = Platform.OS === 'android' ? 
        alert('Loading club details...') : 
        undefined;
        
      const clubDocRef = doc(db, 'club_recruitment', clubId);
      
      // Add a timeout for the Firestore getDoc operation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        throw new Error('Club details request timed out');
      }, 8000);
      
      const clubDoc = await getDoc(clubDocRef);
      clearTimeout(timeoutId);
      
      if (clubDoc.exists()) {
        console.log('Club details fetched successfully');
        const data = clubDoc.data() as Omit<ClubRecruitment, 'id'>;
        const clubDetails: ClubRecruitment = {
          id: clubDoc.id,
          clubName: data.clubName,
          domains: data.domains || [],
          responsibilities: data.responsibilities || [],
          deadline: data.deadline,
          applyUrl: data.applyUrl,
          role: data.role || '',
          requirements: data.requirements || [],
          aboutClub: data.aboutClub || '',
          accomplishments: data.accomplishments || [],
          perks: data.perks || [],
          contactPerson: data.contactPerson || { name: '', email: '' },
          imageLoaded: false
        };
        
        // Get club image with timeout
        const imageTimeoutId = setTimeout(() => {
          console.log('Image loading timed out, using placeholder');
          clubDetails.imageUrl = 'https://via.placeholder.com/400x200?text=Club+Image';
          clubDetails.imageLoaded = true;
          setSelectedClub(clubDetails);
          setDetailsVisible(true);
        }, 5000);
        
        try {
          const imageRef = storageRef(storage, `club_images/${clubId}`);
          const url = await getDownloadURL(imageRef);
          clearTimeout(imageTimeoutId);
          clubDetails.imageUrl = url;
          clubDetails.imageLoaded = true;
          console.log('Club image loaded successfully');
        } catch (error) {
          clearTimeout(imageTimeoutId);
          console.error(`Failed to load detailed image for ${clubId}:`, error);
          clubDetails.imageUrl = 'https://via.placeholder.com/400x200?text=Club+Image';
          clubDetails.imageLoaded = true;
        }
        
        setSelectedClub(clubDetails);
        setDetailsVisible(true);
      } else {
        console.log('Club document does not exist');
        alert('Could not find details for this club. Please try again.');
      }
    } catch (error) {
      console.error('Error loading club details:', error);
      alert('Failed to load club details. Please try again later.');
    }
  };
  
  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'No date specified';
    
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };
  
  // Check if deadline has passed
  const isDeadlinePassed = (dateString?: string): boolean => {
    if (!dateString) return false;
    const deadline = new Date(dateString);
    const today = new Date();
    return deadline < today;
  };
  
  // Render a recruitment card
  const renderRecruitmentCard = ({ item }: { item: ClubRecruitment }) => {
    const deadlinePassed = isDeadlinePassed(item.deadline);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          pressed && { transform: [{ scale: 0.98 }], shadowOpacity: 0.18 },
        ]}
        accessibilityLabel={`View details for ${item.clubName}`}
        onPress={() => item.id && viewClubDetails(item.id)}
        android_ripple={{ color: '#e5e5e5' }}
      >
        {/* Club Image with Gradient Overlay */}
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.clubImage}
              resizeMode="cover"
              accessibilityLabel={`${item.clubName} image`}
            />
          ) : (
            <View style={[styles.clubImage, styles.imagePlaceholder]}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.imageOverlay}
          />
          <Text style={styles.clubName}>{item.clubName || 'Unnamed Club'}</Text>
        </View>
        {/* Recruitment Info */}
        <View style={styles.cardContent}>
          {/* Domains */}
          <View style={styles.infoSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="briefcase-outline" size={18} color="#7d7cf9" />
              <Text style={styles.sectionTitle}>Domains Open</Text>
            </View>
            <View style={styles.tagsContainer}>
              {item.domains && item.domains.length > 0 ? (
                item.domains.map((domain, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{domain}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>General</Text>
                </View>
              )}
            </View>
          </View>
          {/* Key Responsibilities */}
          <View style={styles.infoSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list-outline" size={18} color="#7d7cf9" />
              <Text style={styles.sectionTitle}>Key Responsibilities</Text>
            </View>
            {item.responsibilities && item.responsibilities.length > 0 ? (
              <>
                {item.responsibilities.slice(0, 2).map((resp, index) => (
                  <Text key={index} style={styles.responsibilityText}>
                    • {resp}
                  </Text>
                ))}
                {item.responsibilities.length > 2 && (
                  <Text style={styles.moreText}>+ {item.responsibilities.length - 2} more</Text>
                )}
              </>
            ) : (
              <Text style={styles.responsibilityText}>
                • No specific responsibilities listed
              </Text>
            )}
          </View>
          {/* Deadline */}
          <View style={styles.infoSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={18} color={deadlinePassed ? "#ff3b30" : "#7d7cf9"} />
              <Text style={[styles.sectionTitle, deadlinePassed && styles.deadlinePassed]}>
                Application Deadline
              </Text>
            </View>
            <Text style={[styles.deadlineText, deadlinePassed && styles.deadlinePassed]}>
              {formatDate(item.deadline)} {deadlinePassed && ' (Closed)'}
            </Text>
          </View>
          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.viewButton]}
              onPress={() => item.id && viewClubDetails(item.id)}
              disabled={!item.id}
              accessibilityLabel={`View details for ${item.clubName}`}
            >
              <Ionicons name="eye-outline" size={16} color="#7d7cf9" style={{ marginRight: 6 }} />
              <Text style={styles.viewButtonText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.applyButton, (deadlinePassed || !item.applyUrl) && styles.disabledButton]}
              onPress={() => {
                if (!deadlinePassed && item.applyUrl) {
                  try {
                    Linking.openURL(item.applyUrl);
                  } catch (error) {
                    console.error('Error opening URL:', error);
                    alert('Could not open application URL. Please try again later.');
                  }
                }
              }}
              disabled={deadlinePassed || !item.applyUrl}
              accessibilityLabel={deadlinePassed ? 'Applications closed' : 'Apply now'}
            >
              <Ionicons name="open-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={[styles.applyButtonText, (deadlinePassed || !item.applyUrl) && styles.disabledButtonText]}>
                {deadlinePassed ? 'Closed' : 'Apply Now'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    );
  };
  
  // Club Details Modal
  const renderDetailsModal = () => {
    if (!selectedClub) return null;
    const deadlinePassed = isDeadlinePassed(selectedClub.deadline);
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={detailsVisible}
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}> {/* Safe area */}
          <ScrollView
            style={styles.detailsContainer}
            contentContainerStyle={styles.detailsContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Image with overlayed club name and close button */}
            <View style={styles.detailsImageContainer}>
              {selectedClub.imageUrl ? (
                <Image
                  source={{ uri: selectedClub.imageUrl }}
                  style={styles.detailsImage}
                  resizeMode="cover"
                  accessibilityLabel={`${selectedClub.clubName} image`}
                />
              ) : (
                <View style={[styles.detailsImage, styles.imagePlaceholder]}>
                  <ActivityIndicator color="#fff" size="large" />
                </View>
              )}
              {/* Gradient overlay for text readability */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.detailsImageOverlay}
              />
              {/* Club name at bottom-left of image */}
              <View style={styles.clubDetailsTitleContainer}>
                <Text style={styles.detailsClubName}>{selectedClub.clubName}</Text>
                {selectedClub.role && (
                  <Text style={styles.detailsRole}>{selectedClub.role}</Text>
                )}
              </View>
              {/* Close button at top-right, floating over image */}
              <TouchableOpacity
                style={[styles.closeButton, { top: insets.top + 12, right: 20, backgroundColor: 'rgba(0,0,0,0.4)' }]}
                onPress={() => setDetailsVisible(false)}
                accessibilityLabel="Close details"
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            {/* Content */}
            <View style={styles.detailsContent}>
              {/* Domains */}
              <View style={styles.detailsSection}>
                <View style={styles.detailsSectionHeader}>
                  <Ionicons name="briefcase-outline" size={20} color="#5856d6" />
                  <Text style={styles.detailsSectionTitle}>Domains</Text>
                </View>
                <View style={styles.detailsTagsContainer}>
                  {selectedClub.domains && selectedClub.domains.length > 0 ? (
                    selectedClub.domains.map((domain, index) => (
                      <View key={index} style={styles.detailsTag}>
                        <Text style={styles.detailsTagText}>{domain}</Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.detailsTag}>
                      <Text style={styles.detailsTagText}>General</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {/* Requirements */}
              {selectedClub.requirements && selectedClub.requirements.length > 0 && (
                <View style={styles.detailsSection}>
                  <View style={styles.detailsSectionHeader}>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#5856d6" />
                    <Text style={styles.detailsSectionTitle}>Requirements</Text>
                  </View>
                  {selectedClub.requirements.map((req, index) => (
                    <Text key={index} style={styles.detailsListItem}>• {req}</Text>
                  ))}
                </View>
              )}
              
              {/* Responsibilities */}
              <View style={styles.detailsSection}>
                <View style={styles.detailsSectionHeader}>
                  <Ionicons name="list-outline" size={20} color="#5856d6" />
                  <Text style={styles.detailsSectionTitle}>Responsibilities</Text>
                </View>
                {selectedClub.responsibilities && selectedClub.responsibilities.length > 0 ? (
                  selectedClub.responsibilities.map((resp, index) => (
                    <Text key={index} style={styles.detailsListItem}>• {resp}</Text>
                  ))
                ) : (
                  <Text style={styles.detailsListItem}>• No specific responsibilities listed</Text>
                )}
              </View>
              
              {/* Application Deadline */}
              <View style={styles.detailsSection}>
                <View style={styles.detailsSectionHeader}>
                  <Ionicons 
                    name="calendar-outline" 
                    size={20} 
                    color={deadlinePassed ? "#ff3b30" : "#5856d6"} 
                  />
                  <Text style={styles.detailsSectionTitle}>Application Deadline</Text>
                </View>
                <Text style={[styles.detailsText, deadlinePassed && styles.deadlinePassed]}>
                  {formatDate(selectedClub.deadline)} {deadlinePassed && ' (Closed)'}
                </Text>
              </View>
              
              {/* About Club */}
              {selectedClub.aboutClub && (
                <View style={styles.detailsSection}>
                  <View style={styles.detailsSectionHeader}>
                    <Ionicons name="information-circle-outline" size={20} color="#5856d6" />
                    <Text style={styles.detailsSectionTitle}>About Club</Text>
                  </View>
                  <Text style={styles.detailsText}>{selectedClub.aboutClub}</Text>
                </View>
              )}
              
              {/* Accomplishments */}
              {selectedClub.accomplishments && selectedClub.accomplishments.length > 0 && (
                <View style={styles.detailsSection}>
                  <View style={styles.detailsSectionHeader}>
                    <Ionicons name="trophy-outline" size={20} color="#5856d6" />
                    <Text style={styles.detailsSectionTitle}>Accomplishments</Text>
                  </View>
                  {selectedClub.accomplishments.map((accomplishment, index) => (
                    <Text key={index} style={styles.detailsListItem}>• {accomplishment}</Text>
                  ))}
                </View>
              )}
              
              {/* Perks */}
              {selectedClub.perks && selectedClub.perks.length > 0 && (
                <View style={styles.detailsSection}>
                  <View style={styles.detailsSectionHeader}>
                    <Ionicons name="gift-outline" size={20} color="#5856d6" />
                    <Text style={styles.detailsSectionTitle}>Perks</Text>
                  </View>
                  {selectedClub.perks.map((perk, index) => (
                    <Text key={index} style={styles.detailsListItem}>• {perk}</Text>
                  ))}
                </View>
              )}
              
              {/* Contact Person */}
              {selectedClub.contactPerson && (
                <View style={styles.detailsSection}>
                  <View style={styles.detailsSectionHeader}>
                    <Ionicons name="person-outline" size={20} color="#5856d6" />
                    <Text style={styles.detailsSectionTitle}>Contact Person</Text>
                  </View>
                  <Text style={styles.detailsText}>
                    {selectedClub.contactPerson.name}
                  </Text>
                  {selectedClub.contactPerson.email && (
                    <TouchableOpacity 
                      onPress={() => Linking.openURL(`mailto:${selectedClub.contactPerson?.email}`)}
                      style={styles.contactButton}
                    >
                      <Ionicons name="mail-outline" size={16} color="#5856d6" />
                      <Text style={styles.contactButtonText}>
                        {selectedClub.contactPerson.email}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {selectedClub.contactPerson.phone && (
                    <TouchableOpacity 
                      onPress={() => Linking.openURL(`tel:${selectedClub.contactPerson?.phone}`)}
                      style={styles.contactButton}
                    >
                      <Ionicons name="call-outline" size={16} color="#5856d6" />
                      <Text style={styles.contactButtonText}>
                        {selectedClub.contactPerson.phone}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            
            {/* Apply Button (Fixed at bottom) */}
            <View style={styles.detailsButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.detailsButton, 
                  (deadlinePassed || !selectedClub.applyUrl) && styles.disabledButton
                ]}
                onPress={() => {
                  if (!deadlinePassed && selectedClub.applyUrl) {
                    try {
                      console.log('Opening URL:', selectedClub.applyUrl);
                      Linking.openURL(selectedClub.applyUrl)
                        .catch(error => {
                          console.error('Failed to open URL:', error);
                          alert('Could not open application URL. Please try again later.');
                        });
                    } catch (error) {
                      console.error('Error processing URL:', error);
                      alert('Could not process application URL. Please try again later.');
                    }
                  }
                }}
                disabled={deadlinePassed || !selectedClub.applyUrl}
                accessibilityLabel={deadlinePassed ? 'Applications closed' : 'Apply now'}
              >
                <Ionicons name="open-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.detailsButtonText}>
                  {deadlinePassed ? 'Applications Closed' : selectedClub.applyUrl ? 'Apply Now' : 'No Application Link'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <LinearGradient
        colors={['#7d7cf9', '#5856d6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Club Recruitment</Text>
        <View style={styles.headerRight} />
      </LinearGradient>
      
      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7d7cf9" />
          <Text style={styles.loadingText}>Loading club recruitments...</Text>
        </View>
      ) : recruitments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Could not load recruitment data</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={onRefresh}
            accessibilityLabel="Retry loading"
          >
            <Text style={styles.retryButtonText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={recruitments}
          renderItem={renderRecruitmentCard}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7d7cf9"
              colors={['#7d7cf9']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No club recruitments available</Text>
              <Text style={styles.emptySubText}>
                Check back later for new opportunities
              </Text>
            </View>
          }
          initialNumToRender={5}
          windowSize={7}
        />
      )}
      
      {/* Details Modal */}
      {renderDetailsModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
  },
  headerRight: {
    width: 40,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#5856d6',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#7d7cf9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: Platform.OS === 'ios' ? 0 : 1,
    borderColor: Platform.OS === 'ios' ? 'transparent' : '#eee',
  },
  imageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  clubImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: '#5856d6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  clubName: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardContent: {
    padding: 16,
  },
  infoSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tag: {
    backgroundColor: '#f0effe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#5856d6',
    fontWeight: '500',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  responsibilityText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  moreText: {
    fontSize: 12,
    color: '#5856d6',
    fontWeight: '500',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  deadlineText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  deadlinePassed: {
    color: '#ff3b30',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    marginHorizontal: 2,
  },
  viewButton: {
    backgroundColor: '#f0effe',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#7d7cf9',
  },
  viewButtonText: {
    color: '#7d7cf9',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  applyButton: {
    backgroundColor: '#7d7cf9',
    marginLeft: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  disabledButton: {
    backgroundColor: '#e5e5e5',
  },
  disabledButtonText: {
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  retryButton: {
    backgroundColor: '#5856d6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  detailsContent: {
    paddingBottom: 80,
  },
  detailsImageContainer: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  detailsImage: {
    width: '100%',
    height: '100%',
  },
  detailsImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  clubDetailsTitleContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
  },
  detailsClubName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Inter',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  detailsRole: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  closeButton: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  detailsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  detailsTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailsTag: {
    backgroundColor: '#f0effe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  detailsTagText: {
    color: '#5856d6',
    fontWeight: '500',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  detailsText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  detailsListItem: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
  },
  contactButtonText: {
    marginLeft: 8,
    color: '#5856d6',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
  detailsButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  detailsButton: {
    backgroundColor: '#5856d6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Inter',
  },
});

export default ClubRecruitment;
