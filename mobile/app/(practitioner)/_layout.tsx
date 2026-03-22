import { Redirect, Slot } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';

export default function PractitionerLayout() {
  const { token, user } = useAppSelector((state) => state.auth);

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!user || getPrimaryRole(user) !== 'practitioner') {
    return <Redirect href="/(patient)/(tabs)/home" />;
  }

  return <Slot />;
}
