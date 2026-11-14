import React from 'react';
import { StatusBar } from 'react-native';
import { DefaultTheme, NavigationContainer, type Theme as NavigationTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Router from './navigation/router';
import { linking } from './navigation/linking';
import { AuthProvider } from './context/AuthContext';
import { ConfigurationRequired } from './components/ConfigurationRequired';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StateView } from './components/ui';
import { isFirebaseConfigured, missingFirebaseEnvVars } from './services/firebase';
import { colors } from './theme';

const navigationTheme: NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

const App: React.FC = () => (
  <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" />
      <ErrorBoundary>
        {isFirebaseConfigured ? (
          <AuthProvider>
            <NavigationContainer
              theme={navigationTheme}
              linking={linking}
              fallback={<StateView kind="loading" />}
              documentTitle={{ formatter: (options) => `${options?.title ?? 'Home'} · YOGO Campus` }}
            >
              <Router />
            </NavigationContainer>
          </AuthProvider>
        ) : (
          <ConfigurationRequired missing={missingFirebaseEnvVars} />
        )}
      </ErrorBoundary>
    </GestureHandlerRootView>
  </SafeAreaProvider>
);

export default App;
