// Galería por hora + búsqueda por dorsal + visor con descarga. Sin dependencias.
(function () {
  var cfg = window.CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var input = $("dorsal"), limpiar = $("limpiar"), estado = $("estado"), galeria = $("galeria");
  var vacio = $("vacio"), vacioTxt = $("vacioTxt");
  var visor = $("visor"), vImg = $("vImg"), vDesc = $("vDesc");
  var vPrev = $("vPrev"), vNext = $("vNext"), vCanvas = $("vCanvas"), vEnc = $("vEncuadre"), vEncLabel = $("vEncLabel");
  var encuadre = false;
  try { encuadre = localStorage.getItem("encuadre") === "1"; } catch (e) {}
  vEnc.checked = encuadre;
  var todas = [], lista = [], actual = -1, filtro = null, temporizador = null;
  var PREFIJO = cfg.DOWNLOAD_PREFIX || "carrera";
  var conLogo = !!(window.Watermark && window.Watermark.enabled);   // logo del club (CSS encima; canvas al descargar)

  function hora(t) { return t ? t.slice(11, 16) : ""; }

  // Scroll infinito: se pintan lotes de LOTE miniaturas cuando el centinela se acerca a la pantalla.
  // Primer lote pequeño (pantalla visible al instante); luego lotes de LOTE al acercarse al final.
  // Las miniaturas solo se piden cuando están a <MARGEN_IMG de la pantalla (ahorra datos en móvil).
  var LOTE_INICIAL = 12, LOTE = cfg.BATCH_SIZE || 18, pintadas = 0, cabeceras = false, ultimaCab = null;
  var centinela = document.createElement("div"); centinela.className = "centinela"; centinela.setAttribute("aria-hidden", "true");
  galeria.after(centinela);
  var observador = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    if (es[0].isIntersecting) masFotos();
  }, { rootMargin: "800px 0px" }) : null;
  if (observador) observador.observe(centinela);
  function cargarMini(img) {
    if (!img.dataset.src) return;
    img.onload = function () { img.classList.add("ok"); logoMiniaturas(); };
    img.onerror = function () { img.classList.add("ok"); };
    img.src = img.dataset.src; delete img.dataset.src;
  }
  // el logo de las miniaturas se pide cuando ya se ha visto la primera (no retrasa la carga inicial)
  function logoMiniaturas() {
    if (!conLogo || logoMiniaturas.pedido) return;
    logoMiniaturas.pedido = true;
    window.Watermark.logo().then(function (l) {
      if (!l) { logoMiniaturas.pedido = false; return; }
      galeria.style.setProperty("--logo", 'url("' + l.src + '")'); galeria.classList.add("con-logo");
    });
  }
  var obsImg = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { obsImg.unobserve(e.target); cargarMini(e.target); } });
  }, { rootMargin: "0px 0px 120px 0px" }) : null;

  function pintar(fotos, conCabeceras) {
    lista = fotos; pintadas = 0; cabeceras = conCabeceras; ultimaCab = null;
    galeria.textContent = ""; galeria.removeAttribute("aria-busy");
    masFotos();
  }

  function masFotos(hasta) {   // hasta: pintar al menos hasta ese índice (salto con la barra de hora)
    if (pintadas >= lista.length || galeria.hidden) return;
    var frag = document.createDocumentFragment(), fin = Math.min(lista.length, Math.max(+hasta || 0, pintadas + (pintadas ? LOTE : LOTE_INICIAL)));
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
      img.dataset.src = "thumbs/" + encodeURIComponent(f.f); img.loading = "lazy"; img.decoding = "async";
      img.width = 288; img.height = 360;
      if (i < 6) img.setAttribute("fetchpriority", "high");
      if (obsImg) obsImg.observe(img); else cargarMini(img);
      img.alt = "";
      b.setAttribute("aria-label", "Foto" + (f.t ? " de las " + hora(f.t) : "") + (f.d && f.d.length ? ", dorsal " + f.d.join(" y ") : ""));
      b.appendChild(img);
      if (f.t) { var s = document.createElement("span"); s.className = "t"; s.setAttribute("aria-hidden", "true"); s.textContent = hora(f.t); b.appendChild(s); }
      frag.appendChild(b);
    }
    pintadas = fin;
    galeria.appendChild(frag);
    // si el centinela sigue visible (pantallas grandes), pedir otro lote
    if (!observador) { if (pintadas < lista.length) setTimeout(masFotos, 50); }
    else requestAnimationFrame(function () {
      var r = centinela.getBoundingClientRect();
      if (r.top < window.innerHeight + 800) masFotos();
      else { observador.unobserve(centinela); observador.observe(centinela); }   // nuevo aviso al seguir bajando
    });
  }

  function verTodas() {
    filtro = null; vacio.hidden = true; galeria.hidden = false;
    pintar(todas, true); reloj.hidden = false; seguirScroll();
    estado.innerHTML = "<b>" + todas.length + " fotos</b> · ordenadas por hora";
  }

  function buscar(valor, desdeHash) {
    var v = String(valor || "").replace(/\D/g, "").replace(/^0+/, "");
    limpiar.hidden = !input.value;
    if (!v) { if (filtro !== null) verTodas(); actualizarHash(""); return; }
    var n = parseInt(v, 10);
    filtro = n; reloj.hidden = true; burbuja.hidden = true;
    var res = todas.filter(function (f) { return f.d && f.d.indexOf(n) !== -1; });
    if (!res.length) {
      galeria.hidden = true; galeria.textContent = ""; lista = [];
      vacio.hidden = false;
      vacioTxt.innerHTML = "<b>No encontrado</b><br>Ninguna foto tiene el dorsal " + n + ". A veces no se lee (tapado, de lado…): busca tu foto por la hora de tu salida.";
      estado.innerHTML = "Dorsal <b>" + n + "</b>: no encontrado";
    } else {
      vacio.hidden = true; galeria.hidden = false;
      pintar(res, false);
      estado.innerHTML = "<b>" + res.length + (res.length === 1 ? " foto" : " fotos") + "</b> del dorsal " + n;
    }
    if (!desdeHash) actualizarHash(String(n));
  }

  // ---------- barra de hora (scrubber): eje = hora de captura de la primera a la última foto
  // Arrastrar / tocar / teclado elige un minuto; al soltar, la galería salta a la primera foto a partir de esa hora.
  var reloj = $("reloj"), rArea = $("rArea"), rHist = $("rHist"), pulgar = $("rPulgar"), marcas = $("rMarcas"), burbuja = $("rBurbuja");
  var cabecera = document.querySelector("header.top");
  var minutos = [], porMin = [], rMin = 0, rMax = 1, valor = 0, arrastre = null, tTeclado = null, quietoHasta = 0, rafScroll = 0;
  var sinMovimiento = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function aMin(t) { return t ? +t.slice(11, 13) * 60 + +t.slice(14, 16) : NaN; }
  function hhmm(m) { return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + m % 60).slice(-2); }
  function fotosEn(m) { return (porMin[m - rMin] || 0) + (porMin[m - rMin + 1] || 0); }   // fotos en ese minuto y el siguiente
  function textoFotos(n) { return n ? n + (n === 1 ? " foto" : " fotos") : "sin fotos"; }
  function frac(m) { return rMax > rMin ? (m - rMin) / (rMax - rMin) : 0; }
  function prepararReloj() {
    minutos = todas.map(function (f) { return aMin(f.t); });
    var vale = minutos.filter(function (m) { return !isNaN(m); });
    if (vale.length < 2) { reloj.hidden = true; return; }
    rMin = Math.min.apply(null, vale); rMax = Math.max.apply(null, vale);
    if (rMax === rMin) rMax++;
    porMin = []; for (var k = 0; k <= rMax - rMin + 1; k++) porMin.push(0);
    vale.forEach(function (m) { porMin[m - rMin]++; });
    // histograma: barras de 2 min, escala lineal
    var ns = "http://www.w3.org/2000/svg", w = rMax - rMin, cubos = [], tope = 1;
    for (k = 0; k <= w; k += 2) { var c = porMin[k] + (porMin[k + 1] || 0); cubos.push(c); tope = Math.max(tope, c); }
    rHist.setAttribute("viewBox", "0 0 " + (w + 1) + " " + tope); rHist.textContent = "";
    cubos.forEach(function (c, i) {
      if (!c) return;
      var r = document.createElementNS(ns, "rect");
      r.setAttribute("x", i * 2); r.setAttribute("width", 1.6); r.setAttribute("y", tope - c); r.setAttribute("height", c);
      rHist.appendChild(r);
    });
    reloj.setAttribute("aria-valuemin", rMin); reloj.setAttribute("aria-valuemax", rMax);
    pintarMarcas(); fijarValor(rMin); reloj.classList.add("listo");
  }
  function pintarMarcas() {   // horas redondas que quepan (>= 46 px por etiqueta)
    var ancho = rArea.clientWidth || 300, span = rMax - rMin, pasos = [5, 10, 15, 30, 60, 120, 240], paso = pasos[pasos.length - 1];
    var hueco = Math.max(46, ancho / 12);   // en escritorio, menos marcas
    for (var k = 0; k < pasos.length; k++) if (span / pasos[k] * hueco <= ancho) { paso = pasos[k]; break; }
    marcas.textContent = "";
    for (var m = Math.ceil(rMin / paso) * paso; m <= rMax; m += paso) {
      var p = frac(m);
      if (p * ancho < 16 || (1 - p) * ancho < 16) continue;   // no cortar etiquetas en los bordes
      var s = document.createElement("span"); s.style.left = (p * 100) + "%"; s.textContent = hhmm(m); marcas.appendChild(s);
    }
  }
  function fijarValor(m) {
    valor = Math.max(rMin, Math.min(rMax, Math.round(m)));
    pulgar.style.left = (frac(valor) * 100) + "%";
    reloj.setAttribute("aria-valuenow", valor);
    reloj.setAttribute("aria-valuetext", hhmm(valor) + ", " + textoFotos(fotosEn(valor)));
  }
  function mostrarBurbuja() {
    burbuja.innerHTML = "<b>" + hhmm(valor) + "</b> <small>· " + textoFotos(fotosEn(valor)) + "</small>";
    burbuja.hidden = false;
    var w = rArea.clientWidth, bw = burbuja.offsetWidth, x = frac(valor) * w;
    var izq = -rArea.offsetLeft + 4, der = w + rArea.offsetLeft - 4;   // que no se salga de la pantalla
    x = Math.max(izq + bw / 2, Math.min(der - bw / 2, x));
    burbuja.style.left = x + "px";
  }
  function primeraDesde(m) {   // primera foto con hora >= m (lista ordenada por hora)
    for (var i = 0; i < minutos.length; i++) if (minutos[i] >= m) return i;
    return minutos.length - 1;
  }
  function saltarA(m, enfocar) {
    if (filtro !== null || lista !== todas || !todas.length) return;
    var j = primeraDesde(m);
    if (j >= pintadas) masFotos(j + LOTE);   // pinta solo hasta ahí (las miniaturas se piden al verse)
    var b = galeria.querySelector('.miniatura[data-i="' + j + '"]'); if (!b) return;
    var el = b.previousElementSibling && b.previousElementSibling.classList.contains("hora") ? b.previousElementSibling : b;
    var y = Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - cabecera.offsetHeight - 8);
    var lejos = Math.abs(y - window.pageYOffset) > window.innerHeight * 1.5;   // saltos largos: directo (no pide las miniaturas intermedias)
    quietoHasta = performance.now() + (sinMovimiento || lejos ? 250 : 900);
    window.scrollTo({ top: y, behavior: sinMovimiento || lejos ? "auto" : "smooth" });
    galeria.querySelectorAll(".destino").forEach(function (x) { x.classList.remove("destino"); });
    b.classList.add("destino"); setTimeout(function () { b.classList.remove("destino"); }, 1600);
    if (enfocar) b.focus({ preventScroll: true });
  }
  function valorDeX(x) {
    var r = rArea.getBoundingClientRect();
    return rMin + Math.max(0, Math.min(1, (x - r.left) / r.width)) * (rMax - rMin);
  }
  reloj.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || !reloj.classList.contains("listo")) return;
    arrastre = e.pointerId;
    try { reloj.setPointerCapture(e.pointerId); } catch (er) {}
    reloj.classList.add("activo"); fijarValor(valorDeX(e.clientX)); mostrarBurbuja();
  });
  reloj.addEventListener("pointermove", function (e) {
    if (arrastre !== e.pointerId) return;
    fijarValor(valorDeX(e.clientX)); mostrarBurbuja();
  });
  function soltar(e, saltar) {
    if (arrastre !== e.pointerId) return;
    arrastre = null; reloj.classList.remove("activo"); burbuja.hidden = true;
    if (saltar) { fijarValor(valorDeX(e.clientX)); saltarA(valor, true); }
  }
  reloj.addEventListener("pointerup", function (e) { soltar(e, true); });
  reloj.addEventListener("pointercancel", function (e) { soltar(e, false); });
  reloj.addEventListener("keydown", function (e) {
    var d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[e.key], m;
    if (d) m = valor + d; else if (e.key === "Home") m = rMin; else if (e.key === "End") m = rMax; else return;
    e.preventDefault(); fijarValor(m);
    clearTimeout(tTeclado); quietoHasta = performance.now() + 1e4;
    tTeclado = setTimeout(function () { saltarA(valor, false); }, 350);
  });
  // el pulgar sigue al scroll: hora de la primera miniatura visible bajo la cabecera
  function seguirScroll() {
    rafScroll = 0;
    if (arrastre !== null || performance.now() < quietoHasta || filtro !== null || lista !== todas || !pintadas) return;
    var tiles = galeria.getElementsByClassName("miniatura"), bajo = cabecera.getBoundingClientRect().bottom, lo = 0, hi = tiles.length - 1;
    if (hi < 0) return;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (tiles[mid].getBoundingClientRect().bottom <= bajo + 4) lo = mid + 1; else hi = mid; }
    var m = minutos[+tiles[lo].dataset.i];
    if (!isNaN(m) && m !== valor) fijarValor(m);
  }
  window.addEventListener("scroll", function () { if (!rafScroll) rafScroll = requestAnimationFrame(seguirScroll); }, { passive: true });
  var tMarcas = null;
  window.addEventListener("resize", function () {
    clearTimeout(tMarcas); tMarcas = setTimeout(function () { if (todas.length) pintarMarcas(); }, 150);
  });

  function actualizarHash(h) {
    if (history.replaceState) history.replaceState(history.state, "", h ? "#" + h : location.pathname + location.search);
  }

  // ---------- visor
  // vLista = fotos que recorre el visor (la galería/búsqueda, o la tira de un corredor si se salta a ella)
  var vLista = [], vTit = $("vTit"), vSub = $("vSub"), vRel = $("vRel"), vRelTit = $("vRelTit"), vRelTira = $("vRelTira");
  var vBlur = $("vBlur"), vChips = $("vChips"), vComp = $("vComp"), vTodas = $("vTodas"), aviso = $("aviso"), relActual = [];
  var TITULO = document.title, tAviso = null;

  function nombreDescarga(f) {
    return PREFIJO + (f.d && f.d.length ? "_dorsal" + f.d.join("-") : "") + "_" + f.f;
  }
  function avisar(t) {
    aviso.textContent = t; aviso.hidden = false; clearTimeout(tAviso);
    tAviso = setTimeout(function () { aviso.hidden = true; }, 2600);
  }
  function ocupado(el, si, texto) {
    var t = el.querySelector(".txt");
    if (si) { if (!el.dataset.txt) el.dataset.txt = t.textContent; el.setAttribute("aria-busy", "true"); if (texto) t.textContent = texto; }
    else { el.removeAttribute("aria-busy"); if (el.dataset.txt) t.textContent = el.dataset.txt; delete el.dataset.txt; }
  }

  // Corredores de una foto: claves "503" (dorsal leído o asociado) o "g3" (grupo anónimo), principal primero.
  // f.r = [{k, c}] (c = encuadre 4:5 centrado en ese corredor); si no existe se deduce de f.d / f.g.
  function corredores(f) {
    if (f._r) return f._r;
    var r = (f.r || []).map(function (x) { return { k: String(x.k), c: x.c || null }; });
    (f.d || []).forEach(function (b) { if (!r.some(function (x) { return x.k === String(b); })) r.push({ k: String(b), c: null }); });
    if (f.g && !r.some(function (x) { return x.k === f.g; })) r.push({ k: f.g, c: null });
    f._r = r; return r;
  }
  function tieneCorredor(f, k) { return corredores(f).some(function (x) { return x.k === k; }); }
  var selK = null;   // corredor elegido en el visor
  function elegirCorredor(f) {
    var ks = corredores(f).map(function (x) { return x.k; });
    if (filtro !== null && ks.indexOf(String(filtro)) !== -1) return String(filtro);   // viene de una búsqueda
    if (selK && ks.indexOf(selK) !== -1) return selK;                                    // sigue al mismo corredor
    return ks[0] || null;
  }
  function cropDe(f, k) {
    var x = corredores(f).filter(function (y) { return y.k === (k || selK); })[0];
    return (x && x.c) || f.c || null;
  }
  function relacionadas(k) {
    return k ? todas.filter(function (x) { return tieneCorredor(x, k); }) : [];
  }
  function etiqueta(f, k) {
    if (!k) return "";
    if (k.charAt(0) !== "g") return k;
    var anon = corredores(f).filter(function (x) { return x.k.charAt(0) === "g"; }).map(function (x) { return x.k; });
    return "Corredor " + "ABCDEFGH".charAt(Math.max(0, anon.indexOf(k)));
  }
  function nombreRel(k, f) { return !k ? "" : k.charAt(0) === "g" ? (corredores(f).length > 1 ? etiqueta(f, k).toLowerCase() : "este corredor") : "dorsal " + k; }

  function pintarChips(f) {
    var rs = corredores(f);
    vChips.textContent = "";
    vChips.hidden = rs.length < 2;
    if (rs.length < 2) return;
    rs.forEach(function (x) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (x.k === selK ? " sel" : ""); b.dataset.k = x.k;
      b.setAttribute("aria-pressed", x.k === selK ? "true" : "false");
      b.textContent = etiqueta(f, x.k);
      b.setAttribute("aria-label", "Ver fotos " + (x.k.charAt(0) === "g" ? "de " + etiqueta(f, x.k).toLowerCase() : "del dorsal " + x.k));
      vChips.appendChild(b);
    });
  }
  function pintarTira(f) {
    pintarChips(f);
    var rel = relacionadas(selK); relActual = rel;
    vRelTira.textContent = "";
    if (rel.length < 2) { vRel.hidden = true; vTodas.hidden = true; return; }
    vRel.hidden = false;
    vRelTit.innerHTML = "Más fotos de <b>" + nombreRel(selK, f) + "</b> · " + rel.length;
    var frag = document.createDocumentFragment(), cur = null;
    rel.forEach(function (x) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "rel-mini" + (x === f ? " actual" : ""); b.dataset.f = x.f;
      b.setAttribute("aria-label", "Foto " + (x.t ? hora(x.t) : x.f));
      if (x === f) { b.setAttribute("aria-current", "true"); cur = b; }
      var img = document.createElement("img");
      img.src = "thumbs/" + encodeURIComponent(x.f); img.loading = "lazy"; img.decoding = "async"; img.alt = "";
      b.appendChild(img);
      if (x.t) { var s = document.createElement("span"); s.className = "t"; s.textContent = hora(x.t); b.appendChild(s); }
      frag.appendChild(b);
    });
    vRelTira.appendChild(frag);
    if (cur) {
      var l = cur.offsetLeft - (vRelTira.clientWidth - cur.offsetWidth) / 2;
      vRelTira.scrollLeft = Math.max(0, l);
    }
    vTodas.hidden = rel.length < 2;
    if (!vTodas.hasAttribute("aria-busy")) vTodas.querySelector(".txt").textContent = "Descargar todas (" + rel.length + ")";
  }
  vChips.addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b || b.dataset.k === selK) return;
    var f = vLista[actual]; selK = b.dataset.k;
    if (vLista !== lista) vLista = relacionadas(selK).length ? relacionadas(selK) : vLista;   // recorrer este corredor
    actual = Math.max(0, vLista.indexOf(f));
    pintarTira(f); pintarRecorte(); archivoListo = null; prepararCompartir(); paqueteListo = null;
    vSub.textContent = (actual + 1) + " / " + vLista.length + (f.t ? " · " + hora(f.t) : "");
  });
  vRelTira.addEventListener("click", function (e) {
    var b = e.target.closest(".rel-mini"); if (!b) return;
    var j = -1;
    for (var k = 0; k < vLista.length; k++) if (vLista[k].f === b.dataset.f) { j = k; break; }
    if (j === -1) {   // no está en la lista actual: el visor pasa a recorrer las fotos de este corredor
      vLista = relActual.slice();
      for (k = 0; k < vLista.length; k++) if (vLista[k].f === b.dataset.f) { j = k; break; }
    }
    mostrar(j);
  });

  var archivoListo = null;   // File de la foto actual para compartir (preparado al cargar la foto)
  function mostrar(i) {
    if (i < 0 || i >= vLista.length) return;
    actual = i;
    if (vLista === lista) while (i >= pintadas - 4 && pintadas < lista.length) masFotos();
    var f = vLista[i];
    archivoListo = null;
    selK = elegirCorredor(f);
    vBlur.src = "thumbs/" + encodeURIComponent(f.f); vBlur.hidden = false;
    vImg.classList.add("cargando"); vLogo.hidden = true;
    vImg.src = "fotos/" + encodeURIComponent(f.f);
    vTit.textContent = f.d && f.d.length ? "Dorsal " + f.d.join(" · ") : "Sin dorsal";
    vImg.alt = vTit.textContent + (f.t ? ", " + hora(f.t) : "") + " (" + (i + 1) + " de " + vLista.length + ")";
    vCanvas.setAttribute("aria-label", vImg.alt + ", encuadre 4:5");
    vSub.textContent = (i + 1) + " / " + vLista.length + (f.t ? " · " + hora(f.t) : "");
    vEncLabel.classList.toggle("no", !cropDe(f));
    vCanvas.hidden = true; vImg.hidden = false;
    vDesc.href = "fotos/" + encodeURIComponent(f.f);
    vDesc.setAttribute("download", nombreDescarga(f));
    vPrev.disabled = i === 0; vNext.disabled = i === vLista.length - 1;
    pintarTira(f);
    [i - 1, i + 1].forEach(function (j) { if (vLista[j]) new Image().src = "fotos/" + encodeURIComponent(vLista[j].f); });
  }

  // ---------- encuadre (recorte sugerido, opcional; se hace en el navegador)
  function recorteActivo() { var f = vLista[actual]; return encuadre && f ? cropDe(f) : null; }

  // rectángulo en píxeles del recorte, exactamente 4:5 (vertical)
  function rect45(c, W, H) {
    var sw = Math.min(Math.round(c[2] * W), W, Math.floor(H * 4 / 5));
    sw -= sw % 4; var sh = sw / 4 * 5;
    var cx = (c[0] + c[2] / 2) * W, cy = (c[1] + c[3] / 2) * H;
    return [Math.round(Math.min(Math.max(cx - sw / 2, 0), W - sw)), Math.round(Math.min(Math.max(cy - sh / 2, 0), H - sh)), sw, sh];
  }
  function pintarRecorte() {
    var c = recorteActivo();
    if (!c || !vImg.complete || !vImg.naturalWidth) { vCanvas.hidden = true; vImg.hidden = false; colocarLogo(); return; }
    var q = rect45(c, vImg.naturalWidth, vImg.naturalHeight), sx = q[0], sy = q[1], sw = q[2], sh = q[3];
    vCanvas.width = sw; vCanvas.height = sh;
    vCanvas.getContext("2d").drawImage(vImg, sx, sy, sw, sh, 0, 0, sw, sh);
    vCanvas.hidden = false; vImg.hidden = true;
    colocarLogo();
  }

  // ---------- logo del club superpuesto en el visor (CSS, no toca la foto): abajo a la derecha de la foto visible
  // (la caja real de la imagen, no el hueco con bandas negras), por encima de la tira de fotos si está.
  var vLogo = $("vLogo"), rafLogo = 0;
  function colocarLogo() {
    rafLogo = 0;
    if (!conLogo || visor.hidden) return;
    var lienzo = !vCanvas.hidden, el = lienzo ? vCanvas : vImg;
    var nw = lienzo ? vCanvas.width : vImg.naturalWidth, nh = lienzo ? vCanvas.height : vImg.naturalHeight;
    if (!vLogo.naturalWidth || !nw || !nh || vImg.classList.contains("cargando")) { vLogo.hidden = true; return; }
    var z = zona.getBoundingClientRect(), r = el.getBoundingClientRect();
    var s = Math.min(r.width / nw, r.height / nh), cw = nw * s, ch = nh * s;   // object-fit: contain
    var x = r.left - z.left + (r.width - cw) / 2, y = r.top - z.top + (r.height - ch) / 2;
    var b = window.Watermark.box(cw, ch, vLogo.naturalWidth, vLogo.naturalHeight), top = y + b[1];
    if (!vRel.hidden) top = Math.min(top, vRel.offsetTop - b[3] - 6);
    vLogo.style.left = (x + b[0]) + "px"; vLogo.style.top = Math.max(y, top) + "px";
    vLogo.style.width = b[2] + "px"; vLogo.style.height = b[3] + "px";
    vLogo.style.opacity = cfg.LOGO_OPACITY || 0.9;
    vLogo.hidden = false;
  }
  function recolocarLogo() { if (!rafLogo) rafLogo = requestAnimationFrame(colocarLogo); }
  window.addEventListener("resize", recolocarLogo);
  window.addEventListener("orientationchange", recolocarLogo);
  if (window.ResizeObserver) new ResizeObserver(recolocarLogo).observe($("vZona"));
  function cargarLogoVisor() {   // se pide al abrir el visor por primera vez
    if (!conLogo || vLogo.getAttribute("src")) return;
    vLogo.onload = colocarLogo;
    vLogo.src = cfg.LOGO_URL;
  }
  vImg.addEventListener("load", function () { vImg.classList.remove("cargando"); vBlur.hidden = true; pintarRecorte(); prepararCompartir(); });
  vImg.addEventListener("error", function () {
    if (visor.hidden || !vImg.getAttribute("src")) return;
    avisar("No se ha podido cargar la foto. Revisa tu conexión.");
  });
  vEnc.addEventListener("change", function () {
    encuadre = vEnc.checked;
    try { localStorage.setItem("encuadre", encuadre ? "1" : "0"); } catch (e) {}
    pintarRecorte(); archivoListo = null; prepararCompartir();
  });

  function guardarBlob(blob, nombre) {
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function descargarOriginal(href, nombre) {   // último recurso: el archivo tal cual
    var a = document.createElement("a");
    a.href = href; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  }
  // Blob JPEG de una foto (completa o recortada con su encuadre) con el logo abajo a la derecha (watermark.js).
  // Sin logo ni recorte: el archivo tal cual.
  function blobDeFoto(f, recortar) {
    var url = "fotos/" + encodeURIComponent(f.f);
    var cr = recortar ? cropDe(f) : null;
    if (cr || conLogo) return window.Watermark.render(url, cr ? function (w, h) { return rect45(cr, w, h); } : null);
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); });
  }
  function nombreArchivo(f, recortado) { return nombreDescarga(f).replace(/\.jpg$/i, recortado && cropDe(f) ? "_encuadre.jpg" : ".jpg"); }

  // mientras el visor está abierto, el resto de la página no se puede enfocar ni lo lee el lector de pantalla
  var fondo = [document.querySelector("header.top"), document.querySelector("main"), document.querySelector("footer.pie")], origen = null;
  function bloquearFondo(si) {
    fondo.forEach(function (el) {
      if (!el) return;
      el.inert = si;
      if (si) el.setAttribute("aria-hidden", "true"); else el.removeAttribute("aria-hidden");
    });
  }
  function abrir(i, desde) {
    vLista = lista; origen = desde || document.activeElement;
    visor.hidden = false; document.body.classList.add("bloqueado"); bloquearFondo(true);
    if (history.pushState && !(history.state && history.state.visor)) history.pushState({ visor: true }, "", location.href);
    cargarLogoVisor(); mostrar(i); $("vCerrar").focus();
  }
  function cerrarUI() {
    visor.hidden = true; document.body.classList.remove("bloqueado"); bloquearFondo(false);
    vImg.removeAttribute("src"); aviso.hidden = true; vLogo.hidden = true;
    if (origen && origen.isConnected) origen.focus({ preventScroll: true });   // volver a la miniatura abierta
    origen = null;
  }
  function cerrar() { if (history.state && history.state.visor) history.back(); else cerrarUI(); }
  window.addEventListener("popstate", function () { if (!visor.hidden) cerrarUI(); });

  galeria.addEventListener("click", function (e) {
    var b = e.target.closest(".miniatura"); if (b && b.dataset.i) abrir(+b.dataset.i, b);
  });
  vPrev.onclick = function () { mostrar(actual - 1); };
  vNext.onclick = function () { mostrar(actual + 1); };
  $("vCerrar").onclick = cerrar;
  document.addEventListener("keydown", function (e) {
    if (visor.hidden) return;
    if (e.key === "Tab") {   // el foco no sale del visor
      var foc = Array.prototype.filter.call(visor.querySelectorAll("button, a[href], input"), function (el) {
        return !el.disabled && (el.offsetWidth || el.offsetHeight || el.type === "checkbox") && !el.closest("[hidden], .no");
      });
      if (!foc.length) return;
      var pri = foc[0], ult = foc[foc.length - 1], dentro = visor.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === pri || !dentro)) { e.preventDefault(); ult.focus(); }
      else if (!e.shiftKey && (document.activeElement === ult || !dentro)) { e.preventDefault(); pri.focus(); }
      return;
    }
    if (e.key === "ArrowLeft") mostrar(actual - 1);
    else if (e.key === "ArrowRight") mostrar(actual + 1);
    else if (e.key === "Escape") cerrar();
  });
  var x0 = null, y0 = null, zona = $("vZona");
  zona.addEventListener("touchstart", function (e) {
    if (e.target.closest && e.target.closest(".relacionadas, .chips")) { x0 = null; return; }   // la tira se desliza sola
    if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
  zona.addEventListener("touchmove", function (e) {
    if (x0 !== null) (vCanvas.hidden ? vImg : vCanvas).style.transform = vLogo.style.transform = "translateX(" + (e.touches[0].clientX - x0) * 0.6 + "px)";
  }, { passive: true });
  zona.addEventListener("touchend", function (e) {
    vImg.style.transform = ""; vCanvas.style.transform = ""; vLogo.style.transform = "";
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) mostrar(actual + (dx < 0 ? 1 : -1));
    else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) cerrar();   // deslizar hacia abajo = cerrar
  });

  // ---------- Descargar foto
  vDesc.addEventListener("click", function (e) {
    var f = vLista[actual], rec = !!recorteActivo();
    if (!f || !(rec || conLogo)) return;   // descarga directa del archivo completo
    e.preventDefault();   // JPEG generado aquí: logo abajo a la derecha (del recorte 4:5 si hay Encuadre)
    ocupado(vDesc, true, "Preparando…");
    var href = vDesc.href, nombre = vDesc.getAttribute("download");
    blobDeFoto(f, rec).then(function (b) { guardarBlob(b, nombreArchivo(f, rec)); }, function () { descargarOriginal(href, nombre); })
      .then(function () { ocupado(vDesc, false); });
  });

  // ---------- Compartir (Instagram, TikTok, WhatsApp… desde la hoja nativa del móvil)
  function urlSitio(f) {
    var u = location.href.split("#")[0];
    return selK && selK.charAt(0) !== "g" ? u + "#" + selK : u;
  }
  function puedeCompartirArchivos() {
    try {
      return !!(navigator.canShare && navigator.share &&
        navigator.canShare({ files: [new File([new Blob(["x"], { type: "image/jpeg" })], "a.jpg", { type: "image/jpeg" })] }));
    } catch (e) { return false; }
  }
  function prepararCompartir() {   // se prepara antes del toque, para no perder el "gesto" del usuario en iOS
    var f = vLista[actual];
    if (!f || !puedeCompartirArchivos()) return;
    var rec = !!recorteActivo();
    var p = blobDeFoto(f, rec).then(function (b) {
      return new File([b], nombreArchivo(f, rec), { type: "image/jpeg" });
    });
    p.foto = f; p.rec = rec; p.k = selK; archivoListo = p;
    p.then(function (file) { if (archivoListo === p) p.file = file; }, function () {});
  }
  function copiarEnlace(u) {
    var hecho = function () { avisar("Enlace copiado"); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(u).then(hecho, function () { prompt("Copia el enlace:", u); });
    prompt("Copia el enlace:", u); return Promise.resolve();
  }
  vComp.addEventListener("click", function () {
    var f = vLista[actual]; if (!f) return;
    var texto = "Fotos carrera infantil · Trujillo · 24/10/2026", u = urlSitio(f);
    var rec = !!recorteActivo();
    if (puedeCompartirArchivos()) {
      var listo = archivoListo && archivoListo.foto === f && archivoListo.rec === rec && archivoListo.k === selK ? archivoListo : null;
      if (listo && listo.file) {   // compartir ya, dentro del gesto del usuario
        navigator.share({ files: [listo.file], text: texto + " " + u }).catch(function (err) {
          if (err && err.name === "NotAllowedError") avisar("No se pudo compartir. Prueba con Descargar foto.");
        });
        return;
      }
      ocupado(vComp, true, "Preparando…");
      if (!listo) { prepararCompartir(); listo = archivoListo; }
      listo.then(function (file) {
        ocupado(vComp, false);
        return navigator.share({ files: [file], text: texto + " " + u });
      }).catch(function (err) {
        ocupado(vComp, false);
        if (err && err.name === "NotAllowedError") avisar("Listo: toca Compartir otra vez");
      });
      return;
    }
    if (navigator.share) {
      navigator.share({ title: TITULO, text: texto, url: u }).catch(function (err) {
        if (!err || err.name !== "AbortError") copiarEnlace(u);
      });
    } else copiarEnlace(u);
  });

  // ---------- Descargar todas (N): hoja de compartir en móvil (Guardar imágenes) o ZIP en el navegador
  var paqueteListo = null;   // {clave, files} preparado para compartir con un segundo toque
  function claveRel() { return selK + (encuadre ? "e" : ""); }
  function nombreZip() { return selK.charAt(0) === "g" ? "fotos-corredor-" + selK + ".zip" : "fotos-dorsal-" + selK + ".zip"; }
  vTodas.addEventListener("click", function () {
    var f = vLista[actual]; if (!f) return;
    var rel = relActual.slice(), clave = claveRel(), movil = puedeCompartirArchivos() &&
      window.matchMedia && matchMedia("(pointer:coarse)").matches;
    if (movil && paqueteListo && paqueteListo.clave === clave) {
      var fl = paqueteListo.files;
      navigator.share({ files: fl, text: "Fotos carrera infantil · Trujillo" }).then(function () { paqueteListo = null; ocupado(vTodas, false); })
        .catch(function (err) { if (err && err.name !== "AbortError") { paqueteListo = null; ocupado(vTodas, false); zipYGuardar(fl, f); } });
      return;
    }
    var n = rel.length, hechas = 0, rec = !!encuadre;
    ocupado(vTodas, true, "Preparando 0/" + n + "…");
    var files = new Array(n), cola = rel.map(function (x, k) { return k; });
    function trabajador() {   // 3 descargas en paralelo
      var k = cola.shift(); if (k === undefined) return Promise.resolve();
      var x = rel[k], recX = rec && !!cropDe(x);
      return blobDeFoto(x, recX).then(function (b) {
        files[k] = new File([b], nombreArchivo(x, recX), { type: "image/jpeg" });
        hechas++; vTodas.querySelector(".txt").textContent = "Preparando " + hechas + "/" + n + "…";
      }).then(trabajador);
    }
    Promise.all([trabajador(), trabajador(), trabajador()]).then(function () {
      if (movil && navigator.canShare({ files: files })) {
        paqueteListo = { clave: clave, files: files };
        vTodas.removeAttribute("aria-busy");
        vTodas.querySelector(".txt").textContent = "Guardar " + n + " fotos";
        return navigator.share({ files: files, text: "Fotos carrera infantil · Trujillo" })
          .then(function () { paqueteListo = null; ocupado(vTodas, false); })
          .catch(function (err) {
            if (err && err.name === "NotAllowedError") { avisar("Listo: toca «Guardar " + n + " fotos»"); return; }
            if (err && err.name === "AbortError") { paqueteListo = null; ocupado(vTodas, false); return; }
            paqueteListo = null; ocupado(vTodas, false); return zipYGuardar(files, f);
          });
      }
      return zipYGuardar(files, f).then(function () { ocupado(vTodas, false); });
    }).catch(function () { ocupado(vTodas, false); avisar("No se pudieron preparar las fotos. Inténtalo de nuevo."); });
  });
  function zipYGuardar(files, f) {
    vTodas.setAttribute("aria-busy", "true"); vTodas.querySelector(".txt").textContent = "Creando ZIP…";
    return Promise.all(files.map(function (fl) { return fl.arrayBuffer(); })).then(function (bufs) {
      var entradas = {};
      files.forEach(function (fl, k) { entradas[fl.name] = [new Uint8Array(bufs[k]), { level: 0 }]; });   // JPEG: sin recomprimir
      return new Promise(function (ok, mal) {
        cargarFflate().then(function () {
          window.fflate.zip(entradas, { level: 0 }, function (err, data) { err ? mal(err) : ok(data); });
        }, mal);
      });
    }).then(function (data) {
      guardarBlob(new Blob([data], { type: "application/zip" }), nombreZip());
      ocupado(vTodas, false);
    });
  }

  // ---------- búsqueda
  $("buscar").addEventListener("submit", function (e) { e.preventDefault(); clearTimeout(temporizador); input.blur(); buscar(input.value); });
  input.addEventListener("input", function () {
    clearTimeout(temporizador);
    if (/\D/.test(input.value)) input.value = input.value.replace(/\D/g, "");   // solo números
    limpiar.hidden = !input.value;
    if (!input.value) { buscar(""); return; }
    temporizador = setTimeout(function () { buscar(input.value); }, 450);
  });
  limpiar.addEventListener("click", function () { input.value = ""; buscar(""); input.focus(); });
  $("verTodas").addEventListener("click", function () { input.value = ""; buscar(""); verTodas(); });

  // fflate (ZIP) solo se descarga cuando alguien pulsa "Descargar todas"
  var pFflate = null;
  function cargarFflate() {
    if (window.fflate) return Promise.resolve();
    return pFflate || (pFflate = new Promise(function (ok, mal) {
      var s = document.createElement("script"); s.src = "vendor/fflate.min.js";
      s.onload = function () { window.fflate ? ok() : mal(new Error("fflate")); };
      s.onerror = function () { pFflate = null; mal(new Error("fflate")); };
      document.head.appendChild(s);
    }));
  }
  window.addEventListener("hashchange", function () {
    var h = decodeURIComponent((location.hash || "").slice(1));
    if (todas.length && /^\d{1,4}$/.test(h) && h !== input.value) { if (!visor.hidden) cerrarUI(); input.value = h; buscar(h, true); }
  });
  var fallo = $("fallo");
  function cargarDatos() {
    fallo.hidden = true; galeria.hidden = false; galeria.setAttribute("aria-busy", "true"); estado.textContent = "Cargando fotos…";
    return fetch("data/dorsales.json", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        todas = (d.fotos || []).slice();
        prepararReloj();
        verTodas();
        var h = decodeURIComponent((location.hash || "").slice(1));
        if (/^\d{1,4}$/.test(h)) { input.value = h; buscar(h, true); }
      })
      .catch(function () {   // sin datos: quitar el esqueleto y ofrecer reintentar
        galeria.hidden = true; galeria.removeAttribute("aria-busy"); reloj.hidden = true;
        estado.textContent = ""; fallo.hidden = false;
      });
  }
  $("reintentar").addEventListener("click", function () { input.focus({ preventScroll: true }); cargarDatos(); });
  cargarDatos();
})();
