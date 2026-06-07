// frontend/src/app/[locale]/(auth)/verify-otp/page.tsx

"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";  // ← add useSearchParams
import { Brain, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export default function VerifyOtpPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const searchParams = useSearchParams();                          // ← new
  const redirect = searchParams.get("redirect");                  // ← new
  const t = useTranslations("auth.otp");
  const tErr = useTranslations("auth.errors");
  const { pendingEmail, setAuth, setJustLoggedIn } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const otp = formData.get("otp") as string;

    try {
      const res = await api.post("/auth/verify-otp", {
        email: pendingEmail,
        otp,
      });
      setAuth(res.data.user);
      setJustLoggedIn(true);

      if (typeof window !== "undefined") {
        document.cookie = `access_token=${res.data.accessToken}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      }

      // ── redirect to invitation page if we came from one, else dashboard ──
      if (redirect) {
        router.push(decodeURIComponent(redirect));   // ← the fix
      } else {
        router.push(`/${locale}/dashboard`);
      }
    } catch {
      setError(tErr("invalidOtp"));
    } finally {
      setLoading(false);
    }
  }

  // resend stays exactly the same
  async function handleResend() {
    setResending(true);
    setError("");
    try {
      await api.post("/auth/login", {
        email: pendingEmail,
        motDePasse: "resend-trigger",
      });
    } catch {
      // expected to fail on password — just need the OTP resent
    }
    setSuccess("Code resent. Check your email.");
    setResending(false);
  }

  if (!pendingEmail) {
    router.push(`/${locale}/login`);
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href={`/${locale}`} className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">DocuMind</span>
        </Link>

        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("subtitle")}{" "}
          <span className="font-medium text-foreground">{pendingEmail}</span>
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">{t("label")}</Label>
            <Input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              required
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <button
            onClick={handleResend}
            disabled={resending}
            className="font-medium text-primary hover:underline disabled:opacity-50"
          >
            {resending ? <Loader2 className="inline h-3 w-3 animate-spin" /> : t("resend")}
          </button>
        </div>

        <div className="mt-3 text-center">
          <Link href={`/${locale}/login`} className="text-sm text-muted-foreground hover:underline">
            {t("back")}
          </Link>
        </div>
      </div>
    </div>
  );
}