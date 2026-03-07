import { create } from 'zustand';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
    id: string;
    timestamp: string;
    level: LogLevel;
    message: string;
    details?: any;
}

interface LogState {
    logs: LogEntry[];
    addLog: (level: LogLevel, message: string, details?: any) => void;
    clearLogs: () => void;
}

export const useLogStore = create<LogState>((set) => ({
    logs: [],
    addLog: (level, message, details) =>
        set((state) => {
            // 限制最大日志数量，避免内存溢出
            const MAX_LOGS = 1000;
            const newLog: LogEntry = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                level,
                message,
                details,
            };

            const newLogs = [...state.logs, newLog];
            if (newLogs.length > MAX_LOGS) {
                newLogs.shift(); // 移除最旧的
            }
            return { logs: newLogs };
        }),
    clearLogs: () => set({ logs: [] }),
}));
