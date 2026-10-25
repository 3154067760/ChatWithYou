/* =========================================================
   宿舍补给站 · 部署路径自动识别
   放在根目录（/）还是子路径（/snack/）都能用，不用手改。
   原理：看 config.js 自己被哪个地址加载，/snack/config.js → base = /snack
   ========================================================= */
(function () {
  'use strict';

  var base = '';

  // 本地双击打开（file://）时不做任何前缀
  if (location.protocol !== 'file:') {
    var script = document.currentScript;
    if (!script) {
      var all = document.getElementsByTagName('script');
      script = all[all.length - 1];
    }
    if (script && script.src) {
      try {
        var path = new URL(script.src, location.href).pathname;
        base = path.replace(/\/config\.js$/, '');
        if (base === '/') base = '';
      } catch (e) {
        base = '';
      }
    }
  }

  window.SB_BASE = base;

  // 拼接带前缀的地址：sbUrl('/api/pay-qr') → /snack/api/pay-qr
  window.sbUrl = function (path) {
    if (!base) return path;
    return base + (path.charAt(0) === '/' ? path : '/' + path);
  };

  // 所有 fetch('/api/...') 自动加前缀，页面脚本不用改
  if (base && typeof window.fetch === 'function') {
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      if (typeof input === 'string' && input.indexOf('/api/') === 0) {
        input = base + input;
      }
      return nativeFetch.call(this, input, init);
    };
  }
})();
