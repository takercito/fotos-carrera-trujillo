// Configuración del sitio.
// Para añadir el logo del club a las fotos al descargarlas, pon WATERMARK_ENABLED: true
window.CONFIG = {
  WATERMARK_ENABLED: false,   // false = se descarga la foto original tal cual
  LOGO_URL: "logo.png",       // logo (PNG con transparencia) en esta misma web
  LOGO_WIDTH: 0.09,           // ancho del logo = 9 % del ancho de la foto
  LOGO_MARGIN: 0.022,         // margen a la esquina inferior derecha (2,2 % del ancho)
  LOGO_OPACITY: 0.92,
  JPEG_QUALITY: 0.92,
  PAGE_SIZE: 12               // miniaturas por página en "Fotos sin dorsal detectado"
};
