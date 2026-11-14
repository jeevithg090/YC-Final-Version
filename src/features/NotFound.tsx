import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/router';
import { useAuth } from '../context/AuthContext';
import { StateView } from '../components/ui';
import { colors } from '../theme';

/** Shown for unknown URLs and for links that can't be opened directly. */
const NotFound: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser } = useAuth();
  const home = currentUser ? 'Dashboard' : 'LandingScreen';

  return (
    <View style={styles.container}>
      <StateView
        kind="empty"
        icon="compass-outline"
        title="We couldn’t find that page"
        message="The link may be broken, or the page may only open from inside the app."
        actionLabel={currentUser ? 'Go to home' : 'Go to the welcome screen'}
        onAction={() => navigation.reset({ index: 0, routes: [{ name: home }] })}
        secondaryActionLabel={navigation.canGoBack() ? 'Go back' : undefined}
        onSecondaryAction={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

export default NotFound;
