(() => {
  const ENGINE_URL = "https://lengyeltyler.github.io/createPhil/";
  const ENGINE_ORIGIN = "https://lengyeltyler.github.io";
  const TRAIT_ORDER = ["bg", "wings", "phil", "spikes", "eyes", "nose", "teeth", "top"];
  const TRAIT_NAMES = {
    bg: "Background",
    wings: "Wings",
    phil: "Phil",
    spikes: "Spikes",
    eyes: "Eyes",
    nose: "Nose",
    teeth: "Teeth",
    top: "Top"
  };

  const frame = document.querySelector("[data-engine-frame]");
  const display = document.querySelector("[data-phil-display]");
  const status = document.querySelector("[data-machine-status]");
  const counter = document.querySelector("[data-generation-count]");
  const exportButton = document.querySelector("[data-export]");
  const resetButton = document.querySelector("[data-reset-all]");
  const levers = Array.from(document.querySelectorAll("[data-trait]"));
  const traitSvgs = new Map();
  const traitUrls = new Map();

  let pendingTrait = null;
  let runCount = 0;
  let compositeUrl = "";
  let requestTimer = 0;

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function setBusy(busy) {
    levers.forEach((lever) => {
      lever.disabled = busy;
    });
    document.querySelector(".machine-cabinet")?.setAttribute("aria-busy", String(busy));
  }

  function encodeSvg(svg) {
    const bytes = new TextEncoder().encode(svg);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  }

  function buildCompositeSvg() {
    const layers = TRAIT_ORDER
      .filter((trait) => traitSvgs.has(trait))
      .map((trait) => {
        const href = encodeSvg(traitSvgs.get(trait));
        return `<image data-trait="${trait}" href="${href}" x="0" y="0" width="420" height="420"/>`;
      })
      .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">${layers}</svg>`;
  }

  function replaceImage(container, url, alt) {
    if (!container) return;
    const image = document.createElement("img");
    image.src = url;
    image.alt = alt;
    container.replaceChildren(image);
  }

  function updateComposite() {
    const hasTraits = traitSvgs.size > 0;
    exportButton.disabled = !hasTraits;
    resetButton.disabled = !hasTraits;

    if (!hasTraits) {
      if (compositeUrl) URL.revokeObjectURL(compositeUrl);
      compositeUrl = "";
      display.setAttribute("aria-label", "Generated Phil preview; no traits loaded");
      display.innerHTML = `
        <div class="display-idle" data-display-idle>
          <span class="crosshair" aria-hidden="true"></span>
          <strong>READY</strong>
          <span>Pull a trait lever to begin.</span>
        </div>`;
      return;
    }

    if (compositeUrl) URL.revokeObjectURL(compositeUrl);
    const svg = buildCompositeSvg();
    compositeUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    replaceImage(display, compositeUrl, "Assembled Phil preview");
    display.setAttribute("aria-label", `Generated Phil preview with ${traitSvgs.size} loaded traits`);
  }

  function updateTraitPreview(trait, svg) {
    const station = document.querySelector(`[data-station="${trait}"]`);
    const preview = document.querySelector(`[data-trait-preview="${trait}"]`);
    const clearButton = document.querySelector(`[data-clear-trait="${trait}"]`);
    const oldUrl = traitUrls.get(trait);
    if (oldUrl) URL.revokeObjectURL(oldUrl);

    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    traitUrls.set(trait, url);
    replaceImage(preview, url, `${TRAIT_NAMES[trait]} trait preview`);
    station?.classList.add("is-loaded");
    if (clearButton) clearButton.disabled = false;
  }

  function finishRequest(trait, svg) {
    window.clearTimeout(requestTimer);
    traitSvgs.set(trait, svg);
    updateTraitPreview(trait, svg);
    updateComposite();
    runCount += 1;
    counter.value = String(runCount).padStart(4, "0");
    pendingTrait = null;
    setBusy(false);
    setStatus(`${TRAIT_NAMES[trait]} generated and loaded. Pull it again for a new variation.`);
  }

  function requestTrait(trait) {
    if (!frame || pendingTrait || !TRAIT_ORDER.includes(trait)) return;

    pendingTrait = trait;
    setBusy(true);
    setStatus(`Loading ${TRAIT_NAMES[trait]} generator…`);
    document.querySelector(`[data-station="${trait}"]`)?.classList.add("is-pulled");
    window.setTimeout(() => {
      document.querySelector(`[data-station="${trait}"]`)?.classList.remove("is-pulled");
    }, 520);

    frame.src = `${ENGINE_URL}?machineRun=${Date.now()}`;
    requestTimer = window.setTimeout(() => {
      if (pendingTrait !== trait) return;
      pendingTrait = null;
      setBusy(false);
      setStatus(`${TRAIT_NAMES[trait]} did not return in time. Check the connection and pull again.`);
    }, 30000);
  }

  frame?.addEventListener("load", () => {
    if (!pendingTrait || !frame.contentWindow) {
      setStatus("Machine ready. Pull any trait lever.");
      return;
    }

    setStatus(`Generating ${TRAIT_NAMES[pendingTrait]}…`);
    frame.contentWindow.postMessage(
      { source: "parent", kind: "save", trait: pendingTrait },
      ENGINE_ORIGIN
    );
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== ENGINE_ORIGIN || event.source !== frame?.contentWindow) return;
    const message = event.data || {};

    if (
      message.source === "createPhil" &&
      message.kind === "preview-layer" &&
      message.trait === pendingTrait &&
      typeof message.svg === "string"
    ) {
      finishRequest(message.trait, message.svg);
    }

    if (
      message.source === "createPhil" &&
      message.kind === "download-svg" &&
      typeof message.data === "string"
    ) {
      const url = URL.createObjectURL(new Blob([message.data], {
        type: message.mime || "image/svg+xml;charset=utf-8"
      }));
      const link = document.createElement("a");
      link.href = url;
      link.download = message.filename || "phil.svg";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  });

  levers.forEach((lever) => {
    lever.addEventListener("click", () => requestTrait(lever.dataset.trait));
    lever.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      requestTrait(lever.dataset.trait);
    });
  });

  document.querySelectorAll("[data-clear-trait]").forEach((button) => {
    button.addEventListener("click", () => {
      const trait = button.dataset.clearTrait;
      const preview = document.querySelector(`[data-trait-preview="${trait}"]`);
      const url = traitUrls.get(trait);
      if (url) URL.revokeObjectURL(url);
      traitUrls.delete(trait);
      traitSvgs.delete(trait);
      preview?.replaceChildren(Object.assign(document.createElement("span"), { textContent: "EMPTY" }));
      document.querySelector(`[data-station="${trait}"]`)?.classList.remove("is-loaded");
      button.disabled = true;
      updateComposite();
      setStatus(`${TRAIT_NAMES[trait]} removed from the assembly.`);
    });
  });

  exportButton?.addEventListener("click", () => {
    if (!traitSvgs.size) return;
    const url = URL.createObjectURL(new Blob([buildCompositeSvg()], {
      type: "image/svg+xml;charset=utf-8"
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "createphil-assembly.svg";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus("Assembled Phil exported as SVG.");
  });

  resetButton?.addEventListener("click", () => {
    traitSvgs.clear();
    traitUrls.forEach((url) => URL.revokeObjectURL(url));
    traitUrls.clear();
    document.querySelectorAll("[data-trait-preview]").forEach((preview) => {
      preview.replaceChildren(Object.assign(document.createElement("span"), { textContent: "EMPTY" }));
    });
    document.querySelectorAll("[data-station]").forEach((station) => station.classList.remove("is-loaded"));
    document.querySelectorAll("[data-clear-trait]").forEach((button) => {
      button.disabled = true;
    });
    updateComposite();
    setStatus("Machine reset. Pull any trait lever to start again.");
  });

  window.addEventListener("pagehide", () => {
    if (compositeUrl) URL.revokeObjectURL(compositeUrl);
    traitUrls.forEach((url) => URL.revokeObjectURL(url));
  });
})();
