/* ═══════════════════════════════════════════════════════════════════════════
   STAR WARS PORTFOLIO · app.js  (v2)
   ─────────────────────────────────────────────────────────────────────────
   Cambios respecto a v1:
   ✦ Timeline: tarjeta bloquea el fondo con overlay (igual que ProjectDetail)
   ✦ Ordenamiento ASC / DESC en Timeline y en Projects
   ✦ Scrollbar de la timeline con estilo Star Wars (via CSS variables)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   UTILIDAD: parseDateToNum
   Convierte una cadena de fecha en un número comparable.
   Soporta: "Ago 2020", "Ene 2025 – Jul 2025", "2026", "Mar 2023", etc.
   ───────────────────────────────────────────────────────────────────────── */
const MONTH_MAP = {
  ene:1, feb:2, mar:3, abr:4, may:5, jun:6,
  jul:7, ago:8, sep:9, oct:10, nov:11, dic:12,
};

function parseDateToNum(dateStr) {
  // Si hay un rango ("Ene 2025 – Jul 2025") toma solo la primera fecha
  const part   = dateStr.split('–')[0].trim().toLowerCase();
  const tokens = part.split(/\s+/);

  let year  = null;
  let month = 1;

  tokens.forEach(t => {
    const y = parseInt(t, 10);
    if (!isNaN(y) && y > 1900) { year = y; return; }
    if (MONTH_MAP[t]) month = MONTH_MAP[t];
  });

  if (!year) year = 2000; // fallback si no se pudo parsear
  return new Date(year, month - 1, 1).getTime();
}


/* ─────────────────────────────────────────────────────────────────────────────
   1. STARFIELD — canvas animado de fondo
   ───────────────────────────────────────────────────────────────────────── */
