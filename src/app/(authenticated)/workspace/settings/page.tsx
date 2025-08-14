"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Users,
  Settings,
  Loader,
  Check,
  CreditCard,
  Coins,
} from "lucide-react";
import { useActiveOrganization, authClient } from "@/lib/auth/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { OrganizationCard } from "@/components/organization/organization-card";
import useSWR from "swr";
import { EditOrganizationModal } from "@/components/organization/edit-organization-modal";
import { CreateOrganizationModal } from "@/components/organization/create-organization-modal";
import { DeleteWorkspaceModal } from "@/components/organization/delete-workspace-modal";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // USD per month
  credits: number | "unlimited"; // monthly credits
}

const plans: SubscriptionPlan[] = [
  { id: "free", name: "Free", price: 0, credits: 0 },
  { id: "pro", name: "Pro", price: 10, credits: 1000 },
  { id: "plus", name: "Plus", price: 100, credits: "unlimited" },
  { id: "max", name: "Max", price: 1000, credits: "unlimited" },
];

export default function WorkspaceSettingsPage() {
  const { data: activeOrganization } = useActiveOrganization();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  // Fetch user role to check admin permissions
  const { data: userRole, isLoading: isLoadingRole } = useSWR(
    "user-role",
    async () => {
      const response = await fetch("/api/user/role");
      if (!response.ok) {
        throw new Error("Failed to fetch user role");
      }
      return response.json();
    },
    {
      revalidateOnFocus: false,
    },
  );

  const isPersonalWorkspace = !activeOrganization?.id;
  const isAdmin = isPersonalWorkspace || (userRole?.isAdmin ?? false);
  const referenceId = isPersonalWorkspace
    ? session?.user.id
    : activeOrganization?.id;

  // Fetch current subscription data
  const {
    data: subscriptions,
    mutate: mutateSubscriptions,
    isLoading: isLoadingSubscriptions,
  } = useSWR(
    session && referenceId ? `subscriptions-${referenceId}` : null,
    async () => {
      const res = await fetch(`/api/subscription/list`);
      if (!res.ok) return [];
      return res.json();
    },
  );

  const currentSubscription = subscriptions?.[0];
  const currentPlan = currentSubscription?.plan || "free";
  const isUnlimited = currentPlan === "plus" || currentPlan === "max";
  const currentPlanDetails =
    plans.find((p) => p.id === currentPlan) || plans[0];
  // isUnlimited already computed above

  // Fetch credit balance only for non-unlimited plans
  const {
    data: creditBalance,
    isLoading: isLoadingCredits,
    mutate: mutateCreditBalance,
  } = useSWR(
    referenceId && !isUnlimited ? `credit-balance-${referenceId}` : null,
    async () => {
      const response = await fetch("/api/credits/balance");
      if (!response.ok) {
        throw new Error("Failed to fetch credit balance");
      }
      const data = await response.json();
      return data.balance;
    },
  );

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    if (plan.id === "free") {
      toast.info("You're already on the free plan");
      return;
    }

    if (!referenceId) {
      toast.error("Could not find a reference to create a subscription");
      return;
    }

    try {
      setLoading(plan.id);

      const res = await fetch(`/api/subscription/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan.id,
          referenceId,
          isWorkspace: !isPersonalWorkspace,
          successUrl: `${window.location.origin}/workspace/settings?success=true`,
          cancelUrl: `${window.location.origin}/workspace/settings`,
          subscriptionId: currentSubscription?.id,
          metadata: { referenceId },
        }),
      });
      if (!res.ok) {
        toast.error("Failed to upgrade subscription");
        return;
      }
      const data = await res.json();
      if (data?.url && data.redirect !== false) {
        window.location.href = data.url as string;
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!referenceId) {
      toast.error("Could not find a reference to manage billing");
      return;
    }

    try {
      setLoading("manage");

      const res = await fetch(`/api/subscription/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceId,
          returnUrl: `${window.location.origin}/workspace/settings`,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to open billing portal");
        return;
      }
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url as string;
      }
    } catch (error) {
      console.error("Billing portal error:", error);
      toast.error("Failed to open billing portal");
    } finally {
      setLoading(null);
    }
  };

  const success = searchParams.get("success");

  useEffect(() => {
    if (success) {
      mutateSubscriptions();
      if (!isUnlimited && referenceId) {
        mutateCreditBalance();
      }
      router.replace(`/workspace/settings`);
    }
  }, [success, mutateSubscriptions, router]);

  const handleEditClick = () => {
    if (!isAdmin) {
      toast.error("Only administrators can edit workspace details");
      return;
    }
    setIsEditModalOpen(true);
  };

  const authLoading = session === undefined;
  const orgPending = typeof activeOrganization === "undefined";
  const subsPending =
    session && referenceId ? Boolean(isLoadingSubscriptions) : false;
  const creditsPending =
    referenceId && !isUnlimited ? Boolean(isLoadingCredits) : false;

  if (
    authLoading ||
    orgPending ||
    isLoadingRole ||
    subsPending ||
    creditsPending
  ) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Workspace Settings</h1>
        </div>
      </div>

      {!isPersonalWorkspace && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-lg">
                <AvatarImage
                  src={activeOrganization?.logo || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                  {activeOrganization?.name?.charAt(0) || (
                    <Building2 className="h-5 w-5" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  {activeOrganization?.name || "Personal Workspace"}
                  {isPersonalWorkspace && (
                    <Badge variant="secondary" className="text-xs">
                      Personal
                    </Badge>
                  )}
                </CardTitle>
              </div>
              {!isPersonalWorkspace && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditClick}
                  disabled={!isAdmin}
                  className={!isAdmin ? "opacity-50 cursor-not-allowed" : ""}
                  title={
                    !isAdmin
                      ? "Only administrators can edit workspace details"
                      : ""
                  }
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {!isPersonalWorkspace && (
        <>
          <Separator />
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Member Management
              </h2>
            </div>
            <OrganizationCard isAdmin={isAdmin} />
          </div>
        </>
      )}

      {isPersonalWorkspace && (
        <>
          <Separator />
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      Personal Workspace
                    </CardTitle>
                    <CardDescription>
                      Your private space for individual projects and experiments
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">Ready to collaborate?</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Create a workspace or switch to one to invite team members
                      and work together.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <Separator />
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Billing & Subscription
              </h2>
            </div>
            {success && (
              <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Success! Your subscription has been activated. Welcome to Pro!
                </AlertDescription>
              </Alert>
            )}

            {null}

            <Card className="mb-8">
              <CardContent className="">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Coins className="h-4 w-4" />
                  <span>Credits</span>
                </div>
                <div className="mt-1 text-3xl font-bold">
                  {isUnlimited ? "∞" : (creditBalance ?? "...")}
                </div>
                <div className="mt-4 flex items-center justify-start">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Current Plan
                    </span>
                    <Badge variant="secondary">{currentPlanDetails.name}</Badge>
                  </div>
                </div>
                {currentPlan !== "free" && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    <div>Billing email: {session?.user?.email}</div>
                    {currentSubscription?.periodEnd && (
                      <div>
                        {currentSubscription.cancelAtPeriodEnd ? (
                          <>
                            Set to be cancelled on:{" "}
                            {new Date(
                              currentSubscription.periodEnd,
                            ).toLocaleDateString()}
                          </>
                        ) : (
                          <>
                            Next billing date:{" "}
                            {new Date(
                              currentSubscription.periodEnd,
                            ).toLocaleDateString()}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {currentSubscription && currentPlan !== "free" && (
                  <div className="mt-4">
                    {currentSubscription.cancelAtPeriodEnd ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm border border-primary/20 hover:shadow-md transition-all duration-200"
                        onClick={async () => {
                          try {
                            setLoading("restore");
                            const res = await fetch(
                              `/api/subscription/restore`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  subscriptionId: currentSubscription.id,
                                  referenceId,
                                }),
                              },
                            );
                            if (!res.ok) {
                              toast.error("Failed to restore subscription");
                            } else {
                              toast.success("Subscription restored");
                              mutateSubscriptions();
                            }
                          } catch (error) {
                            console.error("Restore error:", error);
                            toast.error("Failed to restore subscription");
                          } finally {
                            setLoading(null);
                          }
                        }}
                        disabled={loading === "restore"}
                      >
                        {loading === "restore" ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin mr-2" />
                            Restoring...
                          </>
                        ) : (
                          "Restore"
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleManageBilling}
                        disabled={loading === "manage"}
                      >
                        {loading === "manage" ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin mr-2" />
                            Loading...
                          </>
                        ) : (
                          "Cancel"
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-6">
              {plans
                .filter((plan) => plan.id !== "free")
                .map((plan) => {
                  const isCurrentPlan = plan.id === currentPlan;
                  return (
                    <Card key={plan.id}>
                      <CardHeader className="text-center pb-4">
                        <CardTitle className="text-xl flex items-center justify-center gap-2">
                          {plan.name}
                          <Badge variant="secondary">
                            ${plan.price}/{plan.id === "pro" ? "week" : "mo"}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {plan.credits === "unlimited"
                            ? "Unlimited credits"
                            : plan.credits > 0
                              ? `${plan.credits.toLocaleString()} credits/${plan.id === "pro" ? "week" : "month"}`
                              : "Free plan"}
                        </CardDescription>
                      </CardHeader>

                      <CardFooter className="pt-6">
                        {isCurrentPlan ? (
                          <div className="w-full space-y-2">
                            <Button
                              variant="outline"
                              className="w-full"
                              disabled
                            >
                              Current Plan
                            </Button>
                          </div>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => handleUpgrade(plan)}
                            disabled={loading === plan.id}
                            variant="default"
                          >
                            {loading === plan.id ? (
                              <>
                                <Loader className="h-4 w-4 animate-spin mr-2" />
                                Processing...
                              </>
                            ) : (
                              "Switch"
                            )}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
            </div>

            {null}
          </div>
        </>
      )}

      {!isPersonalWorkspace && isAdmin && (
        <>
          <Separator />
          <div className="space-y-4 rounded-lg border border-destructive/50 p-4">
            <h3 className="text-lg font-semibold text-destructive">
              Danger Zone
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Workspace</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this workspace and all of its data.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                Delete
              </Button>
            </div>
          </div>
        </>
      )}

      <CreateOrganizationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
      <EditOrganizationModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
      />
      {activeOrganization && (
        <DeleteWorkspaceModal
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          workspace={activeOrganization}
        />
      )}
    </div>
  );
}
