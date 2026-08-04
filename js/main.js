/* mono azul — interacciones (vanilla JS, sin dependencias) */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Menú móvil ---------- */
  var toggle = document.getElementById('navToggle');
  var menu = document.getElementById('navMenu');

  toggle.addEventListener('click', function () {
    var open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });

  menu.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  /* ---------- Tema del nav (claro sobre el hero, oscuro después) ---------- */
  var navEl = document.getElementById('nav');
  var heroEl = document.getElementById('hero');

  function updateNavTheme() {
    navEl.classList.toggle('nav--dark', heroEl.getBoundingClientRect().bottom <= 64);
  }

  window.addEventListener('scroll', updateNavTheme, { passive: true });
  updateNavTheme();

  /* ---------- Mono del hero: gesto de rascarse la cabeza ----------
     Animación de sprite: al hacer hover (o tap en touch) el mono sube
     la mano, se rasca y vuelve al reposo. La secuencia siempre se
     reproduce entera; si el cursor sale a mitad no se corta. */
  var heroMono = document.getElementById('heroMono');
  var monoLayers = heroMono
    ? Array.prototype.slice.call(heroMono.querySelectorAll('.hero__mono-layer'))
    : [];
  var MONO_FRAMES = [
    'assets/logo/bigblack.webp',
    'assets/logo/mono-pose-01-subiendo.webp',
    'assets/logo/mono-pose-02-rascando.webp',
    'assets/logo/mono-pose-03-completo.webp'
  ];
  var MONO_SEQ = [0, 1, 2, 3, 2, 1, 0]; // ida y vuelta: rasca una vez
  var monoActive = 0;                   // índice de la capa visible ahora
  var monoPlaying = false;
  var MONO_DECODE_TIMEOUT_MS = 80;      // red de seguridad si decode() no resuelve

  /* La duración vive solo en el CSS (--mono-fade): así el fundido y el ritmo
     de la secuencia no se pueden desincronizar al ajustar uno de los dos. */
  function monoFadeMs() {
    var raw = heroMono ? getComputedStyle(heroMono).getPropertyValue('--mono-fade') : '';
    var ms = parseFloat(raw);
    if (!ms) return 300;
    return /\ds\s*$/.test(raw.trim()) ? ms * 1000 : ms; // admite "0.3s" o "300ms"
  }

  function preloadMonoFrames() {
    MONO_FRAMES.forEach(function (src) {
      var img = new Image();
      img.src = src;
    });
  }

  /* Cruza a `frame`: carga la pose en la capa oculta y, una vez decodificada
     (para que no aparezca en blanco), intercambia las opacidades. Las dos
     transiciones corren a la vez, así que es un fundido real. */
  function crossfadeTo(frame, done) {
    var incoming = monoLayers[1 - monoActive];
    var outgoing = monoLayers[monoActive];
    var swapped = false;

    function swap() {
      if (swapped) return;
      swapped = true;
      incoming.classList.add('is-active');
      outgoing.classList.remove('is-active');
      monoActive = 1 - monoActive;
      // el temporizador arranca al iniciar el fundido, no antes de decodificar,
      // para que cada transición reciba su duración completa
      setTimeout(done, monoFadeMs());
    }

    incoming.src = MONO_FRAMES[frame];
    // decode() evita cruzar hacia un frame a medio decodificar, pero puede no
    // resolverse nunca si la pestaña no se está pintando (en segundo plano).
    // El temporizador garantiza que la secuencia avance y acabe en reposo
    // en vez de quedarse bloqueada a mitad del gesto.
    setTimeout(swap, MONO_DECODE_TIMEOUT_MS);
    if (incoming.decode) {
      incoming.decode().then(swap, swap); // si falla, cruza igual
    } else {
      swap();
    }
  }

  function playScratch() {
    if (monoPlaying) return; // ignora disparos durante la secuencia
    monoPlaying = true;
    var step = 1; // el frame 0 ya está en pantalla

    (function next() {
      if (step >= MONO_SEQ.length) {
        monoPlaying = false;
        return;
      }
      var frame = MONO_SEQ[step];
      step++;
      crossfadeTo(frame, next);
    })();
  }

  function setupHeroMono() {
    if (!heroMono || monoLayers.length < 2 || reducedMotion.matches) return;
    preloadMonoFrames();
    heroMono.addEventListener('mouseenter', playScratch);
    heroMono.addEventListener('click', playScratch); // tap en touch
  }

  function teardownHeroMono() {
    if (!heroMono || monoLayers.length < 2) return;
    heroMono.removeEventListener('mouseenter', playScratch);
    heroMono.removeEventListener('click', playScratch);
    monoLayers.forEach(function (l, i) {
      l.src = MONO_FRAMES[0];
      l.classList.toggle('is-active', i === 0);
    });
    monoActive = 0;
  }

  setupHeroMono();

  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener('change', function (e) {
      if (e.matches) {
        teardownScrollFx();
        teardownHeroMono();
      } else {
        setupScrollFx();
        setupHeroMono();
      }
    });
  }

  /* ---------- Efectos ligados al scroll: marquee, texto por carácter
     y apilado del portafolio. Un solo listener con rAF para los tres. ---------- */
  var marqueeRows = Array.prototype.slice.call(document.querySelectorAll('.marquee__row'));
  var marqueeEl = document.getElementById('marquee');
  var stackCards = Array.prototype.slice.call(document.querySelectorAll('.stack-card'));
  var conceptoParas = Array.prototype.slice.call(document.querySelectorAll('.concepto__text p'));
  var conceptoChars = [];
  var conceptoLit = 0; // cuántos caracteres están iluminados ahora mismo
  var conceptoVisible = false;
  var marqueeVisible = false;
  var stackVisible = false;
  var fxTicking = false;

  /* Envuelve cada carácter de los párrafos del concepto en un span,
     preservando el texto original en aria-label para lectores. */
  function splitConceptoChars() {
    conceptoParas.forEach(function (p) {
      var text = p.textContent;
      p.setAttribute('aria-label', text);
      var frag = document.createDocumentFragment();
      for (var i = 0; i < text.length; i++) {
        var s = document.createElement('span');
        s.className = 'char';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = text[i];
        frag.appendChild(s);
        conceptoChars.push(s);
      }
      p.textContent = '';
      p.appendChild(frag);
    });
  }

  function updateMarquee() {
    var y = window.scrollY * 0.25;
    marqueeRows.forEach(function (row, i) {
      row.style.transform = 'translate3d(' + (i % 2 === 0 ? y : -y) + 'px,0,0)';
    });
  }

  function updateConcepto() {
    if (conceptoChars.length === 0) return;
    var wrap = conceptoParas[0].parentNode.getBoundingClientRect();
    var vh = window.innerHeight;
    // 0 cuando el bloque entra por abajo; 1 cuando su base pasa el 35% superior
    var progress = (vh - wrap.top) / (vh * 0.65 + wrap.height);
    progress = Math.max(0, Math.min(progress, 1));
    var lit = Math.round(progress * conceptoChars.length);
    if (lit === conceptoLit) return;
    // Solo se tocan los caracteres que cambian de estado respecto al frame anterior
    var i;
    if (lit > conceptoLit) {
      for (i = conceptoLit; i < lit; i++) conceptoChars[i].style.opacity = '1';
    } else {
      for (i = lit; i < conceptoLit; i++) conceptoChars[i].style.opacity = '';
    }
    conceptoLit = lit;
  }

  function updateStack() {
    var vh = window.innerHeight;
    for (var i = 0; i < stackCards.length - 1; i++) {
      // La tarjeta i se encoge y oscurece a medida que la i+1 sube hacia ella
      var nextTop = stackCards[i + 1].getBoundingClientRect().top;
      var p = Math.max(0, Math.min(1 - (nextTop - 90) / (vh * 0.7), 1));
      stackCards[i].style.transform = 'scale(' + (1 - 0.06 * p) + ')';
      stackCards[i].style.setProperty('--dim', String(0.35 * p));
    }
  }

  function updateScrollFx() {
    fxTicking = false;
    if (marqueeVisible) updateMarquee();
    if (conceptoVisible) updateConcepto();
    if (stackVisible) updateStack();
  }

  function onScrollFx() {
    if (!fxTicking) {
      fxTicking = true;
      requestAnimationFrame(updateScrollFx);
    }
  }

  var fxObserver = null;

  function setupScrollFx() {
    if (reducedMotion.matches) return;
    if (conceptoParas.length && conceptoChars.length === 0) splitConceptoChars();
    if ('IntersectionObserver' in window) {
      fxObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.target === marqueeEl) marqueeVisible = entry.isIntersecting;
          else if (entry.target.classList.contains('concepto__text')) conceptoVisible = entry.isIntersecting;
          else stackVisible = entry.isIntersecting;
        });
        updateScrollFx();
      }, { rootMargin: '100px 0px' });
      if (marqueeEl) fxObserver.observe(marqueeEl);
      if (conceptoParas.length) fxObserver.observe(conceptoParas[0].parentNode);
      var stackEl = document.getElementById('stack');
      if (stackEl) fxObserver.observe(stackEl);
    } else {
      marqueeVisible = conceptoVisible = stackVisible = true;
    }
    window.addEventListener('scroll', onScrollFx, { passive: true });
    updateScrollFx();
  }

  function teardownScrollFx() {
    window.removeEventListener('scroll', onScrollFx);
    if (fxObserver) { fxObserver.disconnect(); fxObserver = null; }
    marqueeRows.forEach(function (row) { row.style.transform = ''; });
    stackCards.forEach(function (card) {
      card.style.transform = '';
      card.style.removeProperty('--dim');
    });
    conceptoChars.forEach(function (s) { s.style.opacity = ''; });
    conceptoLit = 0;
  }

  setupScrollFx();

  /* ---------- Carrusel de planes (solo mobile/tablet) ----------
     Por debajo del breakpoint de 3 columnas las tarjetas pasan a un carrusel
     tipo "coverflow": la activa al centro y las otras dos a los lados con blur.
     Arranca en Premium, no en la primera. Flechas y puntos se crean aquí y se
     destruyen al volver a desktop, para que allí no quede ningún residuo. */
  var planesWrap = document.getElementById('planesCarousel');
  var planesGrid = planesWrap ? planesWrap.querySelector('.planes') : null;
  var planCards = planesGrid
    ? Array.prototype.slice.call(planesGrid.querySelectorAll('.plan'))
    : [];
  var mqCarousel = window.matchMedia('(max-width: 819.98px)');
  var planActive = 0;
  var planDots = [];
  var planNavs = [];
  var planesOn = false;
  var SWIPE_MIN = 40; // px de recorrido horizontal para contar como swipe

  var ARROW_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M15 18l-6-6 6-6"/></svg>';

  function planName(card) {
    var el = card.querySelector('.plan__name');
    return el ? el.textContent.trim() : 'plan';
  }

  function goToPlan(i) {
    var n = planCards.length;
    planActive = ((i % n) + n) % n; // módulo positivo: el ciclo es circular en ambos sentidos
    renderPlanes();
  }

  /* Posición de cada tarjeta relativa a la activa. Con 3 tarjetas, r cubre
     exactamente centro / derecha / izquierda. */
  function renderPlanes() {
    var n = planCards.length;
    planCards.forEach(function (card, i) {
      var r = (i - planActive + n) % n;
      var isActive = r === 0;
      card.classList.toggle('is-active', isActive);
      card.classList.toggle('is-next', r === 1);
      card.classList.toggle('is-prev', r === n - 1);

      if (isActive) {
        card.removeAttribute('role');
        card.removeAttribute('tabindex');
        card.removeAttribute('aria-label');
      } else {
        // Enfocable y activable con Enter/Space. No lleva aria-hidden: ocultar
        // a accesibilidad un elemento enfocable es ARIA inválido; lo que se
        // saca del tabulado es su contenido interno.
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', 'Ver plan ' + planName(card));
      }

      Array.prototype.forEach.call(card.querySelectorAll('a, button'), function (el) {
        if (isActive) el.removeAttribute('tabindex');
        else el.setAttribute('tabindex', '-1');
      });
    });

    planDots.forEach(function (dot, i) {
      var on = i === planActive;
      dot.classList.toggle('is-active', on);
      if (on) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  /* Las tarjetas están fuera del flujo, así que el contenedor necesita una
     altura explícita o el carrusel se solaparía con la sección siguiente.
     offsetHeight ignora los transform: mide el alto real aunque estén escaladas. */
  function syncPlanesHeight() {
    if (!planesOn) return;
    var max = 0;
    planCards.forEach(function (card) {
      if (card.offsetHeight > max) max = card.offsetHeight;
    });
    // + 32px = los 16px de `top` que dejan sitio al badge, y otros 16 abajo
    planesGrid.style.height = max + 32 + 'px';
  }

  function onPlanCardClick(e) {
    var card = e.currentTarget;
    if (card.classList.contains('is-active')) return; // la activa conserva sus enlaces
    e.preventDefault();
    goToPlan(planCards.indexOf(card));
  }

  function onPlanCardKey(e) {
    var card = e.currentTarget;
    if (card.classList.contains('is-active')) return;
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
    goToPlan(planCards.indexOf(card));
    card.blur(); // ya es la activa: el foco no debe quedarse en el envoltorio
  }

  var touchX = 0;
  var touchY = 0;
  var touchLive = false;

  function onPlanTouchStart(e) {
    if (e.touches.length !== 1) return;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    touchLive = true;
  }

  function onPlanTouchEnd(e) {
    if (!touchLive) return;
    touchLive = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchX;
    var dy = t.clientY - touchY;
    // Si el gesto es más vertical que horizontal es un scroll de página, no un swipe
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;
    goToPlan(planActive + (dx < 0 ? 1 : -1));
  }

  function buildPlanNav(dir) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'planes-nav planes-nav--' + (dir < 0 ? 'prev' : 'next');
    btn.setAttribute('aria-label', dir < 0 ? 'Plan anterior' : 'Plan siguiente');
    btn.innerHTML = ARROW_SVG;
    if (dir > 0) btn.querySelector('svg').style.transform = 'rotate(180deg)';
    btn.addEventListener('click', function () { goToPlan(planActive + dir); });
    planesWrap.appendChild(btn);
    planNavs.push(btn);
  }

  function buildPlanDots() {
    var wrap = document.createElement('div');
    wrap.className = 'planes-dots';
    planCards.forEach(function (card, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'planes-dot';
      dot.setAttribute('aria-label', 'Ver plan ' + planName(card));
      dot.addEventListener('click', function () { goToPlan(i); });
      wrap.appendChild(dot);
      planDots.push(dot);
    });
    planesWrap.appendChild(wrap);
  }

  function setupPlanesCarousel() {
    if (planesOn || planCards.length < 2) return;
    planesOn = true;
    planesGrid.classList.add('is-carousel');

    buildPlanNav(-1);
    buildPlanNav(1);
    buildPlanDots();

    planCards.forEach(function (card) {
      card.addEventListener('click', onPlanCardClick);
      card.addEventListener('keydown', onPlanCardKey);
    });
    planesGrid.addEventListener('touchstart', onPlanTouchStart, { passive: true });
    planesGrid.addEventListener('touchend', onPlanTouchEnd, { passive: true });

    // Premium (la destacada) es la activa por defecto, no la primera del DOM
    var featured = planCards.filter(function (c) {
      return c.classList.contains('plan--featured');
    })[0];
    planActive = featured ? planCards.indexOf(featured) : 0;

    renderPlanes();
    syncPlanesHeight();
    // Las webfonts cambian el alto de las tarjetas al cargar
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncPlanesHeight);
  }

  function teardownPlanesCarousel() {
    if (!planesOn) return;
    planesOn = false;

    planNavs.forEach(function (b) { b.parentNode.removeChild(b); });
    planNavs = [];
    if (planDots.length) {
      var dotsWrap = planDots[0].parentNode;
      dotsWrap.parentNode.removeChild(dotsWrap);
      planDots = [];
    }

    planCards.forEach(function (card) {
      card.removeEventListener('click', onPlanCardClick);
      card.removeEventListener('keydown', onPlanCardKey);
      card.classList.remove('is-active', 'is-prev', 'is-next');
      card.removeAttribute('role');
      card.removeAttribute('tabindex');
      card.removeAttribute('aria-label');
      Array.prototype.forEach.call(card.querySelectorAll('a, button'), function (el) {
        el.removeAttribute('tabindex');
      });
    });
    planesGrid.removeEventListener('touchstart', onPlanTouchStart);
    planesGrid.removeEventListener('touchend', onPlanTouchEnd);
    planesGrid.classList.remove('is-carousel');
    planesGrid.style.removeProperty('height');
  }

  function syncPlanesCarousel() {
    if (mqCarousel.matches) setupPlanesCarousel();
    else teardownPlanesCarousel();
  }

  if (planesGrid) {
    syncPlanesCarousel();
    if (mqCarousel.addEventListener) mqCarousel.addEventListener('change', syncPlanesCarousel);
    window.addEventListener('resize', syncPlanesHeight);
    window.addEventListener('orientationchange', syncPlanesHeight);
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Año del footer ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
