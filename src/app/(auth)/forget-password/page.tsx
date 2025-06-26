"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MCPIcon } from "@/components/ui/mcp-icon";
import { useTranslations } from "next-intl";

export default function Component() {
  const t = useTranslations("Auth.ForgotPassword");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      setIsSubmitted(true);
    } catch (_err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>{t("successTitle")}</CardTitle>
            <CardDescription>{t("successDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="default">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{t("successAlert")}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsSubmitted(false)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("backToReset")}
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 transition-colors duration-500">
      <div className="absolute inset-0 pointer-events-none z-0" />
      <Card className="w-full max-w-sm shadow-xl rounded-2xl z-10 animate-fade-in">
        <CardHeader className="flex flex-col items-center gap-2">
          <MCPIcon className="w-10 h-10 text-primary mb-2 animate-fade-in" />
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("title")}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="transition-all focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {error && (
              <Alert
                variant="destructive"
                className="flex items-center gap-2 animate-shake"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t("error")}</AlertDescription>
              </Alert>
            )}
            <Button
              className="w-full mt-2 font-semibold text-base transition-all duration-200"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("sendingButton") : t("sendButton")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/sign-in">
            <Button variant="link" className="px-0">
              {t("backToSignIn")}
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
