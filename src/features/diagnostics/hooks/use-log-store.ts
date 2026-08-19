import { create } from 'zustand';

export interface LogEntry {
  id: string;
  timestamp: Date;
  prefix: '[EXT-NOTIF]' | '[TOPBAR-NOTIF]';
  message: string;
}

interface LogStore {
  logs: LogEntry[];
  addLog: (prefix: LogEntry['prefix'], message: string) => void;
  clearLogs: () => void;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  addLog: (prefix: LogEntry['prefix'], message: string) => {
    console.log(`${prefix} ${message}`);
    set((state) => ({
      logs: [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date(),
          prefix,
          message,
        },
        ...state.logs.slice(0, 99),
      ],
    }));
  },
  clearLogs: () => set({ logs: [] }),
}));
