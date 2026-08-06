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
    const { data } = await api.post<AuthResponse>('/api/auth/login', {
      username,
      password,
    });
    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  fetchProfile: async () => {
    const { data } = await api.get<UserInfo>('/api/auth/profile');
    set({ user: data });
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
}));
