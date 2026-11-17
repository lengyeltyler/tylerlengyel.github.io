(() => {
  const tabs = [...document.querySelectorAll('[data-art-section]')];
  function selectSection() {
    const requested = location.hash.slice(1);
    const selected = tabs.some(tab => tab.dataset.artSection === requested) ? requested : 'pepe';
    for (const tab of tabs) {
      const active = tab.dataset.artSection === selected;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    for (const panel of document.querySelectorAll('[data-art-panel]')) {
      panel.hidden = panel.id !== selected;
    }
  }
  window.addEventListener('hashchange', selectSection);
  selectSection();
  const dialog = document.querySelector('[data-kiera-dialog]');
  const preview = dialog.querySelector('img');
  const title = dialog.querySelector('h2');
  const original = dialog.querySelector('[data-kiera-original]');
  const release = dialog.querySelector('[data-kiera-release]');
  for (const button of document.querySelectorAll('[data-kiera-image]')) {
    button.addEventListener('click', () => {
      preview.src = button.dataset.kieraImage;
      preview.alt = button.dataset.title;
      title.textContent = button.dataset.title;
      original.href = button.dataset.kieraImage;
      release.href = button.dataset.release;
      release.textContent = 'View on ' + (button.dataset.marketplace || 'Manifold');
      dialog.showModal();
    });
  }
  dialog.querySelector('[data-kiera-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();
