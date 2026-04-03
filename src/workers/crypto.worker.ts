/**
 * Crypto Web Worker — offloads AES-GCM encrypt/decrypt from main thread.
 * Communicates via postMessage with a simple request/response protocol.
 */

const ALGO = 'AES-GCM';
const IV_LENGTH = 12;

let cachedKey: CryptoKey | null = null;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const rawKey = base64ToBuffer(keyB64);
  cachedKey = await crypto.subtle.importKey(
    'raw', rawKey, { name: ALGO }, false, ['encrypt', 'decrypt']
  );
  return cachedKey;
}

async function encrypt(json: string, keyB64: string): Promise<{ __encrypted: true; data: string; algo: 'aes-gcm' }> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(json);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return { __encrypted: true, data: bufferToBase64(combined.buffer), algo: 'aes-gcm' };
}

async function decrypt(payload: { data: string }, keyB64: string): Promise<string> {
  const key = await importKey(keyB64);
  const combined = new Uint8Array(base64ToBuffer(payload.data));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// Message handler
self.onmessage = async (e: MessageEvent) => {
  const { id, op, json, payload, keyB64 } = e.data;
  try {
    if (op === 'encrypt') {
      const result = await encrypt(json, keyB64);
      self.postMessage({ id, result });
    } else if (op === 'decrypt') {
      const result = await decrypt(payload, keyB64);
      self.postMessage({ id, result });
    } else if (op === 'clearKey') {
      cachedKey = null;
      self.postMessage({ id, result: true });
    } else {
      self.postMessage({ id, error: `Unknown op: ${op}` });
    }
  } catch (err: any) {
    self.postMessage({ id, error: err.message || 'Worker error' });
  }
};
