/* ═══════════════════════════════════════════════════════════════
   EMEL Solutions — main.js
   Scroll-reveal, active nav, neural network canvas animation
   ═══════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────
   1. SCROLL REVEAL
────────────────────────────────────────────────────────────── */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target); // animate once
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach((el) => {
  revealObserver.observe(el);
});


/* ──────────────────────────────────────────────────────────────
   2. ACTIVE NAV HIGHLIGHTING (Intersection-based)
────────────────────────────────────────────────────────────── */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.glass-nav__link');

function setActiveNav(id) {
  navLinks.forEach((link) => {
    const href = link.getAttribute('href').replace('#', '');
    link.classList.toggle('active', href === id);
  });
}

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        setActiveNav(entry.target.id);
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
);

sections.forEach((sec) => sectionObserver.observe(sec));


/* ──────────────────────────────────────────────────────────────
   3. SMOOTH SCROLL for nav links
────────────────────────────────────────────────────────────── */
navLinks.forEach((link) => {
  link.addEventListener('click', (e) => {
    const targetId = link.getAttribute('href');
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});


/* ──────────────────────────────────────────────────────────────
   4. NEURAL NETWORK CANVAS (Section 3)
   Animated particle & connection graph representing AI
────────────────────────────────────────────────────────────── */
(function initNeuralNet() {
  const canvas = document.getElementById('neuralCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;

  /* Node definition */
  const LAYER_X = [60, 170, 280, 390, 480];
  const LAYER_COUNTS = [4, 6, 6, 4, 2];
  const COLOURS = {
    node:       '#4f8ef7',
    nodeAlt:    '#7b61ff',
    nodeOut:    '#06d6a0',
    conn:       'rgba(79,142,247,0.18)',
    connActive: 'rgba(79,142,247,0.7)',
    pulse:      '#4f8ef7',
  };

  /* Build nodes */
  const nodes = [];
  LAYER_X.forEach((x, layerIdx) => {
    const count = LAYER_COUNTS[layerIdx];
    const spread = count * 28;
    for (let i = 0; i < count; i++) {
      const y = H / 2 - spread / 2 + i * (spread / (count - 1 || 1));
      nodes.push({
        x,
        y,
        layer: layerIdx,
        idx: i,
        r: 5,
        pulse: 0,
        pulseDir: 1,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        colour:
          layerIdx === LAYER_X.length - 1
            ? COLOURS.nodeOut
            : layerIdx % 2 === 0
            ? COLOURS.node
            : COLOURS.nodeAlt,
      });
    }
  });

  /* Build connections (each layer to next) */
  const connections = [];
  for (let l = 0; l < LAYER_X.length - 1; l++) {
    const layerA = nodes.filter((n) => n.layer === l);
    const layerB = nodes.filter((n) => n.layer === l + 1);
    layerA.forEach((a) => {
      layerB.forEach((b) => {
        connections.push({ a, b, progress: Math.random(), active: Math.random() > 0.55 });
      });
    });
  }

  /* Travelling pulses along active connections */
  const pulses = [];
  function spawnPulse() {
    const active = connections.filter((c) => c.active);
    if (active.length === 0) return;
    const conn = active[Math.floor(Math.random() * active.length)];
    pulses.push({ conn, t: 0, speed: 0.008 + Math.random() * 0.012 });
  }
  for (let i = 0; i < 8; i++) spawnPulse();

  /* Animation loop */
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* Draw connections */
    connections.forEach((c) => {
      ctx.beginPath();
      ctx.moveTo(c.a.x, c.a.y);
      ctx.lineTo(c.b.x, c.b.y);
      ctx.strokeStyle = c.active ? COLOURS.connActive : COLOURS.conn;
      ctx.lineWidth = c.active ? 1 : 0.5;
      ctx.stroke();
    });

    /* Draw pulses */
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += p.speed;
      if (p.t >= 1) {
        pulses.splice(i, 1);
        spawnPulse();
        continue;
      }
      const px = p.conn.a.x + (p.conn.b.x - p.conn.a.x) * p.t;
      const py = p.conn.a.y + (p.conn.b.y - p.conn.a.y) * p.t;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, 8);
      grad.addColorStop(0, 'rgba(79,142,247,0.95)');
      grad.addColorStop(1, 'rgba(79,142,247,0)');
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }

    /* Draw nodes */
    nodes.forEach((n) => {
      n.pulse += n.pulseSpeed * n.pulseDir;
      if (n.pulse >= 1 || n.pulse <= 0) n.pulseDir *= -1;
      const glow = 6 + n.pulse * 8;

      // Outer glow
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glow + 4);
      grad.addColorStop(0, n.colour + 'cc');
      grad.addColorStop(1, n.colour + '00');
      ctx.beginPath();
      ctx.arc(n.x, n.y, glow + 4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.colour;
      ctx.fill();

      // White centre
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
    });

    /* Periodically toggle active connections to simulate "thinking" */
    if (frame % 90 === 0) {
      connections.forEach((c) => {
        if (Math.random() > 0.7) c.active = !c.active;
      });
    }

    frame++;
    requestAnimationFrame(draw);
  }

  draw();
})();


/* ──────────────────────────────────────────────────────────────
   5. WORDPRESS SIDEBAR ANIMATION (JS-driven cycling)
────────────────────────────────────────────────────────────── */
(function initWpAnim() {
  const menuItems = document.querySelectorAll('.wp-menu-item');
  const submenu   = document.getElementById('wp-submenu');
  const subItems  = document.querySelectorAll('.wp-submenu-item');

  const sequence = [
    { activeMenu: 'wpm-plugins', openSub: true,  highlightSub: 0 },
    { activeMenu: 'wpm-plugins', openSub: true,  highlightSub: 1 },
    { activeMenu: 'wpm-pages',   openSub: false, highlightSub: -1 },
    { activeMenu: 'wpm-appearance', openSub: false, highlightSub: -1 },
    { activeMenu: 'wpm-plugins', openSub: true,  highlightSub: 0 },
  ];

  let step = 0;

  function applyStep() {
    const s = sequence[step % sequence.length];

    // Reset all menu items
    menuItems.forEach((m) => m.classList.remove('wp-menu-item--active'));

    // Activate the target menu item
    const target = document.getElementById(s.activeMenu);
    if (target) target.classList.add('wp-menu-item--active');

    // Show / hide submenu
    if (submenu) {
      submenu.style.maxHeight = s.openSub ? '120px' : '0';
      submenu.style.opacity   = s.openSub ? '1' : '0';
    }

    // Highlight submenu item
    subItems.forEach((si, idx) => {
      si.classList.toggle('wp-submenu-item--highlight', idx === s.highlightSub);
    });

    step++;
  }

  applyStep();
  setInterval(applyStep, 2200);
})();


/* ──────────────────────────────────────────────────────────────
   6. NAV GLASS: subtle shadow on scroll
────────────────────────────────────────────────────────────── */
const nav = document.getElementById('main-nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 80) {
    nav.classList.add('glass-nav--scrolled');
  } else {
    nav.classList.remove('glass-nav--scrolled');
  }
}, { passive: true });
