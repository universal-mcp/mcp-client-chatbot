"use client";
import { createAuthClient } from "better-auth/react";
import { stripeClient } from "@better-auth/stripe/client";
import {
  organizationClient,
  multiSessionClient,
} from "better-auth/client/plugins";
import { toast } from "sonner";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    multiSessionClient(),
    stripeClient({
      subscription: true, //if you want to enable subscription management
    }),
  ],
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
