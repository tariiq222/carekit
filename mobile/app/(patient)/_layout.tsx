import { Redirect, Slot } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';

export default function PatientLayout() {
  const { token, user } = useAppSelector((state) => state.auth);

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.role === 'practitioner') {
    return <Redirect href="/(practitioner)/(tabs)/today" />;
  }

  return <Slot />;
}
