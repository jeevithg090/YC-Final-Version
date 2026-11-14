import React, { useState, type PropsWithChildren } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CollapsibleProps {
  title: string;
  /** Whether the section starts expanded. Defaults to `false`. */
  initiallyOpen?: boolean;
}

/** A titled section whose content can be shown or hidden. */
export function Collapsible({ title, initiallyOpen = false, children }: PropsWithChildren<CollapsibleProps>) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  return (
    <View>
      <TouchableOpacity
        style={styles.heading}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={title}
      >
        <Ionicons name={isOpen ? 'chevron-down' : 'chevron-forward'} size={18} color="#4E54C8" />
        <Text style={styles.title}>{title}</Text>
      </TouchableOpacity>
      {isOpen && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  content: {
    marginTop: 6,
    marginLeft: 24,
  },
});
