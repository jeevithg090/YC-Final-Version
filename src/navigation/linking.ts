import {
  getPathFromState as defaultGetPathFromState,
  getStateFromPath as defaultGetStateFromPath,
  type LinkingOptions,
} from '@react-navigation/native';
import * as Linking from 'expo-linking';

import type { RootStackParamList } from './router';

/**
 * URL for every screen. Used for browser URLs and back/forward on the web
 * build, and for `yogo://` deep links on iOS/Android.
 */
export const SCREEN_PATHS: Record<keyof RootStackParamList, string> = {
  AnimatedEntry: '',
  LandingScreen: 'welcome',
  Pathway: 'get-started',
  Login: 'login',
  SignUp: 'signup',
  Forgot: 'forgot-password',
  Dashboard: 'home',
  MessOption: 'mess',
  MessMenu: 'mess/menu',
  MessNotification: 'mess/notifications',
  Marketplace: 'marketplace',
  BuyMarketplace: 'marketplace/buy',
  SellMarketplace: 'marketplace/sell',
  LostAndFound: 'lost-and-found',
  Restaurants: 'restaurants',
  ClassNotification: 'classes/notifications',
  Weather: 'weather',
  SportsPlace: 'sports',
  PreviousYearPapers: 'papers',
  DailyTimetable: 'timetable',
  MyGroupSports: 'sports/groups/:groupId',
  AutoShare: 'rides/auto',
  FindAnAutoShare: 'rides/auto/find',
  PublishAnAutoShare: 'rides/auto/publish',
  AutoRideDetails: 'rides/auto/:rideId',
  AutoRideGroupChat: 'rides/auto/:rideId/chat',
  CabShare: 'rides/cab',
  FindACabShare: 'rides/cab/find',
  PublishACabShare: 'rides/cab/publish',
  CabRideDetails: 'rides/cab/:rideId',
  CabRideGroupChat: 'rides/cab/:rideId/chat',
  YourRides: 'rides/mine',
  Events: 'events',
  SmartSplit: 'split',
  SmartBillSplitter: 'split/bill',
  RoommateFinder: 'roommates',
  StudyGroups: 'study-groups',
  QnaForum: 'qna',
  QnaForumPost: 'qna/:questionId',
  ClubRecruitment: 'clubs',
  AskAIBot: 'assistant',
  Profile: 'profile',
  Chat: 'chat',
  ProductChat: 'marketplace/chat',
  RoommateChat: 'roommates/chat',
  AcademicCalendar: 'calendar',
  Alerts: 'alerts',
  InitializeApiKeys: 'dev/api-keys',
  NotFound: '*',
};

/**
 * Screens whose params are whole objects (users, products, listings) passed
 * in memory. They can't be rebuilt from a URL, so opening their URL directly
 * shows the not-found screen instead of crashing.
 */
export const NON_LINKABLE_SCREENS = new Set<string>(['Chat', 'ProductChat', 'RoommateChat']);

/** Screens that can be opened without signing in. */
export const PUBLIC_SCREENS = new Set<string>([
  'AnimatedEntry',
  'LandingScreen',
  'Pathway',
  'Login',
  'SignUp',
  'Forgot',
  'NotFound',
]);

// The API-key bootstrap screen is only registered in development builds.
const { InitializeApiKeys: _devOnlyPath, ...productionPaths } = SCREEN_PATHS;
const config = {
  screens: __DEV__ ? SCREEN_PATHS : productionPaths,
} as LinkingOptions<RootStackParamList>['config'];

type NavState = Parameters<typeof defaultGetPathFromState>[0];
type Route = NavState['routes'][number];

const isPrimitive = (value: unknown) => value === null || ['string', 'number', 'boolean'].includes(typeof value);

/** Drops object-valued params so they never end up as `[object Object]` in the URL. */
function withPrimitiveParams(state: NavState): NavState {
  return {
    ...state,
    routes: state.routes.map((route: Route) => {
      const params = route.params as Record<string, unknown> | undefined;
      const nested = route.state ? { state: withPrimitiveParams(route.state as NavState) } : {};
      if (!params) return { ...route, ...nested };
      const kept = Object.fromEntries(Object.entries(params).filter(([, v]) => isPrimitive(v)));
      return { ...route, ...nested, params: Object.keys(kept).length ? kept : undefined };
    }),
  } as NavState;
}

type StateOptions = Parameters<typeof defaultGetStateFromPath>[1];
type PathOptions = Parameters<typeof defaultGetPathFromState>[1];

export function getStateFromPath(path: string, options: StateOptions = config as StateOptions) {
  const state = defaultGetStateFromPath(path, options);
  const leaf = state?.routes[state.routes.length - 1];
  if (leaf && NON_LINKABLE_SCREENS.has(leaf.name)) {
    return defaultGetStateFromPath('/__not-found__', options);
  }
  return state;
}

export function getPathFromState(state: NavState, options: PathOptions = config as PathOptions) {
  return defaultGetPathFromState(withPrimitiveParams(state), options);
}

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'yogo://'],
  config,
  getStateFromPath,
  getPathFromState,
};
