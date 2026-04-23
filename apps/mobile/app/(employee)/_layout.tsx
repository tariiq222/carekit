import { Redirect, Slot } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { getMobileRole } from '@/types/auth';

export default function EmployeeLayout() {
  const { token, user } = useAppSelector((state) => state.auth);

  usePushNotifications(!!token);

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!user || getMobileRole(user) !== 'employee') {
    return <Redirect href="/(client)/(tabs)/home" />;
  }

  return <Slot />;
}
