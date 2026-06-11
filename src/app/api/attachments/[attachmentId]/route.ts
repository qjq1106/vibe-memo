import { unlink } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { deleteAttachmentById } from "@/lib/attachments-store";

type RouteContext = {
  params: Promise<{
    attachmentId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { attachmentId } = await context.params;
  const id = Number(attachmentId);

  if (Number.isNaN(id)) {
    return NextResponse.json({ message: "无效的附件 ID" }, { status: 400 });
  }

  const attachment = await deleteAttachmentById(id);

  if (!attachment) {
    return NextResponse.json({ message: "附件不存在" }, { status: 404 });
  }

  const absolutePath = path.join(
    process.cwd(),
    attachment.storagePath.replace(/^\//, ""),
  );

  await unlink(absolutePath).catch(() => null);

  return new NextResponse(null, { status: 204 });
}
