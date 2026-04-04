import type { Disposable, HasElement } from "./interfaces";

export abstract class AbstractBaseRenderer implements Disposable, HasElement {
    abstract setFlowSpeed(speed: number): void;
    abstract setRenderScale(scale: number): void;
    abstract setStaticMode(enable: boolean): void;
    abstract setFPS(fps: number): void;
    abstract pause(): void;
    abstract resume(): void;
    abstract setAlbum(
        albumSource: string | HTMLImageElement | HTMLVideoElement,
        isVideo?: boolean
    ): Promise<void>;
    abstract setLowFreqVolume(volume: number): void;
    abstract setHasLyric(hasLyric: boolean): void;
    abstract dispose(): void;
    abstract getElement(): HTMLElement;
}

export abstract class BaseRenderer extends AbstractBaseRenderer {
    private observer: ResizeObserver;
    protected flowSpeed = 4;
    protected currerntRenderScale = 0.75;
    protected mobileMode = false;

    constructor(protected canvas: HTMLCanvasElement) {
        super();
        this.observer = new ResizeObserver(() => {
            const dpr = this.mobileMode ? 1 : window.devicePixelRatio;
            const width = Math.max(
                1,
                canvas.clientWidth * dpr * this.currerntRenderScale
            );
            const height = Math.max(
                1,
                canvas.clientHeight * dpr * this.currerntRenderScale
            );
            this.onResize(width, height);
        });
        this.observer.observe(canvas);
    }

    setMobileMode(enable: boolean) {
        this.mobileMode = enable;
        // 触发一次 resize 以应用新的 DPR
        const dpr = enable ? 1 : window.devicePixelRatio;
        this.onResize(
            this.canvas.clientWidth * dpr * this.currerntRenderScale,
            this.canvas.clientHeight * dpr * this.currerntRenderScale
        );
    }

    setRenderScale(scale: number) {
        this.currerntRenderScale = scale;
        const dpr = this.mobileMode ? 1 : window.devicePixelRatio;
        this.onResize(
            this.canvas.clientWidth * dpr * this.currerntRenderScale,
            this.canvas.clientHeight * dpr * this.currerntRenderScale
        );
    }

    protected onResize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    setFlowSpeed(speed: number) {
        this.flowSpeed = speed;
    }

    abstract override setStaticMode(enable: boolean): void;
    abstract override setFPS(fps: number): void;
    abstract override pause(): void;
    abstract override resume(): void;
    abstract override setAlbum(
        albumSource: string | HTMLImageElement | HTMLVideoElement,
        isVideo?: boolean
    ): Promise<void>;

    dispose(): void {
        this.observer.disconnect();
        this.canvas.remove();
    }

    override getElement(): HTMLElement {
        return this.canvas;
    }
}
