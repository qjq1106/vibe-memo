import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// 获取上传目录
function getUploadDir() {
  const uploadDir = path.join(app.getPath('userData'), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

export function setupIPC(mainWindow: BrowserWindow) {
  // 文件上传 - 从本地路径复制到应用目录
  ipcMain.handle('file:upload', async (_, filePath: string) => {
    try {
      const uploadDir = getUploadDir();
      const fileName = `${Date.now()}-${path.basename(filePath)}`;
      const destPath = path.join(uploadDir, fileName);
      
      fs.copyFileSync(filePath, destPath);
      return { success: true, path: destPath, fileName };
    } catch (error) {
      console.error('Upload failed:', error);
      return { success: false, error: String(error) };
    }
  });

  // 文件删除
  ipcMain.handle('file:delete', async (_, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return { success: true };
    } catch (error) {
      console.error('Delete failed:', error);
      return { success: false, error: String(error) };
    }
  });

  // 获取上传目录路径
  ipcMain.handle('file:getUploadDir', () => {
    return getUploadDir();
  });

  // 应用控制
  ipcMain.on('app:quit', () => {
    app.quit();
  });

  ipcMain.on('app:hide', () => {
    mainWindow?.hide();
  });

  ipcMain.on('app:show', () => {
    mainWindow?.show();
  });

  // 托盘状态更新
  ipcMain.on('tray:update-badge', (_, hasUnsaved: boolean) => {
    // macOS badge 需要额外的 native 模块支持，暂时跳过
    if (process.platform === 'darwin') {
      console.log('Badge state:', hasUnsaved);
    }
  });
}
