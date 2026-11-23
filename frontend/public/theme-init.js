(() => {
  try {
    const theme = localStorage.getItem('cekikilami_theme') === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#f6ead9' : '#150f24');
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
})();
