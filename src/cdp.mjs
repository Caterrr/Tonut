export function localWebSocket(raw, port) {
  const u = new URL(raw);
  if (u.protocol !== 'ws:' || u.hostname !== '127.0.0.1' || Number(u.port) !== port || u.username || u.password)
    throw new Error('拒绝非指定本机调试连接');
  return u;
}
export class PageConnection {
  constructor(socket) {
    this.socket = socket; this.serial = 0; this.pending = new Map();
    socket.addEventListener('message', event => {
      let m; try { m = JSON.parse(event.data); } catch { return; }
      const p = this.pending.get(m?.id); if (!p) return;
      this.pending.delete(m.id); clearTimeout(p.timer);
      m.error || m.result?.exceptionDetails ? p.reject(new Error('页面接口不兼容')) : p.resolve(m.result);
    });
    const reject = () => { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('页面连接已断开')); } this.pending.clear(); };
    socket.addEventListener('close', reject); socket.addEventListener('error', reject);
  }
  static async connect(raw, port) {
    const socket = new WebSocket(localWebSocket(raw, port));
    const page = new PageConnection(socket);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('页面连接超时')); }, 4000);
      const finish = (fn) => { clearTimeout(timer); fn(); };
      socket.addEventListener('open', () => finish(resolve), { once: true });
      socket.addEventListener('error', () => finish(() => reject(new Error('页面无法连接'))), { once: true });
      socket.addEventListener('close', () => finish(() => reject(new Error('页面连接已关闭'))), { once: true });
    });
    return page;
  }
  evaluate(expression) {
    return this.request('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }).then(result => result?.result?.value);
  }
  request(method, params) {
    if (!['Runtime.evaluate', 'Page.captureScreenshot', 'Page.bringToFront', 'Input.dispatchMouseEvent', 'Input.dispatchKeyEvent'].includes(method))
      throw new Error('Unsupported page operation');
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('页面连接不可用'));
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Object.assign(new Error('Page request timed out'),{code:'cdp_timeout'})); }, 4000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch { clearTimeout(timer); this.pending.delete(id); reject(new Error('页面请求失败')); }
    });
  }
  close() { this.socket.close(); }
}
