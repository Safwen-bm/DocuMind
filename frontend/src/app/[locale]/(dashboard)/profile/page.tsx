// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\app\[locale]\(dashboard)\profile\page.tsx
"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { useAuthStore } from "@/store/auth.store";
import { userApi } from "@/lib/user.api";
import { AvatarUpload } from "@/components/dashboard/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Lock,
  Mail,
  Calendar,
  CheckCircle,
  Loader2,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "profile" | "password";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const { user, setAuth } = useAuthStore();
  const [tab, setTab] = useState<Tab>("profile");

  const [nom, setNom] = useState(user?.nom ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const locale = useLocale();

  useEffect(() => {
    if (user) {
      setNom(user.nom);
      setAvatarUrl(user.avatarUrl ?? "");
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data?: { nom?: string; avatarUrl?: string }) =>
      userApi.updateProfile(data ?? { nom, avatarUrl: avatarUrl || undefined }),
    onSuccess: (updated) => {
      setAuth(updated);
      setProfileSaved(true);
      setProfileError("");
      setTimeout(() => setProfileSaved(false), 2500);
    },
    onError: (err: any) => {
      setProfileError(err.response?.data?.message || "Something went wrong.");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => userApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: any) => {
      setPasswordError(err.response?.data?.message || "Something went wrong.");
    },
  });

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    updateMutation.mutate(undefined);
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("password.mismatch"));
      return;
    }
    passwordMutation.mutate();
  }

  function handleAvatarUpload(url: string) {
    setAvatarUrl(url);
    // Immediately save the new avatar URL to the backend
    updateMutation.mutate({ nom, avatarUrl: url });
  }

  const initials = user?.nom
    ? user.nom
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "profile", label: t("tabs.profile"), icon: User },
    { key: "password", label: t("tabs.password"), icon: Lock },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex gap-8">
        {/* Left: tab navigation — desktop */}
        <aside className="hidden w-48 shrink-0 sm:block">
          <nav className="space-y-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  tab === key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile tab bar */}
        <div className="flex gap-2 sm:hidden mb-6 w-full">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                tab === key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-6">

          {/* ── PROFILE TAB ── */}
          {tab === "profile" && (
            <>
              {/* Avatar card */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-5 text-sm font-semibold text-foreground">
                  {t("sections.avatar")}
                </h2>
                <div className="flex items-center gap-5">
                  {/* Cloudinary upload component */}
                  <AvatarUpload
                    currentUrl={avatarUrl}
                    initials={initials}
                    onUpload={handleAvatarUpload}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{user?.nom}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Click the camera icon to upload a new photo.
                      JPG, PNG or GIF. Max 5MB.
                    </p>
                    {/* Save status indicator */}
                    {updateMutation.isPending && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </p>
                    )}
                    {profileSaved && (
                      <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Avatar updated
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal info card */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="mb-5 text-sm font-semibold text-foreground">
                  {t("sections.personalInfo")}
                </h2>
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nom">{t("fields.name")}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="nom"
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("fields.email")}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={user?.email ?? ""}
                          disabled
                          className="pl-9 opacity-60"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("fields.emailNote")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>
                      {t("fields.memberSince")}{" "}
                      <span className="font-medium text-foreground">
                        {new Date().toLocaleDateString(
                          locale === "ar"
                            ? "ar-TN"
                            : locale === "fr"
                            ? "fr-FR"
                            : "en-US",
                          { month: "long", year: "numeric" }
                        )}
                      </span>
                    </span>
                  </div>

                  {profileError && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {profileError}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      disabled={updateMutation.isPending || profileSaved}
                      className="gap-2 min-w-[130px]"
                    >
                      {updateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("saving")}
                        </>
                      ) : profileSaved ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          {t("saved")}
                        </>
                      ) : (
                        t("save")
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* ── PASSWORD TAB ── */}
          {tab === "password" && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("sections.changePassword")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t("sections.changePasswordDesc")}
                  </p>
                </div>
              </div>

              {passwordSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    {t("password.success")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("password.successDesc")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5"
                    onClick={() => setPasswordSuccess(false)}
                  >
                    {t("password.changeAgain")}
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={handlePasswordSave}
                  className="space-y-4 max-w-md"
                >
                  <div className="space-y-2">
                    <Label htmlFor="currentPass">{t("password.current")}</Label>
                    <Input
                      id="currentPass"
                      type="password"
                      placeholder={t("password.currentPlaceholder")}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPass">{t("password.new")}</Label>
                    <Input
                      id="newPass"
                      type="password"
                      placeholder={t("password.newPlaceholder")}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPass">{t("password.confirm")}</Label>
                    <Input
                      id="confirmPass"
                      type="password"
                      placeholder={t("password.confirmPlaceholder")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    {confirmPassword && (
                      <p
                        className={cn(
                          "text-xs flex items-center gap-1",
                          newPassword === confirmPassword
                            ? "text-green-500"
                            : "text-destructive"
                        )}
                      >
                        {newPassword === confirmPassword ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            {t("password.match")}
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3" />
                            {t("password.mismatch")}
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  {passwordError && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {passwordError}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={passwordMutation.isPending}
                      className="gap-2 min-w-[130px]"
                    >
                      {passwordMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("saving")}
                        </>
                      ) : (
                        t("save")
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}