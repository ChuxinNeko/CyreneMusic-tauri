"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/lib/store/useAuthStore"
import { UserAgreementContent } from "@/components/common/UserAgreementContent"
import { AuthForm } from "@/components/auth/AuthForm"
import { AudioSourceManager } from "@/components/settings/AudioSourceManager"
import { Music, ChevronRight, ChevronLeft, Check, FileText, LogIn, Radio } from "lucide-react"
import Image from "next/image"

type SetupStep = 1 | 2 | 3

export function SetupWizard() {
    const {
        hasCompletedSetup,
        hasAcceptedAgreement,
        isLoggedIn,
        acceptAgreement,
        completeSetup,
    } = useAuthStore()

    // 确定初始步骤：如果已接受协议，从第2步开始；否则从第1步
    const getInitialStep = (): SetupStep => {
        if (hasAcceptedAgreement) return 2
        return 1
    }

    const [currentStep, setCurrentStep] = useState<SetupStep>(getInitialStep)
    const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward

    // 如果已完成配置，不渲染
    if (hasCompletedSetup) return null

    const goToStep = (step: SetupStep) => {
        setDirection(step > currentStep ? 1 : -1)
        setCurrentStep(step)
    }

    const handleAcceptAgreement = () => {
        acceptAgreement()
        goToStep(2)
    }

    const handleLoginSuccess = () => {
        // 登录成功后自动进入下一步
        goToStep(3)
    }

    const handleComplete = () => {
        completeSetup()
    }

    const stepInfo = [
        { icon: FileText, label: "用户协议", step: 1 as SetupStep },
        { icon: LogIn, label: "登录账号", step: 2 as SetupStep },
        { icon: Radio, label: "配置音源", step: 3 as SetupStep },
    ]

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 300 : -300,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction > 0 ? -300 : 300,
            opacity: 0,
        }),
    }

    return (
        <>
            {/* 桌面端：保留标题栏，覆盖标题栏以下区域 */}
            <div className="hidden md:flex fixed inset-0 top-[calc(env(safe-area-inset-top)+3.5rem+1px)] z-[90] bg-background flex-col">
                <SetupContent
                    currentStep={currentStep}
                    direction={direction}
                    stepInfo={stepInfo}
                    slideVariants={slideVariants}
                    onAcceptAgreement={handleAcceptAgreement}
                    onLoginSuccess={handleLoginSuccess}
                    onComplete={handleComplete}
                    onGoToStep={goToStep}
                    isLoggedIn={isLoggedIn}
                />
            </div>

            {/* 移动端：完全覆盖整个页面 */}
            <div className="flex md:hidden fixed inset-0 z-[90] bg-background flex-col">
                <SetupContent
                    currentStep={currentStep}
                    direction={direction}
                    stepInfo={stepInfo}
                    slideVariants={slideVariants}
                    onAcceptAgreement={handleAcceptAgreement}
                    onLoginSuccess={handleLoginSuccess}
                    onComplete={handleComplete}
                    onGoToStep={goToStep}
                    isLoggedIn={isLoggedIn}
                />
            </div>
        </>
    )
}

interface SetupContentProps {
    currentStep: SetupStep
    direction: number
    stepInfo: { icon: React.ElementType; label: string; step: SetupStep }[]
    slideVariants: any
    onAcceptAgreement: () => void
    onLoginSuccess: () => void
    onComplete: () => void
    onGoToStep: (step: SetupStep) => void
    isLoggedIn: boolean
}

