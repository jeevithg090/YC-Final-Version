import React from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, elevation, layout, palette, radius, spacing, typography } from '../theme';

const logo = require('../../assets/images/YOGOCampus.jpg');

interface ConfigurationRequiredProps {
  missing: string[];
}

const STEPS = [
  'Copy .env.example to .env in the project root.',
  'Fill in the values below from Firebase console → Project settings → Your apps.',
  'Restart the dev server (npx expo start -c) so Expo picks up the new values.',
];

/** Shown instead of the app when required environment variables are missing. */
export function ConfigurationRequired({ missing }: ConfigurationRequiredProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.column}>
        <Image source={logo} style={styles.logo} accessibilityLabel="YOGO Campus logo" />
        <View style={styles.card} accessibilityRole="alert">
          <View style={styles.badge}>
            <Ionicons name="construct-outline" size={16} color={colors.warning} />
            <Text style={styles.badgeText}>Setup needed</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Configuration required
          </Text>
          <Text style={styles.body}>
            YOGO Campus needs a Firebase project to run. Copy <Text style={styles.inlineCode}>.env.example</Text> to{' '}
            <Text style={styles.inlineCode}>.env</Text>, fill in the values below, then restart the dev server.
          </Text>

          <Text style={styles.subtitle} accessibilityRole="header">
            How to fix it
          </Text>
          {STEPS.map((step, i) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          <Text style={styles.subtitle} accessibilityRole="header">
            Missing variables ({missing.length})
          </Text>
          <View style={styles.codeBlock}>
            {missing.map((name) => (
              <Text key={name} style={styles.code} selectable>
                {name}=
              </Text>
            ))}
          </View>
          <Text style={styles.note}>
            Tip: to try the app without a cloud project, use the local Firebase emulators. See “Run against the Firebase
            emulators” in the README.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  column: { width: '100%', maxWidth: layout.contentMaxWidth - 160, alignSelf: 'center', alignItems: 'center' },
  logo: { width: 64, height: 64, borderRadius: radius.lg, marginBottom: spacing.xl },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...elevation.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  badgeText: { ...typography.label, fontSize: 13, color: colors.warning, marginLeft: spacing.xs },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.subheading, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  body: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  inlineCode: { fontFamily: mono, fontSize: 14, color: colors.primary },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 1,
  },
  stepNumberText: { ...typography.label, fontSize: 13, lineHeight: 16, color: colors.primary },
  stepText: { ...typography.body, fontSize: 15, lineHeight: 22, color: colors.text, flex: 1 },
  codeBlock: {
    backgroundColor: palette.gray900,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  code: { fontFamily: mono, fontSize: 12, lineHeight: 20, color: '#E6E8F2' },
  note: { ...typography.caption, color: colors.textMuted, marginTop: spacing.lg },
});
