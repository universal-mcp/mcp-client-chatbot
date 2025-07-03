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
import { cn } from "lib/utils";
import { ChevronLeft, Loader } from "lucide-react";
import { toast } from "sonner";
import { safe } from "ts-safe";
import { UserZodSchema } from "app-types/user";
import { existsByEmailAction } from "@/app/api/auth/actions";
import { authClient } from "auth/client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function SignUpPage() {
  const t = useTranslations();
  const [step, setStep] = useState(1);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useObjectState({
    email: "",
    name: "",
    password: "",
  });

  const steps = [
    t("Auth.SignUp.step1"),
    t("Auth.SignUp.step2"),
    t("Auth.SignUp.step3"),
  ];

  const safeProcessWithLoading = function <T>(fn: () => Promise<T>) {
    setIsLoading(true);
    return safe(() => fn()).watch(() => setIsLoading(false));
  };

  const backStep = () => {
    setStep(Math.max(step - 1, 1));
  };

  const successEmailStep = async () => {
    const { success } = UserZodSchema.shape.email.safeParse(formData.email);
    if (!success) {
      toast.error(t("Auth.SignUp.invalidEmail"));
      return;
    }
    const exists = await safeProcessWithLoading(() =>
      existsByEmailAction(formData.email),
    ).orElse(false);
    if (exists) {
      toast.error(t("Auth.SignUp.emailAlreadyExists"));
      return;
    }
    setStep(2);
  };

  const successNameStep = () => {
    const { success } = UserZodSchema.shape.name.safeParse(formData.name);
    if (!success) {
      toast.error(t("Auth.SignUp.nameRequired"));
      return;
    }
    setStep(3);
  };

  const successPasswordStep = async () => {
    const { success } = UserZodSchema.shape.password.safeParse(
      formData.password,
    );
    if (!success) {
      toast.error(t("Auth.SignUp.passwordRequired"));
      return;
    }
    await safeProcessWithLoading(() =>
      authClient.signUp.email(
        {
          email: formData.email,
          password: formData.password,
          name: formData.name,
        },
        {
          onError(ctx) {
            toast.error(ctx.error.message || ctx.error.statusText);
          },
          onSuccess() {
            router.push("/");
          },
        },
      ),
    ).unwrap();
  };

  return (
    <div className="animate-in fade-in duration-1000 w-full h-full flex flex-col p-4 md:p-8 justify-center relative">
      <div className="w-full flex justify-end absolute top-0 right-0">
        <Link href="/sign-in">
          <Button variant="ghost">{t("Auth.SignUp.signIn")}</Button>
        </Link>
      </div>
      <Card className="w-full md:max-w-md bg-background border-none mx-auto gap-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-2xl text-center ">
            {t("Auth.SignUp.title")}
          </CardTitle>
          <CardDescription className="py-12">
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground text-right">
                Step {step} of {steps.length}
              </p>
              <div className="h-2 w-full relative bg-input">
                <div
                  style={{
                    width: `${(step / 3) * 100}%`,
                  }}
                  className="h-full bg-primary transition-all duration-300"
                ></div>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {step === 1 && (
              <div className={cn("flex flex-col gap-2")}>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@example.com"
                  disabled={isLoading}
                  autoFocus
                  value={formData.email}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      e.nativeEvent.isComposing === false
                    ) {
                      successEmailStep();
                    }
                  }}
                  onChange={(e) => setFormData({ email: e.target.value })}
                  required
                />
              </div>
            )}
            {step === 2 && (
              <div className={cn("flex flex-col gap-2")}>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jane Doe"
                  disabled={isLoading}
                  autoFocus
                  value={formData.name}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      e.nativeEvent.isComposing === false
                    ) {
                      successNameStep();
                    }
                  }}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  required
                />
              </div>
            )}
            {step === 3 && (
              <div className={cn("flex flex-col gap-2")}>
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  disabled={isLoading}
                  autoFocus
                  value={formData.password}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      e.nativeEvent.isComposing === false
                    ) {
                      successPasswordStep();
                    }
                  }}
                  onChange={(e) => setFormData({ password: e.target.value })}
                  required
                />
              </div>
            )}
            <p className="text-muted-foreground text-xs mb-6">
              {steps[step - 1]}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={isLoading}
                className={cn(step === 1 && "opacity-0", "w-1/2")}
                variant="ghost"
                onClick={backStep}
              >
                <ChevronLeft className="size-4" />
                {t("Common.back")}
              </Button>
              <Button
                disabled={isLoading}
                className="w-1/2"
                onClick={() => {
                  if (step === 1) successEmailStep();
                  if (step === 2) successNameStep();
                  if (step === 3) successPasswordStep();
                }}
              >
                {step === 3 ? t("Auth.SignUp.createAccount") : t("Common.next")}
                {isLoading && <Loader className="size-4 ml-2" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
