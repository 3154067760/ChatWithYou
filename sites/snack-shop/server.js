/* =========================================================
   宿舍补给站 · 零依赖服务器（Node 内置模块，无需 npm install）
   启动：node server.js   或双击 启动服务器.bat
   顾客：http://本机IP:3000/
   商家：http://本机IP:3000/admin.html   账号 gyq / root
   ========================================================= */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const os = require('os');
const { sendMail } = require('./mailer');

const ROOT = __dirname;
const DATA_DIR = process.env.SB_DATA || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

// ===== 商家账号（改这里就行，改完重启服务器） =====
const LOGIN = { username: 'gyq', password: 'root' };

const SESSION_TTL = 12 * 60 * 60 * 1000; // 登录有效期 12 小时
const MAX_BODY = 100 * 1024;

/* ---------------- 小店配置：从 data.js 读取 ---------------- */
let cfgCache = null;
let cfgMtime = 0;

function loadConfig() {
  const file = path.join(ROOT, 'data.js');
  const stat = fs.statSync(file);
  if (cfgCache && stat.mtimeMs === cfgMtime) return cfgCache;

  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { timeout: 2000 });

  const w = sandbox.window;
  if (!w.SHOP || !Array.isArray(w.PRODUCTS)) throw new Error('data.js 格式不对');

  cfgCache = {
    shop: w.SHOP,
    categories: Array.isArray(w.CATEGORIES) ? w.CATEGORIES : [],
    products: w.PRODUCTS,
  };
  cfgMtime = stat.mtimeMs;
  return cfgCache;
}

/* ---------------- 数据文件 ---------------- */
fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, fallback) {
  try {
    const val = JSON.parse(fs.readFileSync(file, 'utf8'));
    return val == null ? fallback : val;
  } catch (e) { return fallback; }
}

function writeJSON(file, val) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(val, null, 2));
  fs.renameSync(tmp, file);
}

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const store = { products: [], orders: [] };

(function loadStore() {
  const seed = loadConfig().products.map(function (p) {
    return Object.assign({}, p, { soldOut: !!p.soldOut });
  });

  const saved = readJSON(PRODUCTS_FILE, null);
  if (Array.isArray(saved) && saved.length) {
    store.products = saved;
  } else {
    store.products = seed;
    writeJSON(PRODUCTS_FILE, seed);
  }

  const orders = readJSON(ORDERS_FILE, []);
  store.orders = Array.isArray(orders) ? orders : [];
})();

function saveProducts() { writeJSON(PRODUCTS_FILE, store.products); }
function saveOrders() { writeJSON(ORDERS_FILE, store.orders); }

/* ---------------- 店铺设置（收款码） ---------------- */
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const QR_FILE = path.join(DATA_DIR, 'pay-qr.bin');

let settings = readJSON(SETTINGS_FILE, {});
if (!settings || typeof settings !== 'object' || Array.isArray(settings)) settings = {};
if (settings.payQr && !fs.existsSync(QR_FILE)) delete settings.payQr;

function saveSettings() { writeJSON(SETTINGS_FILE, settings); }

/* ---------------- 商品图片 ---------------- */
const IMAGES_DIR = path.join(DATA_DIR, 'images');
fs.mkdirSync(IMAGES_DIR, { recursive: true });

function imagePath(id) {
  return path.join(IMAGES_DIR, id + '.bin');
}

/* ---------------- 邮件通知 ---------------- */
let mailBusy = false;
const mailQueue = [];
let mailLast = { at: 0, ok: false, error: '', to: '' };

function getMailConfig() {
  const m = settings.mail || {};
  const to = String(m.to || '');
  return {
    enabled: !!m.enabled,
    to: to,
    from: String(m.from || to),
    user: String(m.user || m.from || to),
    pass: String(m.pass || ''),
    host: String(m.host || 'smtp.qq.com'),
    port: Number(m.port || 465),
    secure: m.secure !== false,
    notifyNew: m.notifyNew !== false,
    notifyPaid: m.notifyPaid !== false,
  };
}

function mailReady(cfg) {
  return !!(cfg.enabled && cfg.to && cfg.from && cfg.pass);
}

function queueMail(subject, text) {
  const cfg = getMailConfig();
  if (!mailReady(cfg)) return;
  mailQueue.push({ cfg: cfg, subject: subject, text: text });
  pumpMail();
}

