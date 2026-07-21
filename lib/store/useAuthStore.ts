import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User } from '@/lib/services/authService'

interface AuthState {
    user: User | null
    token: string | null
    isLoggedIn: boolean
    isLoading: boolean
    hasCompletedSetup: boolean
    hasAcceptedAgreement: boolean
    /** 全局登录弹窗（不持久化） */
    isAuthDialogOpen: boolean

    // Actions
    login: (user: User, token: string) => void
    logout: () => void
    updateUser: (user: User) => void
    completeSetup: () => void
    acceptAgreement: () => void
    openAuthDialog: () => void
    closeAuthDialog: () => void
    setAuthDialogOpen: (open: boolean) => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isLoggedIn: false,
            isLoading: false,
            hasCompletedSetup: false,
            hasAcceptedAgreement: false,
            isAuthDialogOpen: false,

            login: (user, token) => set({ user, token, isLoggedIn: true, isAuthDialogOpen: false }),

            // 仅清登录凭证；保留协议/初始配置完成态，避免 token 失效重登后再次进入 SetupWizard
            logout: () => set({ user: null, token: null, isLoggedIn: false }),

            updateUser: (user) => set({ user }),

            completeSetup: () => set({ hasCompletedSetup: true }),

            acceptAgreement: () => set({ hasAcceptedAgreement: true }),

            openAuthDialog: () => set({ isAuthDialogOpen: true }),

            closeAuthDialog: () => set({ isAuthDialogOpen: false }),

            setAuthDialogOpen: (open) => set({ isAuthDialogOpen: open }),
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