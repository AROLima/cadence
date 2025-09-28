import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export interface AuthState {
  user: Record<string, unknown> | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const STORAGE_KEY = 'authState';
const defaultState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

function loadInitialState(): AuthState {
  if (!browser) {
    return defaultState;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultState;
    }
    const parsed = JSON.parse(stored) as Partial<AuthState>;
    return {
      // Only restore non-sensitive user profile info; tokens are NOT persisted
      user: parsed?.user ?? null,
      accessToken: null,
      refreshToken: null,
    };
  } catch (error) {
    console.error('[authStore] Failed to parse stored state:', error);
    return defaultState;
  }
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(loadInitialState());

  if (browser) {
    subscribe((state) => {
      try {
        // Persist only non-sensitive data (user). Do NOT store tokens.
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ user: state.user }),
        );
      } catch (error) {
        console.error('[authStore] Failed to persist state:', error);
      }
    });
  }

  return {
    subscribe,
    setAuth: (auth: AuthState) =>
      set({
        user: auth.user ?? null,
        accessToken: auth.accessToken ?? null,
        refreshToken: auth.refreshToken ?? null,
      }),
    setTokens: (tokens: { accessToken: string; refreshToken: string }) =>
      update((state) => ({
        ...state,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      })),
    setUser: (user: Record<string, unknown> | null) =>
      update((state) => ({ ...state, user })),
    clearAuth: () => set({ ...defaultState }),
  };
}

export const authStore = createAuthStore();
