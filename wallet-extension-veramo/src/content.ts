function pickOfferUriFromAnchor(a: HTMLAnchorElement): string | null {
  try {
    if (a.dataset.credentialOfferUri) return a.dataset.credentialOfferUri
    if (a.href?.startsWith('openid-credential-offer://')) {
      const u = new URL(a.href)
      return u.searchParams.get('credential_offer_uri')
    }
  } catch {}
  return null
}

document.addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement
  const a = t.closest('a') as HTMLAnchorElement | null
  if (!a) return
  const offerUri = pickOfferUriFromAnchor(a)
  if (offerUri) {
    ev.preventDefault()
    chrome.runtime.sendMessage({ type: 'START_OID4VCI', credential_offer_uri: offerUri })
    // show popup so holder can Accept/Decline
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' })
  }
})
