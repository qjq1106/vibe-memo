"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import "yet-another-react-lightbox/styles.css";

// Electron IPC 类型
interface ElectronAPI {
  file: {
    upload: (filePath: string) => Promise<{ success: boolean; path?: string; fileName?: string; error?: string }>;
    delete: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    getUploadDir: () => Promise<string>;
  };
  darkMode: {
    shouldUseDarkColors: boolean;
    onChange: (callback: (isDark: boolean) => void) => void;
  };
  app: {
    quit: () => void;
    hide: () => void;
    show: () => void;
  };
  update: {
    check: () => Promise<unknown>;
    install: () => void;
    onAvailable: (callback: (info: unknown) => void) => void;
    onDownloaded: (callback: () => void) => void;
  };
  tray: {
    updateBadge: (hasUnsaved: boolean) => void;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

type Attachment = {
  id: number;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  createdAt: string;
};

type Note = {
  id: number;
  title: string;
  content: string | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type NoteSnapshot = {
  title: string;
  content: string;
};
type UploadingImageInfo = {
  name: string;
  size: number;
};
type ConfirmDialog =
  | {
      type: "switch-note";
      noteId: number;
      noteTitle: string;
    }
  | {
      type: "delete-note";
      noteId: number;
      noteTitle: string;
    }
  | {
      type: "delete-image";
      attachmentId: number;
      attachmentName: string;
    };

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function serializeSnapshot(noteId: number | null, snapshot: NoteSnapshot) {
  return JSON.stringify({
    id: noteId,
    title: snapshot.title,
    content: snapshot.content,
  });
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function NoteApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(-1);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [uploadingImageInfo, setUploadingImageInfo] =
    useState<UploadingImageInfo | null>(null);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSnapshotRef = useRef<string>("");
  const requestSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const latestNotesRef = useRef<Note[]>([]);
  const saveNoteRef = useRef<
    ((snapshot: NoteSnapshot) => Promise<boolean | undefined>) | null
  >(null);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );

  useEffect(() => {
    latestNotesRef.current = notes;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const sortedNotes = [...notes].sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );

    if (!normalizedQuery) {
      return sortedNotes;
    }

    return sortedNotes.filter((note) => {
      const haystack = `${note.title}\n${note.content ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [notes, searchQuery]);

  const hasSelection = selectedNote !== null;
  const canSave = hasSelection && saveState !== "saving" && saveState !== "idle";
  const hasUnsavedChanges = saveState === "dirty" || saveState === "error";

  const selectNote = useCallback((note: Note | null) => {
    setSelectedId(note?.id ?? null);
    setDraftTitle(note?.title ?? "");
    setDraftContent(note?.content ?? "");
    setSaveState("idle");
    latestSnapshotRef.current = serializeSnapshot(note?.id ?? null, {
      title: note?.title ?? "",
      content: note?.content ?? "",
    });
  }, []);

  const upsertAndSortNotes = useCallback((updatedNote: Note) => {
    setNotes((current) =>
      [...current.filter((note) => note.id !== updatedNote.id), updatedNote].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    );
  }, []);

  const commitNoteSelection = useCallback(
    (noteId: number | null) => {
      const note =
        noteId === null
          ? null
          : latestNotesRef.current.find((item) => item.id === noteId) ?? null;

      selectNote(note);
    },
    [selectNote],
  );

  const requestNoteSelection = useCallback(
    (noteId: number) => {
      if (noteId === selectedId) {
        return;
      }

      const target =
        latestNotesRef.current.find((item) => item.id === noteId) ?? null;

      if (!target) {
        return;
      }

      if (hasUnsavedChanges) {
        setConfirmDialog({
          type: "switch-note",
          noteId,
          noteTitle: target.title,
        });
        return;
      }

      commitNoteSelection(noteId);
    },
    [commitNoteSelection, hasUnsavedChanges, selectedId],
  );

  async function createNote() {
    setIsCreating(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "新的笔记",
          content: "",
        }),
      });

      const note = (await response.json()) as Note;

      upsertAndSortNotes(note);
      selectNote(note);
    } catch {
      setErrorMessage("创建笔记失败，请稍后重试。");
    } finally {
      setIsCreating(false);
    }
  }

  const saveNote = useCallback(
    async (snapshot: NoteSnapshot) => {
      if (!selectedNote) {
        return;
      }

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      const requestId = ++requestSequenceRef.current;

      setSaveState("saving");
      setErrorMessage("");

      try {
        const response = await fetch(`/api/notes/${selectedNote.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: snapshot.title,
            content: snapshot.content,
          }),
        });

        if (!response.ok) {
          throw new Error("save failed");
        }

        const updatedNote = (await response.json()) as Note;

        if (requestId !== requestSequenceRef.current) {
          return;
        }

        upsertAndSortNotes(updatedNote);
        latestSnapshotRef.current = serializeSnapshot(updatedNote.id, snapshot);
        setSaveState("saved");
        return true;
      } catch {
        setSaveState("error");
        setErrorMessage("保存失败，请稍后重试。");
        return false;
      }
    },
    [selectedNote, upsertAndSortNotes],
  );

  useEffect(() => {
    saveNoteRef.current = saveNote;
  }, [saveNote]);

  useEffect(() => {
    async function loadNotes() {
      try {
        const response = await fetch("/api/notes", { cache: "no-store" });
        const data = (await response.json()) as Note[];

        setNotes(data);

        if (data.length > 0) {
          selectNote(data[0]);
        }
      } catch {
        setErrorMessage("加载笔记失败，请刷新后重试。");
      } finally {
        setIsLoading(false);
      }
    }

    void loadNotes();
  }, [selectNote]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    if (!selectedNote) {
      return;
    }

    const currentSnapshot = serializeSnapshot(selectedNote.id, {
      title: draftTitle,
      content: draftContent,
    });

    if (currentSnapshot === latestSnapshotRef.current) {
      return;
    }

    setSaveState("dirty");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void saveNote({
        title: draftTitle,
        content: draftContent,
      });
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [draftContent, draftTitle, saveNote, selectedNote]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut || !isEditorFocused || !hasSelection) {
        return;
      }

      event.preventDefault();
      void saveNote({
        title: draftTitle,
        content: draftContent,
      });
    }

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [draftContent, draftTitle, hasSelection, isEditorFocused, saveNote]);

  // Electron IPC 事件监听
  useEffect(() => {
    if (!window.electron) {
      return;
    }

    // 监听主进程的新建笔记事件
    const handleCreateNote = () => {
      void createNote();
    };

    // 监听主进程的保存事件
    const handleSaveNote = () => {
      if (hasSelection) {
        void saveNote({
          title: draftTitle,
          content: draftContent,
        });
      }
    };

    // 监听更新可用事件
    const handleUpdateAvailable = (info: unknown) => {
      console.log("发现新版本:", info);
    };

    // 监听更新下载完成事件
    const handleUpdateDownloaded = () => {
      console.log("更新已下载完成");
    };

    // 使用 IPC 监听器
    window.electron.update.onAvailable(handleUpdateAvailable);
    window.electron.update.onDownloaded(handleUpdateDownloaded);

    // 注意：需要通过其他方式监听 note:create 和 note:save
    // 这里使用 window 监听器作为备选
    window.addEventListener("electron-note-create", handleCreateNote);
    window.addEventListener("electron-note-save", handleSaveNote);

    return () => {
      window.removeEventListener("electron-note-create", handleCreateNote);
      window.removeEventListener("electron-note-save", handleSaveNote);
    };
  }, [createNote, saveNote, hasSelection, draftTitle, draftContent]);

  async function uploadAttachment(file: File) {
    if (!selectedNote) {
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/notes/${selectedNote.id}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("upload failed");
      }

      const attachment = (await response.json()) as Attachment;

      const updatedNote: Note = {
        ...selectedNote,
        attachments: [...selectedNote.attachments, attachment],
        updatedAt: new Date().toISOString(),
      };

      upsertAndSortNotes(updatedNote);
      selectNote(updatedNote);
    } catch {
      setErrorMessage("图片上传失败，请稍后重试。");
    } finally {
      setIsUploading(false);
      setUploadingImageInfo(null);
    }
  }

  async function handleUploadFile(file: File) {
    setUploadingImageInfo({
      name: file.name,
      size: file.size,
    });

    await uploadAttachment(file);
  }

  async function deleteAttachment(attachmentId: number) {
    if (!selectedNote) {
      return;
    }

    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("delete attachment failed");
      }

      const updatedNote: Note = {
        ...selectedNote,
        attachments: selectedNote.attachments.filter(
          (item) => item.id !== attachmentId,
        ),
        updatedAt: new Date().toISOString(),
      };

      upsertAndSortNotes(updatedNote);
      selectNote(updatedNote);
    } catch {
      setErrorMessage("图片删除失败，请稍后重试。");
    }
  }

  async function deleteNote(id: number) {
    setErrorMessage("");

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("delete failed");
      }

      const nextNotes = notes.filter((note) => note.id !== id);
      setNotes(nextNotes);

      if (selectedId === id) {
        selectNote(nextNotes[0] ?? null);
      }
    } catch {
      setErrorMessage("删除失败，请稍后重试。");
    }
  }

  async function confirmSwitchNote(mode: "save" | "discard") {
    if (confirmDialog?.type !== "switch-note") {
      return;
    }

    const nextNoteId = confirmDialog.noteId;
    setConfirmDialog(null);

    if (mode === "discard") {
      commitNoteSelection(nextNoteId);
      return;
    }

    const success = await saveNoteRef.current?.({
      title: draftTitle,
      content: draftContent,
    });

    if (success) {
      commitNoteSelection(nextNoteId);
    }
  }

  async function confirmDialogAction() {
    if (!confirmDialog) {
      return;
    }

    const action = confirmDialog;
    setConfirmDialog(null);

    if (action.type === "delete-image") {
      await deleteAttachment(action.attachmentId);
      return;
    }

    if (action.type === "delete-note") {
      await deleteNote(action.noteId);
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto grid h-screen max-w-7xl gap-6 overflow-hidden px-4 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                轻量笔记
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">我的笔记</h1>
            </div>
            <button
              type="button"
              onClick={() => void createNote()}
              disabled={isCreating}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
            >
              {isCreating ? "创建中..." : "新建"}
            </button>
          </div>

          <div className="mt-4">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索标题或内容"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
          </div>

          <div className="mt-4 flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
            {isLoading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">正在加载笔记...</p>
            ) : filteredNotes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {notes.length === 0
                  ? "还没有笔记，点击右上角“新建”开始记录。"
                  : "没有匹配的笔记。"}
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isActive = note.id === selectedId;

                return (
                  <div
                    key={note.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => requestNoteSelection(note.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        requestNoteSelection(note.id);
                      }
                    }}
                    className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                        : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-medium">{note.title}</h2>
                        <p
                          className={`mt-2 line-clamp-2 text-sm ${
                            isActive
                              ? "text-zinc-200 dark:text-zinc-700"
                              : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {note.content?.trim() || "这条笔记还没有内容。"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmDialog({
                            type: "delete-note",
                            noteId: note.id,
                            noteTitle: note.title,
                          });
                        }}
                        className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                          isActive
                            ? "bg-white/15 text-white hover:bg-white/20 dark:bg-black/10 dark:text-zinc-950"
                            : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        删除
                      </button>
                    </div>
                    <p
                      className={`mt-3 text-xs ${
                        isActive
                          ? "text-zinc-300 dark:text-zinc-700"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      更新于 {formatTime(note.updatedAt)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {selectedNote ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">当前编辑</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    更新于 {formatTime(selectedNote.updatedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {saveState === "saving" && "保存中..."}
                    {saveState === "saved" && "已保存"}
                    {saveState === "error" && "保存失败"}
                    {saveState === "dirty" && "已修改"}
                    {saveState === "idle" && "已同步"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void saveNote({
                        title: draftTitle,
                        content: draftContent,
                      })
                    }
                    disabled={!canSave}
                    className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
                <input
                  value={draftTitle}
                  onChange={(event) => {
                    setDraftTitle(event.target.value);
                  }}
                  placeholder="输入笔记标题"
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-2xl font-semibold outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                />

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        正文内容
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        普通输入即可，支持自动保存和快捷键保存
                      </p>
                    </div>
                    <div className="hidden text-xs text-zinc-500 dark:text-zinc-400 md:block">
                      Ctrl/Cmd+S 保存
                    </div>
                  </div>
                  <textarea
                    value={draftContent}
                    onChange={(event) => {
                      setDraftContent(event.target.value);
                    }}
                    onFocus={() => setIsEditorFocused(true)}
                    onBlur={() => setIsEditorFocused(false)}
                    placeholder="开始记录你的想法..."
                    className="min-h-0 flex-1 resize-none overflow-y-auto bg-transparent px-4 py-4 text-[15px] leading-7 outline-none"
                  />
                </div>

                <div className="flex max-h-[34vh] min-h-[210px] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        图片
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        当前仅支持上传图片，点击缩略图可查看大图
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300">
                      {isUploading ? "上传中..." : "上传图片"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];

                          if (file) {
                            void handleUploadFile(file);
                          }

                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {uploadingImageInfo ? (
                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                      <p className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                        正在上传：{uploadingImageInfo.name}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatFileSize(uploadingImageInfo.size)}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                    {selectedNote.attachments.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        还没有图片，上传后会显示在这里。
                      </p>
                    ) : (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                        {selectedNote.attachments.map((attachment, index) => (
                        <div
                          key={attachment.id}
                          className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDialog({
                                type: "delete-image",
                                attachmentId: attachment.id,
                                attachmentName: attachment.name,
                              })
                            }
                            className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-sm font-medium text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100"
                            aria-label={`删除图片 ${attachment.name}`}
                          >
                            ×
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewImageIndex(index)}
                            className="flex h-36 w-full cursor-zoom-in items-center justify-center bg-zinc-100 p-2 dark:bg-zinc-950 sm:h-40"
                          >
                            <Image
                              src={attachment.storagePath}
                              alt={attachment.name}
                              width={640}
                              height={480}
                              className="h-full w-full object-contain"
                            />
                          </button>
                        </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-zinc-300 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <div className="space-y-3 px-6">
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                  从一条新笔记开始
                </h2>
                <p>
                  创建后即可开始普通记录，并支持上传和管理图片。
                </p>
                <button
                  type="button"
                  onClick={() => void createNote()}
                  disabled={isCreating}
                  className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
                >
                  {isCreating ? "创建中..." : "立即新建"}
                </button>
              </div>
            </div>
          )}

          {errorMessage ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          {confirmDialog ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 p-4">
              <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                {confirmDialog.type === "switch-note" ? (
                  <>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      切换前先处理未保存内容
                    </h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      当前笔记还有修改未保存。要先保存，再切换到“{confirmDialog.noteTitle}”吗？
                    </p>
                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmDialog(null)}
                        className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirmSwitchNote("discard")}
                        className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        不保存直接切换
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirmSwitchNote("save")}
                        className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
                      >
                        保存并切换
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {confirmDialog.type === "delete-note"
                        ? "确认删除笔记"
                        : "确认删除图片"}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      {confirmDialog.type === "delete-note"
                        ? `删除后将无法恢复：“${confirmDialog.noteTitle}”`
                        : `删除后将无法恢复：“${confirmDialog.attachmentName}”`}
                    </p>
                    <div className="mt-5 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmDialog(null)}
                        className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirmDialogAction()}
                        className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
                      >
                        确认删除
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}

          <Lightbox
            open={previewImageIndex >= 0}
            close={() => setPreviewImageIndex(-1)}
            index={previewImageIndex >= 0 ? previewImageIndex : 0}
            slides={
              selectedNote?.attachments.map((attachment) => ({
                src: attachment.storagePath,
                alt: attachment.name,
              })) ?? []
            }
            plugins={[Zoom]}
            zoom={{
              scrollToZoom: true,
              minZoom: 0.5,
              maxZoomPixelRatio: 3,
              wheelZoomDistanceFactor: 80,
              zoomInMultiplier: 1.5,
            }}
          />
        </section>
      </div>
    </main>
  );
}
