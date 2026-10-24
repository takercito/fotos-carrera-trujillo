// Configuración del sitio.
window.CONFIG = {
  WATERMARK_ENABLED: true,    // logo del club OBLIGATORIO en toda foto que sale de la web (watermark.js no permite quitarlo)
  LOGO_URL: "logo.png",       // PNG blanco con transparencia (generado con make_logo_web.py)
  LOGO_WIDTH: 0.2,            // ancho del logo = 20 % del ancho de la foto (o del recorte 4:5)
  LOGO_MARGIN: 0.022,         // margen a la esquina inferior derecha
  LOGO_OPACITY: 0.9,
  JPEG_QUALITY: 0.9,
  BATCH_SIZE: 18,             // miniaturas por lote (scroll infinito)
  DOWNLOAD_PREFIX: "carrera-trujillo"   // nombre de los archivos descargados
};
