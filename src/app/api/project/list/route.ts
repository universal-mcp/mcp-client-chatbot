import { getSessionContext } from "@/lib/auth/session-context";
import { chatRepository } from "lib/db/repository";

export async function GET() {
  const { userId, organizationId } = await getSessionContext();
  const projects = await chatRepository.selectProjectsByUserId(
    userId,
    organizationId,
  );
  return Response.json(projects);
}
