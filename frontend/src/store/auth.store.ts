import { create } from 'zustand';
import type { AuthUser } from '../lib/types.ts';
import api from '../lib/api.ts';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  initFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user, isAuthenticated: true });
  },

  logout: () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false });
  },

  initFromStorage: () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      // Décoder le payload JWT sans vérification (vérif côté serveur)
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('accessToken');
        return;
      }
      set({
        user: { id: payload.sub, email: payload.email, nom: payload.nom ?? '', role: payload.role },
        isAuthenticated: true,
      });
    } catch {
      localStorage.removeItem('accessToken');
    }
  },
}));
