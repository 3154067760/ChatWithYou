/* =========================================================
   宿舍补给站 · 极简 SMTP 发信（零依赖，只用 node 自带模块）
   只支持「SSL 直连 + AUTH LOGIN」，够 QQ / 163 / Gmail 用
   ========================================================= */
'use strict';

const net = require('net');
const tls = require('tls');
const os = require('os');

function b64(s) {
  return Buffer.from(String(s), 'utf8').toString('base64');
}

// 防止邮件头注入
function clean(s) {
  return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
}

function encodeHeader(s) {
  return '=?UTF-8?B?' + b64(clean(s)) + '?=';
}

// 正文用 base64，避免中文编码问题，也不会出现以 . 开头的行
function wrapBase64(text) {
  return b64(text).replace(/(.{76})/g, '$1\r\n');
}

function buildMessage(opts) {
  const from = clean(opts.from);
  const to = clean(opts.to);
  const name = clean(opts.fromName || '宿舍补给站');
  const domain = from.split('@')[1] || 'localhost';
  const id = '<' + Date.now() + '.' + Math.random().toString(36).slice(2) + '@' + domain + '>';

  return [
    'From: ' + encodeHeader(name) + ' <' + from + '>',
    'To: <' + to + '>',
    'Subject: ' + encodeHeader(opts.subject || ''),
    'Date: ' + new Date().toUTCString(),
    'Message-ID: ' + id,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(opts.text || ''),
  ].join('\r\n');
}

// 按行读 SMTP 应答（支持 250- 这种多行）
function createSession(socket) {
  let buffer = '';
  let waiter = null;

  function flush() {
    if (!waiter) return;
    const m = buffer.match(/(?:^|\r\n)(\d{3}) /);
    if (!m) return;

    const end = m.index + m[0].length;
    const text = buffer.slice(0, end).replace(/\r\n/g, '\n').trim();
    const code = Number(m[1]);
    buffer = buffer.slice(end);

    const w = waiter;
    waiter = null;
    w.resolve({ code: code, text: text });
  }

  socket.setEncoding('utf8');
  socket.on('data', function (chunk) {
    buffer += chunk;
    flush();
  });

  return {
    read: function () {
      return new Promise(function (resolve) {
        waiter = { resolve: resolve };
        flush();
      });
    },
    write: function (line) {
      socket.write(line + '\r\n');
    },
    raw: function (data) {
      socket.write(data);
    },
  };
}

function sendMail(opts) {
  const host = opts.host || 'smtp.qq.com';
  const port = Number(opts.port || 465);
  const secure = opts.secure !== false;
  const timeout = Number(opts.timeout || 15000);

  const from = clean(opts.from);
  const to = clean(opts.to);
  const user = clean(opts.user || opts.from);
  const pass = String(opts.pass || '');

  return new Promise(function (resolve, reject) {
    if (!from || !to || !pass) {
      reject(new Error('邮件配置不完整'));
      return;
    }

    let socket;
    try {
      socket = secure
        ? tls.connect({ host: host, port: port, servername: host })
        : net.connect({ host: host, port: port });
    } catch (e) {
      reject(new Error('连不上邮件服务器：' + e.message));
      return;
    }

    let finished = false;

    const timer = setTimeout(function () {
      if (finished) return;
      finished = true;
      try { socket.destroy(); } catch (e) {}
      reject(new Error('连接邮件服务器超时'));
    }, timeout);

    function done(err) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { socket.end(); } catch (e) {}
      if (err) reject(err);
      else resolve();
    }

    socket.on('error', function (err) {
      done(new Error('邮件服务器连接失败：' + err.message));
    });
    socket.on('close', function () {
      if (!finished) done(new Error('邮件服务器提前断开'));
    });

    const session = createSession(socket);

    (async function () {
      let r = await session.read();
      if (r.code !== 220) throw new Error('邮件服务器没有就绪：' + r.text);

      session.write('EHLO ' + (os.hostname() || 'localhost'));
      r = await session.read();
      if (r.code !== 250) throw new Error('EHLO 失败：' + r.text);

      session.write('AUTH LOGIN');
      r = await session.read();
      if (r.code !== 334) throw new Error('邮件服务器不支持密码登录');

      session.write(b64(user));
      r = await session.read();
      if (r.code !== 334) throw new Error('邮箱账号被拒绝');

      session.write(b64(pass));
      r = await session.read();
      if (r.code !== 235) throw new Error('授权码不对，或邮箱没开启 SMTP 服务');

      session.write('MAIL FROM:<' + from + '>');
      r = await session.read();
      if (r.code !== 250) throw new Error('发件人被拒绝：' + r.text);

      session.write('RCPT TO:<' + to + '>');
      r = await session.read();
      if (r.code !== 250) throw new Error('收件人被拒绝：' + r.text);

      session.write('DATA');
      r = await session.read();
      if (r.code !== 354) throw new Error('邮件服务器拒绝接收内容');

      session.raw(buildMessage(opts) + '\r\n.\r\n');
      r = await session.read();
      if (r.code !== 250) throw new Error('邮件被退回：' + r.text);

      session.write('QUIT');
      done();
    })().catch(function (err) {
      done(err);
    });
  });
}

module.exports = { sendMail: sendMail, buildMessage: buildMessage };
