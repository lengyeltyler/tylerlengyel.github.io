(function () {
  const MOTION_KEY = "site-motion-preference";
  const WRITING_KEY = "site-writing-played";
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  async function loadJSON(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return response.json();
  }

  function setLatestBadges(summary) {
    const time = summary.run_utc || "unknown";
    const confidence =
      typeof summary.final_confidence === "number"
        ? `${summary.final_confidence.toFixed(2)}%`
        : "n/a";

    document.querySelectorAll("[data-latest-run]").forEach((element) => {
      element.innerHTML = `<strong>${time}</strong> <span>confidence ${confidence}</span>`;
    });
  }

  function fillTechSummary(summary) {
    const target = document.querySelector("[data-tech-summary]");
    if (!target) return;

    const limitingFactors = Array.isArray(summary.limiting_factors)
      ? summary.limiting_factors.join(", ")
      : "none";

    target.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Observations (all sources)</td><td>${summary.observations_all_sources ?? "n/a"}</td></tr>
            <tr><td>Canonical lines</td><td>${summary.canonical_entries ?? "n/a"}</td></tr>
            <tr><td>Artifacts</td><td>${summary.artifact_count ?? "n/a"}</td></tr>
            <tr><td>Winning model</td><td>${summary.winner_model_id ?? "n/a"}</td></tr>
            <tr><td>Final confidence</td><td>${summary.final_confidence ?? "n/a"}%</td></tr>
            <tr><td>Limiting factors</td><td>${limitingFactors}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  async function embedPlainEnglish() {
    const host = document.querySelector("[data-embed-plain-english]");
    if (!host) return;

    try {
      const response = await fetch("/linearA/research/output/latest/plain_english_summary.html", {
        cache: "no-store"
      });
      if (!response.ok) throw new Error("summary not found");

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Sanitize: only allow known-safe element types before injecting into the page.
      // This guards against unexpected script or iframe content if the generated file
      // were ever corrupted or replaced, even though the source is same-origin.
      const ALLOWED_TAGS = new Set([
        "P","UL","OL","LI","STRONG","EM","B","I","SPAN","BR",
        "H2","H3","H4","H5","H6",
        "TABLE","THEAD","TBODY","TR","TH","TD",
        "CODE","PRE","BLOCKQUOTE","HR","DL","DT","DD"
      ]);
      const BLOCKED_ATTRS = /^on/i; // strip inline event handlers

      function sanitizeNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(false);
        if (node.nodeType !== Node.ELEMENT_NODE) return null;
        if (!ALLOWED_TAGS.has(node.tagName)) return null;
        const el = document.createElement(node.tagName);
        for (const attr of node.attributes) {
          if (!BLOCKED_ATTRS.test(attr.name) && attr.name.toLowerCase() !== "style") {
            el.setAttribute(attr.name, attr.value);
          }
        }
        for (const child of node.childNodes) {
          const sanitized = sanitizeNode(child);
          if (sanitized) el.appendChild(sanitized);
        }
        return el;
      }

      const fragment = document.createDocumentFragment();
      const source = doc.body || doc.documentElement;
      for (const child of source.childNodes) {
        const sanitized = sanitizeNode(child);
        if (sanitized) fragment.appendChild(sanitized);
      }
      host.innerHTML = "";
      host.appendChild(fragment);
    } catch (error) {
      host.innerHTML =
        "<p class='muted'>Plain-English summary is not available yet. Run <code>python3 linearA/research/run_all.py</code>.</p>";
    }
  }

  function readStoredMotion() {
    try {
      const value = localStorage.getItem(MOTION_KEY);
      return value === "full" || value === "reduced" ? value : null;
    } catch (error) {
      return null;
    }
  }

  function getMotionMode() {
    return readStoredMotion() || (motionQuery.matches ? "reduced" : "full");
  }

  function getRevealTargets() {
    const scope = document.querySelector(".site-shell");
    if (!scope) return [];

    const seen = new Set();
    const targets = [];

    scope.querySelectorAll("h1, h2, h3, p, li").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (!node.textContent || !node.textContent.trim()) return;
      if (node.closest("nav")) return;
      if (node.closest("table")) return;
      if (node.closest("pre")) return;
      if (node.closest(".grid")) return;
      if (node.closest(".download-list")) return;
      if (node.matches(".muted[style], .table-note")) return;
      if (seen.has(node)) return;
      seen.add(node);
      targets.push(node);
    });

    return targets.slice(0, 20);
  }

  function clearWritingReveal() {
    getRevealTargets().forEach((node) => {
      node.classList.remove("is-writing");
      node.style.removeProperty("--reveal-delay");
      node.style.removeProperty("--reveal-duration");
    });
  }

  function shouldAnimate(force) {
    if (force) return true;

    try {
      return sessionStorage.getItem(WRITING_KEY) !== "1";
    } catch (error) {
      return true;
    }
  }

  function markAnimated() {
    try {
      sessionStorage.setItem(WRITING_KEY, "1");
    } catch (error) {
      return;
    }
  }

  function runWritingReveal(options) {
    const force = Boolean(options && options.force);
    const mode = document.documentElement.dataset.motion === "reduced" ? "reduced" : "full";
    const targets = getRevealTargets();

    if (!targets.length) return;
    if (mode === "reduced") {
      clearWritingReveal();
      return;
    }
    if (!shouldAnimate(force)) {
      clearWritingReveal();
      return;
    }

    targets.forEach((node, index) => {
      const delay = Math.min(index * 120, 840);
      const duration = 780 + Math.min(index * 55, 260);
      node.classList.remove("is-writing");
      node.style.setProperty("--reveal-delay", `${delay}ms`);
      node.style.setProperty("--reveal-duration", `${duration}ms`);
      void node.offsetWidth;
      node.classList.add("is-writing");
    });

    markAnimated();
  }

  function updateToggle(toggle, mode) {
    if (!toggle) return;
    const reduced = mode === "reduced";
    toggle.setAttribute("aria-pressed", reduced ? "true" : "false");
    toggle.textContent = reduced ? "Writing motion: off" : "Writing motion: on";
  }

  function storeMotionMode(mode) {
    try {
      localStorage.setItem(MOTION_KEY, mode);
    } catch (error) {
      return;
    }
  }

  function applyMotionMode(mode, options) {
    const forceReveal = Boolean(options && options.forceReveal);
    document.documentElement.dataset.motion = mode === "reduced" ? "reduced" : "full";
    updateToggle(document.querySelector("[data-motion-toggle]"), document.documentElement.dataset.motion);

    if (options && options.persist) {
      storeMotionMode(document.documentElement.dataset.motion);
    }

    if (document.documentElement.dataset.motion === "reduced") {
      clearWritingReveal();
      return;
    }

    runWritingReveal({ force: forceReveal });
  }

  function createMotionToggle() {
    if (document.querySelector("[data-motion-toggle]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "motion-toggle";
    button.setAttribute("data-motion-toggle", "true");
    button.setAttribute("aria-label", "Toggle writing motion");
    button.addEventListener("click", () => {
      const nextMode =
        document.documentElement.dataset.motion === "reduced" ? "full" : "reduced";

      applyMotionMode(nextMode, {
        persist: true,
        forceReveal: nextMode === "full"
      });
    });

    document.body.appendChild(button);
    updateToggle(button, document.documentElement.dataset.motion || getMotionMode());
  }

  function handleMotionPreferenceChange() {
    if (readStoredMotion()) return;
    applyMotionMode(getMotionMode());
  }

  function attachMotionListener() {
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", handleMotionPreferenceChange);
      return;
    }

    if (typeof motionQuery.addListener === "function") {
      motionQuery.addListener(handleMotionPreferenceChange);
    }
  }

  (async function init() {
    try {
      const summary = await loadJSON("/linearA/research/output/latest/run_summary.json");
      setLatestBadges(summary);
      fillTechSummary(summary);
    } catch (error) {
      document.querySelectorAll("[data-latest-run]").forEach((element) => {
        element.textContent = "Latest run unavailable";
      });
    }

    await embedPlainEnglish();

    document.documentElement.dataset.motion = getMotionMode();
    createMotionToggle();
    applyMotionMode(document.documentElement.dataset.motion);
    attachMotionListener();
  })();
})();
