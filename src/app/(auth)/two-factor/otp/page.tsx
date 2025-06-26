"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MCPIcon } from "@/components/ui/mcp-icon";

export default function Component() {
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  // In a real app, this email would come from your authentication context
  const userEmail = "user@example.com";

  const requestOTP = async () => {
    await authClient.twoFactor.sendOtp();
    // In a real app, this would call your backend API to send the OTP
    setMessage("OTP sent to your email");
    setIsError(false);
    setIsOtpSent(true);
  };
  const router = useRouter();

  const validateOTP = async () => {
    const res = await authClient.twoFactor.verifyOtp({
      code: otp,
    });
    if (res.data) {
      setMessage("OTP validated successfully");
      setIsError(false);
      setIsValidated(true);
      router.push("/");
    } else {
      setIsError(true);
      setMessage("Invalid OTP");
    }
  };
  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 transition-colors duration-500">
      <div className="absolute inset-0 pointer-events-none z-0" />
      <Card className="w-full max-w-sm shadow-xl rounded-2xl z-10 animate-fade-in">
        <CardHeader className="flex flex-col items-center gap-2">
          <MCPIcon className="w-10 h-10 text-primary mb-2 animate-fade-in" />
          <CardTitle className="text-2xl font-bold tracking-tight">
            Two-Factor Authentication
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Verify your identity with a one-time password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            {!isOtpSent ? (
              <Button
                onClick={requestOTP}
                className="w-full font-semibold text-base transition-all duration-200"
              >
                <Mail className="mr-2 h-4 w-4" /> Send OTP to Email
              </Button>
            ) : (
              <>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="otp">One-Time Password</Label>
                  <Label className="py-2">
                    Check your email at {userEmail} for the OTP
                  </Label>
                  <Input
                    id="otp"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    className="transition-all focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <Button
                  onClick={validateOTP}
                  disabled={otp.length !== 6 || isValidated}
                  className="w-full mt-2 font-semibold text-base transition-all duration-200"
                >
                  Validate OTP
                </Button>
              </>
            )}
          </div>
          {message && (
            <div
              className={`flex items-center gap-2 mt-4 ${isError ? "text-red-500 animate-shake" : "text-primary animate-fade-in"}`}
            >
              {isError ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <p className="text-sm">{message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
