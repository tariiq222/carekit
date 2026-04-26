"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@carekit/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@carekit/ui/primitives/card";
import { Input } from "@carekit/ui/primitives/input";
import { Label } from "@carekit/ui/primitives/label";
import { requestPasswordReset } from "./forgot-password.api";

export function ForgotPasswordForm() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const t = useTranslations("forgotPassword");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch {
      setError(t("requestFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("successTitle")}</CardTitle>
            <CardDescription>{t("successBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/login"
              className="text-sm text-primary hover:underline"
            >
              {t("back")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? t("submitting") : t("submit")}
            </Button>
            <Link
              href="/login"
              className="text-sm text-primary hover:underline text-center"
            >
              {t("back")}
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
