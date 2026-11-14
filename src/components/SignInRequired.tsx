import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/router';
import { StateView } from './ui';
import { colors } from '../theme';

/** Replaces a members-only screen when someone opens its URL while signed out. */
export function SignInRequired() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={styles.container}>
      <StateView
        kind="empty"
        icon="lock-closed-outline"
        title="Log in to continue"
        message="This part of YOGO Campus is only available to signed-in students."
        actionLabel="Log in"
        onAction={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
        secondaryActionLabel="Create an account"
        onSecondaryAction={() => navigation.reset({ index: 0, routes: [{ name: 'SignUp' }] })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});

export default SignInRequired;
