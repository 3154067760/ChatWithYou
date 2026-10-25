/* =========================================================
   宿舍补给站 · 商家后台
   账号在 server.js 顶部（默认 gyq / root）
   ========================================================= */
(function () {
  'use strict';

  var sbUrl = window.sbUrl || function (p) { return p; };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var state = {
    orders: [],
    stats: { pending: 0, today: 0, revenue: 0 },
    filter: 'all',
    products: [],
    categories: [],
    tab: 'orders',
    timer: null,
    knownNew: null,
    knownClaimed: null,
    ready: false,
    payQr: false,
    payQrVersion: 0,
  };

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) { return (Math.round(n * 100) / 100).toFixed(2); }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function timeStr(ts) {
    var d = new Date(ts);
    var now = new Date();
    var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    var hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    return sameDay ? hm : (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------------- 请求 ---------------- */
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

  function handleError(err) {
    if (err && err.status === 401) {
      goLogin();
      return;
    }
    toast((err && err.message) || '出错了，稍后再试');
  }

  /* ---------------- 登录状态 ---------------- */
  function goLogin() {
    stopTimer();
    location.replace('login.html');
  }

  $('#logoutBtn').addEventListener('click', function () {
    api('/api/logout', { method: 'POST' }).catch(function () {}).then(goLogin);
  });

  function startDash(user) {
    $('#bootError').hidden = true;
    $('#dashView').hidden = false;
    state.ready = false;
    state.knownNew = null;
    state.knownClaimed = null;
    loadShop();
    loadOrders();
    startTimer();
    if (user) $('#shopName').textContent = '已登录：' + user;
  }

  /* ---------------- 定时刷新 ---------------- */
  function startTimer() {
    stopTimer();
    state.timer = setInterval(function () {
      if (document.hidden) return;
      if (state.tab !== 'orders') return;
      loadOrders().catch(function () {});
    }, 8000);
  }

  function stopTimer() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && state.ready && state.tab === 'orders') loadOrders().catch(function () {});
  });

  /* ---------------- 数据加载 ---------------- */
  function loadShop() {
    return api('/api/shop').then(function (data) {
      if (!data) return;
      state.products = data.products || [];
      state.categories = data.categories || [];
      if (data.shop && data.shop.name) $('#shopName').textContent = data.shop.name;
      setPayQr(!!data.payQr, data.payQrVersion);
      fillCatSelect();
      if (state.tab === 'products') renderProducts();
      if (state.tab === 'settings') renderSettings();
    }).catch(handleError);
  }

  function loadOrders() {
    return api('/api/orders').then(function (data) {
      if (!data) return;
      state.orders = data.orders || [];
      state.stats = data.stats || state.stats;
      renderStats();
      renderFilters();
      renderOrders();
      noticeNew();
      $('#updAt').textContent = '更新于 ' + timeStr(Date.now());
      state.ready = true;
    }).catch(handleError);
  }

  function loadProducts() {
    return api('/api/shop').then(function (data) {
      if (!data) return;
      state.products = data.products || [];
      setPayQr(!!data.payQr, data.payQrVersion);
      renderProducts();
    }).catch(handleError);
  }

  /* ---------------- 收款码 ---------------- */
  function setPayQr(on, version) {
    state.payQr = !!on;
    state.payQrVersion = version || 0;
  }

  function renderSettings() {
    var img = $('#qrPreview');
    var none = $('#qrNone');
    var del = $('#qrDelete');
    if (!img || !none) return;

    if (state.payQr) {
      img.src = sbUrl('/api/pay-qr') + '?v=' + (state.payQrVersion || Date.now());
      img.hidden = false;
      none.hidden = true;
      if (del) del.disabled = false;
    } else {
      img.hidden = true;
      img.removeAttribute('src');
      none.hidden = false;
      if (del) del.disabled = true;
    }
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 手机截图往往一两 MB，先压到指定尺寸、JPEG，上传快、看着也清楚
  function compressImage(file, maxSize, quality) {
    return fileToDataUrl(file).then(function (src) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          try {
            var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            var w = Math.round(img.width * scale);
            var h = Math.round(img.height * scale);
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality || 0.9));
          } catch (e) {
            resolve(src);
          }
        };
        img.onerror = function () { resolve(src); };
        img.src = src;
      });
    });
  }

  function uploadProductImage(id, file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast('请选一张图片');
      return;
    }

    toast('正在处理图片…');
    compressImage(file, 1200, 0.85).then(function (dataUrl) {
      return api('/api/products/' + encodeURIComponent(id) + '/image', {
        method: 'POST',
        body: { dataUrl: dataUrl },
      });
    }).then(function () {
      toast('商品图片已更新');
      return loadProducts();
    }).catch(handleError);
  }

  /* ---------------- 邮件通知 ---------------- */
  function renderMailStatus(data) {
    var el = $('#mailStatus');
    var banner = $('#mailBanner');

    if (banner) {
      if (!data || !data.hasPass) {
        banner.textContent = '还没填 SMTP 授权码，顾客下单、付款都不会发邮件';
        banner.className = 'mail-banner warn';
      } else if (!data.enabled) {
        banner.textContent = '邮件通知是关闭的，不会发信';
        banner.className = 'mail-banner off';
      } else {
        banner.textContent = '邮件通知已开启 · ' + (data.to || '');
        banner.className = 'mail-banner on';
      }
    }

    if (!el) return;

    if (!data || !data.hasPass) {
      el.textContent = '还没有配置，填好上面的信息后点保存';
      el.className = 'panel-note';
      return;
    }

    if (!data.enabled) {
      el.textContent = '配置已保存，但「开启邮件通知」没勾上，不会发信';
      el.className = 'panel-note bad';
      return;
    }

    if (data.last && data.last.at) {
      el.textContent = '上次发送：' + timeStr(data.last.at) + ' · ' +
        (data.last.ok ? '成功' : '失败：' + data.last.error);
      el.className = 'panel-note ' + (data.last.ok ? 'ok' : 'bad');
      return;
    }

    el.textContent = '已保存，点「发送测试邮件」确认能不能收到';
    el.className = 'panel-note';
  }

  function loadMail() {
    return api('/api/settings/mail').then(function (data) {
      if (!data) return;
      $('#mailTo').value = data.to || data.defaultTo || '';
      $('#mailFrom').value = data.from || '';
      $('#mailHost').value = data.host || 'smtp.qq.com';
      $('#mailPort').value = data.port || 465;
      $('#mailNew').checked = data.notifyNew !== false;
      $('#mailPaid').checked = data.notifyPaid !== false;
      // 第一次配置时默认勾上「开启」，否则填了授权码却忘了勾，会白配
      $('#mailEnabled').checked = data.hasPass ? !!data.enabled : true;
      $('#mailPass').value = '';
      $('#mailPass').placeholder = data.hasPass ? '已保存，留空不修改' : 'QQ 邮箱的授权码';
      renderMailStatus(data);
    }).catch(handleError);
  }

  /* ---------------- 统计 / 筛选 ---------------- */
  function renderStats() {
    var s = state.stats;
    $('#stPending').textContent = s.pending || 0;
    $('#stToday').textContent = s.today || 0;
    $('#stRevenue').textContent = '¥' + money(s.revenue || 0);

    var pending = s.pending || 0;
    document.title = pending > 0
      ? '(' + pending + ') 待接单 · 商家后台'
      : '商家后台 · 宿舍补给站';
  }

  var FILTERS = [
    ['all', '全部'],
    ['new', '待接单'],
    ['accepted', '配送中'],
    ['done', '已完成'],
    ['cancelled', '已取消'],
  ];

  function renderFilters() {
    $('#filters').innerHTML = FILTERS.map(function (f) {
      var count = f[0] === 'all'
        ? state.orders.length
        : state.orders.filter(function (o) { return o.status === f[0]; }).length;
      return '<button class="filter' + (state.filter === f[0] ? ' on' : '') + '" type="button" ' +
        'data-filter="' + f[0] + '">' + f[1] + '<b>' + count + '</b></button>';
    }).join('');
  }

  /* ---------------- 订单渲染 ---------------- */
  var STATUS = {
    new: { text: '待接单', cls: 'st-new' },
    accepted: { text: '配送中', cls: 'st-accepted' },
    done: { text: '已完成', cls: 'st-done' },
    cancelled: { text: '已取消', cls: 'st-cancelled' },
  };

  function actionsFor(o) {
    var tel = '<a class="tel" href="tel:' + esc(o.phone) + '">📞 打电话</a>';
    var pay = o.payment || { status: 'unpaid' };
    var payBtn = '';
    if (pay.status !== 'paid' && o.status !== 'cancelled') {
      payBtn = '<button class="btn-pay" type="button" data-act="mark-paid">' +
        (pay.status === 'claimed' ? '确认收款' : '标记已收款') + '</button>';
    }

    if (o.status === 'new') {
      return payBtn + tel +
        '<button class="btn-main" type="button" data-act="accept">接单</button>' +
        '<button class="btn-line btn-danger" type="button" data-act="cancel">取消</button>';
    }
    if (o.status === 'accepted') {
      return payBtn + tel +
        '<button class="btn-main" type="button" data-act="done">已送达</button>' +
        '<button class="btn-line btn-danger" type="button" data-act="cancel">取消</button>';
    }
    return (payBtn ? payBtn : '') +
      '<button class="btn-line btn-danger" type="button" data-act="del-order">删除记录</button>';
  }

  function orderHTML(o) {
    var st = STATUS[o.status] || STATUS.new;
    var pay = o.payment || { status: 'unpaid' };
    var payTag = pay.status === 'paid'
      ? '<span class="pay-tag pay-paid">已收款</span>'
      : pay.status === 'claimed'
        ? '<span class="pay-tag pay-claimed">待确认收款</span>'
        : '<span class="pay-tag pay-unpaid">未收款</span>';

    var items = o.items.map(function (i) {
      return '<li><span class="q">×' + i.qty + '</span><span class="n">' + esc(i.name) + '</span>' +
        '<span class="p">¥' + money(i.price * i.qty) + '</span></li>';
    }).join('');

    return '' +
      '<article class="order' + (o.status === 'new' ? ' new' : '') + '" data-id="' + o.id + '">' +
        '<div class="o-head">' +
          '<span class="st ' + st.cls + '">' + st.text + '</span>' +
          payTag +
          '<span class="o-no">' + esc(o.no) + '</span>' +
          '<span class="o-time">' + timeStr(o.createdAt) + '</span>' +
        '</div>' +
        '<ul class="o-items">' + items + '</ul>' +
        '<div class="o-info">' +
          '送至 <b>' + esc(o.build) + ' ' + esc(o.room) + '</b>　·　' + esc(o.phone) +
          '<br>' + o.items.length + ' 种 / ' + o.items.reduce(function (n, i) { return n + i.qty; }, 0) + ' 件' +
          (o.note ? '<div class="o-note">备注：' + esc(o.note) + '</div>' : '') +
        '</div>' +
        '<div class="o-foot">' +
          '<span class="o-total">¥' + money(o.total) +
            '<small>' + (o.fee ? '含配送费 ¥' + money(o.fee) : '免配送费') + '</small></span>' +
          '<div class="o-acts">' + actionsFor(o) + '</div>' +
        '</div>' +
      '</article>';
  }

  function renderOrders() {
    var list = state.filter === 'all'
      ? state.orders
      : state.orders.filter(function (o) { return o.status === state.filter; });

    if (!list.length) {
      $('#orderList').innerHTML = '<div class="empty"><span>🧾</span>' +
        (state.filter === 'all' ? '还没有订单，等同学下单吧' : '这个分类下暂时没有订单') + '</div>';
      return;
    }

    $('#orderList').innerHTML = list.map(orderHTML).join('');
  }

  function noticeNew() {
    var newIds = state.orders.filter(function (o) { return o.status === 'new'; })
      .map(function (o) { return o.id; });

    if (state.knownNew) {
      var fresh = newIds.filter(function (id) { return state.knownNew.indexOf(id) < 0; });
      if (fresh.length) toast('收到 ' + fresh.length + ' 个新订单');
    }
    state.knownNew = newIds;

    var claimedIds = state.orders.filter(function (o) {
      return o.payment && o.payment.status === 'claimed';
    }).map(function (o) { return o.id; });

    if (state.knownClaimed) {
      var freshPaid = claimedIds.filter(function (id) { return state.knownClaimed.indexOf(id) < 0; });
      if (freshPaid.length) toast('有 ' + freshPaid.length + ' 单顾客点了「我已付款」');
    }
    state.knownClaimed = claimedIds;
  }

  /* ---------------- 订单操作 ---------------- */
  function actOnOrder(id, status) {
    var labels = { accepted: '已接单', done: '已送达', cancelled: '已取消' };
    return api('/api/orders/' + encodeURIComponent(id), { method: 'PATCH', body: { status: status } })
      .then(function () {
        toast(labels[status] || '已更新');
        return loadOrders();
      })
      .catch(handleError);
  }

  function removeOrder(id) {
    return api('/api/orders/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function () { toast('已删除记录'); return loadOrders(); })
      .catch(handleError);
  }

  function markPaid(id) {
    return api('/api/orders/' + encodeURIComponent(id) + '/payment', {
      method: 'POST',
      body: { status: 'paid' },
    }).then(function () {
      toast('已确认收款');
      return loadOrders();
    }).catch(handleError);
  }

  /* ---------------- 商品渲染 ---------------- */
  function fillCatSelect() {
    var cats = state.categories.filter(function (c) { return c.id !== 'all'; });
    $('#npCat').innerHTML = cats.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    }).join('');
  }

  function productHTML(p) {
    var thumb = p.imgVersion
      ? '<img src="' + sbUrl('/api/product-image/' + p.id) + '?v=' + p.imgVersion + '" alt="">'
      : esc(p.emoji);

    return '' +
      '<div class="prod' + (p.soldOut ? ' sold' : '') + '" data-id="' + p.id + '">' +
        '<label class="p-pic" title="点击上传 / 更换图片">' +
          thumb +
          '<input type="file" accept="image/*" data-role="img" data-id="' + p.id + '" hidden>' +
        '</label>' +
        '<div class="p-info">' +
          '<span class="p-name">' + esc(p.name) + '</span>' +
          '<span class="p-spec">' + esc(p.spec) + ' · ' + esc(p.unit) + '</span>' +
          '<span class="p-links">' +
            '<button class="p-link" type="button" data-act="pick-img" data-id="' + p.id + '">换图</button>' +
            (p.imgVersion ? '<button class="p-link" type="button" data-act="revert-img" data-id="' + p.id + '">还原</button>' : '') +
          '</span>' +
        '</div>' +
        '<label class="p-price">¥<input type="number" min="0.1" step="0.5" value="' + p.price +
          '" data-role="price" aria-label="' + esc(p.name) + ' 的价格"></label>' +
        '<label class="p-stock">库存<input type="number" min="0" step="1" value="' + (Number(p.stock) || 0) +
          '" data-role="stock" aria-label="' + esc(p.name) + ' 的库存">件</label>' +
        '<label class="p-sold"><input type="checkbox" data-role="soldout"' +
          (p.soldOut ? ' checked' : '') + '> 售罄</label>' +
        '<button class="p-del" type="button" data-act="del-product" aria-label="删除">✕</button>' +
      '</div>';
  }

  function renderProducts() {
    var cats = state.categories.filter(function (c) { return c.id !== 'all'; });
    var html = '';

    cats.forEach(function (c) {
      var items = state.products.filter(function (p) { return p.cat === c.id; });
      if (!items.length) return;
      html += '<h3 class="cat-title">' + esc(c.name) + ' · ' + items.length + ' 种</h3>' +
        items.map(productHTML).join('');
    });

    $('#productList').innerHTML = html || '<div class="empty"><span>📦</span>还没有商品</div>';
  }

  /* ---------------- 事件绑定 ---------------- */
  document.addEventListener('click', function (e) {
    var filter = e.target.closest('.filter');
    if (filter) {
      state.filter = filter.dataset.filter;
      renderFilters();
      renderOrders();
      return;
    }

    var tab = e.target.closest('.mtab');
    if (tab) {
      state.tab = tab.dataset.tab;
      $$('.mtab').forEach(function (t) { t.classList.toggle('on', t === tab); });
      $('#ordersPanel').hidden = state.tab !== 'orders';
      $('#productsPanel').hidden = state.tab !== 'products';
      $('#settingsPanel').hidden = state.tab !== 'settings';
      if (state.tab === 'products') loadProducts();
      if (state.tab === 'settings') { renderSettings(); loadMail(); }
      return;
    }

    var actBtn = e.target.closest('[data-act]');
    if (!actBtn) return;
    if (actBtn.disabled) return;

    var orderEl = actBtn.closest('.order');
    var act = actBtn.dataset.act;

    if (act === 'del-product') {
      var prodEl = actBtn.closest('.prod');
      if (!prodEl) return;
      api('/api/products/' + encodeURIComponent(prodEl.dataset.id), { method: 'DELETE' })
        .then(function () { toast('已删除商品'); loadProducts(); })
        .catch(handleError);
      return;
    }

    if (act === 'pick-img') {
      var picker = document.querySelector('input[data-role="img"][data-id="' + actBtn.dataset.id + '"]');
      if (picker) picker.click();
      return;
    }

    if (act === 'revert-img') {
      api('/api/products/' + encodeURIComponent(actBtn.dataset.id) + '/image', { method: 'DELETE' })
        .then(function () { toast('已还原成 emoji'); loadProducts(); })
        .catch(handleError);
      return;
    }

    if (!orderEl) return;
    var id = orderEl.dataset.id;

    if (act === 'accept') actOnOrder(id, 'accepted');
    else if (act === 'done') actOnOrder(id, 'done');
    else if (act === 'cancel') actOnOrder(id, 'cancelled');
    else if (act === 'del-order') removeOrder(id);
    else if (act === 'mark-paid') markPaid(id);
  });

  // 改价 / 售罄
  $('#productList').addEventListener('change', function (e) {
    var role = e.target.dataset.role;
    if (!role) return;
    var prodEl = e.target.closest('.prod');
    if (!prodEl) return;
    var id = prodEl.dataset.id;

    if (role === 'img') {
      var file = e.target.files && e.target.files[0];
      uploadProductImage(id, file);
      e.target.value = '';
      return;
    }

    if (role === 'price') {
      var value = Number(e.target.value);
      if (!(value > 0 && value < 10000)) {
        toast('价格不对');
        loadProducts();
        return;
      }
      api('/api/products/' + encodeURIComponent(id), { method: 'PUT', body: { price: value } })
        .then(function () { toast('已改价：¥' + money(value)); loadProducts(); })
        .catch(function (err) { handleError(err); loadProducts(); });
      return;
    }

    if (role === 'stock') {
      var stock = Number(e.target.value);
      if (!Number.isInteger(stock) || stock < 0) {
        toast('库存要填 0 或正整数');
        loadProducts();
        return;
      }
      api('/api/products/' + encodeURIComponent(id), { method: 'PUT', body: { stock: stock } })
        .then(function () { toast('库存已改为 ' + stock + ' 件'); loadProducts(); })
        .catch(function (err) { handleError(err); loadProducts(); });
      return;
    }

    if (role === 'soldout') {
      var sold = e.target.checked;
      api('/api/products/' + encodeURIComponent(id), { method: 'PUT', body: { soldOut: sold } })
        .then(function () { toast(sold ? '已标记售罄' : '已恢复上架'); loadProducts(); })
        .catch(function (err) { handleError(err); loadProducts(); });
    }
  });

  // 新增商品
  $('#addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#npName').value.trim();
    var price = Number($('#npPrice').value);
    var stock = Number($('#npStock').value);

    if (!name) { toast('填一下商品名'); $('#npName').focus(); return; }
    if (!(price > 0)) { toast('价格不对'); $('#npPrice').focus(); return; }
    if (!Number.isInteger(stock) || stock < 0) { toast('库存填 0 或正整数'); $('#npStock').focus(); return; }
    if (!$('#npCat').value) { toast('还没有商品分类'); return; }

    var btn = $('#addForm').querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '添加中…';

    api('/api/products', {
      method: 'POST',
      body: {
        name: name,
        price: price,
        cat: $('#npCat').value,
        spec: $('#npSpec').value.trim(),
        unit: $('#npUnit').value.trim() || '份',
        emoji: $('#npEmoji').value.trim() || '🛒',
        stock: stock,
      },
    }).then(function () {
      toast('已添加：' + name);
      $('#addForm').reset();
      $('#npEmoji').value = '';
      return loadProducts();
    }).catch(handleError).then(function () {
      btn.disabled = false;
      btn.textContent = '添加';
    });
  });

  // 收款码上传 / 删除
  $('#qrFile').addEventListener('change', function (e) {
    var input = e.target;
    var file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast('请选一张图片');
      input.value = '';
      return;
    }

    toast('正在处理图片…');
    compressImage(file, 900).then(function (dataUrl) {
      return api('/api/settings/pay-qr', { method: 'POST', body: { dataUrl: dataUrl } });
    }).then(function (data) {
      setPayQr(true, data && data.version);
      renderSettings();
      toast('收款码已保存');
    }).catch(handleError).then(function () {
      input.value = '';
    });
  });

  $('#qrDelete').addEventListener('click', function () {
    api('/api/settings/pay-qr', { method: 'DELETE' }).then(function () {
      setPayQr(false, 0);
      renderSettings();
      toast('已删除收款码');
    }).catch(handleError);
  });

  // 邮件通知：保存 / 发测试邮件
  $('#mailSave').addEventListener('click', function () {
    var to = $('#mailTo').value.trim();
    if (!to) {
      toast('填一下收件邮箱');
      $('#mailTo').focus();
      return;
    }

    var btn = this;
    btn.disabled = true;
    btn.textContent = '保存中…';

    api('/api/settings/mail', {
      method: 'POST',
      body: {
        to: to,
        from: $('#mailFrom').value.trim(),
        pass: $('#mailPass').value.trim(),
        host: $('#mailHost').value.trim() || 'smtp.qq.com',
        port: Number($('#mailPort').value) || 465,
        notifyNew: $('#mailNew').checked,
        notifyPaid: $('#mailPaid').checked,
        enabled: $('#mailEnabled').checked,
      },
    }).then(function () {
      toast($('#mailEnabled').checked ? '已保存' : '已保存，但邮件通知是关闭的');
      return loadMail();
    }).catch(handleError).then(function () {
      btn.disabled = false;
      btn.textContent = '保存';
    });
  });

  $('#mailTest').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = '发送中…';

    api('/api/settings/mail/test', { method: 'POST', body: {} })
      .then(function () {
        toast('测试邮件已发送，去邮箱看看');
        return loadMail();
      })
      .catch(function (err) {
        toast((err && err.message) || '发送失败');
        return loadMail();
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = '发送测试邮件';
      });
  });

  // 手动刷新
  $('#refreshBtn').addEventListener('click', function () {
    loadOrders();
    if (state.tab === 'products') loadProducts();
    toast('已刷新');
  });

  /* ---------------- 启动 ---------------- */
  function boot() {
    api('/api/me')
      .then(function (data) {
        if (data && data.user) { startDash(data.user); return; }
        goLogin();
      })
      .catch(function (err) {
        if (err && err.status === 401) { goLogin(); return; }
        $('#bootError').hidden = false;
        $('#bootErrorText').textContent =
          (err && err.message) || '请先双击「启动服务器.bat」，再重新打开本页。';
      });
  }

  boot();
})();
