import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAppSelector, useAppDispatch } from '@/hooks/use-redux';
import { setCredentials } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import { getMobileRole } from '@/types/auth';
import { SplashWelcome } from '@/components/SplashWelcome';
import { C } from '@/theme/glass';

export default function IndexScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    async function hydrate() {
      if (token && user) {
        setHydrating(false);
        return;
      }

      const stored = await authService.getStoredTokens();
      if (stored.accessToken && stored.kind) {
        try {
          const user = await authService.hydrate();
          if (user) {
            dispatch(
              setCredentials({
                accessToken: stored.accessToken,
                refreshToken: stored.refreshToken ?? '',
                user,
              }),
            );
          }
        } catch {
          // Token expired or invalid — fall through to splash
        }
      }
      setHydrating(false);
    }

    hydrate();
  }, [dispatch, token, user]);

  useEffect(() => {
    if (hydrating) return;
    if (!token || !user) return;

    const role = getMobileRole(user);
    if (role === 'employee') {
      router.replace('/(employee)/(tabs)/today');
    } else {
      router.replace('/(client)/(tabs)/home');
    }
  }, [hydrating, token, user, router]);

  const handleContinue = useCallback(() => {
    router.replace('/(auth)/login');
  }, [router]);

  if (hydrating) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgBot }}>
        <ActivityIndicator size="large" color={C.deepTeal} />
      </View>
    );
  }

  if (!token || !user) {
    return <SplashWelcome onContinue={handleContinue} />;
  }

  return null;
}