const StarField = (() => {
  const canvas = document.getElementById('starfield');
  const ctx    = canvas.getContext('2d');

  let stars = [], width = 0, height = 0;

  function resize() {
    width  = canvas.width  = window.innerWidth;
    height = canvas.height = window.innerHeight;
    buildStars();
  }

  function buildStars() {
    const count = Math.floor((width * height) / 3500);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,  y: Math.random() * height,
      r: Math.random() * 1.5 + 0.3,
      speed:   Math.random() * 0.18 + 0.02,
      opacity: Math.random() * 0.7 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    stars.forEach(s => {
      s.twinkle += 0.012;
      const alpha = s.opacity * (0.6 + 0.4 * Math.sin(s.twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
      ctx.fill();
      s.y += s.speed;
      if (s.y > height + 2) { s.y = -2; s.x = Math.random() * width; }
    });
    requestAnimationFrame(draw);
  }

  function init() {
    resize();
    window.addEventListener('resize', resize);
    draw();
  }

  return { init };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   2. DATA — fetch de data.json
   ───────────────────────────────────────────────────────────────────────── */
const Data = (() => {
  async function load() {
    const url = './data.json';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
    return res.json();
  }
  return { load };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   3. NAVBAR — burger toggle
   ───────────────────────────────────────────────────────────────────────── */
const Navbar = (() => {
  const navbar   = document.getElementById('navbar');
  const burger   = document.getElementById('navBurger');
  const navLinks = navbar.querySelector('.nav-links');

  function init(name) {
    document.getElementById('nav-name').textContent = name || 'Portfolio';
    burger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
    });
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('open'))
    );
  }

  return { init };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   4. INTRO — foto, nombre, bio, LinkedIn
   ───────────────────────────────────────────────────────────────────────── */
const Intro = (() => {
  function init(data) {
    const photo = document.getElementById('profilePhoto');
    if (data.photo) { photo.src = data.photo; photo.alt = `Foto de ${data.name}`; }

    const liOverlay = document.getElementById('linkedinOverlay');
    if (data.linkedinUrl) liOverlay.href = data.linkedinUrl;

    const nameEl = document.getElementById('introName');
    nameEl.textContent  = data.name || 'Dev Skywalker';
    nameEl.dataset.text = data.name || 'Dev Skywalker';

    document.getElementById('introBio').textContent = data.intro || '';
  }
  return { init };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   5. TIMELINE
   ─────────────────────────────────────────────────────────────────────────
   NUEVO: backdrop de bloqueo + ordenamiento ASC / DESC
   ───────────────────────────────────────────────────────────────────────── */
const Timeline = (() => {
  // ── DOM refs ─────────────────────────────────────────────────────────────
  const track    = document.getElementById('timelineTrack');
  const card     = document.getElementById('timelineCard');
  const closeBtn = document.getElementById('tlCardClose');
  const tlDate   = document.getElementById('tlDate');
  const tlTitle  = document.getElementById('tlTitle');
  const tlDesc   = document.getElementById('tlDesc');
  const tlLink   = document.getElementById('tlLink');

  let activeNode = null;   // nodo activo
  let sortDir    = 'asc';  // orden actual
  let rawItems   = [];     // datos originales

  // ── Construcción del inner track (se llama en init y en cada re-sort) ────
  function buildTrack(items) {
    const oldInner = track.querySelector('.timeline-inner');
    if (oldInner) oldInner.remove();

    const inner = document.createElement('div');
    inner.className = 'timeline-inner';

    items.forEach((item, i) => {
      const node = document.createElement('div');
      node.className = 'tl-node';
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', item.title);

      const dot = document.createElement('div');
      dot.className = 'tl-dot';
      // Cicla el delay entre 0-7 para no acumular retrasos enormes
      dot.style.animationDelay = `${(i % 8) * 0.35}s`;

      const label = document.createElement('span');
      label.className   = 'tl-dot-label';
      label.textContent = item.date.split('–')[0].trim();

      node.append(dot, label);

      const openCard = () => showCard(item, node);
      node.addEventListener('click', openCard);
      node.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(); }
      });

      inner.appendChild(node);
    });

    track.appendChild(inner);
  }

  // ── Mostrar tarjeta ───────────────────────────────────────────────────────
  function showCard(item, node) {
    // Toggle: mismo nodo → cierra
    if (activeNode === node && !card.classList.contains('hidden')) {
      hideCard();
      return;
    }
    activeNode = node;

    tlDate.textContent  = item.date;
    tlTitle.textContent = item.title;
    tlDesc.textContent  = item.description || '';

    if (item.link) {
      tlLink.href = item.link;
      tlLink.classList.remove('hidden');
    } else {
      tlLink.classList.add('hidden');
    }

    // Muestra la tarjeta inline (sin overlay ni scroll-lock)
    card.classList.remove('hidden');
    // Scroll suave hasta la tarjeta para que sea visible sin buscarla
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }

  // ── Ocultar tarjeta ───────────────────────────────────────────────────────
  function hideCard() {
    card.classList.add('hidden');
    activeNode = null;
  }

  // ── Barra de ordenamiento ─────────────────────────────────────────────────
  function buildSortBar(section) {
    const bar = document.createElement('div');
    bar.className = 'sort-bar';
    bar.innerHTML = `
      <span class="sort-label"><i class="ri-sort-asc"></i> Ordenar:</span>
      <button class="sort-btn active" data-dir="asc" title="Del evento más antiguo al más reciente">
        <span class="sort-icon">▲</span> Más antiguo
      </button>
      <button class="sort-btn" data-dir="desc" title="Del evento más reciente al más antiguo">
        <span class="sort-icon">▼</span> Más reciente
      </button>
    `;

    bar.addEventListener('click', e => {
      const btn = e.target.closest('.sort-btn');
      if (!btn || btn.dataset.dir === sortDir) return;

      sortDir = btn.dataset.dir;
      bar.querySelectorAll('.sort-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.dir === sortDir)
      );

      buildTrack(sortItems(rawItems, sortDir));
      hideCard(); // cierra tarjeta abierta si existía
    });

    // Inserta la barra justo antes del track de la línea de tiempo
    section.insertBefore(bar, track);
  }

  // ── Ordenamiento ──────────────────────────────────────────────────────────
  function sortItems(items, dir) {
    return [...items].sort((a, b) => {
      const ta = parseDateToNum(a.date);
      const tb = parseDateToNum(b.date);
      return dir === 'asc' ? ta - tb : tb - ta;
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(items) {
    rawItems = items;

    const section = document.getElementById('timeline');
    buildSortBar(section);
    buildTrack(sortItems(rawItems, sortDir));

    // Mueve la tarjeta al interior de la sección (flujo normal del DOM),
    // justo después del track, para que aparezca debajo de la línea de tiempo.
    section.appendChild(card);

    // Botón × de la tarjeta
    closeBtn.addEventListener('click', hideCard);

    // ESC cierra la tarjeta
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !card.classList.contains('hidden')) hideCard();
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   6. PROJECTS — tarjetas con filtro + ordenamiento ASC/DESC
   ─────────────────────────────────────────────────────────────────────────
   NUEVO: barra de ordenamiento. Usa el índice original del JSON (_idx)
   como referencia cronológica (el array va de más antiguo a más reciente
   según el orden en que el autor los añadió al JSON).
   ───────────────────────────────────────────────────────────────────────── */
const Projects = (() => {
  const grid      = document.getElementById('projectsGrid');
  const filterBar = document.getElementById('filterBar');

  let allProjects   = [];
  let currentFilter = 'all';
  let sortDir       = 'desc'; // proyectos: por defecto más reciente primero

  // ── Categorías ────────────────────────────────────────────────────────────
  function gatherCategories(projects) {
    const cats = new Set();
    projects.forEach(p => p.category.forEach(c => cats.add(c)));
    return [...cats].sort();
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  function buildFilters(categories) {
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className      = 'filter-btn';
      btn.dataset.filter = cat;
      btn.textContent    = cat;
      filterBar.appendChild(btn);
    });

    filterBar.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderGrid();
    });
  }

  // ── Barra de ordenamiento ─────────────────────────────────────────────────
  function buildSortBar() {
    const section = document.getElementById('projects');
    const bar = document.createElement('div');
    bar.className = 'sort-bar';
    bar.innerHTML = `
      <span class="sort-label"><i class="ri-sort-asc"></i> Ordenar:</span>
      <button class="sort-btn" data-dir="asc" title="Del proyecto más antiguo al más reciente">
        <span class="sort-icon">▲</span> Más antiguo
      </button>
      <button class="sort-btn active" data-dir="desc" title="Del proyecto más reciente al más antiguo">
        <span class="sort-icon">▼</span> Más reciente
      </button>
    `;

    bar.addEventListener('click', e => {
      const btn = e.target.closest('.sort-btn');
      if (!btn || btn.dataset.dir === sortDir) return;
      sortDir = btn.dataset.dir;
      bar.querySelectorAll('.sort-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.dir === sortDir)
      );
      renderGrid();
    });

    // Inserta antes del filterBar (que ya existe en el HTML)
    section.insertBefore(bar, filterBar);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderGrid() {
    // Ordena por índice original
    const sorted = [...allProjects].sort((a, b) =>
      sortDir === 'asc' ? a._idx - b._idx : b._idx - a._idx
    );

    // Filtra por categoría
    const visible = currentFilter === 'all'
      ? sorted
      : sorted.filter(p => p.category.includes(currentFilter));

    grid.innerHTML = '';
    visible.forEach(p => grid.appendChild(createCard(p)));
  }

  // ── Tarjeta ───────────────────────────────────────────────────────────────
  function createCard(project) {
    const card = document.createElement('article');
    card.className          = 'project-card';
    card.dataset.id         = project.id;
    card.dataset.categories = project.category.join(',');

    const badges = project.category
      .map(c => `<span class="cat-badge">${c}</span>`)
      .join('');

    card.innerHTML = `
      <img src="${project.thumb}" alt="${project.title}" loading="lazy" />
      <div class="project-card-overlay">
        <div class="project-cat-badges">${badges}</div>
        <h3 class="project-title">${project.title}</h3>
        <p class="project-short">${project.shortDesc}</p>
        <button class="project-more-btn"
                data-id="${project.id}"
                aria-label="Más información sobre ${project.title}">
          Más información
        </button>
      </div>
    `;

    return card;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init(projects) {
    // Añade _idx = índice del array original (orden cronológico del autor)
    allProjects = projects.map((p, i) => ({ ...p, _idx: i }));

    buildSortBar();

    const categories = gatherCategories(projects);
    buildFilters(categories);

    renderGrid();

    // Delegación de eventos → "Más información"
    grid.addEventListener('click', e => {
      const btn = e.target.closest('.project-more-btn');
      if (!btn) return;
      const project = allProjects.find(p => p.id === btn.dataset.id);
      if (project) ProjectDetail.open(project);
    });
  }

  return { init };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   7. PROJECT DETAIL — modal holográfico (sin cambios de lógica)
   ───────────────────────────────────────────────────────────────────────── */
const ProjectDetail = (() => {
  const overlay  = document.getElementById('projectDetailOverlay');
  const panel    = document.getElementById('projectDetailPanel');
  const closeBtn = document.getElementById('pdClose');
  const pdRole   = document.getElementById('pdRole');
  const pdTitle  = document.getElementById('pdTitle');
  const pdMedia  = document.getElementById('pdMedia');
  const pdDesc   = document.getElementById('pdDesc');
  const pdTech   = document.getElementById('pdTech');

  let isOpen = false, currentId = null;

  function buildMedia(p) {
    if (p.mediaType === 'youtube')
      return `<iframe src="https://www.youtube.com/embed/${p.mediaSrc}?rel=0&modestbranding=1"
        title="${p.title}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>`;
    return `<img src="${p.mediaSrc}" alt="${p.title}" loading="lazy" />`;
  }

  function buildTech(arr) {
    return arr.map(t => `<span class="tech-badge">${t}</span>`).join('');
  }

  function inject(p, cb) {
    pdRole.textContent  = p.role;
    pdTitle.textContent = p.title;
    pdMedia.innerHTML   = buildMedia(p);
    pdDesc.textContent  = p.fullDesc;
    pdTech.innerHTML    = buildTech(p.tech);
    if (cb) cb();
  }

  function showSpinner() {
    pdMedia.innerHTML = `<div class="pd-processing"><div class="spinner"></div><span>Procesando datos…</span></div>`;
    pdRole.textContent = pdTitle.textContent = '…';
    pdDesc.textContent = ''; pdTech.innerHTML = '';
  }

  function open(p) {
    if (isOpen && currentId === p.id) return;
    currentId = p.id;

    if (!isOpen) {
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      isOpen = true;
      inject(p, () => panel.classList.add('fade-in'));
      panel.addEventListener('animationend', () => panel.classList.remove('fade-in'), { once: true });
    } else {
      showSpinner();
      setTimeout(() => {
        inject(p, () => {
          panel.classList.add('fade-in');
          panel.addEventListener('animationend', () => panel.classList.remove('fade-in'), { once: true });
        });
      }, 600);
    }
  }

  function close() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    isOpen = false; currentId = null;
    pdMedia.innerHTML = '';
  }

  function init() {
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) close(); });
  }

  return { init, open };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   8. CONTACT
   ───────────────────────────────────────────────────────────────────────── */
const Contact = (() => {
  function init(data) {
    const envelope = document.getElementById('envelopeBtn');
    if (data.email) {
      envelope.addEventListener('click', () => { window.location.href = `mailto:${data.email}`; });
      envelope.style.cursor = 'pointer';
      envelope.title = `Enviar correo a ${data.email}`;
    }
    const waLink = document.getElementById('waLink');
    if (data.whatsappUrl) waLink.href = data.whatsappUrl;
  }
  return { init };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   9. FOOTER
   ───────────────────────────────────────────────────────────────────────── */
const Footer = (() => {
  function init(name) {
    document.getElementById('footerYear').textContent = new Date().getFullYear();
    document.getElementById('footerName').textContent = name || 'Portfolio';
  }
  return { init };
})();


/* ─────────────────────────────────────────────────────────────────────────────
   BOOTSTRAP
   ───────────────────────────────────────────────────────────────────────── */
(async () => {
  try {
    StarField.init();
    ProjectDetail.init();

    const data = await Data.load();

    Navbar.init(data.name);
    Intro.init(data);
    Timeline.init(data.timeline || []);
    Projects.init(data.projects || []);
    Contact.init(data);
    Footer.init(data.name);

  } catch (err) {
    console.error('[Portfolio] Error al cargar data.json:', err);
    const bio = document.getElementById('introBio');
    if (bio) bio.textContent = '⚠ No se pudieron cargar los datos. Verifica que data.json esté en la raíz del proyecto.';
  }
})();