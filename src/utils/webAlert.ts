import type { AlertButton } from 'react-native';

type AlertFn = (title: string, message?: string, buttons?: AlertButton[]) => void;

interface BrowserDialogs {
  alert: (text: string) => void;
  confirm: (text: string) => boolean;
}

/**
 * react-native-web implements `Alert.alert` as a no-op, so on the web build
 * every error, confirmation and success message would silently disappear.
 * This maps it onto the browser's own dialogs:
 *
 * - zero or one button → `window.alert`, then that button's `onPress`
 * - two or more → `window.confirm`; OK runs the last non-cancel button,
 *   Cancel runs the cancel button (if any)
 */
export function createWebAlert(dialogs: BrowserDialogs): AlertFn {
  return (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = buttons ?? [];

    if (list.length <= 1) {
      dialogs.alert(text);
      list[0]?.onPress?.();
      return;
    }

    const cancel = list.find((b) => b.style === 'cancel');
    const confirmButtons = list.filter((b) => b !== cancel);
    const primary = confirmButtons[confirmButtons.length - 1];
    if (dialogs.confirm(text)) primary?.onPress?.();
    else cancel?.onPress?.();
  };
}

/** Replaces `Alert.alert` on web. No-op on iOS/Android. */
export function installWebAlert(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Alert, Platform } = require('react-native') as typeof import('react-native');
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = createWebAlert({
    alert: (text) => window.alert(text),
    confirm: (text) => window.confirm(text),
  });
}
