
/**
 * LxMusic 运行时服务
 * 
 * 使用隐藏的 iframe 作为 JavaScript 沙箱执行洛雪音源 JS 脚本。
 * 参考 Flutter 实现，模拟洛雪音乐桌面版的 API 环境。
 */

import { Track } from "../models/track";
import { invoke } from "@tauri-apps/api/core";

export interface LxScriptInfo {
  name: string;
  version: string;
  author: string;
  description: string;
  sources: string[];
  qualities: string[];
}

class LxMusicRuntimeService {
  private static instance: LxMusicRuntimeService;
  private iframe: HTMLIFrameElement | null = null;
  private isInitialized = false;
  private isScriptReady = false;
  private currentScript: LxScriptInfo | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();
  private requestCounter = 0;

  private constructor() {
    if (typeof window !== "undefined") {
      this.initSandbox();
    }
  }

  public static getInstance(): LxMusicRuntimeService {
    if (!LxMusicRuntimeService.instance) {
      LxMusicRuntimeService.instance = new LxMusicRuntimeService();
    }
    return LxMusicRuntimeService.instance;
  }

  /**
   * 初始化沙箱 iframe
   */
  private initSandbox() {
    if (this.iframe) return;

    this.iframe = document.createElement('iframe');
    this.iframe.style.display = 'none';
    this.iframe.id = 'lx-music-sandbox';

    // 初始化沙箱内容，注入模拟的 lx API
    const sandboxHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <script>
          (function() {
            const pendingHttpRequests = new Map();
            let httpCounter = 0;

            // 模拟 lx API
            window.lx = {
              EVENT_NAMES: {
                request: 'request',
                inited: 'inited',
                updateAlert: 'updateAlert'
              },
              request: (url, options, callback) => {
                const requestId = 'http_' + (++httpCounter);
                pendingHttpRequests.set(requestId, callback);
                window.parent.postMessage({
                  type: 'lx-request',
                  requestId,
                  url,
                  options
                }, '*');
                return () => pendingHttpRequests.delete(requestId);
              },
              on: (eventName, handler) => {
                if (eventName === 'request') {
                  window.__lxRequestHandler = handler;
                }
              },
              send: (eventName, data) => {
                if (eventName === 'inited') {
                  window.parent.postMessage({
                    type: 'lx-inited',
                    data
                  }, '*');
                }
                return Promise.resolve();
              },
              utils: {
                // 常见的工具函数可以根据需要补充
                buffer: {
                  from: (data, encoding) => {
                    return btoa(data);
                  }
                }
              },
              version: '1.0.0',
              env: 'desktop'
            };

            // 处理来自父窗口的消息
            window.addEventListener('message', (event) => {
              const { type, requestId, response, error, action, source, info, requestKey } = event.data;
              
              if (type === 'lx-response') {
                const callback = pendingHttpRequests.get(requestId);
                if (callback) {
                  pendingHttpRequests.delete(requestId);
                  callback(error, response);
                }
              } else if (type === 'lx-execute-request') {
                if (window.__lxRequestHandler) {
                  window.__lxRequestHandler({ action, source, info }).then(url => {
                    window.parent.postMessage({
                      type: 'lx-url-response',
                      requestKey,
                      success: true,
                      url
                    }, '*');
                  }).catch(err => {
                    window.parent.postMessage({
                      type: 'lx-url-response',
                      requestKey,
                      success: false,
                      error: err.message || String(err)
                    }, '*');
                  });
                }
              }
            });

            console.log('LX Sandbox Inited');
          })();
        </script>
      </body>
      </html>
    `;

    document.body.appendChild(this.iframe);
    const doc = this.iframe.contentWindow?.document || this.iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(sandboxHtml);
      doc.close();
    }

    window.addEventListener('message', this.handleMessage.bind(this));
    this.isInitialized = true;
  }

  /**
   * 处理来自沙箱的消息
   */
  private async handleMessage(event: MessageEvent) {
    if (!event.data || typeof event.data !== 'object') return;
    const { type, requestId, url, options, data, requestKey, success, url: resultUrl, error } = event.data;

    switch (type) {
      case 'lx-request':
        this.proxyRequest(requestId, url, options);
        break;
      case 'lx-inited':
        this.handleInited(data);
        break;
      case 'lx-url-response':
        const pending = this.pendingRequests.get(requestKey);
        if (pending) {
          this.pendingRequests.delete(requestKey);
          if (success) pending.resolve(resultUrl);
          else pending.reject(new Error(error));
        }
        break;
    }
  }

  /**
   * 代理沙箱的网络请求 - 通过 Rust 后端执行，绕过 CORS 预检 (OPTIONS)
   */
  private async proxyRequest(requestId: string, url: string, options: any) {
    try {
      const method = (options.method || 'GET').toUpperCase();
      const headers = {
        'User-Agent': options.headers?.['User-Agent'] || 'lx-music-request',
        ...options.headers
      };

      console.log(`[LxMusicRuntime] Rust Proxying ${method} request to: ${url}`);

      const response: any = await invoke('lx_http_request', {
        options: {
          method,
          url,
          headers,
          body: options.body
        }
      });

      this.iframe?.contentWindow?.postMessage({
        type: 'lx-response',
        requestId,
        response: {
          statusCode: response.statusCode,
          body: response.body
        }
      }, '*');
    } catch (error: any) {
      console.error('[LxMusicRuntime] Proxy request failed:', error);
      this.iframe?.contentWindow?.postMessage({
        type: 'lx-response',
        requestId,
        error: error.message || String(error)
      }, '*');
    }
  }

  private handleInited(data: any) {
    console.log('[LxMusicRuntime] Script inited:', data);
    this.isScriptReady = true;
  }

  /**
   * 加载脚本到沙箱
   */
  public async loadScript(scriptContent: string): Promise<boolean> {
    if (!this.isInitialized) this.initSandbox();

    this.isScriptReady = false;

    const scriptTag = `
      (function() {
        try {
          ${scriptContent}
        } catch (e) {
          console.error('Script Evaluation Error:', e);
        }
      })();
    `;

    // 清理旧脚本
    if (this.iframe?.contentWindow) {
      const doc = this.iframe.contentWindow.document;
      const oldScripts = doc.querySelectorAll('script.lx-user-script');
      oldScripts.forEach(s => s.remove());

      const scriptEl = doc.createElement('script');
      scriptEl.className = 'lx-user-script';
      scriptEl.textContent = scriptTag;
      doc.body.appendChild(scriptEl);
    }

    // 等待初始化
    let retry = 0;
    while (!this.isScriptReady && retry < 20) {
      await new Promise(r => setTimeout(r, 100));
      retry++;
    }

    return this.isScriptReady;
  }

  /**
   * 获取音乐 URL
   */
  public async getMusicUrl(source: string, musicInfo: any, quality: string): Promise<string> {
    if (!this.isScriptReady) throw new Error("Script not ready");

    const requestKey = `req_${++this.requestCounter}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestKey, { resolve, reject });

      this.iframe?.contentWindow?.postMessage({
        type: 'lx-execute-request',
        requestKey,
        action: 'musicUrl',
        source,
        info: {
          musicInfo,
          type: quality
        }
      }, '*');

      // 30s 超时
      setTimeout(() => {
        if (this.pendingRequests.has(requestKey)) {
          this.pendingRequests.delete(requestKey);
          reject(new Error("Timeout"));
        }
      }, 30000);
    });
  }
}

export const lxMusicRuntimeService = LxMusicRuntimeService.getInstance();
