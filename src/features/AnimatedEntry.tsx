import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '../components/ui';
import { colors, radius, spacing, typography } from '../theme';

const iconData = [
  { key: 'timetable', Icon: MaterialCommunityIcons, name: 'timetable', color: '#FFD700' },
  { key: 'cab', Icon: FontAwesome5, name: 'taxi', color: '#4ECDC4' },
  { key: 'food', Icon: Ionicons, name: 'fast-food', color: '#FF6B6B' },
  { key: 'music', Icon: Ionicons, name: 'musical-notes', color: '#8F94FB' },
];

const logo = require('../../assets/images/YOGOCampus.jpg');
const SLOGAN = 'Your Campus, Simplified';
type AnimatedEntryNavigationProp = StackNavigationProp<RootStackParamList>;

// Corners the feature icons fly in from (fractions of the screen size): TL, TR, BL, BR
const ICON_START_POSITIONS = [
  { x: -0.35, y: -0.35 },
  { x: 0.35, y: -0.35 },
  { x: -0.35, y: 0.35 },
  { x: 0.35, y: 0.35 },
];

interface FlyingIconProps {
  index: number;
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
  children: React.ReactNode;
}

/** An icon that animates from a screen corner towards the centre. */
const FlyingIcon: React.FC<FlyingIconProps> = ({ index, progress, opacity, children }) => {
  const { width, height } = useWindowDimensions();
  const start = ICON_START_POSITIONS[index % ICON_START_POSITIONS.length];
  const startX = start.x * Math.min(width, 900);
  const startY = start.y * height;
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: width / 2 - 22,
    top: height / 2 - 22,
    transform: [
      { translateX: startX * (1 - progress.value) },
      { translateY: startY * (1 - progress.value) },
      { scale: 0.7 + 0.3 * progress.value },
    ],
    opacity: opacity.value,
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
};

const AnimatedEntry = () => {
  const navigation = useNavigation<AnimatedEntryNavigationProp>();
  const reduceMotion = useReducedMotion();
  const [showGetStarted, setShowGetStarted] = useState(reduceMotion);

  // Lightweight: single shared values
  const scale = useSharedValue(0.7); // for logo & app name
  const iconsProgress = useSharedValue(0); // for all icons
  const fadeIn = useSharedValue(0); // for slogan & button
  const iconsOpacity = useSharedValue(1); // opacity for all icons

  useEffect(() => {
    if (reduceMotion) {
      // Skip the intro animation for users who asked the OS to reduce motion.
      scale.value = 1;
      iconsOpacity.value = 0;
      fadeIn.value = 1;
      setShowGetStarted(true);
      return;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Step 1: Logo & App Name scale up
    scale.value = withSequence(
      withTiming(1.2, { duration: 500, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: 250, easing: Easing.out(Easing.exp) }),
    );
    // Step 2: Animate all icons in together after logo
    timeout = setTimeout(() => {
      iconsProgress.value = withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }, () => {
        // Step 3: Fade out icons, fade in slogan & button
        iconsOpacity.value = withTiming(0, { duration: 300 });
        fadeIn.value = withTiming(1, { duration: 400 });
        runOnJS(setShowGetStarted)(true);
      });
    }, 700); // after logo scale up
    return () => {
      if (timeout) clearTimeout(timeout as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Animated styles
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const appNameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const fadeInStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: 30 * (1 - fadeIn.value) }],
  }));

  return (
    <LinearGradient colors={colors.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <View style={styles.centerContent}>
        <Animated.View style={logoStyle}>
          <Image
            source={logo}
            style={styles.logo}
            resizeMode="cover"
            accessible
            accessibilityLabel="YOGO Campus logo"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
        <Animated.Text style={[styles.appName, appNameStyle]} accessibilityRole="header">
          YOGO Campus
        </Animated.Text>
        {/* Reserve the space so the logo doesn't jump when the button appears */}
        <Animated.View style={[styles.getStartedContainer, fadeInStyle]}>
          <Text style={styles.slogan}>{SLOGAN}</Text>
          {showGetStarted ? (
            <Button
              title="Get started"
              variant="inverse"
              iconRight="arrow-forward"
              fullWidth={false}
              style={styles.getStartedButton}
              onPress={() => navigation.replace('LandingScreen')}
            />
          ) : (
            <View style={styles.buttonPlaceholder} />
          )}
        </Animated.View>
      </View>
      {/* Decorative feature icons */}
      {iconData.map((item, i) => (
        <FlyingIcon key={item.key} index={i} progress={iconsProgress} opacity={iconsOpacity}>
          <item.Icon name={item.name as never} size={44} color={item.color} accessible={false} />
        </FlyingIcon>
      ))}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 2,
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
  },
  appName: { ...typography.display, color: colors.onDark, textAlign: 'center' },
  getStartedContainer: { marginTop: spacing.sm, alignItems: 'center' },
  slogan: { ...typography.subheading, color: colors.onDarkMuted, textAlign: 'center' },
  getStartedButton: { marginTop: spacing.xxl, minWidth: 220 },
  buttonPlaceholder: { height: 52, marginTop: spacing.xxl },
});

export default AnimatedEntry;
