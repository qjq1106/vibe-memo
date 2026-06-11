import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { setupIPC } from './ipc-handlers';
import { createTray } from './tray';
import { createMenu } from './menu';
import { registerShortcuts } from './shortcuts';
import { setupDarkMode } from './dark-mode';
import { setupAutoUpdater } from './updater';
import { getAppState } from './app-state';

const appState = getAppState();
appState.isQuitting = false;

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Vibe Memo',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发环境加载 localhost，生产环境加载静态文件
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  // 点击链接在外部浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 关闭时最小化到托盘
  mainWindow.on('close', (event) => {
    if (!appState.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    
    if (mainWindow) {
      setupIPC(mainWindow);
      createTray(mainWindow);
      createMenu(mainWindow);
      registerShortcuts(mainWindow);
      setupDarkMode(mainWindow);
      setupAutoUpdater();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        mainWindow?.show();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 标记退出状态
  app.on('before-quit', () => {
  appState.isQuitting = true;
});
