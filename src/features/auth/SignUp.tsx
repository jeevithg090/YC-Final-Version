import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Image,
  Switch,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/router';
import { auth } from '../../services/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Picker } from '@react-native-picker/picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { setDoc, doc } from 'firebase/firestore'; // Add this import
import { db } from '../../services/firebase'; // Add this import
import { LinearGradient } from 'expo-linear-gradient';
import { getUserPoints } from '../../services/pointsService';

type SignUpNavigationProp = StackNavigationProp<RootStackParamList>;

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  userName: string;
  mobileNumber: string;
  collegeName: string;
  branch: string;
  acceptedTerms: boolean;
}

type FormErrorsBase = {
  [K in keyof FormState]?: string;
};

interface FormErrors extends FormErrorsBase {}


const { width } = Dimensions.get('window');

const SignUp: React.FC = () => {
  const navigation = useNavigation<SignUpNavigationProp>();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userName: '',
    mobileNumber: '+91',
    collegeName: '',
    branch: '',
    acceptedTerms: false,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState<number>(1);
  const [customBranch, setCustomBranch] = useState('');
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [collegeSuggestions, setCollegeSuggestions] = useState<string[]>([]);
  const [showCollegeSuggestions, setShowCollegeSuggestions] = useState(false);
  const collegeInputRef = useRef(null);
  const collegeDebounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const branchOptions = [
    'Computer Science and Engineering (CSE)',
    'Electronics and Communication Engineering (ECE)',
    'Mechanical Engineering (ME)',
    'Electrical and Electronics Engineering (EEE)',
    'Civil Engineering (CE)',
    'Information Technology (IT)',
    'Artificial Intelligence and Machine Learning (AI & ML)',
    'Data Science and Engineering',
    'Electronics and Instrumentation Engineering',
    'Chemical Engineering',
    'Aerospace Engineering',
    'Biomedical Engineering',
    'Biotechnology',
    'Environmental Engineering',
    'Mechatronics Engineering',
    'Industrial Engineering',
    'Automobile Engineering',
    'Mining Engineering',
    'Petroleum Engineering',
    'Marine Engineering',
    'Textile Engineering',
    'Agricultural Engineering',
    'Food Technology',
    'Metallurgical Engineering',
    'Robotics and Automation Engineering',
    'Other',
  ];

  const topCollegeRecommendations = [
    'Manipal Institute of Technology Manipal (MIT)',
    'Manipal Institute of Technology Bangalore (MIT B)',
    'Kasturba Medical College, Manipal (KMC)'
  ];

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.name) newErrors.name = 'Name is required';
    if (!form.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Email is invalid';
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!form.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.userName) newErrors.userName = 'User Name is required';
    if (!form.mobileNumber || form.mobileNumber.length !== 13) newErrors.mobileNumber = 'Please enter a valid 10-digit mobile number';
    if (!form.collegeName) newErrors.collegeName = 'College Name is required';
    if (!form.branch) newErrors.branch = 'Branch is required';
    if (form.branch === 'Other' && !customBranch) newErrors.branch = 'Please enter your branch';
    if (!form.acceptedTerms) newErrors.acceptedTerms = 'You must accept the Terms and Conditions';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handlePrevious = () => {
    setStep(1);
  };

  const handleSignUp = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    try {
      // Firebase Auth sign up
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      // Optionally update displayName
      if (auth.currentUser && form.name) {
        await updateProfile(auth.currentUser, { displayName: form.name });
      }
      // Save user profile to Firestore
      const branchToSave = form.branch === 'Other' ? customBranch : form.branch;
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), {
        name: form.name,
        userName: form.userName,
        mobileNumber: form.mobileNumber,
        college: form.collegeName,
        branch: branchToSave,
        email: form.email,
        accountCreatedOn: new Date().toISOString(),
      });
      await getUserPoints(); // Ensures user points doc is initialized
      Alert.alert(
        'Registration Successful',
        'Sign up successful! You can now use your account.',
        [{ text: 'OK', onPress: () => navigation.navigate('Dashboard') }]
      );
    } catch (error: any) {
      let message = 'Sign up failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') message = 'Email is already in use.';
      else if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
      else if (error.code === 'auth/weak-password') message = 'Password is too weak.';
      Alert.alert('Sign Up Error', message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollegeSuggestions = async (keyword: string) => {
    if (!keyword || keyword.length < 2) {
      setCollegeSuggestions([]);
      return;
    }
    try {
      const response = await fetch('https://colleges-api-india.fly.dev/colleges/search', {
        method: 'POST',
        headers: {
          'Keyword': keyword,
        },
      });
      const data = await response.json();
      // API returns array of arrays, college name is at index 2
      const suggestions = Array.isArray(data)
        ? data.map((item: any) => (Array.isArray(item) ? item[2]?.trim() : null)).filter(Boolean)
        : [];
      setCollegeSuggestions(suggestions);
    } catch (e) {
      setCollegeSuggestions([]);
    }
  };

  useEffect(() => {
    return () => {
      if (collegeDebounceTimeout.current) clearTimeout(collegeDebounceTimeout.current);
    };
  }, []);

  return (
    <LinearGradient
      colors={["#f5f7fa", "#c3cfe2"]}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/images/YOGOCampus.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Sign up to get started</Text>
            </View>
            <View style={styles.form}>
              {step === 1 ? (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Name</Text>
                    <View style={[styles.inputWrapper, errors.name ? styles.inputWrapperError : null]}>
                      <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your name"
                        placeholderTextColor="#999"
                        value={form.name}
                        onChangeText={(text) => {
                          setForm({ ...form, name: text });
                          if (errors.name) setErrors({ ...errors, name: undefined });
                        }}
                        autoCapitalize="words"
                      />
                    </View>
                    {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Email</Text>
                    <View style={[styles.inputWrapper, errors.email ? styles.inputWrapperError : null]}>
                      <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor="#999"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={form.email}
                        onChangeText={(text) => {
                          setForm({ ...form, email: text });
                          if (errors.email) setErrors({ ...errors, email: undefined });
                        }}
                      />
                    </View>
                    {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Password</Text>
                    <View style={[styles.inputWrapper, errors.password ? styles.inputWrapperError : null]}>
                      <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Create a password"
                        placeholderTextColor="#999"
                        secureTextEntry
                        value={form.password}
                        onChangeText={(text) => {
                          setForm({ ...form, password: text });
                          if (errors.password) setErrors({ ...errors, password: undefined });
                        }}
                      />
                    </View>
                    {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <View style={[styles.inputWrapper, errors.confirmPassword ? styles.inputWrapperError : null]}>
                      <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Confirm your password"
                        placeholderTextColor="#999"
                        secureTextEntry
                        value={form.confirmPassword}
                        onChangeText={(text) => {
                          setForm({ ...form, confirmPassword: text });
                          if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                        }}
                      />
                    </View>
                    {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleNext}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#4e54c8', '#8f94fb']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.buttonText}>Next</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>User Name</Text>
                    <View style={[styles.inputWrapper, errors.userName ? styles.inputWrapperError : null]}>
                      <Ionicons name="person-circle-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter a user name"
                        placeholderTextColor="#999"
                        value={form.userName}
                        onChangeText={(text) => {
                          setForm({ ...form, userName: text });
                          if (errors.userName) setErrors({ ...errors, userName: undefined });
                        }}
                        autoCapitalize="none"
                      />
                    </View>
                    {errors.userName ? <Text style={styles.errorText}>{errors.userName}</Text> : null}
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Mobile Number</Text>
                    <View style={[styles.inputWrapper, errors.mobileNumber ? styles.inputWrapperError : null]}>
                      <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your mobile number"
                        placeholderTextColor="#999"
                        value={form.mobileNumber}
                        onChangeText={(text) => {
                          if (text.startsWith('+91')) {
                            setForm({ ...form, mobileNumber: text });
                          } else if (text.length <= 10) {
                            setForm({ ...form, mobileNumber: '+91' + text.replace(/\D/g, '') });
                          }
                          if (errors.mobileNumber) setErrors({ ...errors, mobileNumber: undefined });
                        }}
                        keyboardType="phone-pad"
                        maxLength={13}
                      />
                    </View>
                    {errors.mobileNumber ? <Text style={styles.errorText}>{errors.mobileNumber}</Text> : null}
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>College Name</Text>
                    <View style={[styles.inputWrapper, errors.collegeName ? styles.inputWrapperError : null]}>
                      <Ionicons name="school-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your college name"
                        placeholderTextColor="#999"
                        value={form.collegeName}
                        onChangeText={(text) => {
                          setForm({ ...form, collegeName: text });
                          if (errors.collegeName) setErrors({ ...errors, collegeName: undefined });
                        }}
                        autoCapitalize="words"
                      />
                    </View>
                    {errors.collegeName ? <Text style={styles.errorText}>{errors.collegeName}</Text> : null}
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Branch</Text>
                    <View style={[styles.inputWrapper, errors.branch ? styles.inputWrapperError : null]}>
                      <Ionicons name="briefcase-outline" size={20} color="#666" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your branch"
                        placeholderTextColor="#999"
                        value={form.branch === 'Other' ? customBranch : form.branch}
                        onChangeText={(text) => {
                          if (form.branch === 'Other') setCustomBranch(text);
                          else setForm({ ...form, branch: text });
                          if (errors.branch) setErrors({ ...errors, branch: undefined });
                        }}
                        autoCapitalize="words"
                      />
                    </View>
                    {errors.branch ? <Text style={styles.errorText}>{errors.branch}</Text> : null}
                    <Modal
                      visible={branchModalVisible}
                      transparent
                      animationType="slide"
                      onRequestClose={() => setBranchModalVisible(false)}
                    >
                      <TouchableWithoutFeedback onPress={() => setBranchModalVisible(false)}>
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} />
                      </TouchableWithoutFeedback>
                      <View style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: '#fff',
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        maxHeight: 400,
                        paddingBottom: 24,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 8,
                      }}>
                        <View style={{ alignItems: 'center', padding: 12 }}>
                          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', marginBottom: 8 }} />
                          <Text style={{ fontWeight: '600', fontSize: 16, marginBottom: 8 }}>Select Branch</Text>
                        </View>
                        <ScrollView style={{ flexGrow: 0 }}>
                          {branchOptions.map((branch) => (
                            <TouchableOpacity
                              key={branch}
                              style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}
                              onPress={() => {
                                setForm({ ...form, branch });
                                setBranchModalVisible(false);
                              }}
                            >
                              <Text style={{ fontSize: 16, color: branch === form.branch ? '#4e54c8' : '#333' }}>{branch}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </Modal>
                  </View>
                  <View style={styles.termsContainer}>
                    <View style={styles.checkboxRow}>
                      <Switch
                        value={form.acceptedTerms}
                        onValueChange={(value) => {
                          setForm({ ...form, acceptedTerms: value });
                          if (errors.acceptedTerms) setErrors({ ...errors, acceptedTerms: undefined });
                        }}
                        trackColor={{ false: '#d1d1d1', true: '#4e54c8' }}
                        thumbColor={form.acceptedTerms ? '#ffffff' : '#f4f3f4'}
                      />
                      <Text style={styles.termsText}>
                        I accept the {' '}
                        <Text 
                          style={styles.termsLink}
                          onPress={() => setTermsModalVisible(true)}
                        >
                          Terms and Conditions
                        </Text>
                        {' '}and{' '}
                        <Text 
                          style={styles.termsLink}
                          onPress={() => setPrivacyModalVisible(true)}
                        >
                          Privacy Policy
                        </Text>
                      </Text>
                    </View>
                    {errors.acceptedTerms ? <Text style={styles.errorText}>{errors.acceptedTerms}</Text> : null}
                  </View>
                  
                  <View style={styles.stepButtonsRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.stepButton]}
                      onPress={handlePrevious}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#c3cfe2', '#f5f7fa']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        <Text style={[styles.buttonText, { color: '#4e54c8' }]}>Back</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.stepButton]}
                      onPress={handleSignUp}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#4e54c8', '#8f94fb']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                      >
                        {loading ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <Text style={styles.buttonText}>Sign Up</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
            <View style={[styles.footer, { marginBottom: Math.max(20, insets.bottom) }]}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <Text style={styles.loginText}>Login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        
        {/* Terms and Conditions Modal */}
        <Modal
          visible={termsModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setTermsModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setTermsModalVisible(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Terms & Conditions</Text>
              <TouchableOpacity onPress={() => setTermsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalText}>
                <Text style={styles.modalSectionTitle}>📑 Terms & Conditions (Terms of Use) for YOGO Campus</Text>{"\n"}
                <Text style={styles.modalSectionSubtitle}>Effective Date: 11th July 2025</Text>{"\n\n"}
                Welcome to YOGO Campus! By using our app, you agree to the following terms.{"\n\n"}
                <Text style={styles.modalSectionHeading}>1. Use of the App</Text>{"\n"}
                You must:{"\n"}
                • Be a current college student or faculty{"\n"}
                • Provide accurate profile information{"\n"}
                • Not abuse, spam, or harass others{"\n\n"}
                <Text style={styles.modalSectionHeading}>2. Accounts & Access</Text>{"\n"}
                • You are responsible for your account security{"\n"}
                • You may not share your account credentials{"\n\n"}
                <Text style={styles.modalSectionHeading}>3. Features & Content</Text>{"\n"}
                YOGO Campus offers:{"\n"}
                • Campus mess menu, reminders, events{"\n"}
                • Points system and streaks{"\n"}
                • Chat forums, study tools, roommate finder{"\n"}
                • Marketplace and profile card with QR code{"\n\n"}
                We may modify or remove features without notice.{"\n\n"}
                <Text style={styles.modalSectionHeading}>4. Content Ownership</Text>{"\n"}
                All logos, designs, and content are owned by Jeevith G. You may not copy or redistribute without permission.{"\n\n"}
                <Text style={styles.modalSectionHeading}>5. Ads & Analytics</Text>{"\n"}
                We show ads via Google AdMob and track usage via Firebase Analytics. Data is handled per our Privacy Policy.{"\n\n"}
                <Text style={styles.modalSectionHeading}>6. Limitations</Text>{"\n"}
                We are not liable for:{"\n"}
                • Data loss or inaccuracy{"\n"}
                • App downtime{"\n"}
                • User behavior within chats or forums{"\n\n"}
                <Text style={styles.modalSectionHeading}>7. Account Termination</Text>{"\n"}
                We may suspend or delete accounts that violate these terms.{"\n\n"}
                <Text style={styles.modalSectionHeading}>8. Governing Law</Text>{"\n"}
                These terms are governed by the laws of India.{"\n\n"}
                <Text style={styles.modalSectionHeading}>9. Changes to Terms</Text>{"\n"}
                We may revise these terms. Continued use of the app means acceptance of changes.{"\n\n"}
                <Text style={styles.modalSectionHeading}>10. Contact</Text>{"\n"}
                For questions or concerns, please contact us at: yogocampus@gmail.com
              </Text>
            </ScrollView>
          </View>
        </Modal>
        
        {/* Privacy Policy Modal */}
        <Modal
          visible={privacyModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPrivacyModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setPrivacyModalVisible(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setPrivacyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalText}>
                <Text style={styles.modalSectionTitle}>📄 Privacy Policy for YOGO Campus</Text>{"\n"}
                <Text style={styles.modalSectionSubtitle}>Effective Date: 11th July 2025</Text>{"\n\n"}
                YOGO Campus ("we", "our", or "us") built this app as a platform for students to connect, explore campus resources, and enhance their college experience. This Privacy Policy outlines how we collect, use, and protect your information.{"\n\n"}
                <Text style={styles.modalSectionHeading}>1. Information We Collect</Text>{"\n"}
                We may collect the following types of data:{"\n"}
                • Personal Information: Name, email address, branch, year, interests, sports, hobbies, etc.{"\n"}
                • Profile Photo (if uploaded){"\n"}
                • Device Info: Device ID, OS version, IP address{"\n"}
                • Usage Data: Features used, event participation, login streaks{"\n"}
                • Firebase/Analytics Data: Events, crash reports, usage patterns{"\n"}
                • AdMob: Anonymous identifiers for personalized ads{"\n\n"}
                🔒 We do not collect sensitive information like health data or financial data.{"\n\n"}
                <Text style={styles.modalSectionHeading}>2. How We Use Your Data</Text>{"\n"}
                • To personalize your experience (e.g., mess menu, points system){"\n"}
                • To show relevant ads using Google AdMob{"\n"}
                • To provide features like profile cards, forums, reminders, etc.{"\n"}
                • To monitor performance and improve user experience (via Firebase){"\n\n"}
                <Text style={styles.modalSectionHeading}>3. Third-Party Services</Text>{"\n"}
                We use the following services that may collect user information:{"\n"}
                • Firebase (by Google){"\n"}
                • Google Analytics for Firebase{"\n"}
                • Google AdMob{"\n"}
                • Expo Push Notifications{"\n\n"}
                Each service has its own privacy policy:{"\n"}
                • Firebase Privacy{"\n"}
                • AdMob Privacy{"\n\n"}
                <Text style={styles.modalSectionHeading}>4. Data Security</Text>{"\n"}
                We implement industry-standard security practices including:{"\n"}
                • HTTPS encryption{"\n"}
                • Firebase Authentication & Firestore security rules{"\n"}
                • Secure login & limited access{"\n\n"}
                <Text style={styles.modalSectionHeading}>5. Children's Privacy</Text>{"\n"}
                YOGO Campus is not intended for children under 13. We do not knowingly collect data from children. If you are a parent and believe your child provided us with data, please contact us.{"\n\n"}
                <Text style={styles.modalSectionHeading}>6. User Rights</Text>{"\n"}
                You may:{"\n"}
                • Request to view or delete your data{"\n"}
                • Delete your account at any time{"\n"}
                • Contact us via yogocampus@gmail.com{"\n\n"}
                <Text style={styles.modalSectionHeading}>7. Changes to This Policy</Text>{"\n"}
                We may update this Privacy Policy. We will notify you by email or in-app if required.{"\n\n"}
                <Text style={styles.modalSectionHeading}>8. Contact</Text>{"\n"}
                If you have questions, please email: yogocampus@gmail.com
              </Text>
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: width * 0.35,
    height: width * 0.35,
    borderRadius: 16,
    marginBottom: 8,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  inputWrapperError: {
    borderColor: '#ff3b30',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: '#333',
    backgroundColor: 'transparent',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flex: 1,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 12,
  },
  stepButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20, // Add default margin for all devices
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  loginText: {
    fontSize: 14,
    color: '#4e54c8',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  termsContainer: {
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  termsLink: {
    color: '#4e54c8',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '15%',
    bottom: '15%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: 16,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSectionSubtitle: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginBottom: 16,
  },
  modalSectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
});

export default SignUp;