"use client";

import React, { useEffect } from "react";
import { useLogStore, LogLevel } from "@/stores/logStore";

export function LogProvider({ children }: { children: React.ReactNode }) {
    const addLog = useLogStore((state) => state.addLog);

    useEffect(() => {
        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;
        const originalConsoleDebug = console.debug;

        const interceptConsole = (level: LogLevel, originalMethod: Function, ...args: any[]) => {
            // 保存日志
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            addLog(level, message, args);

            // 调用原本的方法
            originalMethod.apply(console, args);
        };

        console.log = (...args) => interceptConsole('info', originalConsoleLog, ...args);
        console.warn = (...args) => interceptConsole('warn', originalConsoleWarn, ...args);
        console.error = (...args) => interceptConsole('error', originalConsoleError, ...args);
        console.debug = (...args) => interceptConsole('debug', originalConsoleDebug, ...args);

        return () => {
            // 恢复原本的 console 方法
            console.log = originalConsoleLog;
            console.warn = originalConsoleWarn;
            console.error = originalConsoleError;
            console.debug = originalConsoleDebug;
        };
    }, [addLog]);

    return <>{children}</>;
}
