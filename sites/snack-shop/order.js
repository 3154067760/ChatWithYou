/* =========================================================
   宿舍补给站 · 顾客订单进度
   不用登录：链接里带订单 id + 查询凭证，或手机号 + 订单号查
   ========================================================= */
(function () {
  'use strict';

  var sbUrl = window.sbUrl || function (p) { return p; };
  var $ = function (s) { return document.querySelector(s); };

  var KEY_MY_ORDERS = 'sb_myorders_v1';
  var KEY_CART = 'sb_cart_v2';
  var KEY_COOKED = 'sb_cooked_v1';

  var state = {
    id: '',
    token: '',
    order: null,
    timer: null,
  };

  /* ---------------- 小工具 ---------------- */
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var val = JSON.parse(raw);
      return val && typeof val === 'object' ? val : fallback;
    } catch (e) { return fallback; }
  }

  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) { return (Math.round(Number(n || 0) * 100) / 100).toFixed(2); }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function timeText(ts) {
    var d = new Date(ts || Date.now());
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function api(path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    return fetch(sbUrl(path), init).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) {}
        if (!res.ok) {
          var err = new Error((data && data.error) || '查询失败');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  var STATUS = {
    new: { text: '待接单', cls: 'new', tip: '已经通知商家，正在等你这一单' },
    accepted: { text: '配送中', cls: 'doing', tip: '商家已接单，正在送来的路上' },
    done: { text: '已完成', cls: 'done', tip: '已送达，祝你吃得开心' },
    cancelled: { text: '已取消', cls: 'cancel', tip: '这单被取消了，可以重新下单' },
  };

  var PAY = {
    unpaid: '未付款',
    claimed: '已通知付款，等商家确认',
    paid: '已收款',
  };

  function remember(o, token) {
    if (!o || !o.id) return;
    var list = readJSON(KEY_MY_ORDERS, []);
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (x) { return x && x.id !== o.id; });
    list.unshift({
      id: o.id,
      token: token,
      no: o.no,
      total: o.total,
      createdAt: o.createdAt || Date.now(),
    });
    writeJSON(KEY_MY_ORDERS, list.slice(0, 20));
  }

  function reorder(o) {
    var cart = readJSON(KEY_CART, {});
    var cooked = readJSON(KEY_COOKED, {});
    if (!cart || typeof cart !== 'object' || Array.isArray(cart)) cart = {};
    if (!cooked || typeof cooked !== 'object' || Array.isArray(cooked)) cooked = {};

    (o.items || []).forEach(function (i) {
      if (!i.id) return;
      cart[i.id] = Math.min(99, Number(cart[i.id] || 0) + Number(i.qty || 1));
      if (i.cooked) cooked[i.id] = true;
    });

    writeJSON(KEY_CART, cart);
    writeJSON(KEY_COOKED, cooked);
    location.href = 'index.html';
  }

  /* ---------------- 单个订单 ---------------- */
  function renderOrder(o) {
    var st = STATUS[o.status] || STATUS.new;
    var done = o.status === 'done';
    var cancelled = o.status === 'cancelled';
    var active = !done && !cancelled;

    var stepIndex = o.status === 'new' ? 0 : o.status === 'accepted' ? 1 : done ? 2 : -1;
    var steps = [
      { t: '已下单', d: timeText(o.createdAt) },
      { t: '配送中', d: stepIndex >= 1 ? '商家已接单' : '等商家接单' },
      { t: '已完成', d: done ? '已送达' : '待送达' },
    ];

    var timeline = '';
    if (!cancelled) {
      timeline = '<section class="timeline">' + steps.map(function (s, i) {
        return '<div class="step' + (stepIndex >= i ? ' on' : '') + '">' +
          '<span class="dot"></span>' +
          '<span class="step-t">' + s.t + '</span>' +
          '<span class="step-d">' + s.d + '</span>' +
        '</div>';
      }).join('') + '</section>';
    }

    var items = (o.items || []).map(function (i) {
      return '<div class="item-line">' +
        '<span class="q">×' + i.qty + '</span>' +
        '<span class="n">' + esc(i.name) +
          (i.cooked ? '<em class="cook-mark">泡好</em>' : '') + '</span>' +
        '<span class="p">¥' + money(i.price * i.qty) + '</span>' +
      '</div>';
    }).join('');

    var pay = (o.payment && PAY[o.payment.status]) || PAY.unpaid;

    $('#main').innerHTML =
      '<section class="status-card ' + st.cls + '">' +
        '<span class="status-tag">' + st.text + '</span>' +
        '<p class="status-tip">' + st.tip + '</p>' +
        '<p class="status-no">订单号 ' + esc(o.no) + '</p>' +
      '</section>' +
      timeline +
      '<section class="order-card">' +
        '<h2>商品</h2>' + items +
        (o.cookFee ? '<div class="line"><span>泡好服务费</span><b>¥' + money(o.cookFee) + '</b></div>' : '') +
        '<div class="sum"><span>合计（含配送费）</span><b>¥' + money(o.total) + '</b></div>' +
      '</section>' +
      '<section class="order-card">' +
        '<h2>配送信息</h2>' +
        '<div class="line"><span>送到</span><b>' + esc(o.build) + ' ' + esc(o.room) + '</b></div>' +
        '<div class="line"><span>手机号</span><b>' + esc(o.phone) + '</b></div>' +
        (o.note ? '<div class="line"><span>备注</span><b>' + esc(o.note) + '</b></div>' : '') +
        '<div class="line"><span>付款</span><b>' + esc(pay) + '</b></div>' +
        '<div class="line"><span>下单时间</span><b>' + timeText(o.createdAt) + '</b></div>' +
      '</section>' +
      '<div class="actions">' +
        (done || cancelled
          ? '<button class="btn-primary" type="button" id="reorder">再来一单</button>'
          : '') +
        '<a class="btn-link" href="index.html">继续点单</a>' +
      '</div>';

    var reorderBtn = $('#reorder');
    if (reorderBtn) {
      reorderBtn.addEventListener('click', function () { reorder(o); });
    }

    document.title = st.text + ' · ' + o.no + ' · 宿舍补给站';
    if (active) scheduleRefresh();
  }

  function renderError(msg) {
    $('#main').innerHTML =
      '<div class="empty"><span>🔍</span>' + esc(msg) +
      '<br><a class="btn-link" href="order.html">去查别的订单</a></div>';
  }

  function loadOrder() {
    return api('/api/orders/' + encodeURIComponent(state.id) + '/status?token=' + encodeURIComponent(state.token))
      .then(function (data) {
        state.order = data.order;
        renderOrder(data.order);
      })
      .catch(function (err) {
        renderError((err && err.message) || '查不到这个订单');
      });
  }

  function scheduleRefresh() {
    if (state.timer) return;
    state.timer = setInterval(function () {
      if (document.hidden) return;
      api('/api/orders/' + encodeURIComponent(state.id) + '/status?token=' + encodeURIComponent(state.token))
        .then(function (data) {
          var next = data.order;
          var prev = state.order;
          var changed = !prev ||
            next.status !== prev.status ||
            (next.payment && next.payment.status) !== (prev.payment && prev.payment.status);
          state.order = next;
          if (changed) {
            renderOrder(next);
            if (next.status === 'done' || next.status === 'cancelled') {
              clearInterval(state.timer);
              state.timer = null;
            }
          }
        })
        .catch(function () {});
    }, 8000);
  }

  /* ---------------- 首页：本机订单 + 查询 ---------------- */
  function renderHome() {
    var list = readJSON(KEY_MY_ORDERS, []);
    if (!Array.isArray(list)) list = [];

    var lookup =
      '<section class="lookup">' +
        '<h2>查订单进度</h2>' +
        '<p class="hint">输入下单时填的手机号就行，能看到最近 10 单；记得订单号的话可以填上，查得更准。</p>' +
        '<form id="lookupForm" novalidate>' +
          '<label class="f"><span>手机号</span>' +
            '<input id="lkPhone" inputmode="numeric" maxlength="11" placeholder="11 位手机号"></label>' +
          '<label class="f"><span>订单号（选填）</span>' +
            '<input id="lkNo" maxlength="16" placeholder="不记得就留空"></label>' +
          '<button class="btn-primary" type="submit">查询</button>' +
          '<p class="err" id="lkErr" hidden></p>' +
        '</form>' +
        '<div id="lookupResults" class="lookup-results" hidden></div>' +
      '</section>';

    var mine = '';
    if (list.length) {
      mine = '<section class="my-list">' +
        '<h2>本机下过的单</h2>' +
        list.map(function (o) {
          return '<a class="my-item" href="order.html?id=' + encodeURIComponent(o.id) +
            '&amp;token=' + encodeURIComponent(o.token) + '">' +
            '<div class="mi-main"><b>' + esc(o.no) + '</b>' +
              '<small>' + timeText(o.createdAt) + ' · ¥' + money(o.total) + '</small></div>' +
            '<span class="mi-status" data-id="' + esc(o.id) + '">查看</span>' +
            '<span class="arrow">›</span>' +
          '</a>';
        }).join('') +
      '</section>';
    } else {
      mine = '<div class="empty"><span>🧾</span>这台手机上还没有订单记录' +
        '<span class="empty-sub">下单后会自动记在这里</span></div>';
    }

    $('#main').innerHTML = mine + lookup;
    bindLookup();
    refreshBadges(list);
  }

  function refreshBadges(list) {
    list.slice(0, 8).forEach(function (o) {
      api('/api/orders/' + encodeURIComponent(o.id) + '/status?token=' + encodeURIComponent(o.token))
        .then(function (data) {
          var el = document.querySelector('.mi-status[data-id="' + o.id + '"]');
          if (!el) return;
          var st = STATUS[data.order.status] || STATUS.new;
          el.textContent = st.text;
          el.className = 'mi-status ' + st.cls;
        })
        .catch(function () {});
    });
  }

  function orderHref(o) {
    return 'order.html?id=' + encodeURIComponent(o.id) + '&token=' + encodeURIComponent(o.token);
  }

  function renderResults(list) {
    var box = $('#lookupResults');
    if (!box) return;

    box.hidden = false;
    box.innerHTML =
      '<h3>找到 ' + list.length + ' 单</h3>' +
      list.map(function (o) {
        var st = STATUS[o.status] || STATUS.new;
        return '<a class="my-item" href="' + orderHref(o) + '">' +
          '<div class="mi-main"><b>' + esc(o.no) + '</b>' +
            '<small>' + timeText(o.createdAt) + ' · ¥' + money(o.total) + '</small></div>' +
          '<span class="mi-status ' + st.cls + '">' + st.text + '</span>' +
          '<span class="arrow">›</span>' +
        '</a>';
      }).join('');
  }

  function bindLookup() {
    var form = $('#lookupForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = ($('#lkPhone').value || '').replace(/\D/g, '');
      var no = ($('#lkNo').value || '').trim();
      var err = $('#lkErr');
      var btn = form.querySelector('button');
      var results = $('#lookupResults');

      err.hidden = true;
      if (results) results.hidden = true;
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        err.textContent = '手机号填得不对';
        err.hidden = false;
        return;
      }

      btn.disabled = true;
      btn.textContent = '查询中…';

      api('/api/orders/lookup', { method: 'POST', body: { phone: phone, no: no } })
        .then(function (data) {
          var list = (data && data.orders) || [];
          if (!list.length) throw new Error('这个手机号还没下过单');

          list.forEach(function (o) { remember(o, o.token); });

          if (list.length === 1) {
            location.href = orderHref(list[0]);
            return;
          }

          renderResults(list);
          btn.disabled = false;
          btn.textContent = '查询';
        })
        .catch(function (error) {
          err.textContent = (error && error.message) || '没查到，检查一下手机号';
          err.hidden = false;
          btn.disabled = false;
          btn.textContent = '查询';
        });
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    var params = new URLSearchParams(location.search);
    state.id = params.get('id') || '';
    state.token = params.get('token') || '';

    if (state.id && state.token) {
      loadOrder();
    } else {
      renderHome();
    }
  }

  boot();
})();
