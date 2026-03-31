import { create } from 'zustand';

interface AuthStore {
  token: string;
  lojaId: string;
  setAuth: (token: string, lojaId: string) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: '',
  lojaId: '',
  setAuth: (token, lojaId) => set({ token, lojaId }),
}));
