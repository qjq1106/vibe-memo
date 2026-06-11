import { BrowserWindow, dialog } from 'electron';

// 动态导入 electron-updater（仅在打包后可用）
export async function setupAutoUpdater() {
  let autoUpdater;
  try {
    const updaterModule = await import('electron-updater');
    autoUpdater = updaterModule.autoUpdater;
  } catch {
    console.log('electron-updater 不可用（开发环境正常）');
    return null;
  }

  // 检查更新
  autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
    console.error('检查更新失败:', err);
  });

  // 发现新版本
  autoUpdater.on('update-available', (info: unknown) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send('update:available', info);
    }
  });

  // 下载完成
  autoUpdater.on('update-downloaded', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send('update:downloaded');

      // 提示用户重启安装
      dialog
        .showMessageBox(win, {
          type: 'info',
          title: '更新就绪',
          message: '新版本已下载完成，是否立即重启安装？',
          buttons: ['稍后', '立即重启'],
          defaultId: 1,
        })
        .then(({ response }) => {
          if (response === 1) {
            autoUpdater!.quitAndInstall();
          }
        });
    }
  });

  // 检查更新错误
  autoUpdater.on('error', (error: Error) => {
    console.error('自动更新错误:', error);
  });

  return autoUpdater;
}

export async function installUpdate() {
  try {
    const { autoUpdater } = await import('electron-updater');
    autoUpdater.quitAndInstall();
  } catch {
    console.log('electron-updater 不可用');
  }
}
