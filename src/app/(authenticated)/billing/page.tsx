"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "ui/card";
import { Button } from "ui/button";
import { Badge } from "ui/badge";
import {
  Check,
  Loader2,
  CreditCard,
  Calendar,
  Users,
  AlertCircle,
} from "lucide-react";
import { authClient } from "auth/client";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "ui/alert";
import useSWR from "swr";

interface SubscriptionPlan {
  id: string;
  name: string;
}

const plans: SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
  },
  {
    id: "pro",
    name: "Pro",
  },
];

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();

  // Fetch current subscription data
  const { data: subscriptions, mutate: mutateSubscriptions } = useSWR(
    session ? "subscriptions" : null,
    async () => {
      const result = await authClient.subscription.list();
      return result.data || [];
    },
  );

  const currentSubscription = subscriptions?.[0];
  const currentPlan = currentSubscription?.plan || "free";

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    if (plan.id === "free") {
      toast.info("You're already on the free plan");
      return;
    }

    try {
      setLoading(plan.id);

      const result = await authClient.subscription.upgrade({
        plan: plan.id,
        successUrl: `${window.location.origin}/billing?success=true`,
        cancelUrl: `${window.location.origin}/billing`,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to upgrade subscription");
        return;
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      setLoading("manage");

      // This would open the billing portal
      const result = await authClient.subscription.cancel({
        returnUrl: `${window.location.origin}/billing`,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to open billing portal");
      }
    } catch (error) {
      console.error("Billing portal error:", error);
      toast.error("Failed to open billing portal");
    } finally {
      setLoading(null);
    }
  };

  // Check for success parameter and refresh data
  const success = searchParams.get("success");

  useEffect(() => {
    if (success) {
      // Refresh subscription data when returning from successful checkout
      mutateSubscriptions();
      // Clean up URL
      router.replace(`/billing`);
    }
  }, [success, mutateSubscriptions, router]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Billing & Subscription
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription and billing preferences
        </p>
      </div>

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
          <Check className="h-4 w-4" />
          <AlertDescription>
            Success! Your subscription has been activated. Welcome to Pro!
          </AlertDescription>
        </Alert>
      )}

      {/* Current Subscription Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-semibold">
                  {currentPlan === "free" ? "Free Plan" : "Pro Plan"}
                </span>
                <Badge variant="secondary">Current</Badge>
                {currentSubscription?.status && (
                  <Badge
                    variant={
                      currentSubscription.status === "active"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {currentSubscription.status}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {currentPlan === "free"
                  ? "You're currently on the free plan"
                  : "You have an active Pro subscription"}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                ${currentPlan === "free" ? "0" : "20"}
              </div>
              <div className="text-sm text-muted-foreground">per month</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlan;
          return (
            <Card key={plan.id}>
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  {plan.id === "free" ? "Free plan" : "Pro plan"}
                </CardDescription>
              </CardHeader>

              <CardFooter className="pt-6">
                {isCurrentPlan ? (
                  <div className="w-full space-y-2">
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                    {plan.id !== "free" && currentSubscription && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={handleManageBilling}
                        disabled={loading === "manage"}
                      >
                        {loading === "manage" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading...
                          </>
                        ) : (
                          "Cancel"
                        )}
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(plan)}
                    disabled={loading === plan.id}
                    variant={plan.id === "free" ? "outline" : "default"}
                  >
                    {loading === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : plan.id === "free" && currentPlan === "pro" ? (
                      "Default"
                    ) : (
                      "Upgrade Now"
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Billing Information */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Billing Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Next billing date</span>
              <span className="text-sm text-muted-foreground">
                {currentSubscription?.periodEnd
                  ? new Date(currentSubscription.periodEnd).toLocaleDateString()
                  : "No upcoming billing"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm font-medium">Payment method</span>
              <span className="text-sm text-muted-foreground">
                {currentSubscription
                  ? "Card ending in ••••"
                  : "No payment method"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium">Billing email</span>
              <span className="text-sm text-muted-foreground">
                {session?.user?.email}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Section */}
      <Alert className="mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Need help with billing? Contact our support team at{" "}
          <a href="mailto:support@agentr.dev" className="underline">
            support@agentr.dev
          </a>
        </AlertDescription>
      </Alert>
    </div>
  );
}
