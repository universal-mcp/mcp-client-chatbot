"use client";
import { createAuthClient } from "better-auth/react";
import {
  organizationClient,
  multiSessionClient,
} from "better-auth/client/plugins";
import { toast } from "sonner";

export const authClient = createAuthClient({
  plugins: [organizationClient(), multiSessionClient()],
  fetchOptions: {
    onError(e) {
      if (e.error.status === 429) {
        toast.error("Too many requests. Please try again later.");
      }
    },
  },
});

export const {
  signUp,
  signIn,
  signOut,
  useSession,
  organization,
  useListOrganizations,
  useActiveOrganization,
} = authClient;

authClient.$store.listen("$sessionSignal", async () => {});
