import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import { notificationsService } from '@/services/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

async function requestPermission(): Promise<boolean> {
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function getDeviceToken(): Promise<string | null> {
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData.data;
  } catch (error) {
    console.warn('[Push] Failed to get device push token:', error);
    return null;
  }
}

/**
 * Registers the device for FCM push notifications when the user is
 * authenticated. On cleanup (logout / unmount) it unregisters the token
 * from the backend so stale tokens are not left behind.
 *
 * Usage:
 *   const token = useAppSelector((s) => s.auth.token);
 *   usePushNotifications(!!token);
 */
export function usePushNotifications(isAuthenticated: boolean): void {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    async function register() {
      if (!Device.isDevice) {
        console.log('[Push] Skipped — push notifications require a physical device');
        return;
      }

      const granted = await requestPermission();
      if (!granted) {
        console.log('[Push] Permission denied by user');
        return;
      }

      await setupAndroidChannel();

      const token = await getDeviceToken();
      if (cancelled || !token) return;

      const platform: 'ios' | 'android' =
        Platform.OS === 'ios' ? 'ios' : 'android';

      try {
        await notificationsService.registerFcmToken(token, platform);
        registeredRef.current = true;
        console.log('[Push] FCM token registered successfully');
      } catch (error) {
        console.warn('[Push] Failed to register FCM token:', error);
      }
    }

    register();

    return () => {
      cancelled = true;

      if (registeredRef.current) {
        notificationsService.unregisterFcmToken().catch(() => {});
        registeredRef.current = false;
      }
    };
  }, [isAuthenticated]);
}
