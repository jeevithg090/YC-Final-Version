import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '../../theme';

export type BannerTone = 'error' | 'success' | 'info' | 'warning';

const TONES: Record<BannerTone, { bg: string; fg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  error: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' },
  success: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' },
  info: { bg: colors.primarySoft, fg: colors.primary, icon: 'information-circle' },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'warning' },
};

export interface BannerProps {
  tone?: BannerTone;
  title?: string;
  message: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Inline status message. Used instead of `Alert.alert` for form feedback,
 * because alerts are not shown at all on the web build.
 */
export function Banner({ tone = 'info', title, message, style }: BannerProps) {
  const t = TONES[tone];
  return (
    <View
      style={[styles.container, { backgroundColor: t.bg, borderColor: t.fg }, style]}
      accessible
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
    >
      <Ionicons name={t.icon} size={20} color={t.fg} style={styles.icon} />
      <View style={styles.textCol}>
        {title ? <Text style={[styles.title, { color: t.fg }]}>{title}</Text> : null}
        <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  icon: { marginRight: spacing.sm, marginTop: 2 },
  textCol: { flex: 1 },
  title: { ...typography.label, marginBottom: spacing.xxs },
  message: { ...typography.caption, fontSize: 14, lineHeight: 20 },
});

export default Banner;
