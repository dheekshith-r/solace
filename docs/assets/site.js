// Solace landing: stars, reveals, the breathing orb and the mood check-in.
// Everything here is optional: without it, every section shows its complete picture.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const SVGNS = 'http://www.w3.org/2000/svg';

  // Stars: seeded, so the sky is the same on every visit.
  document.querySelectorAll('[data-stars]').forEach((g) => {
    let seed = Number(g.dataset.seed) || 1;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const n = Number(g.dataset.stars), h = Number(g.dataset.h);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', (rnd() * 1440).toFixed(1));
      c.setAttribute('cy', (rnd() * h).toFixed(1));
      c.setAttribute('r', (rnd() * 1.5 + 0.4).toFixed(2));
      c.setAttribute('opacity', (rnd() * 0.55 + 0.3).toFixed(2));
      if (i % 7 === 0) c.setAttribute('class', 'tw');
      frag.appendChild(c);
    }
    g.appendChild(frag);
  });

  document.documentElement.dataset.ready = '1';

  // Reveal once when near the viewport.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add(e.target.classList.contains('reveal') ? 'in' : 'in-view');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -15% 0px' });
    document.querySelectorAll('.reveal, .pair').forEach((el) => io.observe(el));
  } else {
    document.documentElement.classList.remove('js');
  }

  // Radio groups made of buttons: click or arrow keys, one tab stop.
  function radioGroup(group, onChange) {
    const items = [...group.querySelectorAll('[role="radio"]')];
    const select = (el, focus) => {
      items.forEach((b) => { const on = b === el; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      if (focus) el.focus();
      onChange(el);
    };
    items.forEach((b) => {
      b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
      b.addEventListener('click', () => select(b, false));
      b.addEventListener('keydown', (ev) => {
        const i = items.indexOf(b);
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
        if (!step) return;
        ev.preventDefault();
        select(items[(i + step + items.length) % items.length], true);
      });
    });
  }

  // Breathe: the app's three patterns, four rounds each.
  const PATTERNS = {
    calm: [['in', 'Breathe in', 4], ['hold', 'Hold', 4], ['out', 'Breathe out', 6]],
    box: [['in', 'Breathe in', 4], ['hold', 'Hold', 4], ['out', 'Breathe out', 4], ['hold', 'Hold', 4]],
    sleep: [['in', 'Breathe in', 4], ['hold', 'Hold', 7], ['out', 'Breathe out', 8]],
  };
  const ROUNDS = 4;
  document.querySelectorAll('[data-breathe]').forEach((root) => {
    const orb = root.querySelector('.orb');
    const label = root.querySelector('[data-label]');
    const count = root.querySelector('[data-count]');
    const round = root.querySelector('[data-round]');
    const toggle = root.querySelector('[data-toggle]');
    let pattern = 'calm', timer = null, step = 0, r = 1, left = 0, running = false;

    const scaleFor = (kind) => (kind === 'in' ? 1 : kind === 'out' ? 0.55 : null);
    const setOrb = (kind, seconds) => {
      const s = scaleFor(kind);
      if (s === null) return; // hold: stay where the breath left it
      orb.style.transitionDuration = reduce.matches ? '0ms' : `${seconds}s`;
      orb.style.transform = `scale(${reduce.matches ? 0.78 : s})`;
    };
    const show = () => {
      const [kind, text, secs] = PATTERNS[pattern][step];
      label.textContent = text;
      count.textContent = String(left);
      round.textContent = `Round ${r} of ${ROUNDS}`;
      if (left === secs) setOrb(kind, secs);
    };
    const reset = (msg) => {
      clearInterval(timer); timer = null; running = false;
      step = 0; r = 1; left = 0;
      orb.style.transitionDuration = '600ms'; orb.style.transform = 'scale(.55)';
      label.textContent = msg; count.textContent = ''; round.textContent = '';
      toggle.textContent = 'Start';
    };
    const tick = () => {
      left -= 1;
      if (left <= 0) {
        step += 1;
        if (step >= PATTERNS[pattern].length) { step = 0; r += 1; }
        if (r > ROUNDS) { reset('Well done. That was four rounds.'); return; }
        left = PATTERNS[pattern][step][2];
      }
      show();
    };
    const start = () => {
      if (left === 0) { step = 0; r = 1; left = PATTERNS[pattern][0][2]; show(); }
      else { // resume: finish the current phase from where the orb stopped
        const s = scaleFor(PATTERNS[pattern][step][0]);
        if (s !== null && !reduce.matches) { orb.style.transitionDuration = `${left}s`; orb.style.transform = `scale(${s})`; }
      }
      running = true; toggle.textContent = 'Pause';
      timer = setInterval(tick, 1000);
    };
    const pause = () => {
      clearInterval(timer); timer = null; running = false; toggle.textContent = 'Resume';
      const now = getComputedStyle(orb).transform; // freeze the orb where it is
      orb.style.transitionDuration = '0ms'; orb.style.transform = now;
    };
    toggle.addEventListener('click', () => (running ? pause() : start()));
    radioGroup(root.querySelector('.patterns'), (b) => {
      if (b.dataset.pattern === pattern) return; // same pattern: keep the session going
      pattern = b.dataset.pattern; reset('Ready when you are');
    });
    // Stop when the visitor scrolls away or leaves the tab: a timer nobody sees helps nobody.
    document.addEventListener('visibilitychange', () => { if (document.hidden && running) pause(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { if (!e.isIntersecting && running) pause(); }).observe(root);
    }
  });

  // Mood: Sola's mouth follows the face the visitor taps.
  const MOUTHS = {
    1: 'M92 126 Q100 115 108 126',
    2: 'M93 124 Q100 119 107 124',
    3: 'M93 122 Q100 122 107 122',
    4: 'M93 121 Q100 127 107 121',
    5: 'M91 119 Q100 132 109 119',
  };
  document.querySelectorAll('[data-mood]').forEach((root) => {
    const mouth = root.querySelector('.mouth');
    radioGroup(root.querySelector('.moods'), (b) => {
      const d = MOUTHS[b.dataset.m];
      mouth.setAttribute('d', d);
      mouth.style.d = `path("${d}")`; // lets the CSS transition on d morph the mouth where supported
    });
  });
})();