function pumpMail() {
  if (mailBusy || !mailQueue.length) return;
  mailBusy = true;

  const job = mailQueue.shift();
  sendMail({
    host: job.cfg.host,
    port: job.cfg.port,
    secure: job.cfg.secure,
    user: job.cfg.user,
    pass: job.cfg.pass,
    from: job.cfg.from,
    to: job.cfg.to,
    fromName: loadConfig().shop.name || '宿舍补给站',
    subject: job.subject,
    text: job.text,
  }).then(function () {
    mailLast = { at: Date.now(), ok: true, error: '', to: job.cfg.to };
    console.log('[mail] 已发送：' + job.subject);
  }).catch(function (err) {
    mailLast = { at: Date.now(), ok: false, error: String(err.message || err), to: job.cfg.to };
    console.error('[mail] 发送失败：' + (err.message || err));
  }).then(function () {
    mailBusy = false;
    pumpMail();
  });
}

function notifyOrder(order, kind, req) {
  const cfg = getMailConfig();
  if (!mailReady(cfg)) return;
  if (kind === 'new' && !cfg.notifyNew) return;
  if (kind === 'paid' && !cfg.notifyPaid) return;

  const shop = loadConfig().shop;
  const title = kind === 'paid' ? '顾客说已付款' : '新订单';
  const items = order.items.map(function (i) {
    return '· ' + i.name + ' ×' + i.qty + (i.cooked ? '（泡好）' : '') + '  ¥' +
      round2(i.price * i.qty).toFixed(2);
  }).join('\r\n');

  const host = String((req && req.headers.host) || 'localhost').replace(/[^\w.:\-\[\]]/g, '');
  const lines = [
    '【' + shop.name + '】' + title,
    '',
    '订单号：' + order.no,
    '金额： ¥' + round2(order.total).toFixed(2) + (order.fee ? '（含配送费 ¥' + round2(order.fee).toFixed(2) + '）' : '（免配送费）'),
    (order.cookFee ? '泡好服务费： ¥' + round2(order.cookFee).toFixed(2) : ''),
    '',
    '商品：',
    items,
    '',
    '送到：' + order.build + ' ' + order.room,
    '电话：' + order.phone,
    '备注：' + (order.note || '无'),
    '时间：' + new Date(order.createdAt).toLocaleString('zh-CN', { hour12: false }),
    '',
    kind === 'paid'
      ? '顾客已经点了「我已付款」，请核对微信账单后，在后台点「确认收款」。'
      : '新订单来了，记得接单。',
    '',
    '后台： http://' + host + '/admin.html',
  ];

  queueMail('【' + shop.name + '】' + title + ' ' + order.no + ' ¥' + round2(order.total).toFixed(2),
    lines.join('\r\n'));
}

// 老订单补上支付状态
store.orders.forEach(function (o) {
  if (!o.payment || typeof o.payment !== 'object') {
    o.payment = { status: 'unpaid', claimedAt: 0, paidAt: 0 };
  }
});

// 老订单补一个查询凭证（顾客凭它看进度，不用登录）
let tokenPatched = false;
store.orders.forEach(function (o) {
  if (!o.token) {
    o.token = crypto.randomBytes(12).toString('hex');
    tokenPatched = true;
  }
});
if (tokenPatched) saveOrders();

// 老商品补上库存（默认 20）
let stockPatched = false;
store.products.forEach(function (p) {
  const n = Number(p.stock);
  if (!Number.isFinite(n) || n < 0) {
    p.stock = 20;
    stockPatched = true;
  } else {
    p.stock = Math.floor(n);
  }
});
if (stockPatched) saveProducts();

/* ---------------- 登录会话 ---------------- */
const sessions = new Map();      // token -> { user, exp }
const loginFails = new Map();     // ip -> { count, until }

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

// 在 Nginx 后面时，req.socket.remoteAddress 永远是 127.0.0.1，
// 登录限流要按真实访客 IP 算，否则一个人乱试就能把店主锁住。
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim();
  return (req.socket.remoteAddress || '') + '';
}

function currentUser(req) {
  const token = parseCookies(req).sb_sid;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.exp < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}

function requireAuth(req, res) {
  const user = currentUser(req);
  if (!user) {
    sendJSON(res, 401, { error: '请先登录' });
    return null;
  }
  return user;
}

/* ---------------- HTTP 小工具 ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req, limit) {
  const max = limit || MAX_BODY;
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > max) { reject(new Error('内容太大')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', function () {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('JSON 格式不对')); }
    });
    req.on('error', reject);
  });
}

function round2(n) { return Math.round(n * 100) / 100; }

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* ---------------- 订单 ---------------- */
const STATUSES = ['new', 'accepted', 'done', 'cancelled'];

function statsOf() {
  const t0 = todayStart();
  const today = store.orders.filter(function (o) {
    return o.createdAt >= t0 && o.status !== 'cancelled';
  });
  const revenue = today.filter(function (o) { return o.status === 'done'; })
    .reduce(function (n, o) { return n + o.total; }, 0);

  return {
    pending: store.orders.filter(function (o) { return o.status === 'new'; }).length,
    today: today.length,
    revenue: round2(revenue),
  };
}

