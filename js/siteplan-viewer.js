// ===== Siteplan Viewer Script (PDF.js) =====
// PDF.js stable via cdnjs (ESM)
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.146/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.146/pdf.worker.min.mjs';




// Helpers
const $ = (id) => document.getElementById(id);
const root = document.getElementById('pdfx');
if (!root) {
  console.error('[pdfx] #pdfx tidak ditemukan');
}

const url = root?.dataset?.pdf || '';
if (!url) {
  console.error('[pdfx] data-pdf kosong');
}

// UI refs (tahan null)
const canvas = $('pdfx-canvas');
const ctx = canvas?.getContext?.('2d', { alpha: false });
const zoomInBtn = $('pdfx-zoomin');
const zoomOutBtn = $('pdfx-zoomout');
const fitBtn = $('pdfx-fit');
const zoomLabel = $('pdfx-zoomlabel');
const prevBtn = $('pdfx-prev');
const nextBtn = $('pdfx-next');
const pageInput = $('pdfx-page');
const pagesLabel = $('pdfx-pages');
const downloadBtn = $('pdfx-download');
const fallback = $('pdfx-fallback');
const stage = root?.querySelector?.('.pdfx-stage');
const wrap = root?.querySelector?.('.pdfx-canvaswrap');

if (downloadBtn && url) downloadBtn.href = url;
if (fallback && url) fallback.href = url;

let pdfDoc = null;
let currentPage = 1;
let scale = 1.0;         // skala logis (sebelum DPR)
let isRendering = false;
let pendingPage = null;

// DPR untuk layar hi-dpi
const DPR = window.devicePixelRatio || 1;

function setZoomLabel() {
  if (zoomLabel) zoomLabel.textContent = Math.round(scale * 100) + '%';
}

async function renderPage(num) {
  if (!pdfDoc || !canvas || !ctx) return;

  isRendering = true;
  const page = await pdfDoc.getPage(num);

  // viewport untuk layout CSS
  const viewportCss = page.getViewport({ scale });

  // Atur ukuran canvas visual (CSS px)
  canvas.style.width = Math.floor(viewportCss.width) + 'px';
  canvas.style.height = Math.floor(viewportCss.height) + 'px';
  if (wrap) {
    wrap.style.width = canvas.style.width;
    wrap.style.height = canvas.style.height;
  }

  // viewport untuk render (kalikan DPR)
  const viewportRender = page.getViewport({ scale: scale * DPR });

  // Atur resolusi bitmap canvas
  canvas.width = Math.floor(viewportRender.width);
  canvas.height = Math.floor(viewportRender.height);

  await page.render({
    canvasContext: ctx,
    viewport: viewportRender,
    intent: 'display'
  }).promise;

  isRendering = false;
  if (pendingPage !== null) {
    const n = pendingPage; pendingPage = null; renderPage(n);
  }
}

function queueRenderPage(num) {
  if (isRendering) pendingPage = num;
  else renderPage(num);
}

function goToPage(num) {
  if (!pdfDoc) return;
  const n = Math.min(Math.max(1, num), pdfDoc.numPages);
  currentPage = n;
  if (pageInput) pageInput.value = String(n);
  queueRenderPage(n);
  updateNavButtons();
}

function updateNavButtons() {
  if (!pdfDoc) return;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= pdfDoc.numPages;
}

// Fit-to-width yang mengikuti padding stage
async function fitToWidthSmart() {
  if (!pdfDoc || !stage) return;
  const page = await pdfDoc.getPage(currentPage);
  const base = page.getViewport({ scale: 1 });
  const cs = getComputedStyle(stage);
  const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) || 0;
  const available = stage.clientWidth - paddingX - 2; // kurangi border
  scale = Math.max(0.2, Math.min(6, available / base.width));
  setZoomLabel();
  queueRenderPage(currentPage);
}

function zoom(factor) {
  const next = Math.min(6, Math.max(0.2, scale * factor));
  if (Math.abs(next - scale) < 0.001) return;
  scale = next;
  setZoomLabel();
  queueRenderPage(currentPage);
}

// Events (guarded)
zoomInBtn?.addEventListener('click', () => zoom(1.15));
zoomOutBtn?.addEventListener('click', () => zoom(1 / 1.15));
fitBtn?.addEventListener('click', fitToWidthSmart);
prevBtn?.addEventListener('click', () => goToPage(currentPage - 1));
nextBtn?.addEventListener('click', () => goToPage(currentPage + 1));
pageInput?.addEventListener('change', () => goToPage(parseInt(pageInput.value || '1', 10)));

// Ctrl/Cmd + wheel zoom
stage?.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  zoom(e.deltaY > 0 ? 1 / 1.1 : 1.1);
}, { passive: false });

// Fit on resize
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => fitToWidthSmart(), 150);
});

// Load PDF
(async function init() {
  try {
    if (!root || !canvas || !ctx || !stage || !wrap) {
      console.error('[pdfx] Markup tidak lengkap. Cek id elemen.');
      return;
    }
    if (!url) {
      console.error('[pdfx] data-pdf kosong / salah');
      return;
    }

    // Debug helpful logs:
    console.log('[pdfx] Loading:', url);

    const loadingTask = pdfjsLib.getDocument({ url });
    pdfDoc = await loadingTask.promise;

    if (pagesLabel) pagesLabel.textContent = String(pdfDoc.numPages);
    setZoomLabel();
    await fitToWidthSmart();
    goToPage(1);

    console.log('[pdfx] Loaded pages:', pdfDoc.numPages);
  } catch (err) {
    console.error('Gagal memuat PDF:', err);
  }
})();
