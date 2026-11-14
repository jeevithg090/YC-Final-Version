import React from 'react';
import { View, type ViewProps } from 'react-native';

/** Plain container view; kept as a seam for future theming. */
export function ThemedView(props: ViewProps) {
  return <View {...props} />;
}
