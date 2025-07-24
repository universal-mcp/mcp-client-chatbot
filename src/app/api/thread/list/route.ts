import { getSessionContext } from "@/lib/auth/session-context";
import { chatRepository } from "lib/db/repository";

export async function GET() {
  const { userId, organizationId } = await getSessionContext();
  const threads = await chatRepository.selectThreadsByUserId(
    userId,
    organizationId,
  );
  return Response.json(threads);
}
