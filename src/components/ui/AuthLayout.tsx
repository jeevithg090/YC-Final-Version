import React from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, elevation, layout, radius, spacing, typography } from '../../theme';

const logo = require('../../../assets/images/YOGOCampus.jpg');

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Rendered under the card, e.g. "Don't have an account? Sign up". */
  footer?: React.ReactNode;
  /** Optional element above the title, e.g. a step indicator. */
  eyebrow?: React.ReactNode;
}

/**
 * Shared shell for the sign-in, sign-up and password-reset screens: soft brand
 * background, logo, heading, and a card that is full-width on phones and a
 * centred 440px column on tablets and desktop.
 */
export function AuthLayout({ title, subtitle, children, footer, eyebrow }: AuthLayoutProps) {
  return (
    <LinearGradient colors={[colors.primarySoft, colors.background]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.column}>
              <View style={styles.brand}>
                <Image
                  source={logo}
                  style={styles.logo}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                  accessible
                  accessibilityLabel="YOGO Campus logo"
                />
              </View>
              <View style={styles.card}>
                {eyebrow}
                <Text style={styles.title} accessibilityRole="header">
                  {title}
                </Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                {children}
              </View>
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    // Leaves room for the transparent navigation header's back button.
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  column: { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 72, height: 72, borderRadius: radius.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    ...elevation.md,
  },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});

/** Inline text link with a 44px+ touch target, for footers and secondary actions. */
export function TextLink({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Text
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      style={linkStyles.link}
      suppressHighlighting
    >
      {children}
    </Text>
  );
}

const linkStyles = StyleSheet.create({
  link: {
    ...typography.label,
    color: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
});

export default AuthLayout;
