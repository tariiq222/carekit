import { Redirect, Slot } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';

export default function PractitionerLayout() {
  const { token, user } = useAppSelector((state) => state.auth);

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.role !== 'practitioner') {
    return <Redirect href="/(patient)/(tabs)/home" />;
  }

  return <Slot />;
}
