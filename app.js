// Galería por hora + búsqueda por dorsal + visor con descarga. Sin dependencias.
(function () {
  var cfg = window.CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var input = $("dorsal"), limpiar = $("limpiar"), estado = $("estado"), galeria = $("galeria");
  var vacio = $("vacio"), vacioTxt = $("vacioTxt");
  var visor = $("visor"), vImg = $("vImg"), vInfo = $("vInfo"), vNombre = $("vNombre"), vDesc = $("vDesc");
  var vPrev = $("vPrev"), vNext = $("vNext");
  var todas = [], lista = [], actual = -1, filtro = null, temporizador = null;
  var PREFIJO = cfg.DOWNLOAD_PREFIX || "carrera";

  function hora(t) { return t ? t.slice(11, 16) : ""; }

  // Scroll infinito: se pintan lotes de LOTE miniaturas cuando el centinela se acerca a la pantalla.
  var LOTE = cfg.BATCH_SIZE || 24, pintadas = 0, cabeceras = false, ultimaCab = null;
  var centinela = document.createElement("div"); centinela.className = "centinela"; centinela.setAttribute("aria-hidden", "true");
  galeria.after(centinela);
  var observador = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    if (es[0].isIntersecting) masFotos();
  }, { rootMargin: "1200px 0px" }) : null;
  if (observador) observador.observe(centinela);

  function pintar(fotos, conCabeceras) {
    lista = fotos; pintadas = 0; cabeceras = conCabeceras; ultimaCab = null;
    galeria.textContent = "";
    masFotos();
  }

  function masFotos() {
    if (pintadas >= lista.length || galeria.hidden) return;
    var frag = document.createDocumentFragment(), fin = Math.min(lista.length, pintadas + LOTE);
    for (var i = pintadas; i < fin; i++) {
      var f = lista[i];
      if (cabeceras) {
        var tramo = f.t ? f.t.slice(11, 13) + ":" + (f.t[14] + "0") : "Sin hora";
        if (tramo !== ultimaCab) {
          var h = document.createElement("h2"); h.className = "hora"; h.textContent = tramo;
          frag.appendChild(h); ultimaCab = tramo;
        }
      }
      var b = document.createElement("button");
      b.type = "button"; b.className = "miniatura"; b.dataset.i = i;
      var img = document.createElement("img");
      img.src = "thumbs/" + encodeURIComponent(f.f); img.loading = "lazy"; img.decoding = "async";
      img.alt = "Foto " + (i + 1) + (f.t ? " · " + hora(f.t) : "");
      b.appendChild(img);
      if (f.t) { var s = document.createElement("span"); s.className = "t"; s.textContent = hora(f.t); b.appendChild(s); }
      frag.appendChild(b);
    }
    pintadas = fin;
    galeria.appendChild(frag);
    // si el centinela sigue visible (pantallas grandes), pedir otro lote
    if (!observador) { if (pintadas < lista.length) setTimeout(masFotos, 50); }
    else requestAnimationFrame(function () {
      var r = centinela.getBoundingClientRect();
      if (r.top < window.innerHeight + 1200) masFotos();
    });
  }

  function verTodas() {
    filtro = null; vacio.hidden = true; galeria.hidden = false;
    pintar(todas, true);
    estado.innerHTML = "<b>" + todas.length + " fotos</b> · ordenadas por hora";
  }

  function buscar(valor, desdeHash) {
    var v = String(valor || "").replace(/\D/g, "").replace(/^0+/, "");
    limpiar.hidden = !input.value;
    if (!v) { if (filtro !== null) verTodas(); actualizarHash(""); return; }
    var n = parseInt(v, 10);
    filtro = n;
    var res = todas.filter(function (f) { return f.d && f.d.indexOf(n) !== -1; });
    if (!res.length) {
      galeria.hidden = true; galeria.textContent = ""; lista = [];
      vacio.hidden = false;
      vacioTxt.textContent = "No encontrado: no hay fotos con el dorsal " + n + ". A veces el dorsal no se lee bien (tapado, de lado…). Busca en la galería por la hora de tu salida.";
      estado.innerHTML = "Dorsal <b>" + n + "</b>: no encontrado";
    } else {
      vacio.hidden = true; galeria.hidden = false;
      pintar(res, false);
      estado.innerHTML = "<b>" + res.length + (res.length === 1 ? " foto" : " fotos") + "</b> del dorsal " + n;
    }
    if (!desdeHash) actualizarHash(String(n));
  }

  function actualizarHash(h) {
    if (history.replaceState) history.replaceState(history.state, "", h ? "#" + h : location.pathname + location.search);
  }

  // ---------- visor
  function nombreDescarga(f) {
    return PREFIJO + (f.d && f.d.length ? "_dorsal" + f.d.join("-") : "") + "_" + f.f;
  }

  function mostrar(i) {
    if (i < 0 || i >= lista.length) return;
    actual = i;
    while (i >= pintadas - 4 && pintadas < lista.length) masFotos();
    var f = lista[i];
    vImg.src = "fotos/" + encodeURIComponent(f.f);
    vImg.alt = "Foto " + (i + 1) + " de " + lista.length;
    vInfo.textContent = (i + 1) + " / " + lista.length + (f.t ? " · " + hora(f.t) : "") +
      (f.d && f.d.length ? " · dorsal " + f.d.join(", ") : "");
    vNombre.textContent = f.f;
    vDesc.href = "fotos/" + encodeURIComponent(f.f);
    vDesc.setAttribute("download", nombreDescarga(f));
    vPrev.disabled = i === 0; vNext.disabled = i === lista.length - 1;
    [i - 1, i + 1].forEach(function (j) { if (lista[j]) new Image().src = "fotos/" + encodeURIComponent(lista[j].f); });
  }

  function abrir(i) {
    visor.hidden = false; document.body.classList.add("bloqueado");
    if (history.pushState && !(history.state && history.state.visor)) history.pushState({ visor: true }, "", location.href);
    mostrar(i); $("vCerrar").focus();
  }
  function cerrarUI() { visor.hidden = true; document.body.classList.remove("bloqueado"); vImg.removeAttribute("src"); }
  function cerrar() { if (history.state && history.state.visor) history.back(); else cerrarUI(); }
  window.addEventListener("popstate", function () { if (!visor.hidden) cerrarUI(); });

  galeria.addEventListener("click", function (e) {
    var b = e.target.closest(".miniatura"); if (b) abrir(+b.dataset.i);
  });
  vPrev.onclick = function () { mostrar(actual - 1); };
  vNext.onclick = function () { mostrar(actual + 1); };
  $("vCerrar").onclick = cerrar;
  document.addEventListener("keydown", function (e) {
    if (visor.hidden) return;
    if (e.key === "ArrowLeft") mostrar(actual - 1);
    else if (e.key === "ArrowRight") mostrar(actual + 1);
    else if (e.key === "Escape") cerrar();
  });
  var x0 = null, y0 = null, zona = $("vZona");
  zona.addEventListener("touchstart", function (e) { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
  zona.addEventListener("touchmove", function (e) {
    if (x0 !== null) vImg.style.transform = "translateX(" + (e.touches[0].clientX - x0) * 0.6 + "px)";
  }, { passive: true });
  zona.addEventListener("touchend", function (e) {
    vImg.style.transform = "";
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) mostrar(actual + (dx < 0 ? 1 : -1));
    else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) cerrar();   // deslizar hacia abajo = cerrar
  });
  vDesc.addEventListener("click", function (e) {
    if (!(window.Watermark && window.Watermark.enabled)) return;   // descarga directa del archivo
    e.preventDefault();
    var t = vDesc.textContent; vDesc.textContent = "Preparando…";
    window.Watermark.download(vDesc.href, vDesc.getAttribute("download"))
      .catch(function () { window.location.href = vDesc.href; })
      .then(function () { vDesc.textContent = t; });
  });

  // ---------- búsqueda
  $("buscar").addEventListener("submit", function (e) { e.preventDefault(); clearTimeout(temporizador); input.blur(); buscar(input.value); });
  input.addEventListener("input", function () {
    clearTimeout(temporizador);
    limpiar.hidden = !input.value;
    if (!input.value) { buscar(""); return; }
    temporizador = setTimeout(function () { buscar(input.value); }, 450);
  });
  limpiar.addEventListener("click", function () { input.value = ""; buscar(""); input.focus(); });
  $("verTodas").addEventListener("click", function () { input.value = ""; buscar(""); verTodas(); });

  fetch("data/dorsales.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      todas = (d.fotos || []).slice();
      verTodas();
      var h = decodeURIComponent((location.hash || "").slice(1));
      if (/^\d{1,4}$/.test(h)) { input.value = h; buscar(h, true); }
    })
    .catch(function () { estado.textContent = "No se han podido cargar las fotos. Recarga la página en un momento."; });
})();
