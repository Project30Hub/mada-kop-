// ═══════════════════════════════════════
// MADAKOP – SCRIPT.JS
// ═══════════════════════════════════════

// ── AGE GATE ──
function enterSite() {
  document.getElementById('ageGate').classList.add('hidden');
  sessionStorage.setItem('mk_age_verified', 'true');
}
window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('mk_age_verified') === 'true') {
    const gate = document.getElementById('ageGate');
    if (gate) gate.classList.add('hidden');
  }
});

// ── SMOKE PUFFS ──
window.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('smokeWrap');
  if (!wrap) return;
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'puff';
    const s = 80 + Math.random() * 200;
    p.style.cssText = `width:${s}px;height:${s}px;left:${Math.random()*100}%;animation-duration:${14+Math.random()*18}s;animation-delay:${-Math.random()*25}s;`;
    wrap.appendChild(p);
  }
});

// ── NAV SCROLL ──
window.addEventListener('scroll', () => {
  const nav = document.getElementById('nav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
});

// ── MOBILE MENU ──
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('open');
}

// ── PRODUCT CATEGORY FILTER ──
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      document.querySelectorAll('.prod-card').forEach(card => {
        card.classList.toggle('hidden', cat !== 'all' && card.dataset.cat !== cat);
      });
    });
  });
});

// ── ADD TO BAG ──
function addToBag(btn) {
  const original = btn.textContent;
  btn.textContent = '✓ Added!';
  btn.classList.add('added');
  const toast = document.getElementById('bagToast');
  if (toast) {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('added');
  }, 2000);
}

// ── TUTORIAL STEP SWITCHER ──
function showStep(n) {
  document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('step-' + n);
  const btn = document.querySelectorAll('.step-btn')[n - 1];
  if (el) el.classList.add('active');
  if (btn) btn.classList.add('active');
}

// ── TUTORIAL SKILL FILTER ──
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.skill-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.skill-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lvl = btn.dataset.lvl;
      document.querySelectorAll('.tut-card').forEach(card => {
        card.classList.toggle('hidden', lvl !== 'all' && card.dataset.lvl !== lvl);
      });
    });
  });
});

// ── SCROLL REVEAL (simple) ──
window.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.animation = 'fadeUp .5s ease both';
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.prod-card, .about-card, .member-benefit, .rule-card, .tut-card').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
});
