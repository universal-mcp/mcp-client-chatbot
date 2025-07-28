"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useObjectState } from "@/hooks/use-object-state";

import { Loader, ArrowLeft, CheckCircle2 } from "lucide-react";
import { safe } from "ts-safe";
import { authClient } from "auth/client";
import { toast } from "sonner";
import { GithubIcon } from "ui/github-icon";
import { GoogleIcon } from "ui/google-icon";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SignInPage() {
  const t = useTranslations("Auth.SignIn");
  const forgotPasswordT = useTranslations("Auth.ForgotPassword");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSubmitted, setForgotPasswordSubmitted] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState("");

  // Get invitation ID from URL params
  const invitationId = searchParams.get("invite");

  const [formData, setFormData] = useObjectState({
    email: "",
    password: "",
  });

  const handlePostAuthRedirect = () => {
    // Check if there's a pending invitation from URL params
    if (invitationId) {
      router.push(`/accept-invitation/${invitationId}`);
    } else {
      router.push("/");
    }
  };

  const emailAndPasswordSignIn = () => {
    setLoading(true);
    safe(() =>
      authClient.signIn.email(
        {
          email: formData.email,
          password: formData.password,
          callbackURL: "/",
        },
        {
          onError(ctx) {
            toast.error(ctx.error.message || ctx.error.statusText);
          },
          onSuccess() {
            handlePostAuthRedirect();
          },
        },
      ),
    )
      .watch(() => setLoading(false))
      .unwrap();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordError("");

    try {
      await authClient.requestPasswordReset({
        email: forgotPasswordEmail,
        redirectTo: "/reset-password",
      });
      setForgotPasswordSubmitted(true);
    } catch (_err) {
      setForgotPasswordError("An error occurred. Please try again.");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const googleSignIn = () => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
      return toast.warning(t("oauthClientIdNotSet", { provider: "Google" }));

    // Check if there's a pending invitation to include in the callback URL
    const callbackURL = invitationId
      ? `/accept-invitation/${invitationId}`
      : "/";

    authClient.signIn
      .social({
        provider: "google",
        callbackURL,
      })
      .catch((e) => {
        toast.error(e.error);
      });
  };

  const githubSignIn = () => {
    if (!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID)
      return toast.warning(t("oauthClientIdNotSet", { provider: "GitHub" }));

    // Check if there's a pending invitation to include in the callback URL
    const callbackURL = invitationId
      ? `/accept-invitation/${invitationId}`
      : "/";

    authClient.signIn
      .social({
        provider: "github",
        callbackURL,
      })
      .catch((e) => {
        toast.error(e.error);
      });
  };

  // Show forgot password success state
  if (forgotPasswordSubmitted) {
    return (
      <div className="w-full h-full flex flex-col p-4 md:p-8 justify-center">
        <Card className="w-full md:max-w-md bg-background border-none mx-auto shadow-none animate-in fade-in duration-1000">
          <CardHeader className="my-4">
            <CardTitle className="text-2xl text-center my-1">
              {forgotPasswordT("successTitle")}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              {forgotPasswordT("successDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            <Alert variant="default" className="mb-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                {forgotPasswordT("successAlert")}
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setForgotPasswordSubmitted(false);
                setShowForgotPassword(false);
                setForgotPasswordEmail("");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />{" "}
              {forgotPasswordT("backToSignIn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <div className="w-full h-full flex flex-col p-4 md:p-8 justify-center">
        <Card className="w-full md:max-w-md bg-background border-none mx-auto shadow-none animate-in fade-in duration-1000">
          <CardHeader className="my-4">
            <CardTitle className="text-2xl text-center my-1">
              {forgotPasswordT("title")}
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              {forgotPasswordT("description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="forgot-email">
                  {forgotPasswordT("emailLabel")}
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder={forgotPasswordT("emailPlaceholder")}
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  className="transition-all focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {forgotPasswordError && (
                <Alert
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <AlertDescription>{forgotPasswordError}</AlertDescription>
                </Alert>
              )}
              <Button
                className="w-full"
                type="submit"
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? (
                  <Loader className="size-4 animate-spin ml-1" />
                ) : (
                  forgotPasswordT("sendButton")
                )}
              </Button>
            </form>
            <Button
              variant="link"
              className="w-full mt-4"
              onClick={() => {
                setShowForgotPassword(false);
                setForgotPasswordEmail("");
                setForgotPasswordError("");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />{" "}
              {forgotPasswordT("backToSignIn")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 justify-center">
      <Card className="w-full md:max-w-md bg-background border-none mx-auto shadow-none animate-in fade-in duration-1000">
        <CardHeader className="my-4">
          <CardTitle className="text-2xl text-center my-1">
            {t("title")}
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            {t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                autoFocus
                disabled={loading}
                value={formData.email}
                onChange={(e) => setFormData({ email: e.target.value })}
                type="email"
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                disabled={loading}
                value={formData.password}
                placeholder="********"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    emailAndPasswordSignIn();
                  }
                }}
                onChange={(e) => setFormData({ password: e.target.value })}
                type="password"
                required
              />
            </div>
            <div className="flex justify-end -mt-7">
              <Button
                variant="link"
                className="px-1 h-auto text-sm text-muted-foreground hover:text-primary"
                onClick={() => setShowForgotPassword(true)}
              >
                Forgot password?
              </Button>
            </div>
            <Button
              className="w-full -mt-2"
              onClick={emailAndPasswordSignIn}
              disabled={loading}
            >
              {loading ? (
                <Loader className="size-4 animate-spin ml-1" />
              ) : (
                t("signIn")
              )}
            </Button>
          </div>
          <div className="flex items-center my-4">
            <div className="flex-1 h-px bg-accent"></div>
            <span className="px-4 text-sm text-muted-foreground">
              {t("orContinueWith")}
            </span>
            <div className="flex-1 h-px bg-accent"></div>
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={googleSignIn}
              className="flex-1 "
            >
              <GoogleIcon className="size-4 fill-foreground" />
              Google
            </Button>
            <Button variant="outline" onClick={githubSignIn} className="flex-1">
              <GithubIcon className="size-4 fill-foreground" />
              GitHub
            </Button>
          </div>

          <div className="my-8 text-center text-sm text-muted-foreground">
            {t("noAccount")}
            <Link
              href={
                invitationId ? `/sign-up?invite=${invitationId}` : "/sign-up"
              }
              className="underline-offset-4 text-primary"
            >
              {t("signUp")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
