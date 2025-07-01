import { betterAuth } from "better-auth";
import { organization, twoFactor, apiKey, oneTap } from "better-auth/plugins";
import { reactInvitationEmail } from "@/lib/email/invitation";
import { reactResetPasswordEmail } from "@/lib/email/reset-password";
import { resend } from "@/lib/email/resend";

import { nextCookies } from "better-auth/next-js";
import { passkey } from "better-auth/plugins/passkey";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { pgDb } from "@/lib/db/pg/db.pg";
import { emailHarmony } from "better-auth-harmony";
import * as schema from "@/lib/db/pg/auth.pg";
import { headers } from "next/headers";
import logger from "@/lib/logger";

const from = process.env.BETTER_AUTH_EMAIL || "manoj@agentr.dev";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const auth = betterAuth({
  appName: "agentr",
  database: drizzleAdapter(pgDb, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      const res = await resend.emails.send({
        from,
        to: user.email,
        subject: "Verify your email address",
        html: `<a href="${url}">Verify your email address</a>`,
      });
      console.log(res, user.email);
    },
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
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          await resend.emails.send({
            from,
            to: user.email,
            subject: "Your OTP",
            html: `Your OTP is ${otp}`,
          });
        },
      },
    }),
    passkey(),
    oneTap(),
    nextCookies(),
    emailHarmony(),
    apiKey(),
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
