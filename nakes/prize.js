// /nakes/prize.js  (ES module)
const API_BASE = "https://nakes-prize.nakes-scoreboard.workers.dev";

const STORE = {
  sessionId: "nakes_prize_session_id",
  wallet:    "nakes_prize_wallet",
};

function b64urlToBuf(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64.replace(/-/g,"+").replace(/_/g,"/") + pad);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
function bufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = ""; for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

// Try MetaMask first, else fall back to stored/manual address
async function detectWalletAddress() {
  if (window.ethereum?.request) {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts[0]) return accounts[0];
    } catch {}
  }
  return localStorage.getItem(STORE.wallet) || "";
}
function saveWallet(addr) {
  if (/^0x[a-fA-F0-9]{40}$/.test(addr)) localStorage.setItem(STORE.wallet, addr);
}

// WebAuthn registration: init → navigator.credentials.create → finish
export async function prizeRegisterPasskey() {
  const r = await fetch(`${API_BASE}/prize/signup/init`, { method: "POST" });
  const j = await r.json();
  const pk = j?.creationOptions?.publicKey;
  if (!j?.sessionId || !pk) throw new Error("init failed");

  pk.challenge = b64urlToBuf(pk.challenge);
  pk.user.id   = b64urlToBuf(pk.user.id);

  const cred = await navigator.credentials.create({ publicKey: pk });
  const body = {
    sessionId: j.sessionId,
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufToB64url(cred.response.clientDataJSON),
      attestationObject: cred.response.attestationObject ? bufToB64url(cred.response.attestationObject) : undefined
    }
  };
  const fin = await fetch(`${API_BASE}/prize/signup/finish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const res = await fin.json();
  if (!res?.ok) throw new Error(res?.error || "finish failed");

  localStorage.setItem(STORE.sessionId, j.sessionId);
  return { sessionId: j.sessionId, credentialId: res.credentialId };
}

export async function prizeEnsureWallet(manualAddress = "") {
  let addr = manualAddress?.trim() || "";
  if (!addr) addr = await detectWalletAddress();
  if (!addr) throw new Error("No wallet address; connect a wallet or enter manually.");
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) throw new Error("Invalid wallet address format.");
  saveWallet(addr);
  return addr;
}

export async function prizeEnsureSession() {
  let sessionId = localStorage.getItem(STORE.sessionId);
  if (sessionId) return sessionId;
  const { sessionId: sid } = await prizeRegisterPasskey();
  return sid;
}

// Called when the game ends with the final level
export async function prizeFinish(level, options = {}) {
  if (!(Number(level) >= 23)) return { skipped: true, reason: "below tier thresholds" };

  const to = localStorage.getItem(STORE.wallet) || (await detectWalletAddress());
  if (!to) throw new Error("No wallet set. Save a wallet first.");
  const sessionId = localStorage.getItem(STORE.sessionId) || "";
  if (!sessionId) throw new Error("No session. Register a passkey first.");

  const payload = {
    sessionId,
    to,
    level: Number(level),
    seed: options.seed ?? undefined,
    replay: options.replay ?? undefined
  };

  const resp = await fetch(`${API_BASE}/prize/finish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const j = await resp.json();
  if (!resp.ok || !j?.ok) throw new Error(j?.error || `finish failed (${resp.status})`);
  return j;
}

// Minimal widget (optional UI)
export function mountPrizeWidget(targetSelector = "#prize-root") {
  const root = document.querySelector(targetSelector);
  if (!root) return;
  root.innerHTML = `
    <div style="border:1px solid #184e18;border-radius:12px;padding:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:rgba(76,255,76,.06)">
      <strong>Prize Mode</strong>
      <input id="prize-wallet" placeholder="0xYourWallet" style="flex:1;min-width:240px;padding:8px;border:1px solid #184e18;border-radius:8px;background:#0b140b;color:#d2ffd2"/>
      <button id="prize-save">Save Wallet</button>
      <button id="prize-passkey">Register Passkey</button>
      <span id="prize-status" style="margin-left:auto;font-size:12px;color:#86ff86"></span>
    </div>`;
  const $ = (id) => root.querySelector(id);
  const status = $("#prize-status");
  const stored = localStorage.getItem(STORE.wallet);
  if (stored) $("#prize-wallet").value = stored;

  $("#prize-save").onclick = async () => {
    try {
      await prizeEnsureWallet($("#prize-wallet").value);
      status.textContent = "Wallet saved ✅";
    } catch (e) { status.textContent = e.message || String(e); }
  };
  $("#prize-passkey").onclick = async () => {
    try {
      await prizeEnsureSession();
      status.textContent = "Passkey registered ✅";
    } catch (e) { status.textContent = e.message || String(e); }
  };
}