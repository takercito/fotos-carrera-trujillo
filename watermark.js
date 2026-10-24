// Logo del club en las fotos que salen de la web (descargar, ZIP, compartir y la foto del visor), hecho en el navegador
// con un canvas (los archivos del servidor no se tocan). El logo es OBLIGATORIO: si no se puede cargar, no se entrega
// ninguna foto (se reintenta y, si sigue fallando, la promesa se rechaza con err.logo = true).
(function () {
  var cfg = window.CONFIG || {};
  var LOGO_URL = cfg.LOGO_URL || "logo.png";
  var logoPromise = null;

  function loadImage(url) {
    return new Promise(function (ok, ko) {
      var img = new Image();
      img.onload = function () { img.naturalWidth ? ok(img) : ko(new Error("Imagen vacía " + url)); };
      img.onerror = function () { ko(new Error("No se pudo cargar " + url)); };
      img.src = url;               // misma web => el canvas no queda "contaminado"
    });
  }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  // Promesa con el logo (Image): 3 intentos; si fallan, se rechaza (y la próxima llamada vuelve a intentarlo).
  function logo() {
    if (logoPromise) return logoPromise;
    var intento = function (n) {
      return loadImage(LOGO_URL).catch(function (e) {
        if (n >= 2) throw e;
        return wait(400 * (n + 1)).then(function () { return intento(n + 1); });
      });
    };
    logoPromise = intento(0).catch(function () {
      logoPromise = null;
      var err = new Error("No se pudo cargar el logo"); err.logo = true; throw err;
    });
    return logoPromise;
  }

  function toBlob(canvas, q) {
    return new Promise(function (ok, ko) {
      if (canvas.toBlob) canvas.toBlob(function (b) { b ? ok(b) : ko(new Error("toBlob")); }, "image/jpeg", q);
      else ok(fetch(canvas.toDataURL("image/jpeg", q)).then(function (r) { return r.blob(); }));
    });
  }

  // Caja del logo (abajo a la derecha) para una imagen de W x H: [x, y, ancho, alto].
  function box(W, H, lw0, lh0) {
    var lw = Math.max(1, Math.round(W * (cfg.LOGO_WIDTH || 0.2)));   // proporcional (también en pantalla)
    var lh = Math.round(lh0 * lw / lw0), m = Math.round(W * (cfg.LOGO_MARGIN || 0.022));
    return [W - lw - m, H - lh - m, lw, lh];
  }

  function stamp(ctx, W, H, img) {
    if (!img || !img.naturalWidth) throw new Error("Sin logo");   // nunca se pinta una foto sin logo
    var b = box(W, H, img.naturalWidth, img.naturalHeight);
    ctx.save();
    ctx.globalAlpha = cfg.LOGO_OPACITY || 0.9;      // el PNG ya lleva su halo oscuro
    ctx.drawImage(img, b[0], b[1], b[2], b[3]);
    ctx.restore();
  }

  // Foto con el logo abajo a la derecha -> {blob (JPEG), photo (Image original), logo (Image)}.
  // region(W, H) -> [sx, sy, sw, sh] opcional (recorte 4:5): el logo va en la esquina del recorte. Sin metadatos.
  function compose(photoUrl, region) {
    return Promise.all([loadImage(photoUrl), logo()]).then(function (r) {
      var photo = r[0], lg = r[1];
      var q = region ? region(photo.naturalWidth, photo.naturalHeight) : [0, 0, photo.naturalWidth, photo.naturalHeight];
      var c = document.createElement("canvas"); c.width = q[2]; c.height = q[3];
      var ctx = c.getContext("2d");
      ctx.drawImage(photo, q[0], q[1], q[2], q[3], 0, 0, q[2], q[3]);
      stamp(ctx, q[2], q[3], lg);
      return toBlob(c, cfg.JPEG_QUALITY || 0.9).then(function (blob) { return { blob: blob, photo: photo, logo: lg }; });
    });
  }
  function render(photoUrl, region) { return compose(photoUrl, region).then(function (r) { return r.blob; }); }

  window.Watermark = { enabled: true, logo: logo, box: box, stamp: stamp, compose: compose, render: render };
})();
