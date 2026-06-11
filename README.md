# vibe-memo

一个基于 `Next.js`、`Prisma` 和 `SQLite` 的轻量全栈备忘录应用，强调稳定、可靠和专注记录。支持 Web 和 Electron 桌面端。

## 技术栈

- `Next.js 16` + App Router
- `TypeScript`
- `Tailwind CSS`
- `Prisma 7`
- `SQLite`
- `Electron 33`（桌面端）

## 本地运行

### Web 版

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

启动后访问 [http://localhost:3000](http://localhost:3000)。

### 桌面端

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev:electron
```

### 打包桌面端

```bash
npm run build:electron
```

产物位于 `dist-electron/release/` 目录。

## 已实现功能

- 创建笔记
- 查看笔记列表
- 普通标题与正文输入
- 自动保存
- `Ctrl+S` / `Cmd+S` 手动保存
- 按标题或内容搜索
- 最近更新的笔记自动置顶
- 应用内删除确认弹窗
- 切换笔记前提示保存或直接切换
- 仅支持图片上传、缩略图预览与删除
- 数据持久化到本地 SQLite

### 桌面端专属功能

- 系统托盘：关闭窗口最小化到托盘，右键菜单快速操作
- 原生菜单栏：文件/编辑/视图/帮助完整菜单
- 全局快捷键：`Ctrl+Shift+N` 新建笔记，`Ctrl+Shift+S` 显示/隐藏窗口
- 深色模式：自动跟随系统主题
- 自动更新：支持 GitHub Releases 分发
- 单实例锁：防止重复启动

## 使用说明

- 左侧可以搜索、切换和删除笔记。
- 右侧使用普通文本输入进行记录。
- 停止输入约 1 秒后会自动保存。
- 只有在编辑区聚焦时，`Ctrl+S`（Windows/Linux）或 `Cmd+S`（macOS）才会触发立即保存。
- 列表按最近更新时间排序，刚保存的笔记会自动置顶。
- 删除笔记或图片前会显示应用内确认弹窗，避免误操作。
- 当前仅支持上传图片；上传时会显示进行中的文件信息，上传后会显示完整缩略图，点击可放大、缩放并左右切换查看。

## 目录说明

- `src/app`：页面与 API 路由
- `src/components`：前端组件
- `src/lib`：Prisma 客户端封装
- `prisma`：数据库模型与迁移
- `uploads`：本地附件文件与附件元数据
- `electron`：Electron 主进程代码

## 隐私与本地数据

项目的 `.gitignore` 已忽略：

- `.env*`
- `*.db`
- `*.db-journal`
- `*.db-wal`
- `*.db-shm`
- `uploads/`
