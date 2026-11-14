import React from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ImageStyle } from 'react-native';

import { colors } from '../../theme';

export interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/** Up to two initials from a display name, e.g. "Asha Rao" → "AR". */
export function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Profile photo, or the person's initials when there is no photo. */
export function Avatar({ name, uri, size = 32, style }: AvatarProps) {
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image source={{ uri }} style={[dims, style]} accessibilityLabel={name ? `${name}'s photo` : 'Profile photo'} />
    );
  }
  return (
    <View
      style={[styles.fallback, dims, style as object]}
      accessible
      accessibilityLabel={name ? `${name}'s avatar` : 'Avatar'}
    >
      <Text style={[styles.text, { fontSize: Math.max(10, size * 0.4) }]} allowFontScaling={false}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  text: { color: colors.primary, fontWeight: '700' },
});

export default Avatar;
