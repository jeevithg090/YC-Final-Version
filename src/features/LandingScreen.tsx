import React from 'react';
import { Image, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/router';
import { Button } from '../components/ui';
import { colors, layout, radius, spacing, typography } from '../theme';

type LandingScreenNavigationProp = StackNavigationProp<RootStackParamList>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const logo = require('../../assets/images/YOGOCampus.jpg');

/** Features that exist in the app today; keep this list honest. */
const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'restaurant-outline', title: 'Mess menus', body: 'Today’s meals and reminders' },
  { icon: 'car-outline', title: 'Ride sharing', body: 'Split cabs and autos' },
  { icon: 'pricetags-outline', title: 'Marketplace', body: 'Buy and sell on campus' },
  { icon: 'receipt-outline', title: 'Bill splitting', body: 'Scan a receipt, split fairly' },
  { icon: 'calendar-outline', title: 'Timetable', body: 'Class reminders and calendar' },
  { icon: 'chatbubbles-outline', title: 'Q&A and groups', body: 'Forum, study groups, clubs' },
];

const WIDE_BREAKPOINT = 900;

const LandingScreen: React.FC = () => {
  const navigation = useNavigation<LandingScreenNavigationProp>();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const tileWidth = wide ? '31%' : width >= 520 ? '31%' : '47.5%';

  return (
    <LinearGradient colors={colors.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flex}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.page}>
            <View style={styles.topBar}>
              <View style={styles.brandRow}>
                <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors accessible={false} />
                <Text style={styles.brandName}>YOGO Campus</Text>
              </View>
              {/* Development shortcut: skips sign-in, so it is hidden in production builds */}
              {__DEV__ ? (
                <Button
                  title="Skip (dev)"
                  variant="outlineInverse"
                  size="md"
                  fullWidth={false}
                  onPress={() => navigation.navigate('Dashboard')}
                  accessibilityLabel="Skip to dashboard (development only)"
                />
              ) : null}
            </View>

            <View style={[styles.hero, wide && styles.heroWide]}>
              <View style={[styles.heroText, wide && styles.heroTextWide]}>
                <Text style={[styles.headline, wide && styles.headlineWide]} accessibilityRole="header">
                  Your campus,{'\n'}simplified.
                </Text>
                <Text style={styles.lede}>
                  Mess menus, ride sharing, a student marketplace, bill splitting, timetables and more, in one app built
                  for students.
                </Text>
                <View style={[styles.ctas, wide && styles.ctasWide]}>
                  <Button
                    title="Create an account"
                    variant="inverse"
                    iconRight="arrow-forward"
                    onPress={() => navigation.navigate('SignUp')}
                  />
                  <Button
                    title="I already have an account"
                    variant="outlineInverse"
                    style={styles.secondaryCta}
                    onPress={() => navigation.navigate('Login')}
                  />
                </View>
              </View>

              <View style={[styles.features, wide && styles.featuresWide]} accessibilityRole="list">
                {FEATURES.map((f) => (
                  <View key={f.title} style={[styles.tile, { width: tileWidth }]} accessibilityRole="text">
                    <View style={styles.tileIcon}>
                      <Ionicons name={f.icon} size={22} color={colors.onDark} />
                    </View>
                    <Text style={styles.tileTitle}>{f.title}</Text>
                    <Text style={styles.tileBody}>{f.body}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  page: { flex: 1, width: '100%', maxWidth: layout.wideMaxWidth, alignSelf: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, borderRadius: radius.sm },
  brandName: { ...typography.subheading, color: colors.onDark, marginLeft: spacing.sm },
  hero: { flex: 1, justifyContent: 'center', paddingTop: spacing.xl },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxxl },
  heroText: { marginBottom: spacing.xxl },
  heroTextWide: { flex: 1, marginBottom: 0 },
  headline: { ...typography.display, color: colors.onDark },
  headlineWide: { fontSize: 52, lineHeight: 58 },
  lede: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.onDarkMuted,
    marginTop: spacing.lg,
    maxWidth: 520,
  },
  ctas: { marginTop: spacing.xl },
  ctasWide: { maxWidth: 360 },
  secondaryCta: { marginTop: spacing.md },
  features: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  featuresWide: { flex: 1 },
  tile: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  tileTitle: { ...typography.label, fontSize: 15, color: colors.onDark },
  tileBody: { ...typography.caption, color: colors.onDarkMuted, marginTop: spacing.xxs },
});

export default LandingScreen;
