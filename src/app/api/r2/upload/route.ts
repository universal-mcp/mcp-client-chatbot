import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import R2 from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";

export async function POST(req: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, contentType } = await req.json();

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "Missing filename or contentType" },
      { status: 400 },
    );
  }

  const signedUrl = await getSignedUrl(
    R2,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME as string,
      Key: filename,
      ContentType: contentType,
    }),
    { expiresIn: 60 * 5 }, // 5 minutes
  );

  return NextResponse.json({ signedUrl });
}
