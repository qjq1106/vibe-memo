// Electron IPC 类型定义
export interface ElectronAPI {
  file: {
    upload: (filePath: string) => Promise<{
      success: boolean;
      path?: string;
      fileName?: string;
      error?: string;
    }>;
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

export {};
