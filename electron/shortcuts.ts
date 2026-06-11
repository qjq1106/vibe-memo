import { globalShortcut, BrowserWindow } from 'electron';

export function registerShortcuts(mainWindow: BrowserWindow) {
  // Ctrl+Shift+N: 快速新建笔记
  globalShortcut.register('CommandOrControl+Shift+N', () => {
    mainWindow.show();
    mainWindow.webContents.send('note:create');
  });

  // Ctrl+Shift+S: 显示/隐藏窗口
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
