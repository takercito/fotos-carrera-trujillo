// Marca de agua opcional en el navegador, al descargar (no se guarda en el servidor).
// Si CONFIG.WATERMARK_ENABLED es false, el enlace <a download> descarga el archivo original.
(function () {
  var cfg = window.CONFIG || {};
  var logoPromise = null;

  function loadImage(url) {
    return new Promise(function (ok, ko) {
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { ko(new Error("No se pudo cargar " + url)); };
      img.src = url;               // misma web => el canvas no queda "contaminado"
    });
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

  // Dibuja foto + logo en un canvas; devuelve una promesa con el JPEG (Blob).
  function render(photoUrl) {
    logoPromise = logoPromise || loadImage(cfg.LOGO_URL || "logo.png");
    return Promise.all([loadImage(photoUrl), logoPromise]).then(function (r) {
      var photo = r[0], logo = r[1];
      var W = photo.naturalWidth, H = photo.naturalHeight;
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      var ctx = c.getContext("2d");
      ctx.drawImage(photo, 0, 0);
      var lw = Math.max(60, Math.round(W * (cfg.LOGO_WIDTH || 0.09)));
      var lh = Math.round(logo.naturalHeight * lw / logo.naturalWidth);
      var m = Math.round(W * (cfg.LOGO_MARGIN || 0.022));
      ctx.save();
      ctx.globalAlpha = cfg.LOGO_OPACITY || 0.92;
      ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = Math.max(4, lw / 20);
      ctx.shadowOffsetX = ctx.shadowOffsetY = Math.max(1, lw / 60);
      ctx.drawImage(logo, W - lw - m, H - lh - m, lw, lh);
      ctx.restore();
      return toBlob(c, cfg.JPEG_QUALITY || 0.92);
    });
  }

  function downloadWithLogo(photoUrl, name) {
    return render(photoUrl).then(function (blob) { saveBlob(blob, name); });
  }

  window.Watermark = { enabled: !!cfg.WATERMARK_ENABLED, render: render, download: downloadWithLogo };
})();
