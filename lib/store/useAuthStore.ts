import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User, authService } from '@/lib/services/authService'

interface AuthState {
    user: User | null
    token: string | null
    isLoggedIn: boolean
    isLoading: boolean
    hasCompletedSetup: boolean
    hasAcceptedAgreement: boolean

    // Actions
    login: (user: User, token: string) => void
    logout: () => void
    updateUser: (user: User) => void
    completeSetup: () => void
    acceptAgreement: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoggedIn: false,
            isLoading: false,
            hasCompletedSetup: false,
            hasAcceptedAgreement: false,

            login: (user, token) => set({ user, token, isLoggedIn: true }),

            logout: () => set({ user: null, token: null, isLoggedIn: false, hasCompletedSetup: false }),

            updateUser: (user) => set({ user }),

            completeSetup: () => set({ hasCompletedSetup: true }),

            acceptAgreement: () => set({ hasAcceptedAgreement: true }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isLoggedIn: state.isLoggedIn,
                hasCompletedSetup: state.hasCompletedSetup,
                hasAcceptedAgreement: state.hasAcceptedAgreement,
            }),
        }
    )
)
