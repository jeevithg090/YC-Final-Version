import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { sendPasswordResetEmail } from 'firebase/auth';

import { RootStackParamList } from '../../navigation/router';
import { auth } from '../../services/firebase';
import { AuthLayout, Banner, Button, TextField, TextLink } from '../../components/ui';
import { authErrorMessage, isValidEmail } from '../../utils/authErrors';
import { colors, spacing, typography } from '../../theme';

type ForgotNavigationProp = StackNavigationProp<RootStackParamList>;

const Forgot: React.FC = () => {
  const navigation = useNavigation<ForgotNavigationProp>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSendResetEmail = async () => {
    if (loading) return;
    const trimmed = email.trim();
    if (!trimmed) return setFieldError('Enter the email you signed up with.');
    if (!isValidEmail(trimmed)) return setFieldError('Enter a valid email, like name@university.edu.');

    setLoading(true);
    setSubmitError('');
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setSentTo(trimmed);
    } catch (error) {
      const message = authErrorMessage(error, 'reset');
      // An empty message means "no such account": show the same success screen
      // so the form can't be used to find out who has an account.
      if (message) setSubmitError(message);
      else setSentTo(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <Text style={styles.footerText}>Remembered it?</Text>
      <TextLink onPress={() => navigation.navigate('Login')}>Back to log in</TextLink>
    </>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" subtitle="One more step to get back into your account" footer={footer}>
        <Banner
          tone="success"
          title="Reset link sent"
          message={`If an account exists for ${sentTo}, you’ll get an email with a link to choose a new password. It can take a few minutes; check your spam folder too.`}
        />
        <Button title="Back to log in" onPress={() => navigation.navigate('Login')} />
        <Button
          title="Use a different email"
          variant="ghost"
          style={styles.secondary}
          onPress={() => {
            setSentTo(null);
            setEmail('');
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we’ll send you a link to choose a new password."
      footer={footer}
    >
      {submitError ? <Banner tone="error" message={submitError} /> : null}
      <TextField
        label="Email"
        icon="mail-outline"
        placeholder="name@university.edu"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (fieldError) setFieldError('');
          if (submitError) setSubmitError('');
        }}
        onSubmitEditing={handleSendResetEmail}
        error={fieldError}
      />
      <Button title="Send reset link" icon="paper-plane-outline" onPress={handleSendResetEmail} loading={loading} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  footerText: { ...typography.body, fontSize: 14, color: colors.textMuted },
  secondary: { marginTop: spacing.sm },
});

export default Forgot;
