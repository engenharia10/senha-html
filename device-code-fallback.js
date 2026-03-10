(function () {
  const DEVICE_KEY = 'alfatronic_device_id';

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      if (crypto && crypto.randomUUID) {
        id = crypto.randomUUID();
      } else {
        id = String(Date.now()) + '-' + String(Math.random()).slice(2);
      }
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function hash6(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    const n = (h >>> 0) % 1000000;
    return String(n).padStart(6, '0');
  }

  function mustFill(el) {
    const t = (el.textContent || '').trim();
    return !/\d{6}/.test(t);
  }

  function applyFallbackCode() {
    const el = document.getElementById('display-codigo');
    if (!el) return;
    if (!mustFill(el)) return;
    const code = hash6(getOrCreateDeviceId());
    el.textContent = code;
  }

  function attachCopyFallback() {
    const btn = document.getElementById('btn-copiar-codigo');
    if (!btn || btn.dataset.copyFallback === '1') return;
    btn.dataset.copyFallback = '1';
    btn.addEventListener('click', function () {
      const el = document.getElementById('display-codigo');
      if (!el) return;
      const code = (el.textContent || '').replace(/\D/g, '').slice(0, 6);
      if (!code) return;
      navigator.clipboard && navigator.clipboard.writeText(code).catch(function () {});
    });
  }

  function start() {
    applyFallbackCode();
    attachCopyFallback();
    [200, 700, 1500].forEach(function (ms) {
      setTimeout(function () {
        applyFallbackCode();
        attachCopyFallback();
      }, ms);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
