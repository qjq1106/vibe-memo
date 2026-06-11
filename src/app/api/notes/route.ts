import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { listAttachmentsByNoteIds } from "@/lib/attachments-store";

export async function GET() {
  const notes = await prisma.note.findMany({
    orderBy: {
      updatedAt: "desc",
    },
  });

  const attachmentsByNoteId = await listAttachmentsByNoteIds(
    notes.map((note) => note.id),
  );

  return NextResponse.json(
    notes.map((note) => ({
      ...note,
      attachments: attachmentsByNoteId[note.id] ?? [],
    })),
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    content?: string | null;
  };

  const title = body.title?.trim() || "未命名笔记";
  const content = typeof body.content === "string" ? body.content : null;

  const note = await prisma.note.create({
    data: {
      title,
      content,
    },
  });

  return NextResponse.json({ ...note, attachments: [] }, { status: 201 });
}
