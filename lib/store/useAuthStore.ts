import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User, authService } from '@/lib/services/authService'

interface AuthState {
    user: User | null
    token: string | null
    isLoggedIn: boolean
    isLoading: boolean

    // Actions
    login: (user: User, token: string) => void
    logout: () => void
    updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoggedIn: false,
            isLoading: false,

            login: (user, token) => set({ user, token, isLoggedIn: true }),

            logout: () => set({ user: null, token: null, isLoggedIn: false }),

            updateUser: (user) => set({ user }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ user: state.user, token: state.token, isLoggedIn: state.isLoggedIn }),
        }
    )
)
