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

  /* ---------- Parallax del mono (solo transform, en GPU) ----------
     El mono "desciende": se mueve hacia abajo más lento que el scroll,
     así parece bajar por la página mientras el contenido sube. */
  var mono = document.querySelector('.parallax-mono');
  var ticking = false;

  function updateParallax() {
    ticking = false;
    var y = window.scrollY * 0.35; // desciende al 35% de la velocidad del scroll
    var rot = Math.min(window.scrollY * 0.008, 8); // leve inclinación al bajar
    mono.style.transform = 'translate3d(0,' + y + 'px,0) rotate(' + rot + 'deg)';
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateParallax);
    }
  }

  function setupParallax() {
    if (reducedMotion.matches || !mono) return;
    window.addEventListener('scroll', onScroll, { passive: true });
    updateParallax();
  }

  setupParallax();

  if (reducedMotion.addEventListener) {
    reducedMotion.addEventListener('change', function (e) {
      if (e.matches) {
        window.removeEventListener('scroll', onScroll);
        mono.style.transform = '';
        if (galeriaPin) {
          window.removeEventListener('scroll', onGaleriaScroll);
          window.removeEventListener('resize', galeriaMeasure);
          galeriaSection.classList.remove('is-linked');
          galeriaPin.style.height = '';
          galeriaTrack.style.height = '';
          galeriaItems.forEach(function (el) { el.style.transform = ''; });
        }
      } else {
        setupParallax();
        setupGaleria();
      }
    });
  }

  /* ---------- Portafolio: carrusel ligado al scroll ----------
     La sección se "fija" (sticky) y el scroll vertical avanza las
     diapositivas de una en una: la activa queda centrada y, al seguir
     bajando, sale hacia un lado mientras la siguiente entra desde el
     otro. Cada slide tiene su propio translateX según su índice.
     Sin JS o con reduced-motion queda como scroll horizontal nativo. */
  var galeriaPin = document.getElementById('galeriaPin');
  var galeriaViewport = document.getElementById('galeriaViewport');
  var galeriaTrack = document.getElementById('galeriaTrack');
  var galeriaSection = document.getElementById('portafolio');
  var galeriaItems = galeriaTrack ? Array.prototype.slice.call(galeriaTrack.children) : [];
  var galeriaStep = 0;   // px de scroll vertical por transición
  var galeriaExtra = 0;  // scroll total extra que retiene el pin
  var galeriaTravel = 0; // desplazamiento horizontal para sacar un slide de pantalla
  var galeriaTicking = false;

  function galeriaMeasure() {
    galeriaSection.classList.add('is-linked');
    galeriaStep = Math.max(320, Math.round(window.innerHeight * 0.6));
    galeriaExtra = galeriaStep * (galeriaItems.length - 1);
    galeriaTravel = (galeriaViewport.clientWidth + galeriaItems[0].offsetWidth) / 2 + 40;
    galeriaTrack.style.height = galeriaItems[0].offsetHeight + 'px';
    galeriaPin.style.height = (window.innerHeight + galeriaExtra) + 'px';
    galeriaUpdate();
  }

  function galeriaUpdate() {
    galeriaTicking = false;
    var top = galeriaPin.getBoundingClientRect().top;
    var t = Math.max(0, Math.min(-top / galeriaStep, galeriaItems.length - 1));
    // Pausa en el centro: cada slide se queda quieta un tramo del scroll
    // antes de ceder el lugar a la siguiente (suavizado con smoothstep).
    var seg = Math.floor(t);
    var f = t - seg;
    var fe = f <= 0.25 ? 0 : f >= 0.75 ? 1 : (f - 0.25) / 0.5;
    fe = fe * fe * (3 - 2 * fe);
    var te = seg + fe;
    for (var i = 0; i < galeriaItems.length; i++) {
      var x = Math.max(-galeriaTravel, Math.min((i - te) * galeriaTravel, galeriaTravel));
      galeriaItems[i].style.transform = 'translate3d(' + x + 'px,0,0)';
    }
  }

  function onGaleriaScroll() {
    if (!galeriaTicking) {
      galeriaTicking = true;
      requestAnimationFrame(galeriaUpdate);
    }
  }

  function setupGaleria() {
    if (reducedMotion.matches || !galeriaPin || galeriaItems.length === 0) return;
    galeriaMeasure();
    window.addEventListener('scroll', onGaleriaScroll, { passive: true });
    window.addEventListener('resize', galeriaMeasure);
  }

  setupGaleria();

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
