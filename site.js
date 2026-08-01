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

      // Base background layer
      ctx.fillStyle = '#FAFAF7';
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

    const getStepHeight = () => rotator.children[0].offsetHeight;

    function rotateWords() {
      if (currentWordIndex < wordsCount - 1) {
        currentWordIndex++;
        rotator.style.transform = `translateY(-${currentWordIndex * getStepHeight()}px)`;
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

  function openDrawer() {
    mobileDrawer.classList.add('is-open');
    mobileOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    mobileDrawer.classList.remove('is-open');
    mobileOverlay.classList.remove('is-open');
    if(!document.body.classList.contains('opener-active')) {
      document.body.style.overflow = '';
    }
  }

  if(openMenuBtn && closeMenuBtn && mobileOverlay) {
    openMenuBtn.addEventListener('click', openDrawer);
    closeMenuBtn.addEventListener('click', closeDrawer);
    mobileOverlay.addEventListener('click', closeDrawer);
    $$('.mobile-nav-link').forEach(link => link.addEventListener('click', closeDrawer));
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
  $$('[data-faq-q]').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const list = q.closest('.faq-list, [data-accordion]') || document;
      const wasOpen = item.classList.contains('is-open');
      $$('.faq-item', list).forEach(other => other.classList.remove('is-open'));
      if (!wasOpen) item.classList.add('is-open');
    });
  });

  /* ===== OFFER TABS — persona switcher ===== */
  $$('[data-offer-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.getAttribute('data-offer-tab');
      $$('[data-offer-tab]').forEach(t => {
        t.setAttribute('aria-pressed', t === tab ? 'true' : 'false');
      });
      $$('[data-offer-pane]').forEach(p => {
        p.classList.toggle('is-active', p.getAttribute('data-offer-pane') === key);
      });
    });
  });

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
            $$('.chip', group).forEach(c => c.classList.remove('is-selected'));
            chip.classList.add('is-selected');
            state.data[name] = value;
          } else {
            chip.classList.toggle('is-selected');
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
        `New intake — ${state.data.firstName || '(no name)'}`,
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

      const subject = `New intake — ${state.data.firstName || 'Pollock Tax website'}`;
      const mailto = `mailto:Andy@pollocktax.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;

      window.location.href = mailto;

      steps.forEach(s => s.classList.remove('is-active'));
      success.classList.add('is-visible');
      formNav.style.display = 'none';

      setTimeout(() => {
        const embedEl = $('#calendly-embed');
        if (embedEl && window.Calendly && typeof window.Calendly.initInlineWidget === 'function') {
          embedEl.innerHTML = '';
          window.Calendly.initInlineWidget({
            url: embedEl.getAttribute('data-url'),
            parentElement: embedEl
          });
        }
      }, 400);
    });

    showStep(1);
  }

  /* ===== MODAL ===== */
  const modal = $('#policy-modal');
  if (modal) {
    function openModal(tab) {
      modal.classList.add('is-open');
      if (tab) showModalTab(tab);
      document.body.style.overflow = 'hidden';
    }
    function closeModal() {
      modal.classList.remove('is-open');
      if(!document.body.classList.contains('opener-active')) {
        document.body.style.overflow = '';
      }
    }
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
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

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

  /* ===== YEAR ===== */
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

})();
