import * as pdfjsLib from './assets/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/pdfjs/pdf.worker.min.mjs';

const canvas = document.querySelector('#resume-canvas');
const canvasWrap = document.querySelector('#pdf-canvas-wrap');
const errorMessage = document.querySelector('#pdf-error');
const pageNumber = document.querySelector('#pdf-page');
const pageCount = document.querySelector('#pdf-pages');
const zoomLabel = document.querySelector('#pdf-zoom');
const previousButton = document.querySelector('#pdf-prev');
const nextButton = document.querySelector('#pdf-next');
const zoomOutButton = document.querySelector('#pdf-zoom-out');
const zoomInButton = document.querySelector('#pdf-zoom-in');

let pdfDocument;
let currentPage = 1;
let zoom = 1;
let renderTask;

function updateControls() {
  pageNumber.textContent = currentPage;
  pageCount.textContent = pdfDocument?.numPages ?? 1;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  previousButton.disabled = currentPage <= 1;
  nextButton.disabled = !pdfDocument || currentPage >= pdfDocument.numPages;
  zoomOutButton.disabled = zoom <= 0.6;
  zoomInButton.disabled = zoom >= 2;
}

async function renderPage() {
  const page = await pdfDocument.getPage(currentPage);
  const naturalViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(canvasWrap.clientWidth - 56, 280);
  const fitScale = availableWidth / naturalViewport.width;
  const viewport = page.getViewport({ scale: fitScale * zoom });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const context = canvas.getContext('2d');

  if (renderTask) renderTask.cancel();

  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  renderTask = page.render({
    canvasContext: context,
    viewport,
    transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
  });

  try {
    await renderTask.promise;
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException') throw error;
  } finally {
    renderTask = null;
  }

  updateControls();
}

async function loadViewer() {
  try {
    pdfDocument = await pdfjsLib.getDocument('./assets/resume.pdf').promise;
    await renderPage();
  } catch (error) {
    console.error('Unable to load resume PDF:', error);
    canvas.hidden = true;
    errorMessage.hidden = false;
  }
}

previousButton.addEventListener('click', async () => {
  if (currentPage <= 1) return;
  currentPage -= 1;
  canvasWrap.scrollTo({ top: 0, left: 0 });
  await renderPage();
});

nextButton.addEventListener('click', async () => {
  if (!pdfDocument || currentPage >= pdfDocument.numPages) return;
  currentPage += 1;
  canvasWrap.scrollTo({ top: 0, left: 0 });
  await renderPage();
});

zoomOutButton.addEventListener('click', async () => {
  zoom = Math.max(0.6, zoom - 0.2);
  await renderPage();
});

zoomInButton.addEventListener('click', async () => {
  zoom = Math.min(2, zoom + 0.2);
  await renderPage();
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (pdfDocument) renderPage();
  }, 150);
});

updateControls();
loadViewer();
