import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { MeshGradientRenderer } from '@/lib/utils/background/mesh-renderer';
import { AbstractBaseRenderer } from '@/lib/utils/background/base';

export interface WebGLBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
    album?: string;
    fps?: number;
    playing?: boolean;
    flowSpeed?: number;
    renderScale?: number;
    lowFreqVolume?: number;
    bass?: number;
    mid?: number;
    treble?: number;
    isMobile?: boolean;
}

export interface WebGLBackgroundRef {
    bgRender?: AbstractBaseRenderer;
    wrapperEl: HTMLDivElement | null;
}

export const WebGLBackground = forwardRef<WebGLBackgroundRef, WebGLBackgroundProps>(
    ({ album, fps = 30, playing = true, flowSpeed = 2, renderScale = 0.5, lowFreqVolume = 1.0, bass = 0, mid = 0, treble = 0, isMobile = false, style, ...props }, ref) => {
        const wrapperRef = useRef<HTMLDivElement>(null);
        const rendererRef = useRef<MeshGradientRenderer | null>(null);

        useEffect(() => {
            if (!wrapperRef.current) return;

            const canvas = document.createElement("canvas");
            canvas.style.pointerEvents = "none";
            canvas.style.zIndex = "-1";
            canvas.style.contain = "strict";
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.style.minHeight = "0";
            canvas.style.minWidth = "0";
            canvas.style.overflow = "hidden";
            wrapperRef.current.appendChild(canvas);

            const renderer = new MeshGradientRenderer(canvas);
            rendererRef.current = renderer;

            // 移动端性能优化：先设置移动模式再设置其他参数
            if (isMobile) {
                renderer.setMobileMode(true);
            }

            // Initial configurations
            renderer.setFPS(fps);
            renderer.setFlowSpeed(flowSpeed);
            renderer.setRenderScale(renderScale);
            renderer.setLowFreqVolume(lowFreqVolume);

            return () => {
                renderer.dispose();
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        useEffect(() => {
            if (rendererRef.current) {
                rendererRef.current.setAlbum(album, false);
            }
        }, [album]);

        useEffect(() => {
            if (rendererRef.current) {
                rendererRef.current.setFPS(fps);
            }
        }, [fps]);

        useEffect(() => {
            if (rendererRef.current) {
                if (playing) {
                    rendererRef.current.resume();
                } else {
                    rendererRef.current.pause();
                }
            }
        }, [playing]);

        useEffect(() => {
            if (rendererRef.current) {
                rendererRef.current.setFlowSpeed(flowSpeed);
            }
        }, [flowSpeed]);

        useEffect(() => {
            if (rendererRef.current) {
                rendererRef.current.setRenderScale(renderScale);
            }
        }, [renderScale]);

        useEffect(() => {
            if (rendererRef.current) {
                rendererRef.current.setLowFreqVolume(lowFreqVolume);
            }
        }, [lowFreqVolume]);

        useEffect(() => {
            if (rendererRef.current) {
                rendererRef.current.setFrequencyData(bass, mid, treble);
            }
        }, [bass, mid, treble]);

        useImperativeHandle(ref, () => ({
            wrapperEl: wrapperRef.current,
            bgRender: rendererRef.current || undefined,
        }));

        return (
            <div
                ref={wrapperRef}
                style={{
                    display: "contents",
                    ...style,
                }}
                {...props}
            />
        );
    }
);

WebGLBackground.displayName = "WebGLBackground";
