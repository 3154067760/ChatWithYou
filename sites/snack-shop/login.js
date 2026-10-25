/* =========================================================
   宿舍补给站 · 商家登录
   账号在 server.js 顶部（默认 gyq / root）
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  function api(url, opts) {
    opts = opts || {};
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('这个浏览器太旧了，换 Chrome 或 Edge 打开'));
    }
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    return fetch(url, init).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) {}
        if (!res.ok) {
          var err = new Error((data && data.error) || ('请求失败 ' + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function setError(msg) {
    var box = $('#loginError');
    if (msg) {
      box.textContent = msg;
      box.hidden = false;
    } else {
      box.hidden = true;
    }
  }

  // 已经登录过就直接进后台
  api('/api/me')
    .then(function (data) {
      if (data && data.user) location.replace('admin.html');
    })
    .catch(function () {});

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();

    var user = $('#username').value.trim();
    var pass = $('#password').value;

    if (!user || !pass) {
      setError('用户名和密码都要填');
      return;
    }

    var btn = $('#loginBtn');
    btn.disabled = true;
    btn.textContent = '登录中…';
    setError('');

    api('/api/login', { method: 'POST', body: { username: user, password: pass } })
      .then(function () {
        location.replace('admin.html');
      })
      .catch(function (err) {
        setError((err && err.message) || '登录失败，检查一下服务器有没有启动');
        $('#password').value = '';
        $('#password').focus();
        btn.disabled = false;
        btn.textContent = '登录';
      });
  });
})();
