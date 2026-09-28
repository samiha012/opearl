/* OPearl — shared behaviour */
(function () {
  // TODO: replace with the real EdTech platform URL and inquiry email before launch.
  var CONFIG = {
    platformUrl: 'https://academy.example.com/',
    email: 'info@example.com'
  };

  var root = document.documentElement;

  /* ---- language ---- */
  var langButtons = document.querySelectorAll('[data-set-lang]');
  function setLang(lang) {
    if (lang !== 'ja' && lang !== 'en') return;
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    var t = root.getAttribute('data-title-' + lang);
    if (t) document.title = t;
    langButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)); });
    try { localStorage.setItem('opearl-lang', lang); } catch (e) { }
  }
  var initial = new URLSearchParams(location.search).get('lang');
  if (!initial) { try { initial = localStorage.getItem('opearl-lang'); } catch (e) { } }
  setLang(initial || 'ja');
  langButtons.forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.dataset.setLang); });
  });

  /* ---- mobile menu ---- */
  var header = document.querySelector('header.site');
  var toggle = document.querySelector('.nav-toggle');
  if (header && toggle) {
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---- services dropdown ---- */
  document.querySelectorAll('.has-drop').forEach(function (d) {
    var btn = d.querySelector('.drop-toggle');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = d.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function () {
      d.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { d.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  });

  /* ---- links to the EdTech platform (open in a new tab) ---- */
  document.querySelectorAll('[data-platform]').forEach(function (a) {
    a.href = CONFIG.platformUrl + (a.dataset.platform || '');
    a.target = '_blank';
    a.rel = 'noopener';
  });

  /* ---- email ---- */
  document.querySelectorAll('[data-email]').forEach(function (a) {
    a.href = 'mailto:' + CONFIG.email;
    if (!a.textContent.trim()) a.textContent = CONFIG.email;
  });

  /* ---- hero carousel ---- */
  var car = document.querySelector('.hero-carousel');
  if (car) {
    var slides = car.querySelectorAll('.slide');
    var dotsWrap = car.querySelector('.car-dots');
    var count = car.querySelector('.car-count');
    var pauseBtn = car.querySelector('[data-car="pause"]');
    var MS = 6000;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var idx = 0, timer = null, userPaused = reduce;
    car.style.setProperty('--car-ms', MS + 'ms');

    var dots = [];
    slides.forEach(function (s, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', 'Slide ' + (i + 1));
      d.addEventListener('click', function () { go(i); restart(); });
      dotsWrap.appendChild(d);
      dots.push(d);
    });

    function go(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        var on = i === idx;
        s.classList.toggle('is-active', on);
        s.setAttribute('aria-hidden', String(!on));
        if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
      });
      dots.forEach(function (d, i) {
        // re-trigger the progress animation on the active dot
        d.removeAttribute('aria-current');
        if (i === idx) { void d.offsetWidth; d.setAttribute('aria-current', 'true'); }
      });
      if (count) count.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
    }
    function stop() { clearInterval(timer); timer = null; car.classList.add('paused'); }
    function start() {
      if (userPaused) return;
      stop(); car.classList.remove('paused');
      timer = setInterval(function () { go(idx + 1); }, MS);
    }
    function restart() { if (!userPaused) { start(); go(idx); } }

    car.querySelector('[data-car="prev"]').addEventListener('click', function () { go(idx - 1); restart(); });
    car.querySelector('[data-car="next"]').addEventListener('click', function () { go(idx + 1); restart(); });
    function syncPause() {
      pauseBtn.setAttribute('aria-pressed', String(userPaused));
      pauseBtn.querySelector('.i-pause').style.display = userPaused ? 'none' : '';
      pauseBtn.querySelector('.i-play').style.display = userPaused ? '' : 'none';
    }
    pauseBtn.addEventListener('click', function () {
      userPaused = !userPaused; syncPause();
      if (userPaused) stop(); else { start(); go(idx); }
    });
    car.addEventListener('mouseenter', stop);
    car.addEventListener('mouseleave', start);
    car.addEventListener('focusin', stop);
    car.addEventListener('focusout', function (e) { if (!car.contains(e.relatedTarget)) start(); });
    car.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { go(idx - 1); }
      if (e.key === 'ArrowRight') { go(idx + 1); }
    });

    syncPause();
    go(0);
    if (userPaused) car.classList.add('paused'); else start();
  }

  /* ---- contact form ---- */
  var form = document.querySelector('form.inquiry');
  if (form) {
    var type = new URLSearchParams(location.search).get('type');
    var select = form.querySelector('select[name="type"]');
    if (type && select && select.querySelector('option[value="' + type + '"]')) select.value = type;

    // TODO: connect to a form backend that emails CONFIG.email and sends the sender a confirmation.
    // Until then, submitting opens the visitor's mail app with the message filled in.
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var f = form.elements;
      var typeLabel = select.options[select.selectedIndex].text;
      var body = [
        'Name: ' + f.name.value,
        'Company: ' + (f.company.value || '-'),
        'Email: ' + f.email.value,
        'Inquiry type: ' + typeLabel,
        '',
        f.message.value
      ].join('\n');
      location.href = 'mailto:' + CONFIG.email +
        '?subject=' + encodeURIComponent('[OPearl] ' + typeLabel) +
        '&body=' + encodeURIComponent(body);
      var status = form.querySelector('.form-status');
      if (status) status.hidden = false;
    });
  }
})();
