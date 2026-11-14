import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, layout, radius, spacing, typography } from '../../theme';
import { Button } from './Button';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface StateViewProps {
  /** `loading` shows a spinner; `empty` and `error` show an icon, copy and an optional action. */
  kind: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

const DEFAULTS: Record<StateViewProps['kind'], { title: string; icon: IconName; tint: string; bg: string }> = {
  loading: { title: 'Loading…', icon: 'hourglass-outline', tint: colors.primary, bg: colors.primarySoft },
  empty: { title: 'Nothing here yet', icon: 'file-tray-outline', tint: colors.primary, bg: colors.primarySoft },
  error: { title: 'Something went wrong', icon: 'cloud-offline-outline', tint: colors.danger, bg: colors.dangerSoft },
};

/** Full-area loading, empty and error states with consistent layout and copy. */
export function StateView({
  kind,
  title,
  message,
  icon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
}: StateViewProps) {
  const d = DEFAULTS[kind];
  return (
    <View
      style={[styles.container, style]}
      accessibilityRole={kind === 'error' ? 'alert' : kind === 'loading' ? 'progressbar' : undefined}
      accessibilityLabel={kind === 'loading' ? (title ?? d.title) : undefined}
    >
      <View style={styles.inner}>
        {kind === 'loading' ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: d.bg }]}>
            <Ionicons name={icon ?? d.icon} size={36} color={d.tint} />
          </View>
        )}
        <Text style={styles.title} accessibilityRole="header">
          {title ?? d.title}
        </Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {actionLabel && onAction ? (
          <Button title={actionLabel} onPress={onAction} style={styles.action} fullWidth={false} />
        ) : null}
        {secondaryActionLabel && onSecondaryAction ? (
          <Button
            title={secondaryActionLabel}
            onPress={onSecondaryAction}
            variant="ghost"
            style={styles.secondary}
            fullWidth={false}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  inner: { width: '100%', maxWidth: layout.formMaxWidth, alignItems: 'center' },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.heading, color: colors.text, textAlign: 'center', marginTop: spacing.lg },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  action: { marginTop: spacing.xl, minWidth: 200 },
  secondary: { marginTop: spacing.sm, minWidth: 200 },
});

export default StateView;
