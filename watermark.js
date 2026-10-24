// Logo del club en las fotos descargadas / compartidas, hecho en el navegador con un canvas (los archivos del servidor no se tocan).
// Si CONFIG.WATERMARK_ENABLED es false o LOGO_URL está vacío, no se añade logo. Si el logo no carga, la foto sale sin él.
(function () {
  var cfg = window.CONFIG || {};
  var enabled = !!(cfg.WATERMARK_ENABLED && cfg.LOGO_URL);
  var logoPromise = null;

  function loadImage(url) {
    return new Promise(function (ok, ko) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { ko(new Error("No se pudo cargar " + url)); };
      img.src = url;               // misma web => el canvas no queda "contaminado"
    });
  }

  // Promesa con el logo (Image) o null si está desactivado o no carga (se reintenta la próxima vez).
  function logo() {
    if (!enabled) return Promise.resolve(null);
    return logoPromise || (logoPromise = loadImage(cfg.LOGO_URL).catch(function () { logoPromise = null; return null; }));
  }

  function toBlob(canvas, q) {
    return new Promise(function (ok, ko) {
      if (canvas.toBlob) canvas.toBlob(function (b) { b ? ok(b) : ko(new Error("toBlob")); }, "image/jpeg", q);
      else ok(fetch(canvas.toDataURL("image/jpeg", q)).then(function (r) { return r.blob(); }));
    });
  }

  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  // Caja del logo (abajo a la derecha) para una imagen de W x H: [x, y, ancho, alto].
  function box(W, H, lw0, lh0) {
    var lw = Math.max(1, Math.round(W * (cfg.LOGO_WIDTH || 0.2)));   // proporcional (también en pantalla)
    var lh = Math.round(lh0 * lw / lw0), m = Math.round(W * (cfg.LOGO_MARGIN || 0.022));
    return [W - lw - m, H - lh - m, lw, lh];
  }

  function stamp(ctx, W, H, img) {
    if (!img) return;
    var b = box(W, H, img.naturalWidth, img.naturalHeight);
    ctx.save();
    ctx.globalAlpha = cfg.LOGO_OPACITY || 0.9;      // el PNG ya lleva su halo oscuro
    ctx.drawImage(img, b[0], b[1], b[2], b[3]);
    ctx.restore();
  }

  // JPEG (Blob) de una foto con el logo abajo a la derecha. region(W, H) -> [sx, sy, sw, sh] opcional (recorte 4:5):
  // el logo va en la esquina del recorte. Sin metadatos (el canvas no copia EXIF).
  function render(photoUrl, region) {
    return Promise.all([loadImage(photoUrl), logo()]).then(function (r) {
      var photo = r[0], lg = r[1];
      var q = region ? region(photo.naturalWidth, photo.naturalHeight) : [0, 0, photo.naturalWidth, photo.naturalHeight];
      var c = document.createElement("canvas"); c.width = q[2]; c.height = q[3];
      var ctx = c.getContext("2d");
      ctx.drawImage(photo, q[0], q[1], q[2], q[3], 0, 0, q[2], q[3]);
      stamp(ctx, q[2], q[3], lg);
      return toBlob(c, cfg.JPEG_QUALITY || 0.9);
    });
  }

  function downloadWithLogo(photoUrl, name, region) {
    return render(photoUrl, region).then(function (blob) { saveBlob(blob, name); });
  }

  window.Watermark = { enabled: enabled, logo: logo, box: box, render: render, download: downloadWithLogo };
})();
