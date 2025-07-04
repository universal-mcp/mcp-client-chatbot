"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import {
  authClient,
  organization,
  useListOrganizations,
} from "@/lib/auth/client";
import { InvitationError } from "./invitation-error";
import { useTranslations } from "next-intl";
import { appStore } from "@/app/store";
import { toast } from "sonner";

export default function InvitationPage() {
  const params = useParams<{
    id: string;
  }>();
  const router = useRouter();
  const t = useTranslations("Auth.Invitation");

  // Get refetch functions to refresh organization data
  const { refetch: refetchOrganizations } = useListOrganizations();
  const invalidateOrganizationData = appStore(
    (state) => state.invalidateOrganizationData,
  );

  const handleAccept = async () => {
    await organization
      .acceptInvitation({
        invitationId: params.id,
      })
      .then(async (res) => {
        if (res.error) {
          setError(res.error.message || "An error occurred");
          toast.error(res.error.message || "An error occurred");
        } else {
          // Refresh organization data to show the newly accepted organization
          await Promise.all([refetchOrganizations()]);
          invalidateOrganizationData();

          toast.success(
            t("acceptedTitle", {
              organization: invitation?.organizationName || "",
            }),
          );

          router.push(`/`);
        }
      });
  };

  const handleReject = async () => {
    await organization
      .rejectInvitation({
        invitationId: params.id,
      })
      .then((res) => {
        if (res.error) {
          setError(res.error.message || "An error occurred");
          toast.error(res.error.message || "An error occurred");
        } else {
          toast.error(t("declinedTitle"));
          router.push(`/`);
        }
      });
  };

  const [invitation, setInvitation] = useState<{
    organizationName: string;
    organizationSlug: string;
    inviterEmail: string;
    id: string;
    status: "pending" | "accepted" | "rejected" | "canceled";
    email: string;
    expiresAt: Date;
    organizationId: string;
    role: string;
    inviterId: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authClient.organization
      .getInvitation({
        query: {
          id: params.id,
        },
      })
      .then((res) => {
        if (res.error) {
          setError(res.error.message || "An error occurred");
        } else {
          setInvitation(res.data);
        }
      });
  }, [params.id]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      {invitation ? (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>
                <strong>
                  {t("invitedBy", {
                    inviter: invitation?.inviterEmail,
                    organization: invitation?.organizationName,
                  })}
                </strong>
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleReject}>
              {t("declineButton")}
            </Button>
            <Button onClick={handleAccept}>{t("acceptButton")}</Button>
          </CardFooter>
        </Card>
      ) : error ? (
        <InvitationError />
      ) : (
        <InvitationSkeleton />
      )}
    </div>
  );
}

function InvitationSkeleton() {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-2/3 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Skeleton className="h-10 w-24" />
      </CardFooter>
    </Card>
  );
}