function publicOrder(o) {
  return {
    id: o.id,
    no: o.no,
    status: o.status,
    payment: { status: (o.payment && o.payment.status) || 'unpaid' },
    items: o.items,
    goods: o.goods,
    cookFee: o.cookFee || 0,
    fee: o.fee,
    total: o.total,
    build: o.build,
    room: o.room,
    phone: String(o.phone || '').replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2'),
    note: o.note,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// 换设备查询限流：同一 IP 一分钟最多 10 次
const lookupHits = new Map();

function allowLookup(ip) {
  const now = Date.now();
  const rec = lookupHits.get(ip);
  if (!rec || rec.reset <= now) {
    lookupHits.set(ip, { count: 1, reset: now + 60 * 1000 });
    return true;
  }
  rec.count += 1;
  return rec.count <= 10;
}

function makeOrderNo() {
  const d = new Date();
  const p = function (n) { return n < 10 ? '0' + n : String(n); };
  for (let i = 0; i < 30; i++) {
    const no = '#' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) +
      '-' + String(Math.floor(1000 + Math.random() * 9000));
    if (!store.orders.some(function (o) { return o.no === no; })) return no;
  }
  return '#' + Date.now();
}

function restoreStock(order) {
  if (!order || order.stockRestored) return;
  (order.items || []).forEach(function (item) {
    const p = store.products.filter(function (x) { return x.id === item.id; })[0];
    if (p) p.stock = Number(p.stock || 0) + Number(item.qty || 0);
  });
  order.stockRestored = true;
  saveProducts();
}

async function createOrder(req, res) {
  let body;
  try { body = await readBody(req); }
  catch (e) { return sendJSON(res, 400, { error: e.message }); }

  const items = body.items;
  if (!Array.isArray(items) || !items.length) return sendJSON(res, 400, { error: '购物车是空的' });
  if (items.length > 80) return sendJSON(res, 400, { error: '商品太多了' });

  const cfg = loadConfig();
  const shop = cfg.shop;
  const lines = [];
  let goods = 0;
  let cookFeeTotal = 0;
  const unitCookFee = Number(shop.cookFee);

  for (const it of items) {
    const id = String(it && it.id || '');
    const qty = Number(it && it.qty);
    const product = store.products.filter(function (p) { return p.id === id; })[0];

    if (!product) return sendJSON(res, 400, { error: '有商品已经下架了，刷新页面看看' });
    if (product.soldOut) return sendJSON(res, 409, { error: '「' + product.name + '」刚好卖完了，换一个吧' });
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return sendJSON(res, 400, { error: '数量不对' });

    const stock = Number(product.stock);
    if (Number.isFinite(stock) && qty > stock) {
      return sendJSON(res, 409, {
        error: stock > 0
          ? '「' + product.name + '」库存只剩 ' + stock + ' 件'
          : '「' + product.name + '」卖完了',
      });
    }

    // 只有泡面类支持「泡好送上门」，后台可以单独关掉某个商品
    const cookable = product.cat === 'noodle' && product.cookable !== false;
    const cooked = !!(it && it.cooked) && cookable;
    const lineCookFee = cooked && Number.isFinite(unitCookFee) ? unitCookFee : 0;

    goods += product.price * qty + lineCookFee * qty;
    cookFeeTotal += lineCookFee * qty;

    lines.push({
      id: product.id,
      name: product.name,
      spec: product.spec || '',
      unit: product.unit || '份',
      emoji: product.emoji || '🛒',
      cat: product.cat,
      price: product.price,
      qty: qty,
      cooked: cooked,
      cookFee: lineCookFee,
    });
  }

  goods = round2(goods);
  cookFeeTotal = round2(cookFeeTotal);
  if (goods < shop.minOrder) {
    return sendJSON(res, 400, { error: '还差 ¥' + round2(shop.minOrder - goods) + ' 才到起送价' });
  }

  const fee = goods >= shop.freeDeliveryAt ? 0 : shop.deliveryFee;
  const total = round2(goods + fee);

  const build = String(body.build || '').trim().slice(0, 30);
  const room = String(body.room || '').trim().slice(0, 30);
  const phone = String(body.phone || '').replace(/[\s-]/g, '');
  const note = String(body.note || '').trim().slice(0, 200);

  if (!build) return sendJSON(res, 400, { error: '请填写楼栋' });
  if (!room) return sendJSON(res, 400, { error: '请填写宿舍号' });
  if (!/^1[3-9]\d{9}$/.test(phone)) return sendJSON(res, 400, { error: '手机号不正确' });

  const now = Date.now();
  const order = {
    id: crypto.randomBytes(8).toString('hex'),
    token: crypto.randomBytes(12).toString('hex'),
    no: makeOrderNo(),
    items: lines,
    goods: goods,
    cookFee: cookFeeTotal,
    fee: fee,
    total: total,
    build: build,
    room: room,
    phone: phone,
    note: note,
    status: 'new',
    payment: { status: 'unpaid', claimedAt: 0, paidAt: 0 },
    createdAt: now,
    updatedAt: now,
  };

  // 扣库存（上面的校验都过了才扣）
  lines.forEach(function (line) {
    const p = store.products.filter(function (x) { return x.id === line.id; })[0];
    if (p && Number.isFinite(Number(p.stock))) {
      p.stock = Math.max(0, Number(p.stock) - line.qty);
    }
  });
  saveProducts();

  store.orders.push(order);
  saveOrders();

  try { notifyOrder(order, 'new', req); } catch (e) { console.error('[mail]', e); }

  sendJSON(res, 201, { order: order });
}

/* ---------------- 接口 ---------------- */
async function handleApi(req, res, pathname, url) {
  const method = req.method;

  if (pathname === '/api/ping' && method === 'GET') {
    return sendJSON(res, 200, { ok: true, name: loadConfig().shop.name });
  }

  // 公开：店铺 + 商品
  if (pathname === '/api/shop' && method === 'GET') {
    const cfg = loadConfig();
    return sendJSON(res, 200, {
      shop: cfg.shop,
      categories: cfg.categories,
      products: store.products,
      payQr: !!settings.payQr,
      payQrVersion: settings.payQr ? settings.payQr.updatedAt : 0,
    });
  }

  // 收款码图片（顾客也要看，公开）
  if (pathname === '/api/pay-qr' && method === 'GET') {
    if (!settings.payQr) return sendJSON(res, 404, { error: '还没有收款码' });
    return fs.readFile(QR_FILE, function (err, buf) {
      if (err) return sendJSON(res, 404, { error: '收款码文件丢了' });
      res.writeHead(200, {
        'Content-Type': settings.payQr.mime || 'image/png',
        'Cache-Control': 'no-cache',
      });
      res.end(buf);
    });
  }

  // 上传 / 删除收款码（要登录）
  if (pathname === '/api/settings/pay-qr' && (method === 'POST' || method === 'DELETE')) {
    if (!requireAuth(req, res)) return;

    if (method === 'DELETE') {
      try { fs.unlinkSync(QR_FILE); } catch (e) {}
      delete settings.payQr;
      saveSettings();
      return sendJSON(res, 200, { ok: true, payQr: false });
    }

    let body;
    try { body = await readBody(req, 3 * 1024 * 1024); }
    catch (e) { return sendJSON(res, 400, { error: e.message }); }

    const dataUrl = String(body.dataUrl || '');
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return sendJSON(res, 400, { error: '只能是 PNG / JPG 图片' });

    const buf = Buffer.from(match[2], 'base64');
    if (buf.length < 32) return sendJSON(res, 400, { error: '图片读不出来，换一张试试' });
    if (buf.length > 2 * 1024 * 1024) return sendJSON(res, 400, { error: '图片太大了（超过 2MB）' });

    fs.writeFileSync(QR_FILE, buf);
    settings.payQr = {
      mime: match[1] === 'image/jpg' ? 'image/jpeg' : match[1],
      updatedAt: Date.now(),
    };
    saveSettings();
    return sendJSON(res, 200, { ok: true, payQr: true, version: settings.payQr.updatedAt });
  }

  // 登录
  if (pathname === '/api/login' && method === 'POST') {
    const ip = clientIp(req);
    const fail = loginFails.get(ip);
    if (fail && fail.until > Date.now()) {
      return sendJSON(res, 429, { error: '试错次数太多了，等一分钟再试' });
    }

    let body;
    try { body = await readBody(req); }
    catch (e) { return sendJSON(res, 400, { error: e.message }); }

    const ok = typeof body.username === 'string' && typeof body.password === 'string' &&
      safeEqual(body.username, LOGIN.username) && safeEqual(body.password, LOGIN.password);

    if (!ok) {
      const count = (fail && fail.count ? fail.count : 0) + 1;
      loginFails.set(ip, {
        count: count,
        until: count >= 8 ? Date.now() + 60 * 1000 : 0,
      });
      return sendJSON(res, 401, { error: '用户名或密码不对' });
    }

    loginFails.delete(ip);
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { user: LOGIN.username, exp: Date.now() + SESSION_TTL });
    res.setHeader('Set-Cookie',
      'sb_sid=' + token + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + (SESSION_TTL / 1000));
    return sendJSON(res, 200, { ok: true, user: LOGIN.username });
  }

  if (pathname === '/api/me' && method === 'GET') {
    const user = requireAuth(req, res);
    if (!user) return;
    return sendJSON(res, 200, { user: user });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    const token = parseCookies(req).sb_sid;
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', 'sb_sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    return sendJSON(res, 200, { ok: true });
  }

  // 商品图片（公开）
  const imgMatch = pathname.match(/^\/api\/product-image\/([A-Za-z0-9_-]+)$/);
  if (imgMatch && method === 'GET') {
    const product = store.products.filter(function (p) { return p.id === imgMatch[1]; })[0];
    if (!product || !product.imgVersion) return sendJSON(res, 404, { error: '没有图片' });

    return fs.readFile(imagePath(product.id), function (err, buf) {
      if (err) return sendJSON(res, 404, { error: '图片丢了' });
      res.writeHead(200, {
        'Content-Type': product.imgMime || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      res.end(buf);
    });
  }

  // 上传 / 删除商品图片（要登录）
  const imgUpload = pathname.match(/^\/api\/products\/([A-Za-z0-9_-]+)\/image$/);
  if (imgUpload && (method === 'POST' || method === 'DELETE')) {
    if (!requireAuth(req, res)) return;

    const product = store.products.filter(function (p) { return p.id === imgUpload[1]; })[0];
    if (!product) return sendJSON(res, 404, { error: '商品不存在' });

    if (method === 'DELETE') {
      try { fs.unlinkSync(imagePath(product.id)); } catch (e) {}
      delete product.imgVersion;
      delete product.imgMime;
      saveProducts();
      return sendJSON(res, 200, { ok: true });
    }

    let body;
    try { body = await readBody(req, 3 * 1024 * 1024); }
    catch (e) { return sendJSON(res, 400, { error: e.message }); }

    const dataUrl = String(body.dataUrl || '');
    const matched = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!matched) return sendJSON(res, 400, { error: '只能是 PNG / JPG 图片' });

    const buf = Buffer.from(matched[2], 'base64');
    if (buf.length < 32) return sendJSON(res, 400, { error: '图片读不出来' });
    if (buf.length > 2 * 1024 * 1024) return sendJSON(res, 400, { error: '图片太大了（超过 2MB）' });

    fs.writeFileSync(imagePath(product.id), buf);
    product.imgMime = matched[1] === 'image/jpg' ? 'image/jpeg' : matched[1];
    product.imgVersion = Date.now();
    saveProducts();

    return sendJSON(res, 200, { ok: true, imgVersion: product.imgVersion });
  }

  // 邮件通知设置
  if (pathname === '/api/settings/mail' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const cfg = getMailConfig();
    return sendJSON(res, 200, {
      enabled: cfg.enabled,
      to: cfg.to,
      defaultTo: loadConfig().shop.email || '',
      from: cfg.from,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      notifyNew: cfg.notifyNew,
      notifyPaid: cfg.notifyPaid,
      hasPass: !!cfg.pass,
      last: mailLast,
    });
  }

  if (pathname === '/api/settings/mail' && method === 'POST') {
    if (!requireAuth(req, res)) return;

    let body;
    try { body = await readBody(req); }
    catch (e) { return sendJSON(res, 400, { error: e.message }); }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const to = String(body.to || '').trim();
    const from = String(body.from || '').trim() || to;

    if (!emailRe.test(to)) return sendJSON(res, 400, { error: '收件邮箱格式不对' });
    if (!emailRe.test(from)) return sendJSON(res, 400, { error: '发件邮箱格式不对' });

    const mail = settings.mail || {};
    const pass = typeof body.pass === 'string' ? body.pass.trim() : '';

    mail.enabled = body.enabled !== false;
    mail.to = to;
    mail.from = from;
    mail.user = from;
    mail.host = String(body.host || mail.host || 'smtp.qq.com').trim();
    mail.port = Number(body.port || mail.port || 465);
    mail.secure = body.secure !== false;
    mail.notifyNew = body.notifyNew !== false;
    mail.notifyPaid = body.notifyPaid !== false;

    if (!(mail.port > 0 && mail.port < 65536)) {
      return sendJSON(res, 400, { error: '端口不对' });
    }
    if (pass) mail.pass = pass;
    if (mail.enabled && !mail.pass) {
      return sendJSON(res, 400, { error: '请填 SMTP 授权码（QQ 邮箱设置里生成的那个）' });
    }

    settings.mail = mail;
    saveSettings();
    return sendJSON(res, 200, { ok: true, hasPass: !!mail.pass, enabled: !!mail.enabled });
  }

  if (pathname === '/api/settings/mail/test' && method === 'POST') {
    if (!requireAuth(req, res)) return;

    const cfg = getMailConfig();
    if (!mailReady(cfg)) return sendJSON(res, 400, { error: '先保存邮箱和授权码' });

    try {
      await sendMail({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        user: cfg.user,
        pass: cfg.pass,
        from: cfg.from,
        to: cfg.to,
        fromName: loadConfig().shop.name || '宿舍补给站',
        subject: '【测试】' + (loadConfig().shop.name || '宿舍补给站') + ' 邮件通知',
        text: '这是一封测试邮件。\n\n收到就说明配置成功了：以后有新订单、顾客付款，都会发到这个邮箱。\n\n发送时间：' +
          new Date().toLocaleString('zh-CN', { hour12: false }),
      });
      mailLast = { at: Date.now(), ok: true, error: '', to: cfg.to };
      return sendJSON(res, 200, { ok: true });
    } catch (e) {
      mailLast = { at: Date.now(), ok: false, error: String(e.message || e), to: cfg.to };
      return sendJSON(res, 400, { error: String(e.message || e) });
    }
  }

  // 下单（顾客，公开）
  if (pathname === '/api/orders' && method === 'POST') {
    return createOrder(req, res);
  }

  // 以下都要登录
  if (pathname === '/api/orders' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const status = url.searchParams.get('status') || 'all';
    let list = store.orders.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    if (status !== 'all' && STATUSES.indexOf(status) > -1) {
      list = list.filter(function (o) { return o.status === status; });
    }
    return sendJSON(res, 200, { orders: list, stats: statsOf() });
  }

  // 顾客查自己的订单进度（凭 token，不用登录）
  const statusMatch = pathname.match(/^\/api\/orders\/([A-Za-z0-9-]+)\/status$/);
  if (statusMatch && method === 'GET') {
    const order = store.orders.filter(function (o) { return o.id === statusMatch[1]; })[0];
    if (!order) return sendJSON(res, 404, { error: '订单不存在' });

    const token = url.searchParams.get('token') || '';
    if (!order.token || !safeEqual(token, order.token)) {
      return sendJSON(res, 403, { error: '查询链接不对，回点单页重新点「订单进度」' });
    }
    return sendJSON(res, 200, { order: publicOrder(order) });
  }

  // 换手机/换设备查询：手机号 + 订单号
  if (pathname === '/api/orders/lookup' && method === 'POST') {
    if (!allowLookup(clientIp(req))) {
      return sendJSON(res, 429, { error: '查得太频繁了，等一分钟再试' });
    }

    let body;
    try { body = await readBody(req); }
    catch (e) { return sendJSON(res, 400, { error: e.message }); }

    const phone = String(body.phone || '').replace(/\D/g, '');
    let no = String(body.no || '').trim().toUpperCase();
    if (no && no.charAt(0) !== '#') no = '#' + no;

    if (!/^1[3-9]\d{9}$/.test(phone)) return sendJSON(res, 400, { error: '手机号填得不对' });
    if (no && !/^#\d{6}-\d{4}$/.test(no)) {
      return sendJSON(res, 400, { error: '订单号填错了，或者留空只填手机号' });
    }

    // 只填手机号也能查：返回这个号码最近的订单（最新的在前）
    const list = store.orders
      .filter(function (o) { return o.phone === phone && (!no || String(o.no).toUpperCase() === no); })
      .sort(function (a, b) { return b.createdAt - a.createdAt; })
      .slice(0, 10);

    if (!list.length) {
      return sendJSON(res, 404, {
        error: no ? '没找到这个订单，核对一下手机号和订单号' : '这个手机号还没下过单',
      });
    }

    return sendJSON(res, 200, {
      orders: list.map(function (o) {
        return Object.assign(publicOrder(o), { token: o.token });
      }),
    });
  }

  // 顾客点「我已付款」（公开，凭不可猜的订单 id）
  const claimMatch = pathname.match(/^\/api\/orders\/([A-Za-z0-9-]+)\/claim$/);
  if (claimMatch && method === 'POST') {
    const order = store.orders.filter(function (o) { return o.id === claimMatch[1]; })[0];
    if (!order) return sendJSON(res, 404, { error: '订单不存在' });
    if (order.status === 'cancelled') return sendJSON(res, 400, { error: '订单已经取消了' });
    if (!order.payment) order.payment = { status: 'unpaid', claimedAt: 0, paidAt: 0 };
    if (order.payment.status === 'unpaid') {
      order.payment.status = 'claimed';
      order.payment.claimedAt = Date.now();
      saveOrders();
      try { notifyOrder(order, 'paid', req); } catch (e) { console.error('[mail]', e); }
    }
    return sendJSON(res, 200, { ok: true, payment: order.payment });
  }

  // 商家确认收款 / 改回收款状态（要登录）
  const payMatch = pathname.match(/^\/api\/orders\/([A-Za-z0-9-]+)\/payment$/);
  if (payMatch && method === 'POST') {
    if (!requireAuth(req, res)) return;
    const order = store.orders.filter(function (o) { return o.id === payMatch[1]; })[0];
    if (!order) return sendJSON(res, 404, { error: '订单不存在' });

    let body;
    try { body = await readBody(req); }
    catch (e) { return sendJSON(res, 400, { error: e.message }); }

    const next = String(body.status || '');
    if (['unpaid', 'claimed', 'paid'].indexOf(next) < 0) {
      return sendJSON(res, 400, { error: '收款状态不对' });
    }

    if (!order.payment) order.payment = { status: 'unpaid', claimedAt: 0, paidAt: 0 };
    order.payment.status = next;
    order.payment.paidAt = next === 'paid' ? Date.now() : 0;
    order.updatedAt = Date.now();
    saveOrders();
    return sendJSON(res, 200, { order: order, stats: statsOf() });
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([A-Za-z0-9-]+)$/);
  if (orderMatch) {
    if (!requireAuth(req, res)) return;
    const id = orderMatch[1];
    const order = store.orders.filter(function (o) { return o.id === id; })[0];
    if (!order) return sendJSON(res, 404, { error: '订单不存在' });

    if (method === 'PATCH') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { error: e.message }); }

      const next = String(body.status || '');
      const allowed = {
        new: ['accepted', 'cancelled'],
        accepted: ['done', 'cancelled'],
        done: [],
        cancelled: [],
      };
      if (!allowed[order.status] || allowed[order.status].indexOf(next) < 0) {
        return sendJSON(res, 400, { error: '这个状态不能这么改' });
      }

      order.status = next;
      order.updatedAt = Date.now();
      if (next === 'cancelled') restoreStock(order);
      saveOrders();
      return sendJSON(res, 200, { order: order, stats: statsOf() });
    }

    if (method === 'DELETE') {
      // 还没送出去的订单被删掉，库存要退回去
      if (order.status === 'new' || order.status === 'accepted') restoreStock(order);
      store.orders = store.orders.filter(function (o) { return o.id !== id; });
      saveOrders();
      return sendJSON(res, 200, { ok: true, stats: statsOf() });
    }

    return sendJSON(res, 405, { error: '不支持的方法' });
  }

  // 商品管理（要登录）
  if (pathname === '/api/products' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    let body;
    try { body = await readBody(req); }
    catch (e) { return sendJSON(res, 400, { error: e.message }); }

    const name = String(body.name || '').trim().slice(0, 40);
    const price = Number(body.price);
    const cat = String(body.cat || '');
    const cats = loadConfig().categories.map(function (c) { return c.id; });

    if (!name) return sendJSON(res, 400, { error: '请填写商品名' });
    if (!(price > 0 && price < 10000)) return sendJSON(res, 400, { error: '价格不对' });
    if (cats.indexOf(cat) < 0 || cat === 'all') return sendJSON(res, 400, { error: '分类不对' });

    const stock = Number(body.stock);
    if (body.stock !== undefined && (!Number.isInteger(stock) || stock < 0 || stock > 9999)) {
      return sendJSON(res, 400, { error: '库存要填 0-9999 的整数' });
    }

    const product = {
      id: 'p' + Date.now().toString(36),
      cat: cat,
      name: name,
      spec: String(body.spec || '').trim().slice(0, 30) || '1份',
      price: round2(price),
      unit: String(body.unit || '份').trim().slice(0, 6) || '份',
      emoji: String(body.emoji || '🛒').trim().slice(0, 8) || '🛒',
      stock: body.stock === undefined ? 20 : stock,
      cookable: body.cookable !== false,
      sales: 0,
      soldOut: false,
      desc: String(body.desc || '').trim().slice(0, 80),
    };

    store.products.push(product);
    saveProducts();
    return sendJSON(res, 201, { product: product });
  }

  const productMatch = pathname.match(/^\/api\/products\/([A-Za-z0-9_-]+)$/);
  if (productMatch) {
    if (!requireAuth(req, res)) return;
    const id = productMatch[1];
    const index = store.products.findIndex(function (p) { return p.id === id; });
    if (index < 0) return sendJSON(res, 404, { error: '商品不存在' });
    const product = store.products[index];

    if (method === 'PUT') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { error: e.message }); }

      if ('price' in body) {
        const price = Number(body.price);
        if (!(price > 0 && price < 10000)) return sendJSON(res, 400, { error: '价格不对' });
        product.price = round2(price);
      }
      if ('soldOut' in body) product.soldOut = !!body.soldOut;
      if ('cookable' in body) product.cookable = !!body.cookable;

      if ('stock' in body) {
        const stock = Number(body.stock);
        if (!Number.isInteger(stock) || stock < 0 || stock > 9999) {
          return sendJSON(res, 400, { error: '库存要填 0-9999 的整数' });
        }
        product.stock = stock;
      }

      if (typeof body.name === 'string' && body.name.trim()) product.name = body.name.trim().slice(0, 40);
      if (typeof body.spec === 'string') product.spec = body.spec.trim().slice(0, 30);
      if (typeof body.unit === 'string' && body.unit.trim()) product.unit = body.unit.trim().slice(0, 6);
      if (typeof body.emoji === 'string' && body.emoji.trim()) product.emoji = body.emoji.trim().slice(0, 8);
      if (typeof body.desc === 'string') product.desc = body.desc.trim().slice(0, 80);
      if (typeof body.badge === 'string') {
        product.badge = ['hot', 'new', 'spicy'].indexOf(body.badge) > -1 ? body.badge : '';
      }

      store.products[index] = product;
      saveProducts();
      return sendJSON(res, 200, { product: product });
    }

    if (method === 'DELETE') {
      try { fs.unlinkSync(imagePath(product.id)); } catch (e) {}
      store.products.splice(index, 1);
      saveProducts();
      return sendJSON(res, 200, { ok: true });
    }

    return sendJSON(res, 405, { error: '不支持的方法' });
  }

  return sendJSON(res, 404, { error: '接口不存在' });
}

