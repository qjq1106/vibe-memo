import { app } from 'electron';

// 扩展 app 类型以支持自定义退出状态
export type AppWithState = typeof app & { isQuitting: boolean };

// 获取带状态的 app 实例
export function getAppState(): AppWithState {
  return app as AppWithState;
}
