import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';

export default function IndexScreen() {
  const router = useRouter();
  const { token, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!token) {
      router.replace('/(auth)/login');
      return;
    }

    if (user?.role === 'practitioner') {
      router.replace('/(practitioner)/(tabs)/today');
    } else {
      router.replace('/(patient)/(tabs)/home');
    }
  }, [token, user, router]);

  return null;
}
