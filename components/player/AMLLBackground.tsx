"use client"

import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { BackgroundRender, PixiRenderer } from '@applemusic-like-lyrics/core'
import '@applemusic-like-lyrics/core/style.css'

export interface AMLLBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
    album?: string
    playing?: boolean
    fps?: number
    renderScale?: number
    flowSpeed?: number
    lowFreqVolume?: number
    isMobile?: boolean
}

export interface AMLLBackgroundRef {
    bgRender?: BackgroundRender<PixiRenderer>
    wrapperEl: HTMLDivElement | null
}

export const AMLLBackground = forwardRef<AMLLBackgroundRef, AMLLBackgroundProps>(
    ({ album, playing = true, fps = 60, renderScale = 0.5, flowSpeed = 0.2, lowFreqVolume = 1.0, isMobile = false, style, ...props }, ref) => {
        const wrapperRef = useRef<HTMLDivElement>(null)
        const bgRef = useRef<BackgroundRender<PixiRenderer> | null>(null)

        // 初始化 AMLL 背景实例
        useEffect(() => {
            if (!wrapperRef.current) return

            const bg = BackgroundRender.new(PixiRenderer)

            // 设置初始参数
            bg.setFPS(fps)
            bg.setRenderScale(renderScale)
            bg.setFlowSpeed(flowSpeed)
            bg.setLowFreqVolume(lowFreqVolume)
            bg.setStaticMode(false)

            // 将 canvas 插入容器
            const canvas = bg.getElement()
            canvas.style.width = '100%'
            canvas.style.height = '100%'
            canvas.style.position = 'absolute'
            canvas.style.inset = '0'
            canvas.style.pointerEvents = 'none'
            wrapperRef.current.appendChild(canvas)

            bgRef.current = bg

            return () => {
                bg.dispose()
                bgRef.current = null
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])

        // 专辑图切换
        useEffect(() => {
            if (bgRef.current) {
                if (album) {
                    bgRef.current.setAlbum(album)
                }
            }
        }, [album])

        // 播放/暂停
        useEffect(() => {
            if (bgRef.current) {
                if (playing) bgRef.current.resume()
                else bgRef.current.pause()
            }
        }, [playing])

        // FPS
        useEffect(() => {
            if (bgRef.current) bgRef.current.setFPS(fps)
        }, [fps])

        // 渲染比例
        useEffect(() => {
            if (bgRef.current) bgRef.current.setRenderScale(renderScale)
        }, [renderScale])

        // 流动速度
        useEffect(() => {
            if (bgRef.current) bgRef.current.setFlowSpeed(flowSpeed)
        }, [flowSpeed])

        // 低频音量
        useEffect(() => {
            if (bgRef.current) bgRef.current.setLowFreqVolume(lowFreqVolume)
        }, [lowFreqVolume])

        useImperativeHandle(ref, () => ({
            wrapperEl: wrapperRef.current,
            bgRender: bgRef.current || undefined,
        }))

        return (
            <div
                ref={wrapperRef}
                style={{
                    position: 'relative',
                    display: 'contents',
                    ...style,
                }}
                {...props}
            />
        )
    }
)

AMLLBackground.displayName = 'AMLLBackground'