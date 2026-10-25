/* =========================================================
   宿舍补给站 · 顾客点单
   有服务器时自动连接（订单直接进商家后台）；没服务器时退化为“复制小票”
   ========================================================= */
(function () {
  'use strict';

  var sbUrl = window.sbUrl || function (p) { return p; };

  var SHOP = window.SHOP;
  var CATS = window.CATEGORIES;
  var PRODUCTS = window.PRODUCTS;

  var BY_ID = {};
  function rebuildById() {
    BY_ID = {};
    PRODUCTS.forEach(function (p) { BY_ID[p.id] = p; });
  }
  rebuildById();

  var KEY_CART = 'sb_cart_v2';
  var KEY_COOKED = 'sb_cooked_v1';
  var KEY_MY_ORDERS = 'sb_myorders_v1';
  var apiMode = false;
  var PAY_QR = false;
  var PAY_QR_VERSION = 0;

  var state = {
    cart: readJSON(KEY_CART, {}),
    cooked: readJSON(KEY_COOKED, {}),
    cat: 'all',
    view: 'cart',        // cart | checkout | success
    lastOrder: null,
    synced: false,
    claiming: false
  };

  if (!state.cart || typeof state.cart !== 'object' || Array.isArray(state.cart)) state.cart = {};
  if (!state.cooked || typeof state.cooked !== 'object' || Array.isArray(state.cooked)) state.cooked = {};

  /* ---------------- 小工具 ---------------- */
  function $(sel) { return document.querySelector(sel); }

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

  function price(n) {
    var v = Math.round(n * 100) / 100;
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
  }

  function money(n) { return (Math.round(n * 100) / 100).toFixed(2); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function timeText(ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function tagText(b) {
    return b === 'hot' ? '热销' : b === 'new' ? '新品' : b === 'spicy' ? '辣' : '';
  }

  /* ---------------- 网络请求（失败就退回本地模式） ---------------- */
  function request(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.body) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }

    var timer = null;
    if (typeof AbortController !== 'undefined') {
      var ctrl = new AbortController();
      init.signal = ctrl.signal;
      timer = setTimeout(function () { ctrl.abort(); }, opts.timeout || 6000);
    }

    return fetch(url, init).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) {}
        if (!res.ok) {
          var err = new Error((data && data.error) || '请求失败（' + res.status + '）');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    }).then(function (data) {
      if (timer) clearTimeout(timer);
      return data;
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function setNetNote() {
    var el = document.getElementById('netNote');
    if (!el) return;
    el.textContent = apiMode ? '在线点单已开启' : '未连上商家系统 · 下单后请把订单发我微信';
    el.classList.toggle('on', apiMode);
  }

  /* ---------------- 购物车 ---------------- */
  function cartList() {
    var out = [];
    Object.keys(state.cart).forEach(function (id) {
      var p = BY_ID[id];
      var q = state.cart[id];
      if (p && q > 0) out.push({ p: p, qty: q });
    });
    return out;
  }

  function cartCount() {
    return cartList().reduce(function (n, i) { return n + i.qty; }, 0);
  }

  function goodsBase() {
    return cartList().reduce(function (n, i) { return n + i.p.price * i.qty; }, 0);
  }

  function cookFeeOf(p) {
    if (!p || p.cat !== 'noodle' || p.cookable === false) return 0;
    var fee = Number(SHOP.cookFee);
    return Number.isFinite(fee) ? fee : 1;
  }

  function isCooked(id) {
    return !!state.cooked[id];
  }

  function cookTotal() {
    return cartList().reduce(function (n, i) {
      return n + (isCooked(i.p.id) ? cookFeeOf(i.p) * i.qty : 0);
    }, 0);
  }

  function goodsTotal() {
    return goodsBase() + cookTotal();
  }

  function feeOf(goods) {
    return goods >= SHOP.freeDeliveryAt ? 0 : SHOP.deliveryFee;
  }

  function setQty(id, qty) {
    if (!BY_ID[id]) return;
    qty = Math.max(0, Math.min(99, qty));
    if (qty) state.cart[id] = qty;
    else {
      delete state.cart[id];
      delete state.cooked[id];
      writeJSON(KEY_COOKED, state.cooked);
    }
    writeJSON(KEY_CART, state.cart);
  }

  /* ---------------- 商品列表 ---------------- */
  function picHTML(p) {
    var inner = p.imgVersion
      ? '<img src="' + sbUrl('/api/product-image/' + p.id) + '?v=' + p.imgVersion + '" alt="" loading="lazy">'
      : p.emoji;
    return '<div class="pic" aria-hidden="true">' + inner + '</div>';
  }

  function rowHTML(p) {
    var q = state.cart[p.id] || 0;
    var stock = Number(p.stock);
    var hasStock = Number.isFinite(stock);
    var sold = !!p.soldOut || (hasStock && stock <= 0);

    var action;
    if (sold) action = '<span class="sold-tag">售罄</span>';
    else if (q) action = stepHTML(p, q);
    else action = '<button class="add" type="button" data-act="add" data-id="' + p.id +
      '" aria-label="加入 ' + esc(p.name) + '">＋</button>';

    var stockHTML = '';
    if (sold) stockHTML = '<span class="stock out">没货了</span>';
    else if (hasStock && stock <= 5) stockHTML = '<span class="stock low">仅剩 ' + stock + ' ' + esc(p.unit) + '</span>';
    else if (hasStock) stockHTML = '<span class="stock">库存 ' + stock + '</span>';

    return '' +
      '<div class="item' + (sold ? ' sold' : '') + '">' +
        picHTML(p) +
        '<div class="meta">' +
          '<div class="name-row">' +
            '<span class="name">' + esc(p.name) + '</span>' +
            (p.badge && !sold ? '<span class="tag">' + tagText(p.badge) + '</span>' : '') +
            (cookFeeOf(p) > 0 && !sold ? '<span class="tag tag--cook">可泡好</span>' : '') +
          '</div>' +
          '<div class="spec">' + esc(p.spec) + ' · 已售 ' + p.sales + '</div>' +
          '<div class="price-row"><span class="price">¥' + price(p.price) + '</span>' +
            '<span class="unit">/' + esc(p.unit) + '</span>' + stockHTML + '</div>' +
        '</div>' +
        action +
      '</div>';
  }

  function stepHTML(p, q) {
    return '' +
      '<div class="step">' +
        '<button class="minus" type="button" data-act="minus" data-id="' + p.id + '" aria-label="减少">−</button>' +
        '<span class="q">' + q + '</span>' +
        '<button class="plus" type="button" data-act="plus" data-id="' + p.id + '" aria-label="增加">＋</button>' +
      '</div>';
  }

  function renderTabs() {
    $('#tabs').innerHTML = CATS.map(function (c) {
      return '<button class="tab' + (state.cat === c.id ? ' on' : '') + '" type="button" ' +
        'data-act="tab" data-cat="' + c.id + '" aria-pressed="' + (state.cat === c.id) + '">' +
        c.name + '</button>';
    }).join('');
  }

  function renderList() {
    var html = '';

    if (state.cat === 'all') {
      CATS.forEach(function (c) {
        if (c.id === 'all') return;
        var items = PRODUCTS.filter(function (p) { return p.cat === c.id; });
        if (!items.length) return;
        html += '<div class="group"><b>' + c.name + '</b><span>' + items.length + ' 种</span></div>' +
          items.map(rowHTML).join('');
      });
    } else {
      html = PRODUCTS.filter(function (p) { return p.cat === state.cat; }).map(rowHTML).join('');
    }

    $('#list').innerHTML = html ||
      '<div class="empty"><span>🍜</span>今天暂时没货，晚点再来</div>';
  }

  /* ---------------- 底部结算条 ---------------- */
  function renderBar() {
    var count = cartCount();
    var goods = goodsTotal();
    var cook = cookTotal();
    var fee = count ? feeOf(goods) : 0;
    var total = goods + fee;
    var short = Math.max(0, SHOP.minOrder - goods);

    $('#sumPrice').textContent = '¥' + money(total);

    if (!count) {
      $('#sumHint').textContent = '还没选东西';
    } else if (short > 0) {
      $('#sumHint').textContent = '还差 ¥' + price(short) + ' 起送';
    } else if (fee > 0) {
      $('#sumHint').textContent = (cook > 0 ? '泡好 ¥' + money(cook) + ' · ' : '') + '含配送费 ¥' + money(fee);
    } else {
      $('#sumHint').textContent = cook > 0 ? '含泡好 ¥' + money(cook) : '已免配送费';
    }

    var badge = $('#cartCount');
    badge.hidden = !count;
    badge.textContent = count > 99 ? '99+' : String(count);

    var btn = $('#goCheckout');
    btn.disabled = !count || short > 0;
    btn.textContent = count && short > 0 ? '差 ¥' + price(short) : '去结算';
  }

  /* ---------------- 弹层 ---------------- */
  function ciHTML(it) {
    var p = it.p;
    var fee = cookFeeOf(p);
    var cooked = isCooked(p.id);
    var lineTotal = p.price * it.qty + (cooked ? fee * it.qty : 0);

    var cookToggle = fee > 0
      ? '<label class="cook-toggle">' +
          '<input type="checkbox" data-role="cook" data-id="' + p.id + '"' + (cooked ? ' checked' : '') + '>' +
          '<span>泡好送上门 <b>+¥' + price(fee) + '/份</b></span>' +
        '</label>'
      : '';

    return '' +
      '<div class="ci">' +
        picHTML(p) +
        '<div class="meta">' +
          '<div class="name-row"><span class="name">' + esc(p.name) + '</span></div>' +
          '<div class="spec">¥' + price(p.price) + ' / ' + esc(p.unit) + '</div>' +
          '<div class="price-row"><span class="price">¥' + money(lineTotal) + '</span></div>' +
          cookToggle +
        '</div>' +
        stepHTML(p, it.qty) +
        '<button class="ci-del" type="button" data-act="del" data-id="' + p.id + '" aria-label="删除">✕</button>' +
      '</div>';
  }

  function cartFootHTML(goods, fee, total, short) {
    var cook = cookTotal();
    var bits = [];
    if (cook > 0) bits.push('含泡好 ¥' + money(cook));
    bits.push(fee ? '含配送费 ¥' + money(fee) : '已免配送费');

    return '' +
      '<div class="foot-row">' +
        '<div class="foot-total">合计（' + cartCount() + ' 件）<b>¥' + money(total) + '</b>' +
          '<em>' + bits.join(' · ') + '</em></div>' +
      '</div>' +
      '<button class="btn-primary" type="button" data-act="to-checkout"' + (short > 0 ? ' disabled' : '') + '>' +
        (short > 0 ? '还差 ¥' + price(short) + ' 起送' : '去结算') +
      '</button>';
  }

  function formHTML() {
    var opts = (SHOP.buildings || []).map(function (b) {
      return '<option value="' + esc(b) + '"></option>';
    }).join('');

    return '' +
      '<form class="form" id="orderForm" novalidate>' +
        '<div class="f2">' +
          '<div class="f" data-f="build">' +
            '<label for="fBuild">楼栋</label>' +
            '<input id="fBuild" list="buildOptions" placeholder="如 3栋">' +
            '<small class="msg">请填楼栋</small>' +
          '</div>' +
          '<div class="f" data-f="room">' +
            '<label for="fRoom">宿舍号</label>' +
            '<input id="fRoom" placeholder="如 502">' +
            '<small class="msg">请填宿舍号</small>' +
          '</div>' +
        '</div>' +
        '<datalist id="buildOptions">' + opts + '</datalist>' +
        '<div class="f" data-f="phone">' +
          '<label for="fPhone">手机号</label>' +
          '<input id="fPhone" inputmode="numeric" maxlength="13" placeholder="到了方便联系你">' +
          '<small class="msg">手机号好像不对</small>' +
        '</div>' +
        '<div class="f">' +
          '<label for="fNote">备注（选填）</label>' +
          '<textarea id="fNote" rows="2" placeholder="放门口 / 到了打电话"></textarea>' +
        '</div>' +
        '<p class="form-note">提交后加微信 <b>' + esc(SHOP.wechat) +
          '</b> 转账，看到就送。' + (apiMode ? '' : '（当前未连接商家系统，提交会生成小票，需要你手动发给我）') + '</p>' +
      '</form>';
  }

  function checkoutFootHTML(fee, total) {
    var cook = cookTotal();
    var bits = [];
    if (cook > 0) bits.push('含泡好 ¥' + money(cook));
    bits.push(fee ? '含配送费 ¥' + money(fee) : '已免配送费');

    return '' +
      '<div class="foot-row">' +
        '<div class="foot-total">应付<b>¥' + money(total) + '</b>' +
          '<em>' + bits.join(' · ') + '</em></div>' +
      '</div>' +
      '<button class="btn-primary" type="button" data-act="submit">提交订单</button>';
  }

  function successHTML(order) {
    var synced = state.synced;
    var pay = order.payment || { status: 'unpaid' };
    var showQr = synced && PAY_QR;
    var claimed = pay.status === 'claimed' || pay.status === 'paid';

    var payBox = '';
    if (showQr) {
      payBox = '' +
        '<div class="paybox">' +
          '<p class="pay-top">应付 <b>¥' + money(order.total) + '</b></p>' +
          '<img class="pay-qr" src="' + sbUrl('/api/pay-qr') + '?v=' + (PAY_QR_VERSION || Date.now()) + '" alt="商家微信收款码">' +
          '<p class="pay-hint">微信扫一扫付款，备注订单号 ' + esc(order.no) + '</p>' +
          (claimed
            ? '<p class="pay-state">已通知商家，等你确认收款</p>'
            : '<button class="btn-primary" type="button" data-act="claim">我已付款</button>') +
        '</div>';
    }

    return '' +
      '<div class="ok">' +
        '<div class="tick' + (synced ? '' : ' warn') + '" aria-hidden="true">' + (synced ? '✓' : '!') + '</div>' +
        '<h3>' + (synced ? '订单已发送给商家' : '订单已生成') + '</h3>' +
        '<p>' + (synced
          ? (showQr ? '扫码付款，付完点一下「我已付款」' : '加我微信 <b>' + esc(SHOP.wechat) + '</b> 转账，马上给你送')
          : '没连上商家系统，把下面的信息复制发我微信') + '</p>' +
        '<div class="ono">' + esc(order.no) + '</div>' +
        payBox +
        '<div class="receipt">' + esc(receiptText(order)) + '</div>' +
        (synced && order.token
          ? '<a class="btn-primary" href="' + sbUrl('/order.html') + '?id=' + order.id + '&token=' + order.token + '" style="margin-top:14px;text-decoration:none">查看订单进度</a>'
          : '') +
        '<button class="btn-link" type="button" data-act="copy">复制订单信息</button>' +
        '<button class="btn-link" type="button" data-act="done">继续点单</button>' +
      '</div>';
  }

  function claimPaid() {
    var order = state.lastOrder;
    if (!order || !order.id || state.claiming) return;

    var btn = document.querySelector('[data-act="claim"]');
    state.claiming = true;
    if (btn) { btn.disabled = true; btn.textContent = '正在通知…'; }

    request('/api/orders/' + encodeURIComponent(order.id) + '/claim', { method: 'POST', timeout: 6000 })
      .then(function (data) {
        state.claiming = false;
        order.payment = (data && data.payment) || { status: 'claimed' };
        renderSheet();
        toast('已告诉商家，请等确认');
      })
      .catch(function (err) {
        state.claiming = false;
        if (btn) { btn.disabled = false; btn.textContent = '我已付款'; }
        toast((err && err.message) || '网络不太好，再点一次');
      });
  }

  function renderSheet() {
    var items = cartList();
    var count = cartCount();
    var goods = count ? goodsTotal() : 0;
    var fee = count ? feeOf(goods) : 0;
    var total = goods + fee;
    var short = Math.max(0, SHOP.minOrder - goods);

    if (state.view === 'checkout' && !count) state.view = 'cart';

    var titles = { cart: '已选商品', checkout: '确认订单', success: '下单成功' };
    $('#sheetTitle').textContent = titles[state.view];
    $('#sheetBack').hidden = state.view !== 'checkout';

    var body = $('#sheetBody');
    var foot = $('#sheetFoot');

    if (state.view === 'success' && state.lastOrder) {
      body.innerHTML = successHTML(state.lastOrder);
      foot.innerHTML = '';
      foot.hidden = true;
      body.scrollTop = 0;
      return;
    }

    foot.hidden = false;

    if (state.view === 'checkout') {
      body.innerHTML = formHTML();
      foot.innerHTML = checkoutFootHTML(fee, total);
      body.scrollTop = 0;
      return;
    }

    if (!items.length) {
      body.innerHTML = '<div class="empty"><span>🛒</span>还没选东西</div>';
      foot.innerHTML = '';
      foot.hidden = true;
      return;
    }

    body.innerHTML = items.map(ciHTML).join('');
    foot.innerHTML = cartFootHTML(goods, fee, total, short);
    body.scrollTop = 0;
  }

  var sheet = $('#sheet');
  var mask = $('#mask');
  var hideTimer = null;

  function openSheet(view) {
    state.view = view || 'cart';
    renderSheet();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    mask.hidden = false;
    void mask.offsetWidth;
    mask.classList.add('show');
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    mask.classList.remove('show');
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    state.view = 'cart';
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      mask.hidden = true;
      hideTimer = null;
    }, 240);
  }

  /* ---------------- 表单 ---------------- */
  function markField(name, ok) {
    var f = document.querySelector('[data-f="' + name + '"]');
    if (!f) return;
    f.classList.toggle('err', !ok);
  }

  function validate() {
    var build = ($('#fBuild') || {}).value || '';
    var room = ($('#fRoom') || {}).value || '';
    var phone = (($('#fPhone') || {}).value || '').replace(/[\s-]/g, '');

    var okBuild = build.trim().length > 0;
    var okRoom = room.trim().length > 0;
    var okPhone = /^1[3-9]\d{9}$/.test(phone);

    markField('build', okBuild);
    markField('room', okRoom);
    markField('phone', okPhone);

    if (!okBuild) { $('#fBuild').focus(); return false; }
    if (!okRoom) { $('#fRoom').focus(); return false; }
    if (!okPhone) { $('#fPhone').focus(); return false; }
    return true;
  }

  /* ---------------- 小票 ---------------- */
  function receiptText(o) {
    var lines = o.items.map(function (i) {
      return '· ' + i.name + ' ×' + i.qty + (i.cooked ? '（泡好）' : '') + '　¥' + money(i.price * i.qty);
    });
    var when = o.timeText || timeText(o.createdAt || Date.now());
    var cookFee = Number(o.cookFee || 0);

    return '【' + SHOP.name + '】新订单\n' +
      '订单号：' + o.no + '\n' +
      lines.join('\n') + '\n' +
      (cookFee ? '泡好服务费：¥' + money(cookFee) + '\n' : '') +
      '合计：¥' + money(o.total) + (o.fee ? '（含配送费 ¥' + money(o.fee) + '）' : '（免配送费）') + '\n' +
      '楼栋：' + o.build + ' ' + o.room + '\n' +
      '电话：' + o.phone + '\n' +
      '备注：' + (o.note || '无') + '\n' +
      '下单：' + when;
  }

  function localOrder(payload, items) {
    var goods = goodsTotal();
    var fee = feeOf(goods);
    var now = Date.now();
    var d = new Date(now);

    return {
      id: 'local' + now,
      no: '#' + String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
        '-' + String(Math.floor(1000 + Math.random() * 9000)),
      items: items.map(function (i) {
        var cooked = isCooked(i.p.id) && cookFeeOf(i.p) > 0;
        return {
          name: i.p.name,
          price: i.p.price,
          qty: i.qty,
          unit: i.p.unit,
          cooked: cooked,
          cookFee: cooked ? cookFeeOf(i.p) : 0
        };
      }),
      goods: goods,
      cookFee: cookTotal(),
      fee: fee,
      total: goods + fee,
      build: payload.build,
      room: payload.room,
      phone: payload.phone,
      note: payload.note,
      createdAt: now,
      timeText: timeText(now)
    };
  }

  function rememberOrder(order) {
    if (!order || !order.id || !order.token) return;
    var list = readJSON(KEY_MY_ORDERS, []);
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (x) { return x && x.id !== order.id; });
    list.unshift({
      id: order.id,
      token: order.token,
      no: order.no,
      total: order.total,
      createdAt: order.createdAt || Date.now()
    });
    writeJSON(KEY_MY_ORDERS, list.slice(0, 20));
  }

  function finishOrder(order, synced) {
    state.cart = {};
    writeJSON(KEY_CART, state.cart);
    state.lastOrder = order;
    state.synced = !!synced;
    state.view = 'success';
    if (synced) rememberOrder(order);
    renderBar();
    renderList();
    renderSheet();
  }

  function submitOrder() {
    if (!validate()) return;

    var items = cartList();
    if (!items.length) return;

    var goods = goodsTotal();
    if (goods < SHOP.minOrder) {
      toast('还差 ¥' + price(SHOP.minOrder - goods) + ' 才到起送价');
      return;
    }

    var soldOne = items.filter(function (i) {
      var s = Number(i.p.stock);
      return i.p.soldOut || (Number.isFinite(s) && s <= 0);
    })[0];
    if (soldOne) {
      toast('「' + soldOne.p.name + '」卖完了，换一个吧');
      syncShop();
      return;
    }

    var overOne = items.filter(function (i) {
      var s = Number(i.p.stock);
      return Number.isFinite(s) && i.qty > s;
    })[0];
    if (overOne) {
      toast('「' + overOne.p.name + '」库存只剩 ' + Number(overOne.p.stock) + ' 件');
      syncShop();
      return;
    }

    var payload = {
      items: items.map(function (i) {
        return { id: i.p.id, qty: i.qty, cooked: isCooked(i.p.id) && cookFeeOf(i.p) > 0 };
      }),
      build: ($('#fBuild').value || '').trim(),
      room: ($('#fRoom').value || '').trim(),
      phone: ($('#fPhone').value || '').replace(/[\s-]/g, ''),
      note: ($('#fNote').value || '').trim()
    };

    var btn = document.querySelector('[data-act="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = '提交中…'; }

    function fail(err) {
      if (btn) { btn.disabled = false; btn.textContent = '提交订单'; }
      toast((err && err.message) || '提交失败，稍后再试');
    }

    // 没有服务器：生成小票，让顾客自己发微信
    if (!apiMode || typeof fetch !== 'function') {
      finishOrder(localOrder(payload, items), false);
      return;
    }

    request('/api/orders', { method: 'POST', body: payload, timeout: 8000 })
      .then(function (data) {
        if (!data || !data.order) throw new Error('服务器没有返回订单');
        finishOrder(data.order, true);
      })
      .catch(function (err) {
        if (err && err.status && err.status >= 400 && err.status < 500) {
          fail(err);
          if (err.status === 409) syncShop();
          return;
        }
        // 断网之类：退化成小票
        finishOrder(localOrder(payload, items), false);
        toast('没连上商家系统，已生成小票');
      });
  }

  /* ---------------- 与服务器同步商品 ---------------- */
  function syncShop() {
    if (!apiMode || typeof fetch !== 'function') return;
    request('/api/shop', { timeout: 5000 }).then(function (data) {
      if (!data || !Array.isArray(data.products)) return;
      PRODUCTS = data.products;
      if (data.shop) SHOP = data.shop;
      PAY_QR = !!data.payQr;
      PAY_QR_VERSION = data.payQrVersion || 0;
      rebuildById();

      var changed = false;
      Object.keys(state.cart).forEach(function (id) {
        var p = BY_ID[id];
        if (!p) {
          delete state.cart[id];
          changed = true;
          return;
        }

        var stock = Number(p.stock);
        if (p.soldOut) {
          delete state.cart[id];
          changed = true;
          return;
        }
        if (Number.isFinite(stock) && state.cart[id] > stock) {
          if (stock <= 0) delete state.cart[id];
          else state.cart[id] = stock;
          changed = true;
        }
      });

      if (changed) {
        writeJSON(KEY_CART, state.cart);
        toast('有商品库存变了，购物车已更新');
      }

      // 清掉已经不在购物车、或不再支持泡好的标记
      var cookedChanged = false;
      Object.keys(state.cooked).forEach(function (id) {
        var p = BY_ID[id];
        if (!p || !state.cart[id] || cookFeeOf(p) <= 0) {
          delete state.cooked[id];
          cookedChanged = true;
        }
      });
      if (cookedChanged) writeJSON(KEY_COOKED, state.cooked);

      renderList();
      renderBar();
      if (state.view === 'cart' && !sheet.classList.contains('open')) renderSheet();
    }).catch(function () {});
  }

  /* ---------------- 复制 / 提示 ---------------- */
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }

  /* ---------------- 店铺信息 ---------------- */
  function fillInfo() {
    $('#hours').textContent = pad2(SHOP.openHour) + ':00–' + pad2(SHOP.closeHour) + ':00';
    $('#fpMin').textContent = price(SHOP.minOrder);
    $('#fpFree').textContent = price(SHOP.freeDeliveryAt);
    $('#fpWechat').textContent = SHOP.wechat;
    $('#fpPhone').textContent = SHOP.phone;

    var now = new Date();
    var mins = now.getHours() * 60 + now.getMinutes();
    var isOpen = mins >= SHOP.openHour * 60 && mins < SHOP.closeHour * 60;
    var dot = document.querySelector('.head-right .on');
    if (dot) {
      dot.textContent = isOpen ? '营业中' : '休息中';
      dot.classList.toggle('off', !isOpen);
    }
  }

  /* ---------------- 事件 ---------------- */
  function refresh() {
    renderBar();
    renderList();
    renderSheet();
  }

  function addItem(id, delta) {
    var p = BY_ID[id];
    if (!p) return;

    var stock = Number(p.stock);
    var hasStock = Number.isFinite(stock);
    if (p.soldOut || (hasStock && stock <= 0)) {
      toast('这个卖完了');
      return;
    }

    var current = state.cart[id] || 0;
    var next = current + delta;

    if (delta > 0 && hasStock && next > stock) {
      toast('库存只剩 ' + stock + ' 件');
      return;
    }

    setQty(id, next);
    refresh();
  }

  function onAct(act, el) {
    var id = el.dataset.id;

    switch (act) {
      case 'tab':
        state.cat = el.dataset.cat;
        renderTabs();
        renderList();
        if (window.scrollY > 80) window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'add':
      case 'plus':
        addItem(id, 1);
        break;
      case 'minus':
        addItem(id, -1);
        break;
      case 'del':
        setQty(id, 0);
        refresh();
        break;

      case 'to-checkout':
        state.view = 'checkout';
        renderSheet();
        break;
      case 'back':
        state.view = 'cart';
        renderSheet();
        break;
      case 'submit':
        submitOrder();
        break;

      case 'copy':
        if (state.lastOrder) {
          copyText(receiptText(state.lastOrder)).then(function (ok) {
            toast(ok ? '已复制，去微信粘贴给我' : '复制失败，请长按文字手动复制');
          });
        }
        break;
      case 'claim':
        claimPaid();
        break;
      case 'done':
        closeSheet();
        break;
    }
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    e.preventDefault();
    onAct(el.dataset.act, el);
  });

  document.addEventListener('input', function (e) {
    var f = e.target.closest('.f.err');
    if (f) f.classList.remove('err');
  });

  // 购物车里勾「泡好送上门」
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-role="cook"]');
    if (!el) return;
    var id = el.dataset.id;
    if (el.checked) state.cooked[id] = true;
    else delete state.cooked[id];
    writeJSON(KEY_COOKED, state.cooked);
    renderBar();
    renderSheet();
  });

  $('#cartOpen').addEventListener('click', function () { openSheet('cart'); });
  $('#goCheckout').addEventListener('click', function () { openSheet('cart'); });
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetBack').addEventListener('click', function () {
    state.view = 'cart';
    renderSheet();
  });
  mask.addEventListener('click', closeSheet);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheet.classList.contains('open')) { closeSheet(); return; }
    if (e.key === 'Enter' && state.view === 'checkout' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      submitOrder();
    }
  });

  /* ---------------- 启动 ---------------- */
  function boot() {
    fillInfo();
    renderTabs();
    renderList();
    renderBar();
    renderSheet();

    var net = document.getElementById('netNote');
    if (net) {
      net.textContent = '正在连接商家系统…';
      net.classList.remove('on');
    }

    if (typeof fetch !== 'function') { setNetNote(); return; }

    request('/api/shop', { timeout: 3000 }).then(function (data) {
      if (!data || !Array.isArray(data.products)) { setNetNote(); return; }
      apiMode = true;
      PRODUCTS = data.products;
      if (data.shop) SHOP = data.shop;
      if (Array.isArray(data.categories) && data.categories.length) CATS = data.categories;
      PAY_QR = !!data.payQr;
      PAY_QR_VERSION = data.payQrVersion || 0;
      rebuildById();

      fillInfo();
      renderTabs();
      renderList();
      renderBar();
      setNetNote();
      if (state.view === 'cart' && !sheet.classList.contains('open')) renderSheet();

      setInterval(syncShop, 60000);
    }).catch(function () {
      setNetNote();
    });
  }

  boot();
})();
