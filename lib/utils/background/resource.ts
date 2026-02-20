import { invoke } from '@tauri-apps/api/core';

export function loadImage(imageUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = document.createElement("img");
        img.onload = () => resolve(img);
        img.onerror = async () => {
            // CORS 加载失败时，通过 Tauri Rust 侧下载图片为 data URL
            // 这样图片数据成为同源，canvas getImageData 不会报 tainted 错误
            console.warn(`[loadImage] CORS load failed, fetching via Tauri: ${imageUrl}`);
            try {
                const dataUrl: string = await invoke('fetch_image', { url: imageUrl });
                const fallback = document.createElement("img");
                fallback.onload = () => resolve(fallback);
                fallback.onerror = reject;
                fallback.loading = "eager";
                fallback.src = dataUrl;
            } catch (e) {
                console.error('[loadImage] Tauri fetch_image failed:', e);
                reject(e);
            }
        };
        img.crossOrigin = "anonymous";
        img.loading = "eager";
        img.src = imageUrl;
    });
}

export function loadVideo(videoUrl: string): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        let playing = false;
        let timeupdate = false;
        let rejected = false;
        video.addEventListener(
            "playing",
            () => {
                playing = true;
                checkReady();
            },
            true,
        );
        video.addEventListener(
            "timeupdate",
            () => {
                timeupdate = true;
                checkReady();
            },
            true,
        );
        video.addEventListener(
            "error",
            (err) => {
                rejected = true;
                reject(err);
            },
            true,
        );
        function checkReady() {
            if (playing && timeupdate && !rejected) {
                resolve(video);
            }
        }
        video.src = videoUrl;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.play();
    });
}

export function loadResourceFromUrl(
    url: string,
    isVideo = false,
): Promise<HTMLImageElement | HTMLVideoElement> {
    return isVideo ? loadVideo(url) : loadImage(url);
}

export function loadResourceFromElement(
    element: HTMLImageElement | HTMLVideoElement,
): Promise<HTMLImageElement | HTMLVideoElement> {
    return new Promise((resolve, reject) => {
        if (
            element instanceof HTMLImageElement
                ? element.complete
                : element.readyState >= 3
        ) {
            resolve(element);
        } else {
            element.onload = () => resolve(element);
            element.onerror = reject;
        }
    });
}
