import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vibe-memo",
  description: "一个基于 Next.js、Prisma 和 SQLite 的极简全栈备忘录应用。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // 检测 Electron 环境
                if (typeof window !== 'undefined' && window.electron) {
                  // 从 Electron 获取系统主题
                  const isDark = window.electron.darkMode.shouldUseDarkColors;
                  document.documentElement.classList.toggle('dark', isDark);
                  
                  // 监听主题变化
                  window.electron.darkMode.onChange((dark) => {
                    document.documentElement.classList.toggle('dark', dark);
                  });
                } else {
                  // Web 环境：跟随系统偏好
                  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                  document.documentElement.classList.toggle('dark', mediaQuery.matches);
                  
                  mediaQuery.addEventListener('change', (e) => {
                    document.documentElement.classList.toggle('dark', e.matches);
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
