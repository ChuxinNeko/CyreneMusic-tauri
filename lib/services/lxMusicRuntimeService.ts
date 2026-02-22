
/**
 * LxMusic 运行时服务
 * 
 * 使用隐藏的 iframe 作为 JavaScript 沙箱执行洛雪音源 JS 脚本。
 * 参考 Flutter 实现，模拟洛雪音乐桌面版的 API 环境。
 */

import { invoke } from "@tauri-apps/api/core";

export interface LxScriptInfo {
  name: string;
  version: string;
  author: string;
  description: string;
  homepage: string;
  script: string;
  supportedSources: string[];
  supportedQualities: string[];
  platformQualities: Record<string, string[]>;
}

class LxMusicRuntimeService {
  private static instance: LxMusicRuntimeService;
  private iframe: HTMLIFrameElement | null = null;
  private isInitialized = false;
  private _isScriptReady = false;
  private _currentScript: LxScriptInfo | null = null;
  private pendingRequests = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();
  private requestCounter = 0;
  private httpRequestCounter = 0;

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

  public get isScriptReady() { return this._isScriptReady; }
  public get currentScript() { return this._currentScript; }

  /**
   * 初始化沙箱 iframe
   */
  private initSandbox() {
    if (this.iframe) return;

    this.iframe = document.createElement('iframe');
    this.iframe.style.display = 'none';
    this.iframe.id = 'lx-music-sandbox';

    // 生成沙箱 HTML，包含 MD5 实现和 lx API
    const sandboxHtml = this.generateSandboxHtml();

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
      case 'lx-on-response':
        const pending = this.pendingRequests.get(requestKey);
        if (pending) {
          this.pendingRequests.delete(requestKey);
          if (success) pending.resolve(resultUrl);
          else pending.reject(new Error(error));
        }
        break;
      case 'lx-on-error':
        console.error('[LxMusicRuntime] Script Error:', data);
        break;
    }
  }

  /**
   * 代理沙箱的网络请求 - 通过 Rust 后端执行
   */
  private async proxyRequest(requestId: string, url: string, options: any) {
    try {
      const method = (options.method || 'GET').toUpperCase();
      const headers: Record<string, string> = {};

      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          headers[key.toLowerCase()] = String(value);
        });
      }

      if (!headers['user-agent']) {
        headers['user-agent'] = 'lx-music-request';
      }

      console.log(`[LxMusicRuntime] Rust Proxying ${method} ${url}`);

      const response: any = await invoke('lx_http_request', {
        options: {
          method,
          url,
          headers,
          body: options.body
        }
      });

      this.iframe?.contentWindow?.postMessage({
        type: 'lx-handle-http-response',
        requestId,
        success: true,
        response: {
          statusCode: response.statusCode,
          headers: response.headers || {},
          body: response.body
        },
        body: response.body
      }, '*');
    } catch (error: any) {
      console.error('[LxMusicRuntime] Proxy request failed:', error);
      this.iframe?.contentWindow?.postMessage({
        type: 'lx-handle-http-response',
        requestId,
        success: false,
        error: error.message || String(error)
      }, '*');
    }
  }

  private handleInited(data: any) {
    console.log('[LxMusicRuntime] Script inited:', data);
    if (data && data.sources) {
      const sources = data.sources;
      const supportedSources = Object.keys(sources);
      const platformQualities: Record<string, string[]> = {};
      const allQualities = new Set<string>();

      Object.entries(sources).forEach(([key, value]: [string, any]) => {
        const quals = value.qualitys || value;
        if (Array.isArray(quals)) {
          const qList = quals.map(q => String(q));
          platformQualities[key] = qList;
          qList.forEach(q => allQualities.add(q));
        }
      });

      const qualityOrder = ['128k', '320k', 'flac', 'flac24bit'];
      const supportedQualities = qualityOrder.filter(q => allQualities.has(q));

      if (this._currentScript) {
        this._currentScript.supportedSources = supportedSources;
        this._currentScript.supportedQualities = supportedQualities;
        this._currentScript.platformQualities = platformQualities;
      }
    }
    this._isScriptReady = true;
  }

  /**
   * 加载脚本到沙箱
   */
  public async loadScript(scriptInfo: Partial<LxScriptInfo> & { script: string }): Promise<boolean> {
    if (!this.isInitialized) this.initSandbox();

    this._isScriptReady = false;
    this._currentScript = {
      name: scriptInfo.name || 'Unknown',
      version: scriptInfo.version || '1.0.0',
      author: scriptInfo.author || '',
      description: scriptInfo.description || '',
      homepage: scriptInfo.homepage || '',
      script: scriptInfo.script,
      supportedSources: [],
      supportedQualities: [],
      platformQualities: {}
    };

    const scriptBase64 = btoa(unescape(encodeURIComponent(scriptInfo.script)));

    this.iframe?.contentWindow?.postMessage({
      type: 'lx-load-script',
      scriptContent: scriptInfo.script,
      scriptInfo: {
        ...this._currentScript,
        scriptBase64
      }
    }, '*');

    // 等待初始化 (最多 10s)
    let retry = 0;
    while (!this._isScriptReady && retry < 100) {
      await new Promise(r => setTimeout(r, 100));
      retry++;
    }

    return this._isScriptReady;
  }

  /**
   * 获取音乐 URL
   */
  public async getMusicUrl(source: string, songId: any, quality: string, musicInfo?: any): Promise<string> {
    if (!this._isScriptReady) throw new Error("Script not ready");

    const requestKey = `req_${++this.requestCounter}_${Date.now()}`;

    let info = musicInfo;
    if (!info) {
      const idStr = String(songId);
      if (source === 'kg' && idStr.includes(':')) {
        const parts = idStr.split(':');
        info = {
          hash: parts[0].toUpperCase(),
          albumId: parts[1] || '',
          songmid: parts[0].toUpperCase()
        };
      } else {
        info = {
          songmid: idStr,
          copyrightId: idStr,
          hash: idStr
        };
      }
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestKey, { resolve, reject });

      this.iframe?.contentWindow?.postMessage({
        type: 'lx-send-request',
        requestKey,
        source,
        action: 'musicUrl',
        info: {
          musicInfo: info,
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

  private generateSandboxHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LxMusic Sandbox</title>
</head>
<body>
<script>
(function() {
  'use strict';
  let isInited = false;
  let requestHandler = null;
  const pendingHttpRequests = new Map();
  let httpRequestCounter = 0;

  function sendToParent(type, data) {
    window.parent.postMessage({ type, ...data }, '*');
  }

  // MD5 Implementation
  const md5 = (function() {
    function md5cycle(x, k) {
      let a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a, b, c, d, k[0], 7, -680876936);
      d = ff(d, a, b, c, k[1], 12, -389564586);
      c = ff(c, d, a, b, k[2], 17, 606105819);
      b = ff(b, c, d, a, k[3], 22, -1044525330);
      a = ff(a, b, c, d, k[4], 7, -176418897);
      d = ff(d, a, b, c, k[5], 12, 1200080426);
      c = ff(c, d, a, b, k[6], 17, -1473231341);
      b = ff(b, c, d, a, k[7], 22, -45705983);
      a = ff(a, b, c, d, k[8], 7, 1770035416);
      d = ff(d, a, b, c, k[9], 12, -1958414417);
      c = ff(c, d, a, b, k[10], 17, -42063);
      b = ff(b, c, d, a, k[11], 22, -1990404162);
      a = ff(a, b, c, d, k[12], 7, 1804603682);
      d = ff(d, a, b, c, k[13], 12, -40341101);
      c = ff(c, d, a, b, k[14], 17, -1502002290);
      b = ff(b, c, d, a, k[15], 22, 1236535329);
      a = gg(a, b, c, d, k[1], 5, -165796510);
      d = gg(d, a, b, c, k[6], 9, -1069501632);
      c = gg(c, d, a, b, k[11], 14, 643717713);
      b = gg(b, c, d, a, k[0], 20, -373897302);
      a = gg(a, b, c, d, k[5], 5, -701558691);
      d = gg(d, a, b, c, k[10], 9, 38016083);
      c = gg(c, d, a, b, k[15], 14, -660478335);
      b = gg(b, c, d, a, k[4], 20, -405537848);
      a = gg(a, b, c, d, k[9], 5, 568446438);
      d = gg(d, a, b, c, k[14], 9, -1019803690);
      c = gg(c, d, a, b, k[3], 14, -187363961);
      b = gg(b, c, d, a, k[8], 20, 1163531501);
      a = gg(a, b, c, d, k[13], 5, -1444681467);
      d = gg(d, a, b, c, k[2], 9, -51403784);
      c = gg(c, d, a, b, k[7], 14, 1735328473);
      b = gg(b, c, d, a, k[12], 20, -1926607734);
      a = hh(a, b, c, d, k[5], 4, -378558);
      d = hh(d, a, b, c, k[8], 11, -2022574463);
      c = hh(c, d, a, b, k[11], 16, 1839030562);
      b = hh(b, c, d, a, k[14], 23, -35309556);
      a = hh(a, b, c, d, k[1], 4, -1530992060);
      d = hh(d, a, b, c, k[4], 11, 1272893353);
      c = hh(c, d, a, b, k[7], 16, -155497632);
      b = hh(b, c, d, a, k[10], 23, -1094730640);
      a = hh(a, b, c, d, k[13], 4, 681279174);
      d = hh(d, a, b, c, k[0], 11, -358537222);
      c = hh(c, d, a, b, k[3], 16, -722521979);
      b = hh(b, c, d, a, k[6], 23, 76029189);
      a = hh(a, b, c, d, k[9], 4, -640364487);
      d = hh(d, a, b, c, k[12], 11, -421815835);
      c = hh(c, d, a, b, k[15], 16, 530742520);
      b = hh(b, c, d, a, k[2], 23, -995338651);
      a = ii(a, b, c, d, k[0], 6, -198630844);
      d = ii(d, a, b, c, k[7], 10, 1126891415);
      c = ii(c, d, a, b, k[14], 15, -1416354905);
      b = ii(b, c, d, a, k[5], 21, -57434055);
      a = ii(a, b, c, d, k[12], 6, 1700485571);
      d = ii(d, a, b, c, k[3], 10, -1894986606);
      c = ii(c, d, a, b, k[10], 15, -1051523);
      b = ii(b, c, d, a, k[1], 21, -2054922799);
      a = ii(a, b, c, d, k[8], 6, 1873313359);
      d = ii(d, a, b, c, k[15], 10, -30611744);
      c = ii(c, d, a, b, k[6], 15, -1560198380);
      b = ii(b, c, d, a, k[13], 21, 1309151649);
      a = ii(a, b, c, d, k[4], 6, -145523070);
      d = ii(d, a, b, c, k[11], 10, -1120210379);
      c = ii(c, d, a, b, k[2], 15, 718787259);
      b = ii(b, c, d, a, k[9], 21, -343485551);
      x[0] = add32(a, x[0]);
      x[1] = add32(b, x[1]);
      x[2] = add32(c, x[2]);
      x[3] = add32(d, x[3]);
    }
    function cmn(q, a, b, x, s, t) {
      a = add32(add32(a, q), add32(x, t));
      return add32((a << s) | (a >>> (32 - s)), b);
    }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
    function md51(s) {
      const n = s.length;
      let state = [1732584193, -271733879, -1732584194, 271733878], i;
      for (i = 64; i <= s.length; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
      s = s.substring(i - 64);
      const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
      tail[i >> 2] |= 0x80 << ((i % 4) << 3);
      if (i > 55) {
        md5cycle(state, tail);
        for (i = 0; i < 16; i++) tail[i] = 0;
      }
      tail[14] = n * 8;
      md5cycle(state, tail);
      return state;
    }
    function md5blk(s) {
      const md5blks = [];
      for (let i = 0; i < 64; i += 4) md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
      return md5blks;
    }
    const hex_chr = '0123456789abcdef'.split('');
    function rhex(n) {
      let s = '', j = 0;
      for (; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
      return s;
    }
    function hex(x) {
      for (let i = 0; i < x.length; i++) x[i] = rhex(x[i]);
      return x.join('');
    }
    function add32(a, b) { return (a + b) & 0xFFFFFFFF; }
    return function(s) { return hex(md51(s)); };
  })();

  const utils = {
    crypto: {
      aesEncrypt: (buf) => buf,
      rsaEncrypt: (buf) => buf,
      randomBytes: (size) => {
        const bytes = new Uint8Array(size);
        crypto.getRandomValues(bytes);
        return bytes;
      },
      md5: (str) => {
        if (typeof str !== 'string') str = new TextDecoder().decode(str);
        return md5(str);
      }
    },
    buffer: {
      from: (data, enc) => {
        if (typeof data === 'string') {
          if (enc === 'base64') return Uint8Array.from(atob(data), c => c.charCodeAt(0));
          return new TextEncoder().encode(data);
        }
        return new Uint8Array(data);
      },
      bufToString: (buf, fmt) => {
        if (fmt === 'hex') return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (fmt === 'base64') return btoa(String.fromCharCode(...new Uint8Array(buf)));
        return new TextDecoder().decode(buf);
      }
    }
  };

  window.lx = {
    EVENT_NAMES: { request: 'request', inited: 'inited', updateAlert: 'updateAlert' },
    request: (url, opts, cb) => {
      const rid = 'http_' + (++httpRequestCounter);
      pendingHttpRequests.set(rid, cb);
      sendToParent('lx-request', { requestId: rid, url, options: opts || {} });
      return () => pendingHttpRequests.delete(rid);
    },
    on: (evt, h) => { if (evt === 'request') requestHandler = h; },
    send: (evt, data) => {
      if (evt === 'inited') {
        isInited = true;
        sendToParent('lx-inited', { data });
      }
      return Promise.resolve();
    },
    utils,
    version: '2.0.0',
    env: 'desktop',
    currentScriptInfo: {}
  };

  window.addEventListener('message', (event) => {
    const { type, requestId, response, error, action, source, info, requestKey, scriptContent, scriptInfo } = event.data;
    
    if (type === 'lx-handle-http-response') {
      const cb = pendingHttpRequests.get(requestId);
      if (cb) {
        pendingHttpRequests.delete(requestId);
        if (error) cb(new Error(error), null, null);
        else cb(null, response, response.body);
      }
    } else if (type === 'lx-load-script') {
      window.lx.currentScriptInfo = { ...scriptInfo, rawScript: scriptInfo.scriptContent || scriptInfo.script };
      try {
        (new Function(scriptContent))();
      } catch (e) {
        sendToParent('lx-on-error', { data: e.message });
      }
    } else if (type === 'lx-send-request') {
      if (requestHandler) {
        requestHandler({ source, action, info }).then(url => {
          sendToParent('lx-on-response', { requestKey, success: true, url });
        }).catch(err => {
          sendToParent('lx-on-response', { requestKey, success: false, error: err.message || String(err) });
        });
      }
    }
  });
})();
</script>
</body>
</html>
    `;
  }
}

export const lxMusicRuntimeService = LxMusicRuntimeService.getInstance();
