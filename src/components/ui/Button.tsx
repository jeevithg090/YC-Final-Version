import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, motion, radius, spacing, touchTarget, typography } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse' | 'outlineInverse';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  /** Shows a spinner, disables the button and announces "busy" to screen readers. */
  loading?: boolean;
  /** Ionicons name rendered before the title. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Ionicons name rendered after the title. */
  iconRight?: React.ComponentProps<typeof Ionicons>['name'];
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANTS: Record<ButtonVariant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, bgPressed: colors.primaryPressed, fg: colors.onPrimary },
  secondary: { bg: colors.surface, bgPressed: colors.primarySoft, fg: colors.primary, border: colors.borderStrong },
  ghost: { bg: 'transparent', bgPressed: colors.primarySoft, fg: colors.primary },
  danger: { bg: colors.danger, bgPressed: '#A52222', fg: colors.onPrimary },
  inverse: { bg: colors.surface, bgPressed: colors.primarySoft, fg: colors.primary },
  /** For dark/brand backgrounds. */
  outlineInverse: { bg: 'transparent', bgPressed: 'rgba(255,255,255,0.12)', fg: colors.onDark, border: colors.onDark },
};

/**
 * The app's standard button. Always at least 48px tall, with pressed, hover
 * and keyboard-focus states and correct accessibility semantics.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled,
  icon,
  iconRight,
  fullWidth = true,
  style,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => {
        // react-native-web adds `hovered` and `focused` to the state object.
        const { pressed, hovered, focused } = state as typeof state & { hovered?: boolean; focused?: boolean };
        return [
          styles.base,
          size === 'md' ? styles.md : styles.lg,
          fullWidth && styles.fullWidth,
          {
            backgroundColor: pressed || hovered ? v.bgPressed : v.bg,
            borderColor: v.border ?? 'transparent',
          },
          // On web the global :focus-visible outline marks keyboard focus.
          focused && Platform.OS !== 'web' && styles.focused,
          isDisabled && styles.disabled,
          style,
        ];
      }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" accessibilityLabel="Loading" />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={20} color={v.fg} style={styles.iconLeft} /> : null}
          <Text style={[styles.label, { color: v.fg }]} numberOfLines={1}>
            {title}
          </Text>
          {iconRight ? <Ionicons name={iconRight} size={20} color={v.fg} style={styles.iconRight} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    ...(Platform.OS === 'web'
      ? ({ transitionDuration: `${motion.fast}ms`, transitionProperty: 'background-color, opacity' } as object)
      : null),
  },
  lg: { minHeight: 52 },
  md: { minHeight: touchTarget },
  fullWidth: { alignSelf: 'stretch' },
  focused: {
    borderColor: colors.focusRing,
    borderWidth: 2,
  },
  disabled: { opacity: 0.55 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.button, letterSpacing: 0.2 },
  iconLeft: { marginRight: spacing.sm },
  iconRight: { marginLeft: spacing.sm },
});

export default Button;
