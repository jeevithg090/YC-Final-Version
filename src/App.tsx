import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Router from './navigation/router';
import { AuthProvider } from './context/AuthContext';
import { ConfigurationRequired } from './components/ConfigurationRequired';
import { isFirebaseConfigured, missingFirebaseEnvVars } from './services/firebase';

const App: React.FC = () => (
  <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      {isFirebaseConfigured ? (
        <AuthProvider>
          <NavigationContainer documentTitle={{ formatter: (options) => `${options?.title ?? 'Home'} · YOGO Campus` }}>
            <Router />
          </NavigationContainer>
        </AuthProvider>
      ) : (
        <ConfigurationRequired missing={missingFirebaseEnvVars} />
      )}
    </GestureHandlerRootView>
  </SafeAreaProvider>
);

export default App;
