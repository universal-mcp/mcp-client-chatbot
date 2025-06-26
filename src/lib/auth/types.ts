import type { auth } from "./server";
import { authClient } from "./client";

export type Session = typeof auth.$Infer.Session;
export type Organization = typeof authClient.$Infer.Organization;
export type ActiveOrganization = typeof authClient.$Infer.ActiveOrganization;
export type OrganizationMember = typeof authClient.$Infer.Member;
export type Invitation = typeof authClient.$Infer.Invitation;
