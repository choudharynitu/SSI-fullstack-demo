// shims.js
export const fs = {}
export const path = {}
export const crypto = {
  randomFillSync: (buffer) => {
    // Use Web Crypto API instead of Node crypto
    const arr = new Uint8Array(buffer.length)
    self.crypto.getRandomValues(arr)
    buffer.set(arr)
    return buffer
  }
}

