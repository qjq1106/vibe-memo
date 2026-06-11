import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredAttachment = {
  id: number;
  noteId: number;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  createdAt: string;
};

type AttachmentStore = {
  nextId: number;
  attachments: StoredAttachment[];
};

const uploadsDirectory = path.join(process.cwd(), "uploads");
const storeFile = path.join(uploadsDirectory, "attachments.json");

async function ensureStore() {
  await mkdir(uploadsDirectory, { recursive: true });

  try {
    await readFile(storeFile, "utf8");
  } catch {
    const initialStore: AttachmentStore = {
      nextId: 1,
      attachments: [],
    };

    await writeFile(storeFile, JSON.stringify(initialStore, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const content = await readFile(storeFile, "utf8");
  return JSON.parse(content) as AttachmentStore;
}

async function writeStore(store: AttachmentStore) {
  await writeFile(storeFile, JSON.stringify(store, null, 2), "utf8");
}

export async function getAttachmentsByNoteId(noteId: number) {
  const store = await readStore();
  return store.attachments
    .filter((attachment) => attachment.noteId === noteId)
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
}

export async function listAttachmentsByNoteIds(noteIds: number[]) {
  const store = await readStore();
  const result: Record<number, StoredAttachment[]> = {};

  for (const noteId of noteIds) {
    result[noteId] = [];
  }

  for (const attachment of store.attachments) {
    if (!result[attachment.noteId]) {
      continue;
    }

    result[attachment.noteId].push(attachment);
  }

  for (const noteId of noteIds) {
    result[noteId].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  }

  return result;
}

export async function createAttachment(
  attachment: Omit<StoredAttachment, "id" | "createdAt">,
) {
  const store = await readStore();

  const record: StoredAttachment = {
    ...attachment,
    id: store.nextId,
    createdAt: new Date().toISOString(),
  };

  store.nextId += 1;
  store.attachments.push(record);

  await writeStore(store);

  return record;
}

export async function getAttachmentById(id: number) {
  const store = await readStore();
  return store.attachments.find((attachment) => attachment.id === id) ?? null;
}

export async function deleteAttachmentById(id: number) {
  const store = await readStore();
  const target = store.attachments.find((attachment) => attachment.id === id) ?? null;

  if (!target) {
    return null;
  }

  store.attachments = store.attachments.filter((attachment) => attachment.id !== id);
  await writeStore(store);

  return target;
}
