import { contextBridge, ipcRenderer } from 'electron';

// 安全暴露 IPC 接口给渲染进程
contextBridge.exposeInMainWorld('electron', {
  // 文件操作
  file: {
    upload: (filePath: string) => ipcRenderer.invoke('file:upload', filePath),
    delete: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
    getUploadDir: () => ipcRenderer.invoke('file:getUploadDir'),
  },

  // 深色模式
  darkMode: {
    shouldUseDarkColors: ipcRenderer.sendSync('dark-mode:get'),
    onChange: (callback: (isDark: boolean) => void) => {
      ipcRenderer.on('dark-mode:changed', (_, isDark) => callback(isDark));
    },
  },

  // 应用控制
  app: {
    quit: () => ipcRenderer.send('app:quit'),
    hide: () => ipcRenderer.send('app:hide'),
    show: () => ipcRenderer.send('app:show'),
  },

  // 笔记事件（主进程 → 渲染进程）
  note: {
    onCreate: (callback: () => void) => {
      ipcRenderer.on('note:create', () => callback());
    },
    onSave: (callback: () => void) => {
      ipcRenderer.on('note:save', () => callback());
    },
  },

  // 自动更新
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.send('update:install'),
    onAvailable: (callback: (info: unknown) => void) => {
      ipcRenderer.on('update:available', (_, info) => callback(info));
    },
    onDownloaded: (callback: () => void) => {
      ipcRenderer.on('update:downloaded', () => callback());
    },
  },

  // 托盘
  tray: {
    updateBadge: (hasUnsaved: boolean) => ipcRenderer.send('tray:update-badge', hasUnsaved),
  },
});
