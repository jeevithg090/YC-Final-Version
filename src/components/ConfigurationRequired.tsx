import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface ConfigurationRequiredProps {
  missing: string[];
}

/** Shown instead of the app when required environment variables are missing. */
export function ConfigurationRequired({ missing }: ConfigurationRequiredProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.title} accessibilityRole="header">
          Configuration required
        </Text>
        <Text style={styles.body}>
          YOGO Campus needs a Firebase project to run. Copy <Text style={styles.code}>.env.example</Text> to{' '}
          <Text style={styles.code}>.env</Text>, fill in the values below, then restart the dev server.
        </Text>
        <Text style={styles.subtitle}>Missing variables</Text>
        {missing.map((name) => (
          <Text key={name} style={styles.code}>
            • {name}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F4F6FB',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#3A3A3C',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#4E54C8',
  },
});
