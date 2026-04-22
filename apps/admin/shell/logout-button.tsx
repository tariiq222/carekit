'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@carekit/ui/primitives/button';

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      onClick={() => {
        window.localStorage.removeItem('admin.accessToken');
        document.cookie = 'admin.authenticated=; Path=/; SameSite=Lax; Max-Age=0';
        router.push('/login');
      }}
    >
      Sign out
    </Button>
  );
}
