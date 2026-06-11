import { BrowserWindow, nativeTheme, ipcMain } from 'electron';

export function setupDarkMode(mainWindow: BrowserWindow) {
  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    const isDark = nativeTheme.shouldUseDarkColors;
    mainWindow.webContents.send('dark-mode:changed', isDark);
  });

  // 获取当前主题（同步）
  ipcMain.on('dark-mode:get', (event) => {
    event.returnValue = nativeTheme.shouldUseDarkColors;
  });

  // 切换主题
  ipcMain.on('dark-mode:toggle', () => {
    const currentTheme = nativeTheme.themeSource;
    nativeTheme.themeSource = currentTheme === 'dark' ? 'light' : 'dark';
  });

  // 设置主题
  ipcMain.on('dark-mode:set', (_, theme: 'light' | 'dark' | 'system') => {
    nativeTheme.themeSource = theme;
  });
}
