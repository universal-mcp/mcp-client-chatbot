import { chatRepository } from "lib/db/repository";
import { generateUUID } from "lib/utils";
import { generateTitleFromUserMessageAction } from "../chat/actions";
import { getSessionContext } from "@/lib/auth/session-context";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const { id, projectId, message } = await request.json();

  const { userId, organizationId } = await getSessionContext();

  if (!userId) {
    return redirect("/sign-in");
  }

  const title = await generateTitleFromUserMessageAction({
    message,
  });

  const newThread = await chatRepository.insertThread(
    {
      id: id ?? generateUUID(),
      projectId,
      title,
      userId,
      isPublic: false,
    },
    userId,
    organizationId,
  );

  return Response.json({
    threadId: newThread.id,
  });
}
