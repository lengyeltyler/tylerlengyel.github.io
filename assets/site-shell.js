(() => {
  const THEME_KEY = "tylerlengyel-theme";
  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  const favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/svg+xml";
  favicon.href = "/assets/favicon.svg";
  document.head.appendChild(favicon);

  function readTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return stored === "light" || stored === "dark" ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function preferredTheme() {
    return readTheme() || (systemTheme.matches ? "dark" : "light");
  }

  function updateThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#17191C" : "#EAE7DF");
  }

  function updateThemeButtons(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const isDark = theme === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
      const value = button.querySelector("[data-theme-value]");
      if (value) value.textContent = isDark ? "DARK" : "LIGHT";
    });
  }

  function applyTheme(theme, persist = false) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = safeTheme;
    root.style.colorScheme = safeTheme;
    updateThemeColor(safeTheme);
    updateThemeButtons(safeTheme);

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, safeTheme);
      } catch (error) {
        return;
      }
    }
  }

  function navLink(href, label, id, active) {
    const current = active === id ? ' aria-current="page"' : "";
    return `<a href="${href}"${current}>${label}</a>`;
  }

  function socialLink(href, label, mark) {
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}"><span aria-hidden="true">${mark}</span></a>`;
  }

  function headerMarkup(active) {
    const navigation = [
      ["/", "Home", "home"],
      ["/linearA/", "Linear A", "linear-a"],
      ["/createPhil/", "createPhil", "create-phil"],
      ["/nakes/", "nakes", "nakes"],
      ["/art/", "Art", "art"],
      ["/svg-editor/", "SVG Editor", "svg-editor"]
    ].map(([href, label, id]) => navLink(href, label, id, active)).join("");

    const socials = [
      ["https://x.com/tyler_lengyel", "X account for Tyler Lengyel", "X"],
      ["https://github.com/lengyeltyler", "Tyler Lengyel on GitHub", "GH"],
      ["https://www.linkedin.com/in/tyler-lengyel-b16b12368/", "Tyler Lengyel on LinkedIn", "in"],
      ["https://www.instagram.com/lengyel_tyler/", "Tyler Lengyel on Instagram", "IG"],
      ["https://www.facebook.com/profile.php?id=61572755744935", "Tyler Lengyel on Facebook", "f"],
      ["https://substack.com/@0xling?r=1p4uy1&utm_campaign=profile&utm_medium=profile-page", "Tyler Lengyel on Substack", "S"]
    ].map(([href, label, mark]) => socialLink(href, label, mark)).join("");

    return `
      <div class="site-frame">
        <nav class="site-tabs" aria-label="Primary navigation">${navigation}</nav>
        <div class="site-tools">
          <div class="social-links" role="group" aria-label="Social links">${socials}</div>
          <button class="theme-toggle" type="button" data-theme-toggle aria-pressed="false">
            <span class="theme-label" aria-hidden="true">MODE</span>
            <span data-theme-value>LIGHT</span>
          </button>
        </div>
      </div>`;
  }

  function buildHeader() {
    document.querySelectorAll("[data-site-header]").forEach((header) => {
      header.classList.add("site-header");
      header.innerHTML = headerMarkup(header.dataset.siteHeader || "");
    });

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
      });
    });

    updateThemeButtons(root.dataset.theme);
  }

  function handleSystemChange() {
    if (readTheme()) return;
    applyTheme(systemTheme.matches ? "dark" : "light");
  }

  applyTheme(preferredTheme());

  if (typeof systemTheme.addEventListener === "function") {
    systemTheme.addEventListener("change", handleSystemChange);
  } else if (typeof systemTheme.addListener === "function") {
    systemTheme.addListener(handleSystemChange);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildHeader, { once: true });
  } else {
    buildHeader();
  }

  window.SiteShell = { applyTheme };
})();
