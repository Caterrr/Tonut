import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// Only launches the explicitly supplied official binary; never opens credential files.
export class QuotaClient {
  constructor(command, args = ['app-server']) {
    this.child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    this.pending = new Map(); this.serial = 0; this.closed = false;
    this.child.stderr.resume(); // Do not persist private server diagnostics.
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', line => {
      let m; try { m = JSON.parse(line); } catch { return; }
      const p = this.pending.get(m?.id); if (!p) return;
      this.pending.delete(m.id); clearTimeout(p.timer);
      m.error ? p.reject(new Error('额度接口返回错误；未记录原始账号响应')) : p.resolve(m.result);
    });
    this.child.on('error', () => this.close());
    this.child.on('exit', () => this.close());
    this.child.stdin.on('error', () => this.close());
  }
  request(method, params) {
    if (!['initialize', 'account/rateLimits/read'].includes(method)) throw new Error('只允许初始化与只读额度请求');
    if (this.closed) return Promise.reject(new Error('额度进程已关闭'));
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('额度接口超时')); }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, ...(params ? { params } : {}) }) + '\n');
    });
  }
  async initialize() {
    await this.request('initialize', { clientInfo: { name: 'tonut', title: 'Tonut', version: '0.4.2' } });
    this.child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
  }
  read() { return this.request('account/rateLimits/read'); }
  close() {
    if (this.closed) return; this.closed = true;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('额度进程已关闭')); }
    this.pending.clear(); this.lines.close();
    this.child.kill();
  }
}
