import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export const isNative = Capacitor.isNativePlatform();

/**
 * Android hardware back button. `handler` returns true when it consumed the event
 * (closed a panel, left edit mode, ...). Otherwise we ask before exiting.
 */
export function bindBackButton(handler: () => boolean, confirmExit: () => Promise<boolean>, onPause: () => void) {
  if (isNative) {
    App.addListener('backButton', async () => {
      if (handler()) return;
      if (await confirmExit()) App.exitApp();
    });
    App.addListener('pause', onPause);
  }
  // Desktop/web: Escape behaves like back
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') handler();
  });
}
