import { create } from 'zustand';
import api from '@/services/api';

interface UserInfo {
  id: string;
  username: string;
  realName: string;
  role: string;
  email?: string;
}

interface AuthResponse {
  token: string;
  user: UserInfo;
}

interface AppState {
  user: UserInfo | null;
  token: string | null;
  sidebarCollapsed: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  sidebarCollapsed: false,

  login: async (username: string, password: string) => {
    const res = await api.post('/api/auth/login', { username, password });
    const payload = res.data.data; // API返回 { data: { token, user } }
    localStorage.setItem('token', payload.token);
    set({ token: payload.token, user: payload.user });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  fetchProfile: async () => {
    const res = await api.get('/api/auth/profile');
    set({ user: res.data.data }); // API返回 { data: { user } }
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
}));
