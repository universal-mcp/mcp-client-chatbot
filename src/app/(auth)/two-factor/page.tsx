"use client";

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
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MCPIcon } from "@/components/ui/mcp-icon";

export default function Component() {
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6 || !/^\d+$/.test(totpCode)) {
      setError("TOTP code must be 6 digits");
      return;
    }
    authClient.twoFactor
      .verifyTotp({
        code: totpCode,
      })
      .then((res) => {
        if (res.data?.token) {
          setSuccess(true);
          setError("");
        } else {
          setError("Invalid TOTP code");
        }
      });
  };

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 transition-colors duration-500">
      <div className="absolute inset-0 pointer-events-none z-0" />
      <Card className="w-full max-w-sm shadow-xl rounded-2xl z-10 animate-fade-in">
        <CardHeader className="flex flex-col items-center gap-2">
          <MCPIcon className="w-10 h-10 text-primary mb-2 animate-fade-in" />
          <CardTitle className="text-2xl font-bold tracking-tight">
            TOTP Verification
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Enter your 6-digit TOTP code to authenticate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="totp">TOTP Code</Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                  className="transition-all focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-500 animate-shake">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              <Button
                type="submit"
                className="w-full mt-2 font-semibold text-base transition-all duration-200"
              >
                Verify
              </Button>
            </form>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2 animate-fade-in">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-lg font-semibold">Verification Successful</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground gap-2 flex justify-center">
          <Link href="/two-factor/otp">
            <Button variant="link" size="sm">
              Switch to Email Verification
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
