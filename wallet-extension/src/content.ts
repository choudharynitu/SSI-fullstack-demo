/// <reference types="chrome" />
/** Content script: listens for portal's 'oid4vci:claim' event and forwards to background */
window.addEventListener('oid4vci:claim', (ev: Event) => {
  try {
    const detail = (ev as CustomEvent).detail
    if (!detail?.credential_offer_uri) return
    chrome.runtime.sendMessage({ type: 'OID4VCI_START', payload: detail })
  } catch (e) {
    console.error('Wallet content-script error', e)
  }
})
