(() => {
  const MOTION_KEY = "site-motion-preference";
  const WRITING_KEY = "site-writing-played";
  const root = document.documentElement;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const writingSelector = "h1, h2, h3, p, li, blockquote";

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

  function getWritingRoots() {
    const explicitRoots = Array.from(document.querySelectorAll("[data-writing-root]"));
    if (explicitRoots.length) return explicitRoots;

    const main = document.querySelector("main");
    return main ? [main] : [];
  }

  function isRevealCandidate(node) {
    if (!node || !(node instanceof HTMLElement)) return false;
    if (!node.textContent || !node.textContent.trim()) return false;
    if (node.closest("nav")) return false;
    if (node.closest("form")) return false;
    if (node.closest("table")) return false;
    if (node.closest("pre")) return false;
    if (node.closest("[data-no-reveal]")) return false;
    if (node.matches(".helper-text, .status-line, .meta-line, .motion-toggle")) return false;
    return true;
  }

  function getWritingTargets() {
    const seen = new Set();
    const targets = [];

    getWritingRoots().forEach((scope) => {
      scope.querySelectorAll(writingSelector).forEach((node) => {
        if (!isRevealCandidate(node) || seen.has(node)) return;
        seen.add(node);
        targets.push(node);
      });
    });

    return targets.slice(0, 20);
  }

  function clearWritingReveal() {
    getWritingTargets().forEach((node) => {
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

  function runWritingReveal(options = {}) {
    const force = Boolean(options.force);
    const mode = root.dataset.motion === "reduced" ? "reduced" : "full";
    const targets = getWritingTargets();

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

  function wireMotionToggle(toggle) {
    if (!toggle || toggle.dataset.motionToggleReady === "true") return;
    toggle.dataset.motionToggleReady = "true";
    toggle.addEventListener("click", () => {
      const nextMode = root.dataset.motion === "reduced" ? "full" : "reduced";
      applyMotionMode(nextMode, {
        persist: true,
        forceReveal: nextMode === "full"
      });
    });
  }

  function writeStoredMotion(mode) {
    try {
      localStorage.setItem(MOTION_KEY, mode);
    } catch (error) {
      return;
    }
  }

  function applyMotionMode(mode, options = {}) {
    const forceReveal = Boolean(options.forceReveal);
    root.dataset.motion = mode === "reduced" ? "reduced" : "full";
    updateToggle(document.querySelector("[data-motion-toggle]"), root.dataset.motion);

    if (options.persist) {
      writeStoredMotion(root.dataset.motion);
    }

    if (root.dataset.motion === "reduced") {
      clearWritingReveal();
      return;
    }

    runWritingReveal({ force: forceReveal });
  }

  function buildMotionToggle() {
    const existing = document.querySelector("[data-motion-toggle]");
    if (existing) {
      wireMotionToggle(existing);
      updateToggle(existing, root.dataset.motion || getMotionMode());
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "motion-toggle";
    button.setAttribute("data-motion-toggle", "true");
    button.setAttribute("aria-label", "Toggle writing motion");
    wireMotionToggle(button);
    document.body.appendChild(button);
    updateToggle(button, root.dataset.motion || getMotionMode());
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

  window.SiteTheme = {
    applyMotionMode,
    clearWritingReveal,
    runWritingReveal
  };

  document.addEventListener("DOMContentLoaded", () => {
    root.dataset.motion = getMotionMode();
    buildMotionToggle();
    applyMotionMode(root.dataset.motion);
    attachMotionListener();
  });
})();
