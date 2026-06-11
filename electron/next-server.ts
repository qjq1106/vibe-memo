import { app } from 'electron';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_PORT = 37123;

let nextProcess: ChildProcess | null = null;
const serverPort = DEFAULT_PORT;

function getStandaloneDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'standalone');
  }

  return path.join(__dirname, '../.next/standalone');
}

export function getDatabaseUrl(): string {
  const dbPath = path.join(app.getPath('userData'), 'vibe-memo.db');
  return `file:${dbPath.replace(/\\/g, '/')}`;
}

function runMigrations(databaseUrl: string): void {
  const prismaBin = path.join(app.getAppPath(), 'node_modules', 'prisma', 'build', 'index.js');
  if (!fs.existsSync(prismaBin)) {
    console.warn('Prisma CLI not found, skipping migrations');
    return;
  }

  const result = spawnSync(process.execPath, [prismaBin, 'migrate', 'deploy'], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.warn('Migration deploy exited with status', result.status);
  }
}

export async function startNextServer(): Promise<number> {
  const standaloneDir = getStandaloneDir();
  const serverEntry = path.join(standaloneDir, 'server.js');

  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Next standalone server not found: ${serverEntry}`);
  }

  const databaseUrl = getDatabaseUrl();
  runMigrations(databaseUrl);

  await new Promise<void>((resolve, reject) => {
    nextProcess = spawn(process.execPath, [serverEntry], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1',
        PORT: String(serverPort),
        DATABASE_URL: databaseUrl,
      },
      stdio: 'inherit',
    });

    nextProcess.on('error', reject);
    nextProcess.once('spawn', () => resolve());
  });

  await waitForServer(`http://127.0.0.1:${serverPort}`);
  return serverPort;
}

async function waitForServer(url: string, maxAttempts = 60): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // server still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next server did not become ready: ${url}`);
}

export function stopNextServer(): void {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
}

export function getServerUrl(): string {
  return `http://127.0.0.1:${serverPort}`;
}
