/* aminabubakar.com shared behaviour. No build step, no dependencies. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  root.classList.remove('no-js');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* ---------- navigation ---------- */
  var toggle = doc.querySelector('.nav-toggle');
  var links = doc.querySelector('.nav-links');
  if (toggle && links) {
    var setNav = function (open) {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    toggle.addEventListener('click', function () { setNav(!links.classList.contains('open')); });
    all('a', links).forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });
  }

  /* ---------- reveal on scroll ---------- */
  var reveals = all('.reveal');
  if (reveals.length) {
    if ('IntersectionObserver' in window && !reduceMotion) {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      reveals.forEach(function (el) { ro.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('in'); });
    }
  }

  /* ---------- side rail: highlight the section in view ---------- */
  var railLinks = all('.rail a[href^="#"]');
  if (railLinks.length) {
    var targets = railLinks.map(function (a) { return doc.getElementById(a.getAttribute('href').slice(1)); });
    var setActive = function (i) {
      railLinks.forEach(function (a, j) { a.classList.toggle('is-active', i === j); });
    };
    var onScroll = function () {
      var line = window.innerHeight * 0.3;
      var current = 0;
      targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top <= line) current = i; });
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    railLinks.forEach(function (a, i) {
      a.addEventListener('click', function () {
        var t = targets[i];
        if (t && t.tagName === 'DETAILS') t.open = true;
      });
    });
    if (location.hash) {
      var hashed = doc.getElementById(location.hash.slice(1));
      if (hashed && hashed.tagName === 'DETAILS') hashed.open = true;
    }
  }

  /* ---------- gallery filter ---------- */
  var filters = all('.filter[data-filter]');
  var shots = all('.shot[data-cat]');
  if (filters.length && shots.length) {
    filters.forEach(function (btn) {
      var key = btn.getAttribute('data-filter');
      var count = btn.querySelector('i');
      if (count) {
        count.textContent = key === 'all' ? shots.length : shots.filter(function (s) { return s.getAttribute('data-cat') === key; }).length;
      }
      btn.addEventListener('click', function () {
        filters.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        shots.forEach(function (s) {
          var show = key === 'all' || s.getAttribute('data-cat') === key;
          s.hidden = !show;
          if (show) s.classList.add('in');
        });
      });
    });
  }

  /* ---------- lightbox (images and YouTube) ---------- */
  var modal = doc.getElementById('lightbox');
  if (modal) {
    var stage = modal.querySelector('.modal-stage');
    var text = modal.querySelector('.modal-text');
    var lastFocus = null;
    var close = function () {
      modal.classList.remove('open');
      stage.innerHTML = '';
      text.innerHTML = '';
      doc.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };
    var open = function (trigger) {
      var shot = trigger.closest('.shot');
      var video = trigger.getAttribute('data-video');
      lastFocus = trigger;
      if (video) {
        var frame = doc.createElement('iframe');
        frame.src = 'https://www.youtube.com/embed/' + encodeURIComponent(video) + '?autoplay=1';
        frame.allow = 'autoplay; encrypted-media; picture-in-picture';
        frame.allowFullscreen = true;
        frame.title = trigger.getAttribute('aria-label') || 'Video';
        stage.appendChild(frame);
      } else {
        var img = doc.createElement('img');
        var src = trigger.querySelector('img');
        img.src = trigger.getAttribute('data-full') || (src && src.getAttribute('src'));
        img.alt = src ? src.alt : '';
        stage.appendChild(img);
      }
      if (shot) {
        var h = shot.querySelector('h3');
        var cap = shot.querySelector('.shot-cap');
        if (h) text.appendChild(h.cloneNode(true));
        if (cap) text.appendChild(cap.cloneNode(true));
      }
      modal.classList.add('open');
      doc.body.style.overflow = 'hidden';
      modal.querySelector('.modal-close').focus();
    };
    all('[data-lightbox]').forEach(function (el) {
      el.addEventListener('click', function () { open(el); });
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('.modal-close')) close();
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
  }

  /* ---------- hero: interactive vector field ----------
     A grid of needles lines up with the field of two slowly orbiting
     charges. The cursor acts as a third charge, so the field bends
     toward wherever the pointer is. */
  var canvas = doc.getElementById('field');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var hero = canvas.parentNode;
    var W = 0, H = 0, dpr = 1, gap = 38;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0, q: 0, tq: 0 };
    var running = false, visible = true, raf = 0, t0 = 0;

    var resize = function () {
      var r = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      gap = W < 700 ? 30 : 38;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!pointer.x && !pointer.y) { pointer.x = pointer.tx = W * 0.7; pointer.y = pointer.ty = H * 0.4; }
    };

    var draw = function (time) {
      var t = time / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.07;
      pointer.y += (pointer.ty - pointer.y) * 0.07;
      pointer.q += (pointer.tq - pointer.q) * 0.05;

      var sources = [
        { x: W * (0.72 + 0.16 * Math.cos(t * 0.11)), y: H * (0.34 + 0.2 * Math.sin(t * 0.13)), q: 1 },
        { x: W * (0.42 + 0.2 * Math.cos(t * 0.07 + 2)), y: H * (0.72 + 0.16 * Math.sin(t * 0.09 + 1)), q: -1 },
        { x: pointer.x, y: pointer.y, q: 1.6 * pointer.q }
      ];

      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';
      var cols = Math.ceil(W / gap) + 1, rows = Math.ceil(H / gap) + 1;
      var ox = (W - (cols - 1) * gap) / 2, oy = (H - (rows - 1) * gap) / 2;
      var soft = 90 * 90, reach = 260;

      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var x = ox + i * gap, y = oy + j * gap, ex = 0, ey = 0;
          for (var k = 0; k < 3; k++) {
            var s = sources[k], dx = x - s.x, dy = y - s.y, d2 = dx * dx + dy * dy + soft;
            var f = s.q * 9000 / (d2 * Math.sqrt(d2));
            ex += dx * f; ey += dy * f;
          }
          var mag = Math.sqrt(ex * ex + ey * ey);
          if (mag < 1e-6) continue;
          var ux = ex / mag, uy = ey / mag;
          var strength = Math.min(1, mag * 2.2);
          var pdx = x - pointer.x, pdy = y - pointer.y;
          var near = Math.max(0, 1 - Math.sqrt(pdx * pdx + pdy * pdy) / reach) * pointer.q;
          var len = 5 + 7 * strength + 4 * near;
          var alpha = 0.07 + 0.2 * strength + 0.5 * near;
          ctx.strokeStyle = near > 0.02
            ? 'rgba(79,209,197,' + alpha.toFixed(3) + ')'
            : 'rgba(214,222,232,' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 1 + 0.6 * near;
          ctx.beginPath();
          ctx.moveTo(x - ux * len, y - uy * len);
          ctx.lineTo(x + ux * len, y + uy * len);
          ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.beginPath();
          ctx.arc(x + ux * len, y + uy * len, 1.1 + 0.9 * near, 0, 6.2832);
          ctx.fill();
        }
      }
    };

    var loop = function (now) {
      if (!running) return;
      draw(now - t0);
      raf = requestAnimationFrame(loop);
    };
    var start = function () {
      if (running || reduceMotion || !visible || doc.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    var stop = function () { running = false; cancelAnimationFrame(raf); };

    resize();
    t0 = (window.performance && performance.now()) || 0;
    draw(40000);
    window.addEventListener('resize', function () { resize(); if (!running) draw(40000); });

    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = hero.getBoundingClientRect();
      pointer.tx = e.clientX - r.left;
      pointer.ty = e.clientY - r.top;
      pointer.tq = 1;
    });
    hero.addEventListener('pointerleave', function () { pointer.tq = 0; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(hero);
    }
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else start(); });
    start();
  }
})();
