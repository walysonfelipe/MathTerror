// Zoom da interface aplicado no <html> em telas grandes (ver script no index.html).
// innerWidth/innerHeight, clientX e getBoundingClientRect vêm em pixels da tela; já os
// valores escritos em style (left, top, px de gradiente) são multiplicados pelo zoom.
// Por isso, ao posicionar algo a partir de pixels da tela, divida por uiZoom().
export const uiZoom = () => parseFloat(document.documentElement.style.zoom) || 1;
