(function () {
  async function loadJSON(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return response.json();
  }

  function setLatestBadges(summary) {
    const time = summary.run_utc || "unknown";
    const conf = typeof summary.final_confidence === "number" ? `${summary.final_confidence.toFixed(2)}%` : "n/a";

    document.querySelectorAll("[data-latest-run]").forEach((el) => {
      el.innerHTML = `<strong>${time}</strong> <span>confidence ${conf}</span>`;
    });
  }

  function fillTechSummary(summary) {
    const target = document.querySelector("[data-tech-summary]");
    if (!target) return;

    const lim = Array.isArray(summary.limiting_factors) ? summary.limiting_factors.join(", ") : "none";
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
            <tr><td>Limiting factors</td><td>${lim}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  async function embedPlainEnglish() {
    const host = document.querySelector("[data-embed-plain-english]");
    if (!host) return;

    try {
      const response = await fetch("/linearA/research/output/latest/plain_english_summary.html", { cache: "no-store" });
      if (!response.ok) throw new Error("summary not found");
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const content = doc.body ? doc.body.innerHTML : html;
      host.innerHTML = content;
    } catch (err) {
      host.innerHTML = "<p class='muted'>Plain-English summary is not available yet. Run <code>python3 linearA/research/run_all.py</code>.</p>";
    }
  }

  (async function init() {
    try {
      const summary = await loadJSON("/linearA/research/output/latest/run_summary.json");
      setLatestBadges(summary);
      fillTechSummary(summary);
    } catch (err) {
      document.querySelectorAll("[data-latest-run]").forEach((el) => {
        el.textContent = "Latest run unavailable";
      });
    }

    await embedPlainEnglish();
  })();
})();
