const codeBlocks = document.querySelectorAll('[data-code-src]');

for (const codeBlock of codeBlocks) {
  try {
    const sourceUrl = new URL(codeBlock.dataset.codeSrc, document.baseURI);
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    codeBlock.textContent = await response.text();
  } catch (error) {
    console.error('Unable to load code sample:', error);
    codeBlock.textContent = 'Unable to load the firmware sample.';
  }
}
