import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { createAttachment } from "@/lib/attachments-store";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const uploadDirectory = path.join(process.cwd(), "uploads");

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const noteId = Number(id);

  if (Number.isNaN(noteId)) {
    return NextResponse.json({ message: "无效的笔记 ID" }, { status: 400 });
  }

  const note = await prisma.note.findUnique({
    where: {
      id: noteId,
    },
  });

  if (!note) {
    return NextResponse.json({ message: "笔记不存在" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "未找到上传文件" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { message: "当前仅支持上传图片文件" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = `${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;

  await mkdir(uploadDirectory, { recursive: true });

  const absolutePath = path.join(uploadDirectory, safeName);
  await writeFile(absolutePath, bytes);

  const attachment = await createAttachment({
    noteId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    storagePath: `/uploads/${safeName}`,
  });

  return NextResponse.json(attachment, { status: 201 });
}
