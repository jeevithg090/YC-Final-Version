import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { StateView } from './ui';
import { colors } from '../theme';

interface State {
  error: Error | null;
}

/**
 * Catches render errors anywhere below it and shows a recovery screen instead
 * of a blank page.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  private reset = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Start again from the home URL so a broken deep link isn't re-opened.
      window.location.assign('/');
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <StateView
          kind="error"
          title="Something went wrong"
          message="This screen hit an unexpected problem. Your data is safe; try again, and if it keeps happening, let us know what you were doing."
          actionLabel="Try again"
          onAction={this.reset}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

export default ErrorBoundary;
