import React, { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, touchTarget, typography } from '../../theme';

export interface TextFieldProps extends TextInputProps {
  /** Visible label; also used as the input's accessible name. */
  label: string;
  /** Validation message. Turns the field red and is announced to screen readers. */
  error?: string;
  /** Helper text shown under the field when there is no error. */
  hint?: string;
  /** Ionicons name shown inside the field, before the text. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Adds a show/hide toggle and hides the value by default. */
  password?: boolean;
}

/** Labelled text input with error, hint, focus and password-visibility states. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, icon, password = false, style, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(password);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.container}>
      <Text style={styles.label} nativeID={rest.nativeID ? `${rest.nativeID}-label` : undefined}>
        {label}
      </Text>
      <View
        style={[
          styles.inputWrapper,
          { borderColor },
          (focused || !!error) && styles.inputWrapperActive,
          !editable && styles.inputWrapperDisabled,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={focused ? colors.primary : colors.textSubtle}
            style={styles.icon}
            accessible={false}
          />
        ) : null}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={label}
          accessibilityHint={error ? undefined : hint}
          aria-invalid={!!error}
          secureTextEntry={password && hidden}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {password ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={4}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.messageRow} accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={colors.danger} style={styles.messageIcon} />
          <Text style={[styles.message, styles.error]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.message}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.text, marginBottom: spacing.sm },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputWrapperActive: { borderWidth: 2, paddingHorizontal: spacing.md - 1 },
  inputWrapperDisabled: { backgroundColor: colors.surfaceMuted },
  icon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.md,
    // The wrapper draws the focus state, so drop the browser's default outline.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  toggle: {
    minWidth: touchTarget - 8,
    minHeight: touchTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.xs,
  },
  messageRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs + 2 },
  messageIcon: { marginRight: spacing.xs },
  message: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs + 2 },
  error: { color: colors.danger, marginTop: 0, flexShrink: 1 },
});

export default TextField;
