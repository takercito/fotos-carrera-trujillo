// Buscar fotos por dorsal (flujo principal) + listado paginado de fotos sin dorsal detectado.
(function () {
  var cfg = window.CONFIG || {};
  var datos = null;
  var $ = function (id) { return document.getElementById(id); };
  var form = $("buscar"), input = $("dorsal"), estado = $("estado"), fotos = $("fotos");
  var sinBtn = $("verSinDorsal"), sinBox = $("sinDorsal"), sinGrid = $("sinGrid"), sinPag = $("sinPag");
  var PAGE = cfg.PAGE_SIZE || 12;

  function cargar() {
    if (datos) return Promise.resolve(datos);
    return fetch("data/dorsales.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { datos = d; return d; });
  }

  function tarjeta(nombre, descarga, alt) {
    var fig = document.createElement("figure");
    var img = document.createElement("img");
    img.src = "thumbs/" + encodeURIComponent(nombre);
    img.alt = alt; img.loading = "lazy"; img.decoding = "async";
    var cap = document.createElement("figcaption");
    var txt = document.createElement("span"); txt.textContent = nombre;
    var a = document.createElement("a");
    a.className = "descargar";
    a.href = "fotos/" + encodeURIComponent(nombre);
    a.setAttribute("download", descarga);
    a.textContent = "Descargar";
    if (window.Watermark && window.Watermark.enabled) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var t = a.textContent; a.textContent = "Preparando…";
        window.Watermark.download(a.href, descarga)
          .catch(function () { window.location.href = a.href; })   // si falla, abre la foto
          .then(function () { a.textContent = t; });
      });
    }
    cap.appendChild(txt); cap.appendChild(a);
    fig.appendChild(img); fig.appendChild(cap);
    return fig;
  }

  function mostrar(num) {
    fotos.innerHTML = "";
    var lista = (datos.dorsales && datos.dorsales[String(num)]) || [];
    if (!lista.length) {
      estado.innerHTML = "";
      estado.appendChild(document.createTextNode("No hemos encontrado fotos con el dorsal " + num +
        ". A veces el dorsal no se lee bien: mira también en "));
      var l = document.createElement("a"); l.href = "#sin-dorsal"; l.textContent = "fotos sin dorsal detectado";
      l.addEventListener("click", function (e) { e.preventDefault(); abrirSin(); });
      estado.appendChild(l); estado.appendChild(document.createTextNode("."));
      return;
    }
    estado.textContent = lista.length + (lista.length === 1 ? " foto" : " fotos") + " del dorsal " + num + ":";
    lista.forEach(function (n) { fotos.appendChild(tarjeta(n, "CSR_dorsal" + num + "_" + n, "Foto del dorsal " + num)); });
  }

  function buscar() {
    var v = (input.value || "").replace(/\D/g, "").replace(/^0+/, "");
    if (!v) { estado.textContent = "Escribe un número de dorsal."; fotos.innerHTML = ""; return; }
    var n = parseInt(v, 10);
    estado.textContent = "Buscando…";
    cargar().then(function () {
      mostrar(n);
      if (history.replaceState) history.replaceState(null, "", "#" + n);
    }).catch(function () { estado.textContent = "No se han podido cargar los datos. Inténtalo de nuevo en un momento."; });
  }

  function pagina(p) {
    var lista = datos.sin_dorsal || [];
    var total = Math.max(1, Math.ceil(lista.length / PAGE));
    p = Math.min(Math.max(1, p), total);
    sinGrid.innerHTML = "";
    lista.slice((p - 1) * PAGE, p * PAGE).forEach(function (n) {
      sinGrid.appendChild(tarjeta(n, "CSR_" + n, "Foto sin dorsal detectado"));
    });
    sinPag.innerHTML = "";
    if (!lista.length) { sinPag.textContent = "No hay fotos sin dorsal."; return; }
    var prev = document.createElement("button"); prev.type = "button"; prev.textContent = "‹ Anteriores";
    prev.disabled = p <= 1; prev.onclick = function () { pagina(p - 1); sinBox.scrollIntoView(); };
    var info = document.createElement("span"); info.textContent = "Página " + p + " de " + total + " (" + lista.length + " fotos)";
    var next = document.createElement("button"); next.type = "button"; next.textContent = "Siguientes ›";
    next.disabled = p >= total; next.onclick = function () { pagina(p + 1); sinBox.scrollIntoView(); };
    sinPag.appendChild(prev); sinPag.appendChild(info); sinPag.appendChild(next);
  }

  function abrirSin() {
    cargar().then(function () { sinBox.hidden = false; sinBtn.setAttribute("aria-expanded", "true"); pagina(1); sinBox.scrollIntoView(); })
      .catch(function () { estado.textContent = "No se han podido cargar los datos."; });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); input.blur(); buscar(); });
  sinBtn.addEventListener("click", function () {
    if (sinBox.hidden) abrirSin(); else { sinBox.hidden = true; sinBtn.setAttribute("aria-expanded", "false"); }
  });
  var h = (location.hash || "").replace("#", "");
  if (/^\d{1,3}$/.test(h)) { input.value = h; buscar(); }
  else if (h === "sin-dorsal") abrirSin();
})();