/* ---------------- 静态文件 ---------------- */
function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); }
  catch (e) { rel = pathname; }

  if (rel === '/' || rel === '') rel = '/index.html';

  const file = path.resolve(ROOT, '.' + rel);

  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403); return res.end('403');
  }

  const relative = path.relative(ROOT, file).replace(/\\/g, '/');
  if (/^data\//i.test(relative) || /^server\.js$/i.test(relative) || /^mailer\.js$/i.test(relative) ||
      /\.md$/i.test(relative) || /\.bat$/i.test(relative) || /^\./.test(relative)) {
    res.writeHead(404); return res.end('404');
  }

  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

/* ---------------- 启动 ---------------- */
const server = http.createServer(function (req, res) {
  const pathname = (req.url || '/').split('?')[0];

  if (pathname.indexOf('/api/') === 0) {
    handleApi(req, res, pathname, new URL(req.url, 'http://localhost')).catch(function (e) {
      if (!res.headersSent) sendJSON(res, 500, { error: '服务器出错了' });
      console.error('[api]', e);
    });
    return;
  }

  serveStatic(req, res, pathname);
});

function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();

  Object.keys(nets).forEach(function (name) {
    const virtual = /vmware|virtual|vethernet|hyper-v|loopback|bluetooth|tap|tun|docker|wsl|tailscale|zerotier/i.test(name);
    const wireless = /wlan|wi-?fi|wireless|无线|以太网|ethernet/i.test(name);
    (nets[name] || []).forEach(function (net) {
      if (net.family !== 'IPv4' || net.internal) return;
      out.push({ name: name, address: net.address, score: (virtual ? 2 : 0) + (wireless ? -1 : 0) });
    });
  });

  // 真实无线 / 有线网卡优先，虚拟机网卡往后排
  return out.sort(function (a, b) { return a.score - b.score; });
}

server.listen(PORT, HOST, function () {
  const ips = lanAddresses();
  const primary = ips[0] ? ips[0].address : 'localhost';
  const others = ips.slice(1).map(function (i) { return i.address + '（' + i.name + '）'; });

  console.log('');
  console.log('  宿舍补给站 已启动');
  console.log('  ─────────────────────────────');
  console.log('  顾客点单：http://' + primary + ':' + PORT + '/');
  console.log('  商家后台：http://' + primary + ':' + PORT + '/admin.html');
  console.log('  本机自测：http://localhost:' + PORT + '/');
  if (others.length) console.log('  其他网卡：' + others.join('、'));
  console.log('  商家账号：' + LOGIN.username);
  console.log('  ─────────────────────────────');
  console.log('  数据保存在 ' + DATA_DIR);
  console.log('  手机要连同一个 WiFi，打不开就看 README 第九节');
  console.log('  关掉这个窗口就停止服务（Ctrl+C）');
  console.log('');
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 被占用了，换一个：set PORT=3001 && node server.js');
  } else {
    console.error(e);
  }
  process.exit(1);
});
