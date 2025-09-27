// src/content.ts
window.addEventListener("oid4vci:claim", (ev) => {
  try {
    const detail = ev.detail;
    if (!detail?.credential_offer_uri) return;
    chrome.runtime.sendMessage({ type: "OID4VCI_START", payload: detail });
  } catch (e) {
    console.error("Wallet content-script error", e);
  }
});
