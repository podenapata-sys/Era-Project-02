/* PlumbPro — interactions. No dependencies. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Sticky header shadow ---------- */
  var header = document.getElementById('siteHeader');
  function onScroll() {
    header.classList.toggle('is-stuck', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav ---------- */
  var navToggle = document.getElementById('navToggle');
  var nav = document.getElementById('primaryNav');

  function setNav(open) {
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  navToggle.addEventListener('click', function () {
    setNav(navToggle.getAttribute('aria-expanded') !== 'true');
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a') && window.matchMedia('(max-width: 1024px)').matches) setNav(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      setNav(false);
      closeMenus();
    }
  });

  /* ---------- Services dropdown ---------- */
  var menuParents = Array.prototype.slice.call(document.querySelectorAll('.has-menu'));

  function closeMenus(except) {
    menuParents.forEach(function (li) {
      if (li === except) return;
      li.classList.remove('is-open');
      var btn = li.querySelector('.nav__link--menu');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  menuParents.forEach(function (li) {
    var btn = li.querySelector('.nav__link--menu');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = !li.classList.contains('is-open');
      closeMenus(li);
      li.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.has-menu')) closeMenus();
  });

  /* ---------- Active section highlighting ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__link[href^="#"]'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { sectionObserver.observe(s); });
  }

  /* ---------- FAQ accordion ---------- */
  var accordion = document.querySelector('.accordion');
  if (accordion) {
    var triggers = Array.prototype.slice.call(accordion.querySelectorAll('.accordion__trigger'));
    triggers.forEach(function (trigger) {
      trigger.addEventListener('click', function () {
        var open = trigger.getAttribute('aria-expanded') !== 'true';
        triggers.forEach(function (other) {
          var panel = document.getElementById(other.getAttribute('aria-controls'));
          var isThis = other === trigger;
          other.setAttribute('aria-expanded', String(isThis && open));
          other.closest('.accordion__item').classList.toggle('is-open', isThis && open);
          if (panel) panel.hidden = !(isThis && open);
        });
      });
    });
    triggers[0].click();
  }

  /* ---------- Testimonial carousel ---------- */
  var carousel = document.querySelector('.carousel');
  if (carousel) {
    var track = carousel.querySelector('.carousel__track');
    var cards = Array.prototype.slice.call(track.children);
    var dotsWrap = document.querySelector('.carousel__dots');
    var page = 0;

    function perPage() {
      if (window.matchMedia('(max-width: 760px)').matches) return 1;
      if (window.matchMedia('(max-width: 1024px)').matches) return 2;
      return 3;
    }

    function pageCount() {
      return Math.max(1, Math.ceil(cards.length / perPage()));
    }

    function render() {
      var per = perPage();
      page = Math.min(page, pageCount() - 1);
      var first = cards[page * per];
      var offset = first ? first.offsetLeft - cards[0].offsetLeft : 0;
      track.style.transform = 'translateX(' + -offset + 'px)';

      Array.prototype.slice.call(dotsWrap.children).forEach(function (dot, i) {
        dot.setAttribute('aria-selected', String(i === page));
      });
      cards.forEach(function (card, i) {
        var visible = i >= page * per && i < page * per + per;
        card.setAttribute('aria-hidden', String(!visible));
      });
    }

    function buildDots() {
      dotsWrap.innerHTML = '';
      for (var i = 0; i < pageCount(); i++) {
        (function (index) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.setAttribute('role', 'tab');
          dot.setAttribute('aria-selected', 'false');
          dot.setAttribute('aria-label', 'Show testimonials ' + (index + 1));
          dot.addEventListener('click', function () { page = index; render(); });
          dotsWrap.appendChild(dot);
        })(i);
      }
    }

    function go(delta) {
      var total = pageCount();
      page = (page + delta + total) % total;
      render();
    }

    carousel.querySelector('.carousel__nav--prev').addEventListener('click', function () { go(-1); });
    carousel.querySelector('.carousel__nav--next').addEventListener('click', function () { go(1); });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { buildDots(); render(); }, 150);
    });

    buildDots();
    render();

    if (!reduceMotion) {
      var timer = setInterval(function () { go(1); }, 7000);
      ['mouseenter', 'focusin'].forEach(function (evt) {
        carousel.addEventListener(evt, function () { clearInterval(timer); });
      });
    }
  }

  /* ---------- Scroll reveal ----------
     A rAF-throttled sweep rather than an IntersectionObserver: IO samples at
     frame boundaries, so fast scrolling or an in-page anchor jump can skip an
     element entirely and leave it stuck at opacity 0. The sweep re-checks every
     still-hidden element on each scroll frame, so nothing is ever left behind. */
  var pending = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  function revealAll() {
    pending.forEach(function (el) { el.classList.add('is-visible'); });
    pending = [];
  }

  if (reduceMotion) {
    revealAll();
  } else {
    var sweepQueued = false;

    function sweep() {
      sweepQueued = false;
      var limit = window.innerHeight * 0.92;
      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top >= limit) return true;
        el.classList.add('is-visible');
        return false;
      });
      if (!pending.length) {
        window.removeEventListener('scroll', queueSweep);
        window.removeEventListener('resize', queueSweep);
      }
    }

    function queueSweep() {
      if (sweepQueued || !pending.length) return;
      sweepQueued = true;
      requestAnimationFrame(sweep);
    }

    window.addEventListener('scroll', queueSweep, { passive: true });
    window.addEventListener('resize', queueSweep);
    window.addEventListener('load', queueSweep);
    sweep();
  }

  /* ---------- Animated stat counters ---------- */
  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        countObserver.unobserve(el);
        var target = parseInt(el.getAttribute('data-count'), 10);
        var suffix = el.getAttribute('data-suffix') || '';
        var start = performance.now();
        var duration = 1400;
        (function tick(now) {
          var p = Math.min(1, (now - start) / duration);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        })(start);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { countObserver.observe(el); });
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
