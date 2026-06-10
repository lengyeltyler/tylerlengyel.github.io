const SEPOLIA_CHAIN_ID = 11155111n;
const PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const TOKEN_ID = 1n;

const state = {
  platform: null,
  abi: {},
  readProvider: null,
  walletProvider: null,
  selectedProvider: null,
  selectedProviderLabel: "",
  discoveredProviders: [],
  signer: null,
  account: null,
  contracts: {},
  walletContracts: {},
  metadata: null,
  fullSvg: ""
};

const el = {};
const providerListenerSet = new WeakSet();

function $(id) {
  return document.getElementById(id);
}

function log(message) {
  const stamp = new Date().toLocaleTimeString();
  el.activityLog.textContent = `[${stamp}] ${message}\n${el.activityLog.textContent || ""}`;
}

function shortAddress(address) {
  if (!address || address === ethers.ZeroAddress) return "None";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatEth(wei) {
  return `${ethers.formatEther(wei)} ETH`;
}

function formatTime(seconds) {
  const value = Number(seconds);
  if (!value) return "Inactive";
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return h ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function formatTimestamp(timestamp) {
  const value = Number(timestamp);
  if (!value) return "Inactive";
  return new Date(value * 1000).toLocaleString();
}

function setText(id, value) {
  const node = el[id] || $(id);
  if (node) node.textContent = value;
}

function setBusy(button, busy, label) {
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.defaultLabel;
}

function providerLabel(provider) {
  if (!provider) return "None";
  const flags = [];
  if (provider.isMetaMask) flags.push("MetaMask");
  if (provider.isPhantom) flags.push("Phantom");
  if (provider.isCoinbaseWallet) flags.push("Coinbase");
  if (provider.isRabby) flags.push("Rabby");
  if (provider.isBraveWallet) flags.push("Brave");
  return flags.length ? flags.join(" / ") : "Injected EIP-1193 provider";
}

function providerGroup(label, provider) {
  const text = `${label || ""} ${providerLabel(provider)}`.toLowerCase();
  if (text.includes("metamask")) return "MetaMask";
  if (text.includes("phantom")) return "Phantom";
  if (text.includes("coinbase")) return "Coinbase";
  return "Other";
}

function showWalletError(message) {
  if (!el.walletError) return;
  el.walletError.hidden = !message;
  el.walletError.textContent = message || "";
}

function rememberProvider(provider, label, source = "injected") {
  if (!provider) return;
  if (state.discoveredProviders.some((entry) => entry.provider === provider)) return;
  const resolvedLabel = label || providerLabel(provider);
  state.discoveredProviders.push({
    provider,
    label: resolvedLabel,
    source,
    group: providerGroup(resolvedLabel, provider)
  });
}

async function discoverEip6963Providers() {
  if (!window.dispatchEvent || !window.addEventListener) return [];

  const found = [];
  function onAnnounce(event) {
    const detail = event.detail || {};
    if (!detail.provider) return;
    found.push(detail);
    rememberProvider(detail.provider, detail.info?.name || providerLabel(detail.provider), "eip6963");
  }

  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  window.removeEventListener("eip6963:announceProvider", onAnnounce);
  return found;
}

function renderProviderSelection(entries) {
  if (!el.providerOptions) return;
  el.providerOptions.replaceChildren();
  if (!entries.length) {
    el.providerOptions.hidden = true;
    return;
  }

  const title = document.createElement("p");
  title.className = "helper-text";
  title.textContent = "Choose wallet provider:";
  el.providerOptions.appendChild(title);

  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${entry.group}: ${entry.label}`;
    button.addEventListener("click", () => {
      state.selectedProvider = entry.provider;
      state.selectedProviderLabel = entry.label;
      showWalletError("");
      log(`Selected provider: ${entry.label}`);
      connectWallet(true, entry.provider);
    });
    el.providerOptions.appendChild(button);
  });
  el.providerOptions.hidden = false;
}

async function selectWalletProvider({ allowFallback = false } = {}) {
  state.discoveredProviders = [];
  await discoverEip6963Providers();

  const injected = window.ethereum;
  if (injected?.providers?.length) {
    injected.providers.forEach((provider) => rememberProvider(provider, providerLabel(provider), "window.ethereum.providers"));
  } else if (injected) {
    rememberProvider(injected, providerLabel(injected), "window.ethereum");
  }

  log(`Providers discovered: ${state.discoveredProviders.length}`);
  state.discoveredProviders.forEach((entry) => {
    log(`Provider option: ${entry.group} / ${entry.label} via ${entry.source}`);
  });

  renderProviderSelection(state.discoveredProviders);

  const metamask = state.discoveredProviders.find((entry) => entry.group === "MetaMask");
  const selected = metamask || (allowFallback ? state.discoveredProviders[0] : null);
  state.selectedProvider = selected?.provider || null;
  state.selectedProviderLabel = selected?.label || "";

  if (state.selectedProvider) {
    log(`Selected provider: ${state.selectedProviderLabel}`);
    showWalletError("");
  } else {
    const message = state.discoveredProviders.length
      ? "MetaMask not detected or another wallet is intercepting provider injection. Disable other wallet extensions or choose a provider."
      : "MetaMask not detected. Install or enable MetaMask, then reload.";
    showWalletError(message);
    log(message);
  }

  return state.selectedProvider;
}

async function selectedProviderRequest(method, params = []) {
  if (!state.selectedProvider?.request) throw new Error("MetaMask provider not found.");
  return state.selectedProvider.request({ method, params });
}

async function getSelectedChainId() {
  try {
    const chainId = await selectedProviderRequest("eth_chainId");
    return BigInt(chainId);
  } catch (error) {
    log(`Unable to read wallet chainId: ${error.message}`);
    return null;
  }
}

function updateProviderDebug(chainId = null) {
  const account = state.account || "not connected";
  const chainText = chainId === null ? "unknown" : chainId.toString();
  setText("walletAddress", state.account ? state.account : "Wallet not connected");
  log(`Provider debug: type=${providerLabel(state.selectedProvider)}; selected=${state.selectedProviderLabel || "none"}; chainId=${chainText}; account=${account}`);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

function safeRenderSvg(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") throw new Error("Contract did not return SVG XML");
  svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());
  el.svgFrame.replaceChildren(document.importNode(svg, true));
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function init() {
  cacheElements();
  try {
    state.platform = await fetchJson("/art/data/platform-sepolia.json");
    state.abi.registry = await fetchJson("/art/abi/PhilRegistry.json");
    state.abi.edition = await fetchJson("/art/abi/PhilEdition.json");
    state.abi.auction = await fetchJson("/art/abi/PhilAuction.json");
    state.readProvider = new ethers.JsonRpcProvider(PUBLIC_SEPOLIA_RPC, Number(SEPOLIA_CHAIN_ID));
    buildReadContracts();
    wireUi();
    applyLinks();
    await loadReadOnlyState();
    setText("walletAddress", "Wallet not connected");
    setText("networkStatus", "Click Connect wallet");
    setInterval(refreshAuctionState, 15000);
    log("Loaded Sepolia platform data and contract ABIs.");
  } catch (error) {
    log(`Startup failed: ${error.message}`);
  }
}

function cacheElements() {
  [
    "activityLog", "connectWallet", "switchSepolia", "walletAddress", "networkStatus", "walletError", "providerOptions",
    "editionCount", "galleryList", "editionTitle", "editionDescription", "previewImage",
    "editionSymbol", "editionArtist", "tokenOwner", "registryLink", "editionLink",
    "auctionLink", "tokenLink", "loadSvg", "downloadSvg", "copySvg", "svgFrame",
    "auctionStatus", "auctionCountdown", "reservePrice", "currentBid", "currentBidder",
    "minIncrement", "startTime", "endTime", "sellerProceeds", "refundBalance",
    "bidForm", "bidAmount", "refreshState", "withdrawRefund", "settleAuction", "withdrawSeller"
  ].forEach((id) => {
    el[id] = $(id);
  });
}

function buildReadContracts() {
  const p = state.platform;
  state.contracts.registry = new ethers.Contract(p.PhilRegistry, state.abi.registry, state.readProvider);
  state.contracts.edition = new ethers.Contract(p.PhilEdition, state.abi.edition, state.readProvider);
  state.contracts.auction = new ethers.Contract(p.PhilAuction, state.abi.auction, state.readProvider);
}

function buildWalletContracts() {
  if (!state.signer) return;
  const p = state.platform;
  state.walletContracts.edition = new ethers.Contract(p.PhilEdition, state.abi.edition, state.signer);
  state.walletContracts.auction = new ethers.Contract(p.PhilAuction, state.abi.auction, state.signer);
}

function wireUi() {
  el.connectWallet.addEventListener("click", connectWallet);
  el.switchSepolia.addEventListener("click", switchToSepolia);
  el.refreshState.addEventListener("click", refreshAuctionState);
  el.loadSvg.addEventListener("click", loadFullSvg);
  el.downloadSvg.addEventListener("click", () => downloadText("sample-phil.svg", state.fullSvg, "image/svg+xml"));
  el.copySvg.addEventListener("click", copyFullSvg);
  el.bidForm.addEventListener("submit", placeBid);
  el.withdrawRefund.addEventListener("click", withdrawRefund);
  el.settleAuction.addEventListener("click", settleAuction);
  el.withdrawSeller.addEventListener("click", withdrawSellerProceeds);

  if (state.selectedProvider) attachProviderListeners(state.selectedProvider);
}

function attachProviderListeners(provider) {
  if (!provider || providerListenerSet.has(provider)) return;
  providerListenerSet.add(provider);
  provider.on?.("accountsChanged", (accounts) => {
    state.account = accounts?.[0] || null;
    log(state.account ? `Wallet account changed: ${state.account}` : "Wallet disconnected.");
    connectWallet(false);
  });
  provider.on?.("chainChanged", (chainId) => {
    log(`Wallet network changed: ${chainId}`);
    updateWalletStatus();
  });
}

function applyLinks() {
  const links = state.platform.etherscan;
  el.registryLink.href = links.registry;
  el.editionLink.href = links.edition;
  el.auctionLink.href = links.auction;
  el.tokenLink.href = links.token;
}

async function loadReadOnlyState() {
  const [editionCount, editionInfo, tokenUri, owner, symbol] = await Promise.all([
    state.contracts.registry.getEditionCount(),
    state.contracts.registry.getEdition(1),
    state.contracts.edition.tokenURI(TOKEN_ID),
    state.contracts.edition.ownerOf(TOKEN_ID),
    state.contracts.edition.symbol()
  ]);

  state.metadata = decodeTokenUri(tokenUri);
  setText("editionCount", `${editionCount.toString()} registered edition`);
  setText("editionTitle", state.metadata.name || editionInfo.name);
  setText("editionDescription", state.metadata.description || "Marketplace-light on-chain Phil metadata.");
  setText("editionSymbol", symbol);
  setText("editionArtist", editionInfo.artist || "Tyler Lengyel");
  setText("tokenOwner", owner);
  el.previewImage.src = state.metadata.image;

  renderGalleryCard(editionInfo, state.metadata);
  await refreshAuctionState();
}

function decodeTokenUri(tokenUri) {
  const prefix = "data:application/json;base64,";
  if (!tokenUri.startsWith(prefix)) throw new Error("Unexpected tokenURI format");
  return JSON.parse(atob(tokenUri.slice(prefix.length)));
}

function renderGalleryCard(editionInfo, metadata) {
  const card = document.createElement("article");
  card.className = "edition-card";
  card.innerHTML = `
    <img alt="${metadata.name || editionInfo.name} preview" src="${metadata.image}" />
    <div>
      <h3>${metadata.name || editionInfo.name}</h3>
      <p>${editionInfo.symbol} · ${editionInfo.artist}</p>
      <p>${editionInfo.active ? "Active Sepolia edition" : "Inactive edition"}</p>
    </div>
  `;
  el.galleryList.replaceChildren(card);
}

async function refreshAuctionState() {
  const auction = state.contracts.auction;
  const [
    reserve,
    current,
    bidder,
    started,
    ended,
    settled,
    start,
    end,
    remaining,
    increment,
    proceeds
  ] = await Promise.all([
    auction.reservePrice(),
    auction.currentBid(),
    auction.currentBidder(),
    auction.hasStarted(),
    auction.hasEnded(),
    auction.settled(),
    auction.startTime(),
    auction.endTime(),
    auction.timeRemaining(),
    auction.MIN_INCREMENT(),
    auction.sellerProceeds()
  ]);

  let refund = 0n;
  if (state.account) {
    refund = await auction.refunds(state.account);
  }

  const status = settled ? "Settled" : ended ? "Ended" : started ? "Active" : "Not started";
  setText("auctionStatus", status);
  setText("auctionCountdown", started && !ended ? `Time remaining: ${formatTime(remaining)}` : "Countdown inactive");
  setText("reservePrice", formatEth(reserve));
  setText("currentBid", formatEth(current));
  setText("currentBidder", shortAddress(bidder));
  setText("minIncrement", formatEth(increment));
  setText("startTime", formatTimestamp(start));
  setText("endTime", formatTimestamp(end));
  setText("sellerProceeds", formatEth(proceeds));
  setText("refundBalance", formatEth(refund));

  const defaultBid = started ? current + increment : reserve;
  el.bidAmount.value = ethers.formatEther(defaultBid);
}

async function connectWallet(requestAccounts = true, forcedProvider = null) {
  log("Connect wallet clicked.");
  try {
    const provider = forcedProvider || await selectWalletProvider();
    if (!provider) {
      setText("networkStatus", "MetaMask not found");
      log("Provider missing. Install or enable MetaMask, then reload.");
      return;
    }

    attachProviderListeners(provider);
    state.selectedProvider = provider;
    state.selectedProviderLabel = state.selectedProviderLabel || providerLabel(provider);
    if (!provider.isMetaMask) {
      log(`Selected provider is not MetaMask: ${providerLabel(provider)}.`);
    }

    if (requestAccounts) {
      log("Requesting wallet accounts...");
      try {
        await provider.request({ method: "eth_requestAccounts" });
        log("eth_requestAccounts succeeded.");
      } catch (error) {
        log(`eth_requestAccounts failed: ${error.message}`);
        throw error;
      }
    }

    state.walletProvider = new ethers.BrowserProvider(provider);
    let network = null;
    try {
      network = await state.walletProvider.getNetwork();
      log(`chainId read succeeded: ${network.chainId.toString()}`);
    } catch (error) {
      log(`chainId read failed: ${error.message}`);
    }
    const accounts = await provider.request({ method: "eth_accounts" });
    state.account = accounts[0] || null;
    state.signer = state.account ? await state.walletProvider.getSigner() : null;
    buildWalletContracts();
    await updateWalletStatus(network);
    await refreshAuctionState();
    log(state.account ? `Account connected: ${state.account}` : "No account connected.");
  } catch (error) {
    log(`Wallet connection rejected or failed: ${error.message}`);
  }
}

async function updateWalletStatus(networkOverride) {
  if (!state.selectedProvider) {
    setText("networkStatus", "Click Connect wallet");
    updateProviderDebug(null);
    return;
  }
  if (!state.walletProvider && !networkOverride) {
    setText("networkStatus", "Wallet provider selected; connect account to read network");
    updateProviderDebug(null);
    return;
  }

  let network = networkOverride;
  if (!network) {
    try {
      network = await state.walletProvider.getNetwork();
      log(`chainId read succeeded: ${network.chainId.toString()}`);
    } catch (error) {
      log(`chainId read failed: ${error.message}`);
      setText("networkStatus", "Unable to read wallet network");
      updateProviderDebug(null);
      return;
    }
  }
  const onSepolia = network.chainId === SEPOLIA_CHAIN_ID;
  el.switchSepolia.hidden = onSepolia;
  setText("networkStatus", onSepolia ? "Connected to Sepolia" : `Wrong network: chain ${network.chainId.toString()}`);
  setText("walletAddress", state.account ? state.account : "Wallet not connected");
  if (!onSepolia) log(`Wrong network detected: chain ${network.chainId.toString()}. Sepolia is required.`);
  updateProviderDebug(network.chainId);
}

async function switchToSepolia() {
  try {
    const provider = state.selectedProvider;
    if (!provider) {
      log("Cannot switch network because MetaMask provider was not found.");
      return;
    }
    log("Requesting switch to Sepolia...");
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }]
    });
    await connectWallet(false);
  } catch (error) {
    if (error.code === 4902 || /Unrecognized chain ID|wallet_addEthereumChain/i.test(error.message || "")) {
      try {
        log("Sepolia missing in wallet. Requesting wallet_addEthereumChain...");
        await state.selectedProvider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [PUBLIC_SEPOLIA_RPC],
            blockExplorerUrls: ["https://sepolia.etherscan.io"]
          }]
        });
        await connectWallet(false);
        return;
      } catch (addError) {
        log(`Adding Sepolia failed: ${addError.message}`);
      }
    }
    log(`Switch to Sepolia failed: ${error.message}`);
  }
}

async function requireWalletAuction() {
  if (!state.signer || !state.walletContracts.auction) {
    await connectWallet();
  }
  const network = await state.walletProvider.getNetwork();
  if (network.chainId !== SEPOLIA_CHAIN_ID) throw new Error("Switch MetaMask to Sepolia first.");
  return state.walletContracts.auction;
}

async function placeBid(event) {
  event.preventDefault();
  try {
    const auction = await requireWalletAuction();
    const value = ethers.parseEther(el.bidAmount.value.trim());
    setBusy(el.bidForm.querySelector("button"), true, "Pending...");
    log(`Submitting bid for ${el.bidAmount.value} Sepolia ETH...`);
    const tx = await auction.placeBid({ value });
    log(`Bid submitted: ${tx.hash}`);
    await tx.wait();
    log("Bid confirmed.");
    await refreshAuctionState();
  } catch (error) {
    log(`Bid failed: ${error.reason || error.message}`);
  } finally {
    setBusy(el.bidForm.querySelector("button"), false);
  }
}

async function withdrawRefund() {
  await sendAuctionTx("withdrawRefund", "Withdrawing refund...", (auction) => auction.withdrawRefund());
}

async function settleAuction() {
  await sendAuctionTx("settleAuction", "Settling auction...", (auction) => auction.settle());
}

async function withdrawSellerProceeds() {
  await sendAuctionTx("withdrawSeller", "Withdrawing seller proceeds...", (auction) => auction.withdrawSellerProceeds());
}

async function sendAuctionTx(buttonId, pendingMessage, fn) {
  const button = el[buttonId];
  try {
    const auction = await requireWalletAuction();
    setBusy(button, true, "Pending...");
    log(pendingMessage);
    const tx = await fn(auction);
    log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    log("Transaction confirmed.");
    await refreshAuctionState();
  } catch (error) {
    log(`Transaction failed: ${error.reason || error.message}`);
  } finally {
    setBusy(button, false);
  }
}

async function loadFullSvg() {
  try {
    setBusy(el.loadSvg, true, "Loading...");
    state.fullSvg = await state.contracts.edition.fullSVG();
    safeRenderSvg(state.fullSvg);
    el.downloadSvg.disabled = false;
    el.copySvg.disabled = false;
    log(`Full SVG loaded (${new Blob([state.fullSvg]).size} bytes).`);
  } catch (error) {
    log(`Failed to load full SVG: ${error.message}`);
  } finally {
    setBusy(el.loadSvg, false);
  }
}

async function copyFullSvg() {
  try {
    await navigator.clipboard.writeText(state.fullSvg);
    log("Copied SVG string.");
  } catch (error) {
    log(`Copy failed: ${error.message}`);
  }
}

document.addEventListener("DOMContentLoaded", init);