function SetupContent({
    currentStep,
    direction,
    stepInfo,
    slideVariants,
    onAcceptAgreement,
    onLoginSuccess,
    onComplete,
    onGoToStep,
    isLoggedIn,
}: SetupContentProps) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* 顶部步骤指示器 */}
            <div className="flex items-center justify-center py-6 px-4 border-b bg-background/50 backdrop-blur-sm">
                <div className="flex items-center gap-2 max-w-md w-full">
                    {stepInfo.map((info, index) => {
                        const Icon = info.icon
                        const isActive = currentStep === info.step
                        const isCompleted = currentStep > info.step

                        return (
                            <React.Fragment key={info.step}>
                                {index > 0 && (
                                    <div className={`flex-1 h-0.5 rounded-full transition-colors duration-500 ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />
                                )}
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className={`
                                        relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500
                                        ${isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110' :
                                            isCompleted ? 'bg-primary/20 text-primary' :
                                                'bg-muted text-muted-foreground'}
                                    `}>
                                        {isCompleted ? (
                                            <Check className="h-5 w-5" />
                                        ) : (
                                            <Icon className="h-5 w-5" />
                                        )}
                                        {isActive && (
                                            <div className="absolute -inset-1 bg-primary/20 rounded-full animate-pulse" />
                                        )}
                                    </div>
                                    <span className={`text-[11px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {info.label}
                                    </span>
                                </div>
                            </React.Fragment>
                        )
                    })}
                </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-hidden relative">
                <AnimatePresence custom={direction} mode="wait">
                    <motion.div
                        key={currentStep}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute inset-0 overflow-auto"
                    >
                        {currentStep === 1 && (
                            <StepWelcome onAccept={onAcceptAgreement} />
                        )}
                        {currentStep === 2 && (
                            <StepLogin
                                onLoginSuccess={onLoginSuccess}
                                onSkip={() => onGoToStep(3)}
                                isLoggedIn={isLoggedIn}
                                onNext={() => onGoToStep(3)}
                            />
                        )}
                        {currentStep === 3 && (
                            <StepAudioSource
                                onComplete={onComplete}
                                onBack={() => onGoToStep(2)}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}

/** Step 1: 欢迎 + 用户协议 */
function StepWelcome({ onAccept }: { onAccept: () => void }) {
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement
        const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50
        if (isAtBottom) {
            setHasScrolledToBottom(true)
        }
    }

    return (
        <div className="flex flex-col h-full">
            {/* 欢迎头部 */}
            <div className="flex flex-col items-center text-center pt-8 pb-6 px-6 space-y-4 shrink-0">
                <div className="relative group">
                    <div className="absolute -inset-2 bg-gradient-to-tr from-primary/20 to-primary/5 rounded-3xl blur-xl opacity-75" />
                    <div className="relative bg-background rounded-2xl p-3 border shadow-xl">
                        <Image
                            src="/ico.png"
                            alt="CyreneMusic"
                            width={64}
                            height={64}
                            className="rounded-xl"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                        欢迎使用 CyreneMusic
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        在开始之前，请阅读并同意以下用户协议
                    </p>
                </div>
            </div>

            {/* 协议内容 - 可滚动 */}
            <div className="flex-1 overflow-hidden px-4 md:px-8">
                <div
                    className="h-full overflow-y-auto rounded-2xl border bg-card/50 p-6 md:p-8 max-w-3xl mx-auto"
                    onScroll={handleScroll}
                >
                    <div className="flex items-center justify-between mb-6 pb-4 border-b">
                        <h2 className="text-lg font-bold">CyreneMusic 使用协议</h2>
                        <div className="text-xs text-muted-foreground px-2 py-1 rounded bg-background/50 border">Apache-2.0</div>
                    </div>
                    <UserAgreementContent />
                </div>
            </div>

            {/* 底部按钮 */}
            <div className="shrink-0 p-6 flex justify-center">
                <Button
                    size="lg"
                    onClick={onAccept}
                    className="gap-2 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                >
                    我已阅读并同意协议
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

/** Step 2: 登录/注册 */
function StepLogin({
    onLoginSuccess,
    onSkip,
    isLoggedIn,
    onNext,
}: {
    onLoginSuccess: () => void
    onSkip: () => void
    isLoggedIn: boolean
    onNext: () => void
}) {
    // 如果已经登录，显示已登录状态
    if (isLoggedIn) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-6 space-y-6 text-center">
                <div className="p-4 bg-primary/10 rounded-full">
                    <Check className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">登录成功</h2>
                    <p className="text-muted-foreground">您已成功登录，继续下一步配置音源</p>
                </div>
                <Button size="lg" onClick={onNext} className="gap-2 px-8 rounded-xl">
                    继续
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto px-6 py-8">
                <div className="max-w-sm mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
                            <LogIn className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold">登录您的账号</h2>
                        <p className="text-sm text-muted-foreground">
                            登录后可同步歌单、查看听歌排行及更多个性化推荐
                        </p>
                    </div>

                    <AuthForm
                        onLoginSuccess={onLoginSuccess}
                        showHeader={false}
                    />
                </div>
            </div>

            <div className="shrink-0 p-6 flex justify-center border-t">
                <Button
                    variant="ghost"
                    onClick={onSkip}
                    className="text-muted-foreground hover:text-foreground"
                >
                    暂时跳过，稍后再说
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>
        </div>
    )
}

/** Step 3: 配置音源 */
function StepAudioSource({
    onComplete,
    onBack,
}: {
    onComplete: () => void
    onBack: () => void
}) {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto px-6 py-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
                            <Radio className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold">配置音源</h2>
                        <p className="text-sm text-muted-foreground">
                            添加至少一个音源以开始播放音乐。您也可以稍后在设置中配置。
                        </p>
                    </div>

                    <AudioSourceManager />
                </div>
            </div>

            <div className="shrink-0 p-6 flex items-center justify-between border-t max-w-2xl mx-auto w-full">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    className="gap-1"
                >
                    <ChevronLeft className="h-4 w-4" />
                    上一步
                </Button>
                <Button
                    size="lg"
                    onClick={onComplete}
                    className="gap-2 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                >
                    <Check className="h-4 w-4" />
                    完成配置
                </Button>
            </div>
        </div>
    )
}
