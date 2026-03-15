"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { AuthForm } from "./AuthForm"

interface AuthDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="sr-only">账号</DialogTitle>
                    <DialogDescription className="sr-only">登录或注册您的账号</DialogDescription>
                </DialogHeader>
                <AuthForm
                    onLoginSuccess={() => onOpenChange(false)}
                    showHeader={true}
                />
            </DialogContent>
        </Dialog>
    )
}
