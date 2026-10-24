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
  // vLista = fotos que recorre el visor (la galería/búsqueda, o la tira de un corredor si se salta a ella)
  var vLista = [], vTit = $("vTit"), vSub = $("vSub"), vRel = $("vRel"), vRelTit = $("vRelTit"), vRelTira = $("vRelTira");
  var vChips = $("vChips"), vComp = $("vComp"), vTodas = $("vTodas"), aviso = $("aviso"), relActual = [];
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
      vChips.appendChild(b);
    });
  }
  function pintarTira(f) {
    pintarChips(f);
    var rel = relacionadas(selK); relActual = rel;
    vRelTira.textContent = "";
    var multi = corredores(f).length > 1;
    if (rel.length < 2 && !multi) { vRel.hidden = true; vTodas.hidden = true; return; }
    vRel.hidden = false;
    vRelTit.innerHTML = rel.length < 2 ? "Elige corredor" : "Más fotos de <b>" + nombreRel(selK, f) + "</b> · " + rel.length;
    vRelTira.hidden = rel.length < 2;
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
    vImg.src = "fotos/" + encodeURIComponent(f.f);
    vImg.alt = "Foto " + (i + 1) + " de " + vLista.length;
    vTit.textContent = f.d && f.d.length ? "Dorsal " + f.d.join(" · ") : "Sin dorsal";
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
    if (!c || !vImg.complete || !vImg.naturalWidth) { vCanvas.hidden = true; vImg.hidden = false; return; }
    var q = rect45(c, vImg.naturalWidth, vImg.naturalHeight), sx = q[0], sy = q[1], sw = q[2], sh = q[3];
    vCanvas.width = sw; vCanvas.height = sh;
    vCanvas.getContext("2d").drawImage(vImg, sx, sy, sw, sh, 0, 0, sw, sh);
    vCanvas.hidden = false; vImg.hidden = true;
  }
  vImg.addEventListener("load", function () { pintarRecorte(); prepararCompartir(); });
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
  function aBlob(canvas) {
    return new Promise(function (ok, mal) {
      canvas.toBlob(function (b) { b ? ok(b) : mal(new Error("toBlob")); }, "image/jpeg", cfg.JPEG_QUALITY || 0.92);
    });
  }
  function cargarImg(url) {
    return new Promise(function (ok, mal) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = mal; im.src = url; });
  }
  // Blob JPEG de una foto: completa (el archivo tal cual) o recortada con su encuadre
  function blobDeFoto(f, recortar) {
    var url = "fotos/" + encodeURIComponent(f.f);
    var cr = recortar ? cropDe(f) : null;
    if (!cr) return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); });
    return cargarImg(url).then(function (im) {
      var cv = document.createElement("canvas"), q = rect45(cr, im.naturalWidth, im.naturalHeight);
      var sx = q[0], sy = q[1], sw = q[2], sh = q[3];
      cv.width = sw; cv.height = sh; cv.getContext("2d").drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
      return aBlob(cv);
    });
  }
  function nombreArchivo(f, recortado) { return nombreDescarga(f).replace(/\.jpg$/i, recortado && cropDe(f) ? "_encuadre.jpg" : ".jpg"); }

  function abrir(i) {
    vLista = lista;
    visor.hidden = false; document.body.classList.add("bloqueado");
    if (history.pushState && !(history.state && history.state.visor)) history.pushState({ visor: true }, "", location.href);
    mostrar(i); $("vCerrar").focus();
  }
  function cerrarUI() { visor.hidden = true; document.body.classList.remove("bloqueado"); vImg.removeAttribute("src"); aviso.hidden = true; }
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
    if (x0 !== null) (vCanvas.hidden ? vImg : vCanvas).style.transform = "translateX(" + (e.touches[0].clientX - x0) * 0.6 + "px)";
  }, { passive: true });
  zona.addEventListener("touchend", function (e) {
    vImg.style.transform = ""; vCanvas.style.transform = "";
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) mostrar(actual + (dx < 0 ? 1 : -1));
    else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) cerrar();   // deslizar hacia abajo = cerrar
  });

  // ---------- Descargar foto
  vDesc.addEventListener("click", function (e) {
    var c = recorteActivo();
    if (c && !vCanvas.hidden) {   // descarga recortada, generada aquí (JPEG ~0.92)
      e.preventDefault();
      var nombre = vDesc.getAttribute("download").replace(/\.jpg$/i, "_encuadre.jpg");
      ocupado(vDesc, true, "Preparando…");
      aBlob(vCanvas).then(function (b) { guardarBlob(b, nombre); }, function () { window.location.href = vDesc.href; })
        .then(function () { ocupado(vDesc, false); });
      return;
    }
    if (!(window.Watermark && window.Watermark.enabled)) return;   // descarga directa del archivo completo
    e.preventDefault();
    ocupado(vDesc, true, "Preparando…");
    window.Watermark.download(vDesc.href, vDesc.getAttribute("download"))
      .catch(function () { window.location.href = vDesc.href; })
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
        if (!window.fflate) return mal(new Error("fflate"));
        window.fflate.zip(entradas, { level: 0 }, function (err, data) { err ? mal(err) : ok(data); });
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
