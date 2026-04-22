'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@carekit/ui/primitives/button';
import { Input } from '@carekit/ui/primitives/input';
import { Label } from '@carekit/ui/primitives/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@carekit/ui/primitives/card';
import { adminApi } from '@/lib/api';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { accessToken, user } = await adminApi.login(email, password);
      if (!user?.isSuperAdmin) {
        toast.error('This account is not authorized for the super-admin panel.');
        return;
      }
      if (!accessToken) {
        toast.error('Login succeeded but no access token was returned.');
        return;
      }
      window.localStorage.setItem('admin.accessToken', accessToken);
      document.cookie = `admin.authenticated=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`;
      router.push(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>CareKit Super-admin</CardTitle>
          <CardDescription>Platform staff only. Sign in with your CareKit account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
