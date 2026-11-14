import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

/** Text with the app's default typography applied; extra styles override it. */
export function ThemedText({ style, ...rest }: TextProps) {
  return <Text style={[styles.default, style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    color: '#1C1C1E',
    fontSize: 16,
    lineHeight: 22,
  },
});
