/* AWARA — shared behaviour for aw-* sections.
   Every feature is keyed on data attributes and initialised per section root,
   so it re-runs when the theme editor reloads a section (shopify:section:load). */
(function () {
  if (window.AWARA) return;
  var DEFAULT_WA = '201229726229';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var design = !!(window.Shopify && Shopify.designMode);

  function $all(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function waNumber(el) {
    var own = el && el.getAttribute('data-aw-num');
    var n = (own || window.AW_WA_NUMBER || DEFAULT_WA).replace(/[^0-9]/g, '');
    return n || DEFAULT_WA;
  }
  function waUrl(num, msg) { return 'https://wa.me/' + num + (msg ? '?text=' + encodeURIComponent(msg) : ''); }
  function track(source) {
    try { if (window.Shopify && Shopify.analytics && Shopify.analytics.publish) Shopify.analytics.publish('aw_whatsapp_click', { source: source }); } catch (e) {}
    try { if (window.fbq) fbq('track', 'Contact', { content_name: source }); } catch (e) {}
    try { if (window.gtag) gtag('event', 'generate_lead', { method: 'whatsapp', source: source }); } catch (e) {}
    try { if (window.ttq) ttq.track('Contact'); } catch (e) {}
  }

  /* ---------- reveal on scroll ---------- */
  function initReveal(root) {
    var els = $all(root, '[data-aw-reveal]');
    if (!els.length) return;
    if (design || reduced || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
    setTimeout(function () { els.forEach(function (e) { e.classList.add('is-in'); }); }, 6000); // safety net
  }

  /* ---------- count-up numbers ---------- */
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-aw-count')) || 0;
    var dec = parseInt(el.getAttribute('data-aw-dec') || '0', 10);
    if (reduced || design) { el.textContent = to.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }); return; }
    var start = null, dur = 1600;
    function step(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / dur), v = to * (1 - Math.pow(1 - p, 3));
      el.textContent = v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initCounters(root) {
    var els = $all(root, '[data-aw-count]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(countUp); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { countUp(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.4 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- WhatsApp links ---------- */
  function initWa(root) {
    $all(root, '[data-aw-wa]').forEach(function (a) {
      if (a.__aw) return; a.__aw = 1;
      a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener');
      a.href = waUrl(waNumber(a), a.getAttribute('data-aw-msg') || '');
      a.addEventListener('click', function () {
        if (a.hasAttribute('data-aw-calc-cta')) return; // calculator sets its own href
        a.href = waUrl(waNumber(a), a.getAttribute('data-aw-msg') || '');
        track(a.getAttribute('data-aw-wa') || 'link');
      });
    });
  }

  /* ---------- hero card stack ---------- */
  function initHero(root) {
    $all(root, '[data-aw-stack]').forEach(function (stack) {
      var cards = $all(stack, '[data-aw-card]'), n = cards.length;
      if (n < 2) return;
      var order = cards.map(function (_, i) { return i; });
      function paint() { order.forEach(function (ci, pos) { cards[ci].setAttribute('data-pos', pos); }); }
      paint();
      if (stack.__awTimer) clearInterval(stack.__awTimer);
      var paused = false;
      stack.addEventListener('mouseenter', function () { paused = true; });
      stack.addEventListener('mouseleave', function () { paused = false; stack.style.setProperty('--rx', '0deg'); stack.style.setProperty('--ry', '0deg'); });
      stack.addEventListener('click', function () { order.push(order.shift()); paint(); });
      if (!reduced) stack.__awTimer = setInterval(function () { if (!paused && !document.hidden) { order.push(order.shift()); paint(); } }, 3200);
      if (!reduced && matchMedia('(hover: hover)').matches) {
        stack.addEventListener('pointermove', function (e) {
          var r = stack.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          stack.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg');
          stack.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
        });
      }
    });
  }

  /* ---------- portfolio filter + load more ---------- */
  function initGallery(root) {
    $all(root, '[data-aw-gallery]').forEach(function (g) {
      var items = $all(g, '[data-aw-item]');
      var chips = $all(g, '[data-aw-filter]');
      var more = g.querySelector('[data-aw-more]');
      var limit = parseInt(g.getAttribute('data-aw-limit') || '12', 10);
      var cat = 'all', expanded = false;
      function apply() {
        var shown = 0;
        items.forEach(function (it) {
          var match = cat === 'all' || it.getAttribute('data-cat') === cat;
          var visible = match && (expanded || shown < limit);
          if (match && visible) shown++;
          it.hidden = !visible;
        });
        var total = items.filter(function (it) { return cat === 'all' || it.getAttribute('data-cat') === cat; }).length;
        if (more) more.hidden = expanded || total <= limit;
      }
      chips.forEach(function (c) {
        c.addEventListener('click', function () {
          cat = c.getAttribute('data-aw-filter');
          chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
          apply();
        });
      });
      if (more) more.addEventListener('click', function () { expanded = true; apply(); });
      apply();
      items.forEach(function (it) {
        it.addEventListener('click', function (e) {
          e.preventDefault();
          var list = items.filter(function (x) { return !x.hidden; });
          openLb(list, list.indexOf(it), g);
        });
      });
    });
  }

  /* ---------- lightbox ---------- */
  var lb, lbState = { list: [], i: 0, g: null };
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  function buildLb() {
    lb = document.createElement('div');
    lb.className = 'aw-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = '<button class="aw-lb__close" type="button" aria-label="Close">&times;</button>' +
      '<button class="aw-lb__btn aw-lb__prev" type="button" aria-label="Previous">' + ARROW + '</button>' +
      '<figure class="aw-lb__fig"><img class="aw-lb__img" alt=""><figcaption class="aw-lb__cap"><span class="aw-lb__brand"></span><a class="aw-lb__cta" href="#"></a></figcaption></figure>' +
      '<button class="aw-lb__btn aw-lb__next" type="button" aria-label="Next">' + ARROW.replace('M15 18l-6-6 6-6', 'M9 6l6 6-6 6') + '</button>';
    document.body.appendChild(lb);
    lb.querySelector('.aw-lb__close').onclick = closeLb;
    lb.querySelector('.aw-lb__prev').onclick = function () { showLb(lbState.i - 1); };
    lb.querySelector('.aw-lb__next').onclick = function () { showLb(lbState.i + 1); };
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      var rtl = lb.getAttribute('dir') === 'rtl';
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowRight') showLb(lbState.i + (rtl ? -1 : 1));
      if (e.key === 'ArrowLeft') showLb(lbState.i + (rtl ? 1 : -1));
    });
    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx, rtl = lb.getAttribute('dir') === 'rtl';
      if (Math.abs(dx) > 50) showLb(lbState.i + ((dx < 0) !== rtl ? 1 : -1));
      sx = null;
    });
    lb.querySelector('.aw-lb__cta').addEventListener('click', function () { track('lightbox'); });
  }
  function showLb(i) {
    var L = lbState.list; if (!L.length) return;
    lbState.i = (i + L.length) % L.length;
    var it = L[lbState.i], g = lbState.g;
    var img = lb.querySelector('.aw-lb__img');
    img.src = it.getAttribute('data-full') || it.querySelector('img').src;
    img.alt = it.querySelector('img').alt || '';
    var brand = it.getAttribute('data-brand') || '';
    lb.querySelector('.aw-lb__brand').textContent = brand;
    var cta = lb.querySelector('.aw-lb__cta');
    var label = g.getAttribute('data-aw-lb-label');
    cta.hidden = !label;
    if (label) {
      cta.innerHTML = '<span class="aw-wa-ico"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg></span>' + label.replace(/</g, '&lt;');
      var msg = (g.getAttribute('data-aw-lb-msg') || '').split('[brand]').join(brand);
      cta.href = waUrl(waNumber(g), msg); cta.target = '_blank'; cta.rel = 'noopener';
    }
  }
  function openLb(list, i, g) {
    if (!lb) buildLb();
    lbState.list = list; lbState.g = g;
    lb.setAttribute('dir', g.closest('[dir]') ? g.closest('[dir]').getAttribute('dir') : 'ltr');
    showLb(i);
    lb.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    lb.querySelector('.aw-lb__close').focus();
  }
  function closeLb() { lb.classList.remove('is-open'); document.documentElement.style.overflow = ''; }

  /* ---------- price calculator ---------- */
  function initCalc(root) {
    $all(root, '[data-aw-calc]').forEach(function (c) {
      var price = parseFloat(c.getAttribute('data-price')) || 0;
      var edit = parseFloat(c.getAttribute('data-edit')) || 0;
      var dep = (parseFloat(c.getAttribute('data-deposit')) || 50) / 100;
      var max = parseInt(c.getAttribute('data-max') || '100', 10);
      var tpl = c.getAttribute('data-msg') || '';
      var inImg = c.querySelector('[data-aw-in="images"]'), inEd = c.querySelector('[data-aw-in="edits"]');
      var out = function (k) { return c.querySelector('[data-aw-out="' + k + '"]'); };
      var cta = c.querySelector('[data-aw-calc-cta]');
      function clamp(v, lo, hi) { v = parseInt(v, 10); if (isNaN(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }
      function render() {
        var n = clamp(inImg.value, 1, max), e = clamp(inEd.value, 0, 999);
        var total = n * price + e * edit, d = Math.round(total * dep), r = total - d;
        out('total').textContent = fmt(total);
        out('deposit').textContent = fmt(d);
        out('remaining').textContent = fmt(r);
        if (out('images-cost')) out('images-cost').textContent = fmt(n * price);
        if (out('edits-cost')) out('edits-cost').textContent = fmt(e * edit);
        $all(c, '[data-aw-chip]').forEach(function (ch) { ch.setAttribute('aria-pressed', String(parseInt(ch.getAttribute('data-aw-chip'), 10) === n)); });
        var msg = tpl.split('[count]').join(n).split('[edits]').join(e).split('[total]').join(fmt(total))
          .split('[deposit]').join(fmt(d)).split('[remaining]').join(fmt(r));
        if (cta) cta.href = waUrl(waNumber(cta), msg);
        c.classList.remove('aw-bump'); void c.offsetWidth; c.classList.add('aw-bump');
      }
      $all(c, '[data-aw-step]').forEach(function (b) {
        b.addEventListener('click', function () {
          var inp = b.getAttribute('data-aw-target') === 'edits' ? inEd : inImg;
          var lo = inp === inEd ? 0 : 1, hi = inp === inEd ? 999 : max;
          inp.value = clamp((parseInt(inp.value, 10) || 0) + parseInt(b.getAttribute('data-aw-step'), 10), lo, hi);
          render();
        });
      });
      $all(c, '[data-aw-chip]').forEach(function (ch) { ch.addEventListener('click', function () { inImg.value = ch.getAttribute('data-aw-chip'); render(); }); });
      [inImg, inEd].forEach(function (i) { i.addEventListener('input', render); i.addEventListener('blur', function () { i.value = clamp(i.value, i === inEd ? 0 : 1, i === inEd ? 999 : max); render(); }); });
      if (cta) cta.addEventListener('click', function () { track('calculator'); });
      render();
    });
  }

  /* ---------- process timeline progress ---------- */
  var progEls = [];
  function initProgress(root) {
    $all(root, '[data-aw-progress]').forEach(function (el) { if (progEls.indexOf(el) < 0) progEls.push(el); });
    tick();
  }
  function tick() {
    var vh = window.innerHeight;
    progEls.forEach(function (el) {
      if (!el.isConnected) return;
      var r = el.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (vh * 0.75 - r.top) / (r.height || 1)));
      if (reduced || design) p = 1;
      el.style.setProperty('--p', p.toFixed(3));
      var steps = $all(el, '[data-aw-stepitem]');
      steps.forEach(function (s, i) { s.classList.toggle('is-on', p >= (i / steps.length) + 0.02 || p === 1); });
    });
  }

  /* ---------- floating WhatsApp + sticky bar ---------- */
  function initFloat(root) {
    $all(root, '[data-aw-float]').forEach(function (f) {
      var num = f.getAttribute('data-aw-global-num');
      if (num) { window.AW_WA_NUMBER = num; $all(document, '[data-aw-wa]').forEach(function (a) { if (!a.getAttribute('data-aw-num')) a.href = waUrl(waNumber(a), a.getAttribute('data-aw-msg') || ''); }); }
      var after = parseInt(f.getAttribute('data-aw-after') || '0', 10);
      function onScroll() {
        var on = window.scrollY > after || design;
        f.classList.toggle('is-on', on);
        document.documentElement.classList.toggle('aw-bar-on', on && !!f.querySelector('.aw-bar'));
      }
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
      var bubble = f.querySelector('[data-aw-bubble]');
      var delay = parseInt(f.getAttribute('data-aw-bubble-delay') || '0', 10);
      if (bubble && delay > 0 && !design) {
        var seen = false; try { seen = sessionStorage.getItem('aw-bubble') === '1'; } catch (e) {}
        if (!seen) setTimeout(function () { bubble.classList.add('is-on'); }, delay * 1000);
        var x = bubble.querySelector('[data-aw-bubble-x]');
        if (x) x.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); bubble.classList.remove('is-on'); try { sessionStorage.setItem('aw-bubble', '1'); } catch (er) {} });
      }
    });
  }

  /* ---------- FAQ: one open at a time ---------- */
  function initFaq(root) {
    $all(root, '[data-aw-faq]').forEach(function (list) {
      if (list.__aw) return; list.__aw = 1;
      list.addEventListener('toggle', function (e) {
        if (!e.target.matches('details') || !e.target.open) return;
        $all(list, 'details[open]').forEach(function (o) { if (o !== e.target) o.open = false; });
      }, true);
    });
  }

  function init(root) {
    root = root || document;
    initFloat(root); initWa(root); initReveal(root); initCounters(root); initHero(root);
    initGallery(root); initCalc(root); initProgress(root); initFaq(root);
  }

  window.AWARA = { init: init, waUrl: waUrl };
  window.addEventListener('scroll', function () { if (progEls.length) requestAnimationFrame(tick); }, { passive: true });
  window.addEventListener('resize', tick);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
