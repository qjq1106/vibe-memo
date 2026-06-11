import { NextResponse } from "next/server";

import { getAttachmentsByNoteId } from "@/lib/attachments-store";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function getUpdatePayload(body: { title?: string; content?: string | null }) {
  const data: {
    title?: string;
    content?: string | null;
  } = {};

  if (typeof body.title === "string") {
    data.title = body.title.trim() || "未命名笔记";
  }

  if (typeof body.content === "string") {
    data.content = body.content;
  } else if (body.content === null) {
    data.content = null;
  }

  return data;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const noteId = Number(id);

  if (Number.isNaN(noteId)) {
    return NextResponse.json({ message: "无效的笔记 ID" }, { status: 400 });
  }

  const body = (await request.json()) as {
    title?: string;
    content?: string | null;
  };

  const data = getUpdatePayload(body);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "没有可更新的字段" }, { status: 400 });
  }

  const note = await prisma.note.update({
    where: { id: noteId },
    data,
  });

  const attachments = await getAttachmentsByNoteId(noteId);

  return NextResponse.json({ ...note, attachments });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const noteId = Number(id);

  if (Number.isNaN(noteId)) {
    return NextResponse.json({ message: "无效的笔记 ID" }, { status: 400 });
  }

  await prisma.note.delete({
    where: { id: noteId },
  });

  return new NextResponse(null, { status: 204 });
}
