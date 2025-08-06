import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { reactInvitationEmail } from "@/lib/email/invitation";
import { reactResetPasswordEmail } from "@/lib/email/reset-password";
import { resend } from "@/lib/email/resend";

import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { pgDb } from "@/lib/db/pg/db.pg";
import { emailHarmony } from "better-auth-harmony";
import * as schema from "@/lib/db/pg/auth.pg";
import { headers } from "next/headers";
import logger from "@/lib/logger";
import { reactVerifyEmail } from "@/lib/email/verify-email";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";

const from = process.env.BETTER_AUTH_EMAIL || "manoj@agentr.dev";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export const auth = betterAuth({
  appName: "agentr",
  database: drizzleAdapter(pgDb, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60,
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
  },
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      await resend.emails.send({
        from,
        to: user.email,
        subject: "Verify your email address",
        react: reactVerifyEmail({
          username: user.name,
          verifyLink: url,
        }),
      });
    },
    autoSignInAfterVerification: true,
  },
  account: {
    accountLinking: {
      trustedProviders: ["google", "github", "agentr"],
    },
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      await resend.emails.send({
        from,
        to: user.email,
        subject: "Reset your password",
        react: reactResetPasswordEmail({
          username: user.email,
          resetLink: url,
        }),
      });
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      mapProfileToUser: (profile) => {
        const [firstName, ...rest] = (profile.name || "").split(" ");
        return {
          firstName: firstName || undefined,
          lastName: rest.length > 0 ? rest.join(" ") : "",
          email: profile.email,
          image: profile.avatar_url,
          emailVerified: true,
        };
      },
    },
    google: {
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      mapProfileToUser: (profile) => {
        return {
          firstName: profile.given_name,
          lastName: profile.family_name,
          email: profile.email,
          image: profile.picture,
          emailVerified: true,
        };
      },
    },
  },
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        await resend.emails.send({
          from,
          to: data.email,
          subject: "You've been invited to join an organization",
          react: reactInvitationEmail({
            username: data.email,
            invitedByUsername: data.inviter.user.name,
            invitedByEmail: data.inviter.user.email,
            teamName: data.organization.name,
            inviteLink: `${APP_URL}/accept-invitation/${data.id}`,
          }),
        });
      },
    }),
    nextCookies(),
    emailHarmony(),
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        requireEmailVerification: false,
        plans: [
          {
            name: "pro",
            priceId: "price_1RpqflHVSpWJf2VWygjqJFT1",
          },
        ],
        onSubscriptionComplete: async ({ subscription, plan }) => {
          logger.info(
            `Subscription ${subscription.id} completed for plan ${plan.name}`,
          );
        },
        onSubscriptionUpdate: async ({ subscription }) => {
          logger.info(`Subscription ${subscription.id} updated`);
        },
        onSubscriptionCancel: async ({ subscription }) => {
          logger.info(`Subscription ${subscription.id} canceled`);
        },
      },
      onEvent: async (event) => {
        logger.info(`Stripe webhook event: ${event.type}`);

        switch (event.type) {
          case "customer.subscription.created":
            logger.info("New subscription created", event.data.object);
            break;
          case "customer.subscription.updated":
            logger.info("Subscription updated", event.data.object);
            break;
          case "customer.subscription.deleted":
            logger.info("Subscription deleted", event.data.object);
            break;
          case "invoice.paid":
            logger.info("Invoice paid", event.data.object);
            break;
          case "invoice.payment_failed":
            logger.error("Invoice payment failed", event.data.object);
            break;
        }
      },
    }),
  ],
  trustedOrigins: ["exp://"],
  advanced: {
    database: {
      generateId: false,
    },
  },
});

export const getSession = async () => {
  "use server";
  const session = await auth.api
    .getSession({
      headers: await headers(),
    })
    .catch((e) => {
      logger.error(e);
      return null;
    });
  if (!session) {
    logger.error("No session found");
    return null;
  }
  // logger.debug("Session found", session);
  return session;
};

export const getActiveMember = async () => {
  "use server";
  try {
    const member = await auth.api.getActiveMember({
      headers: await headers(),
    });
    return member;
  } catch (e) {
    logger.error(e, "Failed to get active member");
    return null;
  }
};
