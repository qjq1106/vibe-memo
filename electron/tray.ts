import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron';
import * as path from 'path';

// 扩展 app 类型
type AppWithState = typeof app & { isQuitting: boolean };

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow) {
  // 创建托盘图标
  const iconPath = path.join(__dirname, '../public/icon.png');
  let trayIcon: ReturnType<typeof nativeImage.createEmpty>;
  
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createEmpty();
    }
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Vibe Memo');

  const appState = app as AppWithState;

  // 托盘右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => mainWindow.show(),
    },
    {
      label: '新建笔记',
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send('note:create');
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        appState.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 点击托盘图标显示窗口
  tray.on('click', () => {
    mainWindow.show();
  });

  return tray;
}

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
