import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './src/App';
import { installWebAlert } from './src/utils/webAlert';

// react-native-web's Alert.alert does nothing; use the browser's dialogs instead.
installWebAlert();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and sets up the environment for both Expo Go and native builds.
registerRootComponent(App);
