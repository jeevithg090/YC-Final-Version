import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { RootStackParamList } from '../../navigation/router';
import { auth } from '../../services/firebase';
import { AuthLayout, Banner, Button, TextField, TextLink } from '../../components/ui';
import { authErrorMessage, isValidEmail } from '../../utils/authErrors';
import { colors, spacing, typography } from '../../theme';

type LoginNavigationProp = StackNavigationProp<RootStackParamList>;

interface FormState {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const navigation = useNavigation<LoginNavigationProp>();
  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitError, setSubmitError] = useState('');
  const passwordRef = useRef<TextInput>(null);

  const update = (field: keyof FormState) => (text: string) => {
    setForm((f) => ({ ...f, [field]: text }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (submitError) setSubmitError('');
  };

  const validate = (): boolean => {
    const next: Partial<FormState> = {};
    if (!form.email.trim()) next.email = 'Enter your email address.';
    else if (!isValidEmail(form.email)) next.email = 'Enter a valid email, like name@university.edu.';
    if (!form.password) next.password = 'Enter your password.';
    else if (form.password.length < 6) next.password = 'Passwords are at least 6 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (loading || !validate()) return;
    setLoading(true);
    setSubmitError('');
    try {
      await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (error) {
      setSubmitError(authErrorMessage(error, 'login'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue to YOGO Campus"
      footer={
        <>
          <Text style={styles.footerText}>New to YOGO Campus?</Text>
          <TextLink onPress={() => navigation.navigate('SignUp')}>Create an account</TextLink>
        </>
      }
    >
      {submitError ? <Banner tone="error" title="Couldn’t log in" message={submitError} /> : null}

      <TextField
        label="Email"
        icon="mail-outline"
        placeholder="name@university.edu"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        value={form.email}
        onChangeText={update('email')}
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={errors.email}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        icon="lock-closed-outline"
        placeholder="Your password"
        password
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        value={form.password}
        onChangeText={update('password')}
        onSubmitEditing={handleLogin}
        error={errors.password}
      />

      <View style={styles.forgotRow}>
        <TextLink onPress={() => navigation.navigate('Forgot')}>Forgot password?</TextLink>
      </View>

      <Button title="Log in" onPress={handleLogin} loading={loading} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  forgotRow: { alignItems: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.md },
  footerText: { ...typography.body, fontSize: 14, color: colors.textMuted },
});

export default Login;
