import * as pdfjsLib from './assets/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./assets/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

function createPdfViewer(root) {
  const scrollable = root.hasAttribute('data-pdf-scroll');
  const canvas = root.querySelector('[data-pdf-canvas]');
  const pageStack = root.querySelector('[data-pdf-page-stack]');
  const canvasWrap = root.querySelector('[data-pdf-wrap]');
  const errorMessage = root.querySelector('[data-pdf-error]');
  const pageNumber = root.querySelector('[data-pdf-page]');
  const pageCount = root.querySelector('[data-pdf-pages]');
  const zoomLabel = root.querySelector('[data-pdf-zoom]');
  const previousButton = root.querySelector('[data-pdf-prev]');
  const nextButton = root.querySelector('[data-pdf-next]');
  const zoomOutButton = root.querySelector('[data-pdf-zoom-out]');
  const zoomInButton = root.querySelector('[data-pdf-zoom-in]');

  let pdfDocument;
  let currentPage = 1;
  let zoom = 1;
  let renderTask;

  function updateControls() {
    if (pageNumber) pageNumber.textContent = currentPage;
    if (pageCount) pageCount.textContent = pdfDocument?.numPages ?? pageCount.textContent;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    if (previousButton) previousButton.disabled = currentPage <= 1;
    if (nextButton) nextButton.disabled = !pdfDocument || currentPage >= pdfDocument.numPages;
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

  async function renderAllPages() {
    pageStack.replaceChildren();
    const availableWidth = Math.max(canvasWrap.clientWidth - 56, 280);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex += 1) {
      const page = await pdfDocument.getPage(pageIndex);
      const naturalViewport = page.getViewport({ scale: 1 });
      const fitScale = availableWidth / naturalViewport.width;
      const viewport = page.getViewport({ scale: fitScale * zoom });
      const pageCanvas = document.createElement('canvas');
      const context = pageCanvas.getContext('2d');

      pageCanvas.className = 'pdf-page-canvas';
      pageCanvas.setAttribute('aria-label', `Rendered TA presentation guide page ${pageIndex}`);
      pageCanvas.width = Math.floor(viewport.width * pixelRatio);
      pageCanvas.height = Math.floor(viewport.height * pixelRatio);
      pageCanvas.style.width = `${Math.floor(viewport.width)}px`;
      pageCanvas.style.height = `${Math.floor(viewport.height)}px`;
      pageStack.append(pageCanvas);

      await page.render({
        canvasContext: context,
        viewport,
        transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      }).promise;
    }

    updateControls();
  }

  async function loadViewer() {
    try {
      const pdfUrl = new URL(root.dataset.pdfUrl, document.baseURI).href;
      pdfDocument = await pdfjsLib.getDocument(pdfUrl).promise;
      await (scrollable ? renderAllPages() : renderPage());
    } catch (error) {
      console.error(`Unable to load ${root.dataset.pdfLabel || 'PDF'}:`, error);
      if (canvas) canvas.hidden = true;
      if (pageStack) pageStack.hidden = true;
      errorMessage.hidden = false;
    }
  }

  previousButton?.addEventListener('click', async () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    canvasWrap.scrollTo({ top: 0, left: 0 });
    await renderPage();
  });

  nextButton?.addEventListener('click', async () => {
    if (!pdfDocument || currentPage >= pdfDocument.numPages) return;
    currentPage += 1;
    canvasWrap.scrollTo({ top: 0, left: 0 });
    await renderPage();
  });

  zoomOutButton.addEventListener('click', async () => {
    zoom = Math.max(0.6, zoom - 0.2);
    await (scrollable ? renderAllPages() : renderPage());
  });

  zoomInButton.addEventListener('click', async () => {
    zoom = Math.min(2, zoom + 0.2);
    await (scrollable ? renderAllPages() : renderPage());
  });

  updateControls();
  loadViewer();

  return { renderPage: () => pdfDocument && (scrollable ? renderAllPages() : renderPage()) };
}

const viewers = [...document.querySelectorAll('.pdf-js-viewer')].map(createPdfViewer);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    viewers.forEach((viewer) => viewer.renderPage());
  }, 150);
});
