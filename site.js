(function () {
  'use strict';
  const $  = (q, ctx = document) => ctx.querySelector(q);
  const $$ = (q, ctx = document) => Array.from(ctx.querySelectorAll(q));

  const OPENER_KEY = 'pollock.opener';

  /* ===== NATIVE WEBGL FLUID ENGINE ===== */
  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('fluid-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Fluid wave parameter equations
    let time = 0;
    function animate() {
      time += 0.002; 
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Base background layer — read from the theme so the intro matches the site
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg').trim() || '#FAFAF7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render 3 distinct algorithmic color paths to simulate an organic mesh blend
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        
        let grad = ctx.createRadialGradient(
          canvas.width * (0.3 + Math.sin(time + i * 2) * 0.2),
          canvas.height * (0.4 + Math.cos(time + i * 1.5) * 0.2),
          10,
          canvas.width * (0.3 + Math.sin(time + i * 2) * 0.2),
          canvas.height * (0.4 + Math.cos(time + i * 1.5) * 0.2),
          canvas.width * 0.6
        );

        if (i === 0) {
          grad.addColorStop(0, 'rgba(10, 49, 97, 0.14)');   // Old Glory Blue
          grad.addColorStop(1, 'transparent');
        } else if (i === 1) {
          grad.addColorStop(0, 'rgba(170, 21, 27, 0.11)');  // Spanish flag red
          grad.addColorStop(1, 'transparent');
        } else {
          grad.addColorStop(0, 'rgba(241, 191, 0, 0.09)');  // Spanish flag yellow
          grad.addColorStop(1, 'transparent');
        }

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationFrameId = requestAnimationFrame(animate);
    }
    animate();

    // Clean canvas calculations up when overlay collapses
    window.stopFluidCanvas = function() {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  });

/* ===== SITE INTRO OPENER SYSTEM =====
   Three words, then the lockup, then out of the way — about three seconds in
   total. It plays once per browsing session, is skippable at any point, and is
   bypassed entirely for anyone who prefers reduced motion. */
  document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const opener = $('#site-opener');
    const headlineWrap = $('.opener-headline-wrap');
    const rotator = $('#rotator-words');
    const brandReveal = $('#opener-brand');
    const skipBtn = $('#opener-skip');

    if (!opener || !rotator) return;

    let seen = false;
    try { seen = !!sessionStorage.getItem(OPENER_KEY); } catch (e) {}
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Returning within the session, or reduced motion: straight to the site.
    if (seen || reduce) {
      if (window.stopFluidCanvas) window.stopFluidCanvas();
      opener.remove();
      body.classList.remove('opener-active');
      return;
    }

    body.classList.add('opener-active');
    try { sessionStorage.setItem(OPENER_KEY, '1'); } catch (e) {}

    const timers = [];
    const after = (fn, ms) => timers.push(setTimeout(fn, ms));
    let dismissed = false;

    setTimeout(() => { headlineWrap.style.opacity = '1'; }, 100);

    const wordsCount = rotator.children.length;
    let currentWordIndex = 0;
    const wordStayDuration = 620;

    const getStepHeight = () => rotator.children[0].getBoundingClientRect().height;

    // The frame is only as wide as the word inside it, so a short word does not
    // leave a hole between "for" and "in Spain."
    const rotatorBox = rotator.parentElement;
    function fitRotator(i) {
      const word = rotator.children[i];
      if (!word || !rotatorBox) return;
      const cs = getComputedStyle(rotatorBox);
      const chrome = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
      rotatorBox.style.width = Math.ceil(word.getBoundingClientRect().width + chrome) + 'px';
    }
    fitRotator(0);
    // Re-measure once the webfont is in, so the first frame is not sized to the fallback.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitRotator(currentWordIndex));

    function rotateWords() {
      if (currentWordIndex < wordsCount - 1) {
        currentWordIndex++;
        rotator.style.transform = `translateY(-${currentWordIndex * getStepHeight()}px)`;
        fitRotator(currentWordIndex);
        after(rotateWords, wordStayDuration);
      } else {
        after(triggerBrandReveal, 500);
      }
    }

    function triggerBrandReveal() {
      headlineWrap.style.opacity = '0';
      headlineWrap.style.transform = 'translate(0, -20px)';

      after(() => {
        headlineWrap.style.display = 'none';
        brandReveal.classList.add('is-active');
        after(dismissOpener, 850);
      }, 380);
    }

    function dismissOpener() {
      if (dismissed) return;
      dismissed = true;
      timers.forEach(clearTimeout);
      opener.style.opacity = '0';
      opener.style.pointerEvents = 'none';
      if (window.stopFluidCanvas) window.stopFluidCanvas();

      setTimeout(() => {
        opener.remove();
        body.classList.remove('opener-active');
        window.scrollTo(0, 0);
      }, 520);
    }

    // Failsafe: on a slow connection the timer chain can start late (the font
    // stylesheet is render-blocking). The intro never outstays this cap.
    setTimeout(dismissOpener, 6000);

    // Any deliberate input skips the rest of the intro.
    if (skipBtn) skipBtn.addEventListener('click', dismissOpener);
    opener.addEventListener('click', dismissOpener);
    window.addEventListener('keydown', dismissOpener, { once: true });
    window.addEventListener('wheel', dismissOpener, { once: true, passive: true });
    window.addEventListener('touchstart', dismissOpener, { once: true, passive: true });

    after(rotateWords, wordStayDuration);
  });

  /* ===== THEME ===== */
  const root = document.documentElement;
  const STORAGE_KEYS = { theme: 'pollock.theme', lang: 'pollock.lang', cookies: 'pollock.cookies' };

  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem(STORAGE_KEYS.theme, t); } catch (e) {}
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved) setTheme(saved);
  } catch (e) {}
  $$('[data-theme-toggle]').forEach(btn => btn.addEventListener('click', () => {
    setTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  }));

  /* ===== LANGUAGE ===== */
  function setLang(l) {
    root.setAttribute('lang', l);
    $$('[data-set-lang]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-set-lang') === l ? 'true' : 'false');
    });
    try { localStorage.setItem(STORAGE_KEYS.lang, l); } catch (e) {}
  }
  try {
    const savedLang = localStorage.getItem(STORAGE_KEYS.lang);
    if (savedLang) setLang(savedLang);
  } catch (e) {}
  $$('[data-set-lang]').forEach(btn => btn.addEventListener('click', () => setLang(btn.getAttribute('data-set-lang'))));

  /* ===== NAV scroll state ===== */
  const nav = $('#nav');
  if (nav) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        nav.classList.toggle('is-scrolled', window.scrollY > 8);
        ticking = false;
      });
    }, { passive: true });
  }

  /* ===== Mobile Navigation Menu Interactivity ===== */
  const mobileDrawer = $('#mobile-drawer');
  const mobileOverlay = $('#mobile-overlay');
  const openMenuBtn = $('#menu-toggle-btn');
  const closeMenuBtn = $('#menu-close-btn');

  const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';

  /* Keeps Tab inside an open overlay, so keyboard users cannot wander into the
     inert page behind it. */
  function trapFocus(container, e) {
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, container).filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openDrawer() {
    drawerReturn = document.activeElement;
    mobileDrawer.classList.add('is-open');
    mobileOverlay.classList.add('is-open');
    mobileDrawer.removeAttribute('aria-hidden');
    if (openMenuBtn) openMenuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (closeMenuBtn) closeMenuBtn.focus();
  }

  function closeDrawer() {
    const wasOpen = mobileDrawer.classList.contains('is-open');
    mobileDrawer.classList.remove('is-open');
    mobileOverlay.classList.remove('is-open');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    if (openMenuBtn) openMenuBtn.setAttribute('aria-expanded', 'false');
    if(!document.body.classList.contains('opener-active')) {
      document.body.style.overflow = '';
    }
    if (wasOpen && drawerReturn && document.contains(drawerReturn)) drawerReturn.focus();
    drawerReturn = null;
  }

  let drawerReturn = null;

  if(openMenuBtn && closeMenuBtn && mobileOverlay) {
    mobileDrawer.setAttribute('aria-hidden', 'true');
    openMenuBtn.setAttribute('aria-expanded', 'false');
    openMenuBtn.setAttribute('aria-controls', 'mobile-drawer');
    openMenuBtn.addEventListener('click', openDrawer);
    closeMenuBtn.addEventListener('click', closeDrawer);
    mobileOverlay.addEventListener('click', closeDrawer);
    $$('.mobile-nav-link').forEach(link => link.addEventListener('click', closeDrawer));
    mobileDrawer.addEventListener('keydown', e => trapFocus(mobileDrawer, e));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileDrawer.classList.contains('is-open')) closeDrawer();
    });
  }

  /* ===== Reveal on scroll ===== */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    $$('[data-reveal]').forEach(el => io.observe(el));
  } else {
    $$('[data-reveal]').forEach(el => el.classList.add('is-visible'));
  }

  /* ===== FAQ + generic scoped accordions (.faq-list / [data-accordion]) ===== */
  function syncAccordion(item) {
    const btn = $('[data-faq-q]', item);
    if (btn) btn.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');
  }
  $$('[data-faq-q]').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const list = q.closest('.faq-list, [data-accordion]') || document;
      const wasOpen = item.classList.contains('is-open');
      $$('.faq-item', list).forEach(other => {
        other.classList.remove('is-open');
        syncAccordion(other);
      });
      if (!wasOpen) item.classList.add('is-open');
      syncAccordion(item);
    });
  });

  /* ===== OFFER TABS — persona switcher ===== */
  (function () {
    const tabs = $$('[data-offer-tab]');
    if (!tabs.length) return;

    function select(tab, moveFocus) {
      const key = tab.getAttribute('data-offer-tab');
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
      });
      $$('[data-offer-pane]').forEach(p => {
        p.classList.toggle('is-active', p.getAttribute('data-offer-pane') === key);
      });
      if (moveFocus) tab.focus();
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false));
      // Arrow keys move between tabs, as a tablist is expected to.
      tab.addEventListener('keydown', e => {
        const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (e.key in map) {
          e.preventDefault();
          select(tabs[(i + map[e.key] + tabs.length) % tabs.length], true);
        } else if (e.key === 'Home') {
          e.preventDefault(); select(tabs[0], true);
        } else if (e.key === 'End') {
          e.preventDefault(); select(tabs[tabs.length - 1], true);
        }
      });
    });
  })();

  /* ===== BOOKING CALENDAR (Cal.com) =====
     The embed script is only fetched once someone actually reaches the booking
     step, so no third-party code loads for a visitor who never gets there. */
  const CAL_LINK = 'pollocktax/30min';
  const CAL_NS   = 'discovery';
  let calMounted = false;

  function loadCalEmbed() {
    if (window.Cal) return;
    (function (C, A, L) {
      let p = function (a, ar) { a.q.push(ar); };
      let d = C.document;
      C.Cal = C.Cal || function () {
        let cal = C.Cal, ar = arguments;
        if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; }
        if (ar[0] === L) {
          const api = function () { p(api, arguments); };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); }
          else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, 'https://app.cal.com/embed/embed.js', 'init');
  }

  function mountCalendar() {
    const el = $('#cal-embed');
    if (!el || calMounted) return;
    calMounted = true;
    loadCalEmbed();
    const theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    window.Cal('init', CAL_NS, { origin: 'https://app.cal.com' });
    window.Cal.ns[CAL_NS]('inline', {
      elementOrSelector: '#cal-embed',
      calLink: el.getAttribute('data-cal-link') || CAL_LINK,
      config: { layout: 'month_view' }
    });
    window.Cal.ns[CAL_NS]('ui', { theme: theme, hideEventTypeDetails: false, layout: 'month_view' });
  }

  // Keep the embed in step with the site theme once it is on the page.
  $$('[data-theme-toggle]').forEach(btn => btn.addEventListener('click', () => {
    if (!calMounted || !window.Cal || !window.Cal.ns || !window.Cal.ns[CAL_NS]) return;
    window.Cal.ns[CAL_NS]('ui', { theme: root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light' });
  }));

  /* ===== FORM ===== */
  const form = $('#onboarding-form');
  if (form) {
    const steps = $$('[data-step]', form).filter(s => s.getAttribute('data-step') !== 'success');
    const success = $('[data-step="success"]', form);
    const progress = $$('.form-progress span', form);
    const backBtn = $('[data-form-back]', form);
    const nextBtn = $('[data-form-next]', form);
    const submitBtn = $('[data-form-submit]', form);
    const currentLabel = $('[data-current-step]', form);
    const formNav = $('[data-form-nav]', form);

    const state = {
      step: 1,
      data: {
        firstName: '', email: '', based: '', usStatus: '',
        services: [], timeInSpain: '', visa: '',
        selfEmployed: '', fbarTrigger: '', investments: '', realEstate: '', unfiled: '', notes: ''
      }
    };

    $$('[data-chips]', form).forEach(group => {
      const name = group.getAttribute('data-name');
      const mode = group.getAttribute('data-mode') || 'single';
      $$('.chip', group).forEach(chip => {
        chip.addEventListener('click', () => {
          const value = chip.getAttribute('data-value');
          if (mode === 'single') {
            $$('.chip', group).forEach(c => {
              c.classList.remove('is-selected');
              c.setAttribute('aria-pressed', 'false');
            });
            chip.classList.add('is-selected');
            chip.setAttribute('aria-pressed', 'true');
            state.data[name] = value;
          } else {
            chip.classList.toggle('is-selected');
            chip.setAttribute('aria-pressed', chip.classList.contains('is-selected') ? 'true' : 'false');
            if (!Array.isArray(state.data[name])) state.data[name] = [];
            if (chip.classList.contains('is-selected')) {
              if (!state.data[name].includes(value)) state.data[name].push(value);
            } else {
              state.data[name] = state.data[name].filter(v => v !== value);
            }
          }
        });
      });
    });

    $$('[data-yn]', form).forEach(group => {
      const name = group.getAttribute('data-name');
      $$('button', group).forEach(b => {
        b.addEventListener('click', () => {
          $$('button', group).forEach(bb => bb.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          state.data[name] = b.getAttribute('data-value');
        });
      });
    });

    form.addEventListener('input', e => {
      const t = e.target;
      if (t.matches('.input, .textarea')) {
        const name = t.getAttribute('name');
        if (name) state.data[name] = t.value;
      }
    });

    function showStep(n) {
      state.step = n;
      steps.forEach((s, i) => s.classList.toggle('is-active', i === n - 1));
      progress.forEach((p, i) => p.classList.toggle('is-active', i <= n - 1));
      currentLabel.textContent = String(n);
      backBtn.style.display = n > 1 ? 'inline-flex' : 'none';
      const isLast = n === steps.length;
      nextBtn.style.display = isLast ? 'none' : 'inline-flex';
      submitBtn.style.display = isLast ? 'inline-flex' : 'none';
    }

    nextBtn.addEventListener('click', () => { if (state.step < steps.length) showStep(state.step + 1); });
    backBtn.addEventListener('click', () => { if (state.step > 1) showStep(state.step - 1); });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const isES = root.getAttribute('lang') === 'es';

      const servicesLabels = {
        federal: 'Federal return', fbar: 'FBAR', fatca: 'FATCA / 8938',
        state: 'State return', spanish: 'Spanish IRPF', streamlined: 'Catch-up filings',
        planning: 'Tax planning', se: 'Self-employed', military: 'Military',
        extension: 'Extension', student: 'Student return', sme: 'SME / business', other: 'Other'
      };

      const lines = [
        `New intake: ${state.data.firstName || '(no name)'}`,
        ``,
        `Name: ${state.data.firstName || '—'}`,
        `Email: ${state.data.email || '—'}`,
        ``,
        `Based: ${state.data.based || '—'}`,
        `U.S. status: ${state.data.usStatus || '—'}`,
        `Time in Spain: ${state.data.timeInSpain || '—'}`,
        `Visa/residency: ${state.data.visa || '—'}`,
        ``,
        `Services: ${(state.data.services || []).map(s => servicesLabels[s] || s).join(', ') || '—'}`,
        ``,
        `— Self-employed?  ${state.data.selfEmployed || '—'}`,
        `— FBAR-trigger accounts (>$10k aggregate)?  ${state.data.fbarTrigger || '—'}`,
        `— Investment / brokerage accounts?  ${state.data.investments || '—'}`,
        `— Real estate ownership?  ${state.data.realEstate || '—'}`,
        `— Years of unfiled U.S. returns:  ${state.data.unfiled || '—'}`,
        ``,
        `Notes:`,
        state.data.notes || '—',
        ``,
        `--`,
        `Submitted from pollocktax.com`
      ].join('\n');

      const subject = `New intake: ${state.data.firstName || 'Pollock Tax website'}`;
      const mailto = `mailto:Andy@pollocktax.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;

      // The mailto may be blocked, or the visitor may use webmail, so the same
      // text is always shown on the page for them to copy.
      const summaryEl = $('#intake-summary');
      if (summaryEl) summaryEl.textContent = lines;
      const retry = $('[data-mailto-retry]');
      if (retry) retry.setAttribute('href', mailto);

      window.location.href = mailto;

      steps.forEach(s => s.classList.remove('is-active'));
      success.classList.add('is-visible');
      formNav.style.display = 'none';

      setTimeout(mountCalendar, 400);
    });

    showStep(1);
  }

  /* ===== MAP =====
     The ranked list is the real data; the map is a picture of it. Hovering or
     focusing either side highlights the matching region. */
  (function () {
    const block = $('.map-block');
    if (!block) return;

    const TITLE = {
      en: 'Map of Spain shaded by the share of U.S. nationals living in each autonomous community',
      es: 'Mapa de España sombreado según la proporción de ciudadanos estadounidenses en cada comunidad autónoma'
    };
    const DESC = {
      en: 'Madrid, Catalonia and Andalusia are the darkest, together accounting for about two thirds of the total. The figures are listed beside the map.',
      es: 'Madrid, Cataluña y Andalucía son las más oscuras y suman cerca de dos tercios del total. Las cifras aparecen junto al mapa.'
    };

    function label() {
      const l = root.getAttribute('lang') === 'es' ? 'es' : 'en';
      const t = $('[data-map-title]', block), d = $('[data-map-desc]', block);
      if (t) t.textContent = TITLE[l];
      if (d) d.textContent = DESC[l];
    }
    label();
    $$('[data-set-lang]').forEach(b => b.addEventListener('click', label));

    const regions = $$('[data-region]', block);
    const rows = $$('[data-region-row]', block);

    function highlight(key) {
      block.classList.toggle('is-focusing', !!key);
      regions.forEach(r => r.classList.toggle('is-active', r.getAttribute('data-region') === key));
      rows.forEach(r => r.classList.toggle('is-active', r.getAttribute('data-region-row') === key));
    }

    rows.forEach(row => {
      const key = row.getAttribute('data-region-row');
      ['mouseenter', 'focus'].forEach(ev => row.addEventListener(ev, () => highlight(key)));
      ['mouseleave', 'blur'].forEach(ev => row.addEventListener(ev, () => highlight(null)));
    });
    regions.forEach(region => {
      const key = region.getAttribute('data-region');
      region.addEventListener('mouseenter', () => highlight(key));
      region.addEventListener('mouseleave', () => highlight(null));
    });
  })();

  /* ===== STATS =====
     The figures are already correct in the HTML; this only animates the way
     they arrive. Anything that goes wrong here leaves the printed numbers in
     place, and reduced-motion visitors get them straight away. */
  (function () {
    const grid = $('[data-stats]');
    if (!grid) return;

    const stats = $$('[data-stat-order]', grid);
    const counters = $$('[data-count]', grid).map(el => {
      const final = el.textContent.trim();
      const digits = final.replace(/[^\d]/g, '');
      return {
        el: el,
        final: final,
        target: parseInt(digits, 10),
        // Keep the separator the page already uses rather than imposing a locale.
        sep: (final.match(/[^\d]/) || [''])[0]
      };
    }).filter(c => c.target > 0);

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Only hide the stats once we know the script is running.
    grid.classList.add('is-armed');

    // Reserve the final width so nothing reflows while the digits climb.
    counters.forEach(c => {
      c.el.style.display = 'inline-block';
      c.el.style.minWidth = c.final.length + 'ch';
      c.el.style.fontVariantNumeric = 'tabular-nums';
    });

    function group(n, sep) {
      const s = String(n);
      if (!sep) return s;
      return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    }

    function run() {
      if (reduce) {
        stats.forEach(s => s.classList.add('is-shown'));
        return;
      }

      // The headline figure leads; the others follow it in.
      stats.forEach(s => {
        const order = parseInt(s.getAttribute('data-stat-order'), 10) || 0;
        setTimeout(() => s.classList.add('is-shown'), order * 260);
      });

      counters.forEach((c, i) => {
        const duration = 1500;
        const delay = i * 260;
        const start = performance.now() + delay;
        c.el.textContent = group(0, c.sep);

        function frame(now) {
          const t = (now - start) / duration;
          if (t < 0) { requestAnimationFrame(frame); return; }
          if (t >= 1) { c.el.textContent = c.final; return; }
          // easeOutCubic: quick off the mark, settling gently on the figure
          const eased = 1 - Math.pow(1 - t, 3);
          c.el.textContent = group(Math.round(c.target * eased), c.sep);
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    }

    if (!('IntersectionObserver' in window)) { run(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.disconnect();
        run();
      });
    }, { threshold: 0.35 });
    io.observe(grid);
  })();

  /* ===== COPY TO CLIPBOARD =====
     [data-copy="<selector>"] copies that element's text; [data-copy-text="…"]
     copies a literal string. Falls back to a hidden textarea where the async
     clipboard API is unavailable or blocked, and announces the result. */
  (function () {
    const buttons = $$('[data-copy], [data-copy-text]');
    if (!buttons.length) return;

    let live = $('#copy-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'copy-live';
      live.className = 'visually-hidden';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }

    function legacyCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      return ok;
    }

    async function copy(text) {
      if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
      }
      return legacyCopy(text);
    }

    const MSG = {
      en: { ok: 'Copied to clipboard', fail: 'Copy failed. Select the text and copy it manually.' },
      es: { ok: 'Copiado al portapapeles', fail: 'No se pudo copiar. Selecciona el texto y cópialo a mano.' }
    };

    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const literal = btn.getAttribute('data-copy-text');
        const src = literal !== null ? literal : (($(btn.getAttribute('data-copy')) || {}).textContent || '');
        if (!src.trim()) return;

        const ok = await copy(src);
        const msgs = MSG[root.getAttribute('lang') === 'es' ? 'es' : 'en'];
        live.textContent = ok ? msgs.ok : msgs.fail;

        btn.classList.toggle('is-copied', ok);
        btn.classList.toggle('is-copy-failed', !ok);
        // Select the text so a manual copy is one keystroke away if this failed.
        if (!ok && literal === null) {
          const el = $(btn.getAttribute('data-copy'));
          if (el) {
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            el.focus();
          }
        }
        setTimeout(() => {
          btn.classList.remove('is-copied', 'is-copy-failed');
          live.textContent = '';
        }, 2600);
      });
    });
  })();

  /* ===== MODAL ===== */
  const modal = $('#policy-modal');
  if (modal) {
    let modalReturn = null;
    modal.setAttribute('aria-hidden', 'true');

    function openModal(tab) {
      modalReturn = document.activeElement;
      modal.classList.add('is-open');
      modal.removeAttribute('aria-hidden');
      if (tab) showModalTab(tab);
      document.body.style.overflow = 'hidden';
      const first = $('[data-modal-close]', modal) || $(FOCUSABLE, modal);
      if (first) first.focus();
    }
    function closeModal() {
      const wasOpen = modal.classList.contains('is-open');
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      if(!document.body.classList.contains('opener-active')) {
        document.body.style.overflow = '';
      }
      if (wasOpen && modalReturn && document.contains(modalReturn)) modalReturn.focus();
      modalReturn = null;
    }
    modal.addEventListener('keydown', e => trapFocus(modal, e));
    function showModalTab(tab) {
      $$('[data-modal-tab]', modal).forEach(b => {
        b.setAttribute('aria-pressed', b.getAttribute('data-modal-tab') === tab ? 'true' : 'false');
      });
      $$('[data-modal-pane]', modal).forEach(p => {
        p.classList.toggle('is-active', p.getAttribute('data-modal-pane') === tab);
      });
    }
    $$('[data-modal-open]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); openModal(a.getAttribute('data-modal-open')); });
    });
    $$('[data-modal-close]').forEach(b => b.addEventListener('click', closeModal));
    $$('[data-modal-tab]', modal).forEach(b => {
      b.addEventListener('click', () => showModalTab(b.getAttribute('data-modal-tab')));
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });

    // Policy links on the reference pages arrive here as index.html#privacy etc.
    const POLICY_HASHES = ['privacy', 'cookies', 'ethics', 'terms'];
    function openFromHash() {
      const tab = location.hash.replace('#', '');
      if (POLICY_HASHES.includes(tab)) openModal(tab);
    }
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }

  /* ===== COOKIE BANNER ===== */
  const banner = $('#cookie-banner');
  if (banner) {
    let accepted = false;
    try { accepted = !!localStorage.getItem(STORAGE_KEYS.cookies); } catch (e) {}
    if (!accepted) setTimeout(() => banner.classList.add('is-visible'), 800);
    $$('[data-cookie-action]', banner).forEach(b => {
      b.addEventListener('click', () => {
        try { localStorage.setItem(STORAGE_KEYS.cookies, '1'); } catch (e) {}
        banner.classList.remove('is-visible');
      });
    });
  }

  /* ===== PRICING CALCULATOR =====
     Every figure here is a published flat fee, so the panel behaves like a
     ledger rather than a sales page: line items in, a bundle discount shown
     as its own line, and the a-la-carte figure left visible next to the
     bundled one. The count-up is the only theatre, and it only ever animates
     the way a number that is already decided arrives on screen. */
  (function () {
    const wrap = $('[data-calc]');
    if (!wrap) return;

    /* Launch-year fee schedule. U.S. work is quoted in USD and Spanish work in
       EUR because that is how each side is filed and paid; the two are never
       converted into one another. */
    const FEE = {
      us: { simple: 425, standard: 625, complex: 875,
            fbar: 65, f8938: 65, state: 150, pfic: 175, streamlined: 1450 },
      es: { simple: 150, standard: 220, complex: 320,
            m720: { a: 150, b: 220, c: 320 }, m714: 165, m151: 175, m149: 250 }
    };
    // Published 2026 rates from the larger expat filing services, for context.
    const MARKET = {
      us: { simple: '$400–$565', standard: '$565–$800', complex: '$800–$1,200' },
      es: { simple: '€40–€185', standard: '€150–€250', complex: '€250+' }
    };
    const BUNDLE = { base: 0.10, full: 0.15 };
    const SECOND_RETURN = 0.15;

    const T = {
      usSide:      { en: 'U.S. side',      es: 'Lado americano' },
      esSide:      { en: 'Spanish side',   es: 'Lado español' },
      was:         { en: 'à la carte',     es: 'por separado' },
      calcing:     { en: 'calculating',    es: 'calculando' },
      ready:       { en: 'estimate ready', es: 'estimación lista' },
      tier:        {
        simple:   { en: 'Simple',   es: 'Sencillo' },
        standard: { en: 'Standard', es: 'Estándar' },
        complex:  { en: 'Complex',  es: 'Complejo' }
      },
      f1040:       { en: 'Form 1040',      es: 'Formulario 1040' },
      m100:        { en: 'Modelo 100',     es: 'Modelo 100' },
      second:      { en: 'Second return in the household', es: 'Segunda declaración de la unidad familiar' },
      fbar:        { en: 'FBAR (FinCEN 114)', es: 'FBAR (FinCEN 114)' },
      f8938:       { en: 'Form 8938 (FATCA)', es: 'Formulario 8938 (FATCA)' },
      state:       { en: 'U.S. state return', es: 'Declaración estatal' },
      pfic:        { en: 'Form 8621, foreign funds', es: 'Formulario 8621, fondos extranjeros' },
      streamlined: { en: 'Streamlined catch-up filing', es: 'Regularización Streamlined' },
      m720:        {
        a: { en: 'Modelo 720, up to 10 assets',   es: 'Modelo 720, hasta 10 bienes' },
        b: { en: 'Modelo 720, 11 to 25 assets',   es: 'Modelo 720, de 11 a 25 bienes' },
        c: { en: 'Modelo 720, 26 to 50 assets',   es: 'Modelo 720, de 26 a 50 bienes' }
      },
      m714:        { en: 'Modelo 714, wealth tax', es: 'Modelo 714, patrimonio' },
      m151:        { en: 'Modelo 151, annual Beckham return', es: 'Modelo 151, declaración anual Beckham' },
      m149:        { en: 'Modelo 149, Beckham election', es: 'Modelo 149, opción por el régimen Beckham' },
      bundle:      { en: 'Cross-border bundle', es: 'Paquete transfronterizo' },
      bundleBadge: { en: 'Both sides prepared together', es: 'Ambos lados preparados a la vez' },
      us:          { en: 'United States', es: 'Estados Unidos' },
      es:          { en: 'Spain', es: 'España' },
      noteEstimate: {
        en: 'An estimate at list prices. The fixed fee is agreed in writing after the free discovery call, and nothing changes it without your say-so.',
        es: 'Una estimación a precios de tarifa. El precio cerrado se acuerda por escrito tras la llamada inicial gratuita, y nada lo cambia sin tu visto bueno.'
      },
      noteMarket:  { en: 'Comparable market rate at this level: ', es: 'Tarifa de mercado comparable a este nivel: ' },
      noteVat:     { en: 'Spanish fees are shown before IVA (21%).', es: 'Las tarifas españolas se muestran sin IVA (21%).' },
      noteLoyal:   { en: 'From year two, the base return drops 10% for returning clients.', es: 'A partir del segundo año, la declaración base baja un 10% para clientes que repiten.' },
      openTitle:   { en: 'Let’s work it out on a call.', es: 'Vamos a verlo en una llamada.' },
      openBody:    {
        en: 'Most people cannot tell from the outside which tier their year falls into, and guessing wrong helps nobody. Thirty minutes is usually enough to scope it properly and put a number in writing.',
        es: 'Casi nadie sabe desde fuera en qué tramo cae su año, y equivocarse no ayuda a nadie. Treinta minutos suelen bastar para definirlo bien y poner una cifra por escrito.'
      },
      summaryTitle: { en: 'Pollock Tax — fee estimate', es: 'Pollock Tax — estimación de tarifas' },
      summaryTotal: { en: 'Estimated total', es: 'Total estimado' },
      letsTalk:    { en: 'To be scoped on a call', es: 'Por definir en una llamada' }
    };

    const root = document.documentElement;
    const lang = () => (root.getAttribute('lang') === 'es' ? 'es' : 'en');
    const t = (node) => (node && node[lang()]) || '';

    function money(cur, n) {
      const sym = cur === 'usd' ? '$' : '€';
      return sym + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    const state = {
      scope: 'both',
      tier: 'standard',
      m720band: 'a',
      addons: {
        fbar: true, f8938: false, state: false, pfic: false, streamlined: false,
        m720: false, m714: false, beckham: false, beckham149: false, second: false
      }
    };

    const resultEl   = $('[data-calc-result]');
    const statusEl   = $('[data-calc-status]', resultEl);
    const totalsEl   = $('[data-calc-totals]', resultEl);
    const badgesEl   = $('[data-calc-badges]', resultEl);
    const ledgerEl   = $('[data-calc-ledger]', resultEl);
    const notesEl    = $('[data-calc-notes]', resultEl);
    const summaryEl  = $('#estimate-summary');
    const minibar    = $('[data-calc-minibar]');
    const minibarVal = $('[data-calc-minibar-value]');

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- compute ---- */
    function compute() {
      const usOn = state.scope === 'us' || state.scope === 'both';
      const esOn = state.scope === 'es' || state.scope === 'both';
      const a = state.addons;
      const unsure = state.tier === 'unsure';
      const out = { unsure: unsure, usOn: usOn, esOn: esOn, us: null, es: null, pct: 0 };
      if (unsure) return out;

      const tierKey = state.tier;

      if (usOn) {
        const items = [];
        items.push({ label: t(T.f1040) + ' — ' + t(T.tier[tierKey]), amount: FEE.us[tierKey] });
        if (a.second) items.push({ label: t(T.second) + ' (−15%)', amount: Math.round(FEE.us[tierKey] * (1 - SECOND_RETURN)) });
        if (a.fbar)        items.push({ label: t(T.fbar), amount: FEE.us.fbar });
        if (a.f8938)       items.push({ label: t(T.f8938), amount: FEE.us.f8938 });
        if (a.state)       items.push({ label: t(T.state), amount: FEE.us.state });
        if (a.pfic)        items.push({ label: t(T.pfic), amount: FEE.us.pfic });
        if (a.streamlined) items.push({ label: t(T.streamlined), amount: FEE.us.streamlined });
        out.us = { cur: 'usd', items: items, list: items.reduce((s, i) => s + i.amount, 0) };
      }

      if (esOn) {
        const items = [];
        const base = a.beckham ? FEE.es.m151 : FEE.es[tierKey];
        items.push(a.beckham
          ? { label: t(T.m151), amount: FEE.es.m151 }
          : { label: t(T.m100) + ' — ' + t(T.tier[tierKey]), amount: FEE.es[tierKey] });
        if (a.beckham && a.beckham149) items.push({ label: t(T.m149), amount: FEE.es.m149 });
        if (a.second) items.push({ label: t(T.second) + ' (−15%)', amount: Math.round(base * (1 - SECOND_RETURN)) });
        if (a.m720) items.push({ label: t(T.m720[state.m720band]), amount: FEE.es.m720[state.m720band] });
        if (a.m714) items.push({ label: t(T.m714), amount: FEE.es.m714 });
        out.es = { cur: 'eur', items: items, list: items.reduce((s, i) => s + i.amount, 0) };
      }

      /* The bundle is the whole point of a Spain-based practice preparing both
         sides: one set of facts, entered once. It deepens when the foreign-asset
         reporting is in scope on both sides too. */
      if (usOn && esOn) {
        const bothReported = (a.fbar || a.f8938) && (a.m720 || a.m714);
        out.pct = bothReported ? BUNDLE.full : BUNDLE.base;
      }

      ['us', 'es'].forEach(k => {
        const side = out[k];
        if (!side) return;
        side.discount = Math.round(side.list * out.pct);
        side.total = side.list - side.discount;
      });

      out.market = [];
      if (usOn) out.market.push(MARKET.us[tierKey]);
      if (esOn && !a.beckham) out.market.push(MARKET.es[tierKey]);
      return out;
    }

    /* ---- number count-up ---- */
    const shown = {};
    function countTo(el, key, cur, target) {
      const from = typeof shown[key] === 'number' ? shown[key] : target;
      shown[key] = target;
      if (reduce || from === target) { el.textContent = money(cur, target); return; }
      const start = performance.now();
      const dur = 520;
      (function frame(now) {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = money(cur, from + (target - from) * eased);
        if (p < 1) requestAnimationFrame(frame);
      })(start);
    }

    /* ---- render ---- */
    function render(animate) {
      const r = compute();
      const L = lang();

      resultEl.classList.toggle('is-open-ended', r.unsure);
      totalsEl.classList.toggle('calc-totals--two', !r.unsure && r.usOn && r.esOn);

      badgesEl.innerHTML = '';
      ledgerEl.innerHTML = '';
      notesEl.innerHTML = '';

      if (r.unsure) {
        totalsEl.innerHTML =
          '<div><p class="calc-openended-title">' + t(T.openTitle) + '</p>' +
          '<p class="calc-openended-body">' + t(T.openBody) + '</p></div>';
        $('.calc-ledger-wrap', resultEl).hidden = true;
        summaryEl.textContent = t(T.summaryTitle) + '\n' + t(T.letsTalk);
        if (minibarVal) minibarVal.textContent = t(T.letsTalk);
        setStatus(animate);
        return;
      }
      $('.calc-ledger-wrap', resultEl).hidden = false;

      /* Totals. The à-la-carte figure stays on screen next to the bundled one
         rather than being quietly replaced by it. */
      const blocks = [];
      if (r.usOn) blocks.push({ key: 'us', label: t(T.usSide), side: r.us });
      if (r.esOn) blocks.push({ key: 'es', label: t(T.esSide), side: r.es });

      totalsEl.innerHTML = blocks.map(b =>
        '<div class="calc-total"><span class="calc-total-label">' + b.label + '</span>' +
        '<span class="calc-total-value" data-total="' + b.key + '">' + money(b.side.cur, b.side.total) + '</span>' +
        (b.side.discount > 0
          ? '<span class="calc-total-was"><s>' + money(b.side.cur, b.side.list) + '</s> ' + t(T.was) + '</span>'
          : '') +
        '</div>'
      ).join('');

      blocks.forEach(b => {
        const el = $('[data-total="' + b.key + '"]', totalsEl);
        if (el) countTo(el, b.key, b.side.cur, b.side.total);
      });

      if (r.pct > 0) {
        badgesEl.innerHTML =
          '<span class="calc-badge">' + t(T.bundle) + ' −' + Math.round(r.pct * 100) + '%</span>' +
          '<span class="calc-badge" style="border-color:var(--line);background:transparent;color:var(--ink-3)">' +
          t(T.bundleBadge) + '</span>';
      }

      // Ledger
      const rows = [];
      blocks.forEach(b => {
        if (blocks.length > 1) {
          rows.push('<li style="color:var(--ink-4);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;padding-top:12px">' +
            '<span>' + (b.key === 'us' ? t(T.us) : t(T.es)) + '</span><span></span></li>');
        }
        b.side.items.forEach(it => {
          rows.push('<li><span>' + it.label + '</span><span class="amt">' + money(b.side.cur, it.amount) + '</span></li>');
        });
        if (b.side.discount > 0) {
          rows.push('<li class="is-discount"><span>' + t(T.bundle) + ' −' + Math.round(r.pct * 100) + '%</span>' +
            '<span class="amt">−' + money(b.side.cur, b.side.discount) + '</span></li>');
        }
      });
      ledgerEl.innerHTML = rows.join('');
      if (!reduce) {
        $$('li', ledgerEl).forEach((li, i) => { li.style.animationDelay = (i * 26) + 'ms'; });
      }

      // Notes
      const notes = ['<p class="calc-note">' + t(T.noteEstimate) + '</p>'];
      if (r.market.length) {
        notes.push('<p class="calc-note">' + t(T.noteMarket) + '<strong>' + r.market.join(' · ') + '</strong></p>');
      }
      if (r.esOn) notes.push('<p class="calc-note">' + t(T.noteVat) + '</p>');
      notes.push('<p class="calc-note">' + t(T.noteLoyal) + '</p>');
      notesEl.innerHTML = notes.join('');

      // Plain-text version, for the copy button and for pasting into an email.
      const lines = [t(T.summaryTitle), ''];
      blocks.forEach(b => {
        lines.push((b.key === 'us' ? t(T.us) : t(T.es)).toUpperCase());
        b.side.items.forEach(it => lines.push('  ' + it.label + '  ' + money(b.side.cur, it.amount)));
        if (b.side.discount > 0) {
          lines.push('  ' + t(T.bundle) + ' −' + Math.round(r.pct * 100) + '%  −' + money(b.side.cur, b.side.discount));
        }
        lines.push('  ' + t(T.summaryTotal) + ': ' + money(b.side.cur, b.side.total));
        lines.push('');
      });
      lines.push(t(T.noteEstimate));
      summaryEl.textContent = lines.join('\n');

      if (minibarVal) {
        minibarVal.textContent = blocks.map(b => money(b.side.cur, b.side.total)).join('  +  ');
      }
      setStatus(animate);
    }

    let statusTimer = null;
    function setStatus(animate) {
      if (!statusEl) return;
      if (!animate || reduce) { statusEl.textContent = t(T.ready); return; }
      resultEl.classList.remove('is-calculating');
      void resultEl.offsetWidth;           // restart the sweep on every change
      resultEl.classList.add('is-calculating');
      statusEl.textContent = t(T.calcing) + '…';
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        resultEl.classList.remove('is-calculating');
        statusEl.textContent = t(T.ready);
      }, 560);
    }

    /* ---- the inputs ---- */
    function syncTierPrices() {
      const usOn = state.scope === 'us' || state.scope === 'both';
      const esOn = state.scope === 'es' || state.scope === 'both';
      ['simple', 'standard', 'complex'].forEach(k => {
        const el = $('[data-tier-price="' + k + '"]');
        if (!el) return;
        const parts = [];
        if (usOn) parts.push(money('usd', FEE.us[k]));
        if (esOn) parts.push(money('eur', state.addons.beckham ? FEE.es.m151 : FEE.es[k]));
        el.textContent = parts.join(' · ');
      });
    }

    function syncGroups() {
      const usOn = state.scope === 'us' || state.scope === 'both';
      const esOn = state.scope === 'es' || state.scope === 'both';
      const g = k => $('[data-addon-group="' + k + '"]');
      if (g('us')) g('us').hidden = !usOn;
      if (g('es')) g('es').hidden = !esOn;
      const sub720 = $('[data-subchoice="m720"]');
      if (sub720) sub720.hidden = !(esOn && state.addons.m720);
      const subB = $('[data-subchoice="beckham"]');
      if (subB) subB.hidden = !(esOn && state.addons.beckham);
      const amt720 = $('[data-addon-amount="m720"]');
      if (amt720) amt720.textContent = money('eur', FEE.es.m720[state.m720band]);
    }

    function update() {
      syncGroups();
      syncTierPrices();
      render(true);
    }

    // Radio groups: scope, tier, Modelo 720 asset band.
    $$('[data-calc-group]', wrap).forEach(group => {
      const name = group.getAttribute('data-calc-group');
      const opts = $$('[role="radio"]', group);
      function select(opt, moveFocus) {
        opts.forEach(o => {
          const on = o === opt;
          o.setAttribute('aria-checked', on ? 'true' : 'false');
          o.setAttribute('tabindex', on ? '0' : '-1');
        });
        state[name] = opt.getAttribute('data-value');
        update();
        if (moveFocus) opt.focus();
      }
      opts.forEach((opt, i) => {
        opt.setAttribute('tabindex', opt.getAttribute('aria-checked') === 'true' ? '0' : '-1');
        opt.addEventListener('click', () => select(opt, false));
        opt.addEventListener('keydown', e => {
          const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
          if (e.key in map) {
            e.preventDefault();
            select(opts[(i + map[e.key] + opts.length) % opts.length], true);
          }
        });
      });
    });

    $$('[data-addon]', wrap).forEach(input => {
      const key = input.getAttribute('data-addon');
      input.checked = !!state.addons[key];
      input.addEventListener('change', () => {
        state.addons[key] = input.checked;
        // The Modelo 149 election only exists inside the Beckham regime.
        if (key === 'beckham' && !input.checked) {
          state.addons.beckham149 = false;
          const sub = $('[data-addon="beckham149"]', wrap);
          if (sub) sub.checked = false;
        }
        update();
      });
    });

    /* Running total on phones, where the card sits below the controls. */
    if (minibar && 'IntersectionObserver' in window) {
      let cardVisible = true, sectionVisible = false;
      const paint = () => {
        minibar.hidden = false;
        minibar.classList.toggle('is-visible', sectionVisible && !cardVisible);
      };
      new IntersectionObserver(e => { cardVisible = e[0].isIntersecting; paint(); },
        { threshold: 0.15 }).observe(resultEl);
      new IntersectionObserver(e => { sectionVisible = e[0].isIntersecting; paint(); },
        { threshold: 0 }).observe($('.calc-section'));
      const jump = $('[data-calc-minibar-jump]');
      if (jump) jump.addEventListener('click', () => resultEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }));
    }

    // The language toggle rewrites nothing inside the card, so redraw it here.
    new MutationObserver(() => render(false)).observe(root, { attributes: true, attributeFilter: ['lang'] });

    syncGroups();
    syncTierPrices();
    render(false);
  })();

  /* ===== YEAR ===== */
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

})();
