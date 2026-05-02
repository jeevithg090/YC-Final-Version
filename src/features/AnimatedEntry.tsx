import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const iconData = [
  { key: 'timetable', Icon: MaterialCommunityIcons, name: 'timetable', color: '#FFD700' },
  { key: 'cab', Icon: FontAwesome5, name: 'taxi', color: '#4ECDC4' },
  { key: 'food', Icon: Ionicons, name: 'fast-food', color: '#FF6B6B' },
  { key: 'music', Icon: Ionicons, name: 'musical-notes', color: '#8F94FB' },
];

const logo = require('../../assets/images/YOGOCampus.jpg');
const SLOGAN = 'Your Campus, Simplified';
type AnimatedEntryNavigationProp = StackNavigationProp<RootStackParamList>;

const AnimatedEntry = () => {
  const navigation = useNavigation<AnimatedEntryNavigationProp>();
  const [showGetStarted, setShowGetStarted] = useState(false);

  // Lightweight: single shared values
  const scale = useSharedValue(0.7); // for logo & app name
  const iconsProgress = useSharedValue(0); // for all icons
  const fadeIn = useSharedValue(0); // for slogan & button
  const iconsOpacity = useSharedValue(1); // opacity for all icons

  useEffect(() => {
    let timeout: number | undefined;
    // Step 1: Logo & App Name scale up
    scale.value = withSequence(
      withTiming(1.2, { duration: 500, easing: Easing.out(Easing.exp) }),
      withTiming(1, { duration: 250, easing: Easing.out(Easing.exp) })
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
  }, [navigation]);

  // Animated styles
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const appNameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const iconsStyles = iconData.map((_, i) =>
    useAnimatedStyle(() => {
      // Corners: TL, TR, BL, BR
      const iconStart = [
        { x: -width * 0.35, y: -height * 0.35 },
        { x: width * 0.35, y: -height * 0.35 },
        { x: -width * 0.35, y: height * 0.35 },
        { x: width * 0.35, y: height * 0.35 },
      ];
      return {
        position: 'absolute',
        left: width / 2 - 28,
        top: height / 2 - 28,
        transform: [
          { translateX: iconStart[i].x * (1 - iconsProgress.value) },
          { translateY: iconStart[i].y * (1 - iconsProgress.value) },
          { scale: 0.7 + 0.3 * iconsProgress.value },
        ],
        opacity: iconsOpacity.value,
      };
    })
  );
  const fadeInStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: 30 * (1 - fadeIn.value) }],
  }));

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.gradient} />
      </View>
      {/* Logo & App Name */}
      <View style={styles.centerContent}>
        <Animated.View style={logoStyle}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <Animated.Text style={[styles.appName, appNameStyle]}>YOGO Campus</Animated.Text>
        {/* Slogan & Get Started Button */}
        {showGetStarted && (
          <Animated.View style={[styles.getStartedContainer, fadeInStyle]}>
            <Text style={styles.slogan}>{SLOGAN}</Text>
            <TouchableOpacity style={styles.getStartedButton} onPress={() => navigation.replace('LandingScreen')}>
              <Text style={styles.getStartedButtonText}>Get Started</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
      {/* Animated Feature Icons */}
      {iconData.map((item, i) => {
        const IconComponent = item.Icon;
        return (
          <Animated.View key={item.key} style={iconsStyles[i]}>
            <IconComponent name={item.name} size={44} color={item.color} />
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a2980',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    flex: 1,
    backgroundColor: '#1a2980',
    opacity: 0.95,
  },
  centerContent: {
    position: 'absolute',
    top: height / 2 - 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  logo: {
    width: 110,
    height: 110,
    borderRadius: 24,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 0, // Add this to remove space below app name
  },
  slogan: {
    fontSize: 14, // Smaller than app name
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 0, // No gap below app name
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  getStartedContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  getStartedButton: {
    backgroundColor: '#4e54c8',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  getStartedButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});

export default AnimatedEntry;