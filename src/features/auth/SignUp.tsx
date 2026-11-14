import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Switch,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/router';
import { auth, db } from '../../services/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { setDoc, doc } from 'firebase/firestore';
import { getUserPoints } from '../../services/pointsService';
import { AuthLayout, Banner, Button, TextField, TextLink } from '../../components/ui';
import { authErrorMessage, isValidEmail } from '../../utils/authErrors';
import { colors, elevation, layout, radius, spacing, typography } from '../../theme';

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

type FormErrors = {
  [K in keyof FormState]?: string;
};

const SignUp: React.FC = () => {
  const navigation = useNavigation<SignUpNavigationProp>();
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
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState<number>(1);
  const [customBranch, setCustomBranch] = useState('');
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

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
    'Kasturba Medical College, Manipal (KMC)',
  ];

  const validateStep1 = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = 'Enter your name.';
    if (!form.email.trim()) newErrors.email = 'Enter your email address.';
    else if (!isValidEmail(form.email)) newErrors.email = 'Enter a valid email, like name@university.edu.';
    if (!form.password) newErrors.password = 'Choose a password.';
    else if (form.password.length < 6) newErrors.password = 'Use at least 6 characters.';
    if (!form.confirmPassword) newErrors.confirmPassword = 'Re-enter your password to confirm it.';
    else if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'The passwords don’t match.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.userName.trim()) newErrors.userName = 'Choose a username.';
    if (!/^\+91\d{10}$/.test(form.mobileNumber)) newErrors.mobileNumber = 'Enter a 10-digit mobile number after +91.';
    if (!form.collegeName.trim()) newErrors.collegeName = 'Enter your college.';
    if (!form.branch.trim()) newErrors.branch = 'Enter your branch, or pick one from the list.';
    if (form.branch === 'Other' && !customBranch.trim()) newErrors.branch = 'Enter your branch.';
    if (!form.acceptedTerms) newErrors.acceptedTerms = 'Accept the Terms and Privacy Policy to continue.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateField =
    (field: 'name' | 'email' | 'password' | 'confirmPassword' | 'userName' | 'collegeName') => (text: string) => {
      setForm((f) => ({ ...f, [field]: text }));
      if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
      if (submitError) setSubmitError('');
    };

  const handleNext = () => {
    if (validateStep1()) setStep(2);
  };

  const handlePrevious = () => {
    setStep(1);
  };

  const handleSignUp = async () => {
    if (loading || !validateStep2()) return;
    setLoading(true);
    setSubmitError('');
    try {
      // Firebase Auth sign up
      const userCredential = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
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
        email: form.email.trim(),
        accountCreatedOn: new Date().toISOString(),
      });
      await getUserPoints(); // Ensures user points doc is initialized
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (error) {
      setSubmitError(authErrorMessage(error, 'signup'));
      // Email problems are fixed on step 1, so send the user back there.
      const code = (error as { code?: string })?.code;
      if (code === 'auth/email-already-in-use' || code === 'auth/invalid-email') setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <Text style={styles.footerText}>Already have an account?</Text>
      <TextLink onPress={() => navigation.navigate('Login')}>Log in</TextLink>
    </>
  );

  const stepIndicator = (
    <View style={styles.stepper} accessible accessibilityLabel={`Step ${step} of 2`}>
      {[1, 2].map((n) => (
        <View key={n} style={[styles.stepDot, n <= step && styles.stepDotActive]} />
      ))}
      <Text style={styles.stepLabel}>Step {step} of 2</Text>
    </View>
  );

  return (
    <>
      <AuthLayout
        title={step === 1 ? 'Create your account' : 'Tell us about you'}
        subtitle={step === 1 ? 'It takes less than a minute.' : 'This helps classmates find and trust you.'}
        eyebrow={stepIndicator}
        footer={footer}
      >
        {submitError ? <Banner tone="error" title="Couldn’t create your account" message={submitError} /> : null}
        {step === 1 ? (
          <>
            <TextField
              label="Full name"
              icon="person-outline"
              placeholder="Asha Rao"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              value={form.name}
              onChangeText={updateField('name')}
              error={errors.name}
            />
            <TextField
              label="Email"
              icon="mail-outline"
              placeholder="name@university.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              value={form.email}
              onChangeText={updateField('email')}
              error={errors.email}
            />
            <TextField
              label="Password"
              icon="lock-closed-outline"
              placeholder="At least 6 characters"
              password
              autoComplete="new-password"
              textContentType="newPassword"
              value={form.password}
              onChangeText={updateField('password')}
              error={errors.password}
              hint="Use 6 or more characters."
            />
            <TextField
              label="Confirm password"
              icon="lock-closed-outline"
              placeholder="Re-enter your password"
              password
              autoComplete="new-password"
              textContentType="newPassword"
              value={form.confirmPassword}
              onChangeText={updateField('confirmPassword')}
              onSubmitEditing={handleNext}
              error={errors.confirmPassword}
            />
            <Button title="Continue" iconRight="arrow-forward" onPress={handleNext} />
          </>
        ) : (
          <>
            <TextField
              label="Username"
              icon="at-outline"
              placeholder="asha.rao"
              autoCapitalize="none"
              autoComplete="username"
              textContentType="username"
              value={form.userName}
              onChangeText={updateField('userName')}
              error={errors.userName}
              hint="Shown on your posts, listings and rides."
            />
            <TextField
              label="Mobile number"
              icon="call-outline"
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={13}
              value={form.mobileNumber}
              onChangeText={(text) => {
                if (text.startsWith('+91')) {
                  setForm({ ...form, mobileNumber: text });
                } else if (text.length <= 10) {
                  setForm({ ...form, mobileNumber: '+91' + text.replace(/\D/g, '') });
                }
                if (errors.mobileNumber) setErrors({ ...errors, mobileNumber: undefined });
              }}
              error={errors.mobileNumber}
            />
            <TextField
              label="College"
              icon="school-outline"
              placeholder={topCollegeRecommendations[0]}
              autoCapitalize="words"
              value={form.collegeName}
              onChangeText={updateField('collegeName')}
              error={errors.collegeName}
            />
            <TextField
              label="Branch"
              icon="briefcase-outline"
              placeholder="Computer Science and Engineering"
              autoCapitalize="words"
              value={form.branch === 'Other' ? customBranch : form.branch}
              onChangeText={(text) => {
                if (form.branch === 'Other') setCustomBranch(text);
                else setForm({ ...form, branch: text });
                if (errors.branch) setErrors({ ...errors, branch: undefined });
              }}
              error={errors.branch}
            />
            <View style={styles.pickBranchRow}>
              <TextLink onPress={() => setBranchModalVisible(true)}>Choose from common branches</TextLink>
            </View>

            <View style={styles.termsContainer}>
              <View style={styles.checkboxRow}>
                <Switch
                  value={form.acceptedTerms}
                  onValueChange={(value) => {
                    setForm({ ...form, acceptedTerms: value });
                    if (errors.acceptedTerms) setErrors({ ...errors, acceptedTerms: undefined });
                  }}
                  trackColor={{ false: colors.borderStrong, true: colors.primary }}
                  thumbColor={colors.surface}
                  accessibilityLabel="I accept the Terms and Conditions and Privacy Policy"
                />
                <Text style={styles.termsText}>
                  I accept the{' '}
                  <Text style={styles.termsLink} accessibilityRole="link" onPress={() => setTermsModalVisible(true)}>
                    Terms and Conditions
                  </Text>{' '}
                  and{' '}
                  <Text style={styles.termsLink} accessibilityRole="link" onPress={() => setPrivacyModalVisible(true)}>
                    Privacy Policy
                  </Text>
                </Text>
              </View>
              {errors.acceptedTerms ? (
                <Text style={styles.errorText} accessibilityRole="alert">
                  {errors.acceptedTerms}
                </Text>
              ) : null}
            </View>

            <View style={styles.stepButtonsRow}>
              <Button
                title="Back"
                variant="secondary"
                icon="arrow-back"
                onPress={handlePrevious}
                fullWidth={false}
                style={styles.stepButton}
                disabled={loading}
              />
              <Button
                title="Create account"
                onPress={handleSignUp}
                loading={loading}
                fullWidth={false}
                style={[styles.stepButton, styles.stepButtonPrimary]}
              />
            </View>
          </>
        )}
      </AuthLayout>

      <Modal
        visible={branchModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setBranchModalVisible(false)} accessibilityLabel="Close">
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} accessibilityRole="header">
              Select your branch
            </Text>
            <TouchableOpacity
              onPress={() => setBranchModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {branchOptions.map((branch) => (
              <TouchableOpacity
                key={branch}
                style={styles.sheetOption}
                accessibilityRole="button"
                accessibilityState={{ selected: branch === form.branch }}
                onPress={() => {
                  setForm({ ...form, branch });
                  if (errors.branch) setErrors({ ...errors, branch: undefined });
                  setBranchModalVisible(false);
                }}
              >
                <Text style={[styles.sheetOptionText, branch === form.branch && styles.sheetOptionSelected]}>
                  {branch}
                </Text>
                {branch === form.branch ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
            <TouchableOpacity
              onPress={() => setTermsModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText}>
              <Text style={styles.modalSectionTitle}>📑 Terms & Conditions (Terms of Use) for YOGO Campus</Text>
              {'\n'}
              <Text style={styles.modalSectionSubtitle}>Effective Date: 11th July 2025</Text>
              {'\n\n'}
              Welcome to YOGO Campus! By using our app, you agree to the following terms.{'\n\n'}
              <Text style={styles.modalSectionHeading}>1. Use of the App</Text>
              {'\n'}
              You must:{'\n'}• Be a current college student or faculty{'\n'}• Provide accurate profile information
              {'\n'}• Not abuse, spam, or harass others{'\n\n'}
              <Text style={styles.modalSectionHeading}>2. Accounts & Access</Text>
              {'\n'}• You are responsible for your account security{'\n'}• You may not share your account credentials
              {'\n\n'}
              <Text style={styles.modalSectionHeading}>3. Features & Content</Text>
              {'\n'}
              YOGO Campus offers:{'\n'}• Campus mess menu, reminders, events{'\n'}• Points system and streaks{'\n'}•
              Chat forums, study tools, roommate finder{'\n'}• Marketplace and profile card with QR code{'\n\n'}
              We may modify or remove features without notice.{'\n\n'}
              <Text style={styles.modalSectionHeading}>4. Content Ownership</Text>
              {'\n'}
              All logos, designs, and content are owned by Jeevith G. You may not copy or redistribute without
              permission.{'\n\n'}
              <Text style={styles.modalSectionHeading}>5. Ads & Analytics</Text>
              {'\n'}
              We show ads via Google AdMob and track usage via Firebase Analytics. Data is handled per our Privacy
              Policy.{'\n\n'}
              <Text style={styles.modalSectionHeading}>6. Limitations</Text>
              {'\n'}
              We are not liable for:{'\n'}• Data loss or inaccuracy{'\n'}• App downtime{'\n'}• User behavior within
              chats or forums{'\n\n'}
              <Text style={styles.modalSectionHeading}>7. Account Termination</Text>
              {'\n'}
              We may suspend or delete accounts that violate these terms.{'\n\n'}
              <Text style={styles.modalSectionHeading}>8. Governing Law</Text>
              {'\n'}
              These terms are governed by the laws of India.{'\n\n'}
              <Text style={styles.modalSectionHeading}>9. Changes to Terms</Text>
              {'\n'}
              We may revise these terms. Continued use of the app means acceptance of changes.{'\n\n'}
              <Text style={styles.modalSectionHeading}>10. Contact</Text>
              {'\n'}
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
            <TouchableOpacity
              onPress={() => setPrivacyModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText}>
              <Text style={styles.modalSectionTitle}>📄 Privacy Policy for YOGO Campus</Text>
              {'\n'}
              <Text style={styles.modalSectionSubtitle}>Effective Date: 11th July 2025</Text>
              {'\n\n'}
              YOGO Campus ("we", "our", or "us") built this app as a platform for students to connect, explore campus
              resources, and enhance their college experience. This Privacy Policy outlines how we collect, use, and
              protect your information.{'\n\n'}
              <Text style={styles.modalSectionHeading}>1. Information We Collect</Text>
              {'\n'}
              We may collect the following types of data:{'\n'}• Personal Information: Name, email address, branch,
              year, interests, sports, hobbies, etc.{'\n'}• Profile Photo (if uploaded){'\n'}• Device Info: Device ID,
              OS version, IP address{'\n'}• Usage Data: Features used, event participation, login streaks{'\n'}•
              Firebase/Analytics Data: Events, crash reports, usage patterns{'\n'}• AdMob: Anonymous identifiers for
              personalized ads{'\n\n'}
              🔒 We do not collect sensitive information like health data or financial data.{'\n\n'}
              <Text style={styles.modalSectionHeading}>2. How We Use Your Data</Text>
              {'\n'}• To personalize your experience (e.g., mess menu, points system){'\n'}• To show relevant ads using
              Google AdMob{'\n'}• To provide features like profile cards, forums, reminders, etc.{'\n'}• To monitor
              performance and improve user experience (via Firebase){'\n\n'}
              <Text style={styles.modalSectionHeading}>3. Third-Party Services</Text>
              {'\n'}
              We use the following services that may collect user information:{'\n'}• Firebase (by Google){'\n'}• Google
              Analytics for Firebase{'\n'}• Google AdMob{'\n'}• Expo Push Notifications{'\n\n'}
              Each service has its own privacy policy:{'\n'}• Firebase Privacy{'\n'}• AdMob Privacy{'\n\n'}
              <Text style={styles.modalSectionHeading}>4. Data Security</Text>
              {'\n'}
              We implement industry-standard security practices including:{'\n'}• HTTPS encryption{'\n'}• Firebase
              Authentication & Firestore security rules{'\n'}• Secure login & limited access{'\n\n'}
              <Text style={styles.modalSectionHeading}>5. Children's Privacy</Text>
              {'\n'}
              YOGO Campus is not intended for children under 13. We do not knowingly collect data from children. If you
              are a parent and believe your child provided us with data, please contact us.{'\n\n'}
              <Text style={styles.modalSectionHeading}>6. User Rights</Text>
              {'\n'}
              You may:{'\n'}• Request to view or delete your data{'\n'}• Delete your account at any time{'\n'}• Contact
              us via yogocampus@gmail.com{'\n\n'}
              <Text style={styles.modalSectionHeading}>7. Changes to This Policy</Text>
              {'\n'}
              We may update this Privacy Policy. We will notify you by email or in-app if required.{'\n\n'}
              <Text style={styles.modalSectionHeading}>8. Contact</Text>
              {'\n'}
              If you have questions, please email: yogocampus@gmail.com
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  footerText: { ...typography.body, fontSize: 14, color: colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  stepDot: {
    width: 28,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xxs,
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepLabel: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.sm },
  pickBranchRow: { alignItems: 'flex-start', marginTop: -spacing.md, marginBottom: spacing.sm },
  termsContainer: { marginBottom: spacing.xl },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  termsText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    flex: 1,
    marginLeft: spacing.md,
  },
  termsLink: { color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  stepButtonsRow: { flexDirection: 'row', gap: spacing.md },
  stepButton: { flex: 1, paddingHorizontal: spacing.md },
  stepButtonPrimary: { flex: 1.6 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.sm },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
    ...elevation.md,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetOptionText: { ...typography.body, color: colors.text, flex: 1, paddingRight: spacing.sm },
  sheetOptionSelected: { color: colors.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay },
  modalContainer: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    left: spacing.lg,
    right: spacing.lg,
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    marginHorizontal: 'auto',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...elevation.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.heading, color: colors.text },
  modalContent: { padding: spacing.lg },
  modalText: { ...typography.body, fontSize: 15, color: colors.text },
  modalSectionTitle: { ...typography.subheading, color: colors.text },
  modalSectionSubtitle: { ...typography.caption, fontStyle: 'italic', color: colors.textMuted },
  modalSectionHeading: { ...typography.bodyStrong, color: colors.text },
});

export default SignUp;
