/**
 * Steganography engine — LSB and Append methods.
 * Supports optional AES-256-GCM encrypted payloads.
 */

const MAGIC = new Uint8Array([0x50, 0x56, 0x4c, 0x54]); // "PVLT" marker
const HEADER_SIZE = 8; // 4 magic + 4 length (uint32)

// ─── Shared helpers ────────────────────────────────────────────────────────────

function buildPayload(data: Uint8Array): Uint8Array {
  const header = new Uint8Array(HEADER_SIZE);
  header.set(MAGIC, 0);
  const view = new DataView(header.buffer);
  view.setUint32(4, data.length, false);
  const payload = new Uint8Array(HEADER_SIZE + data.length);
  payload.set(header, 0);
  payload.set(data, HEADER_SIZE);
  return payload;
}

function extractPayload(raw: Uint8Array): Uint8Array {
  for (let i = 0; i < 4; i++) {
    if (raw[i] !== MAGIC[i]) throw new Error("No hidden data found.");
  }
  const view = new DataView(raw.buffer, raw.byteOffset);
  const length = view.getUint32(4, false);
  if (length > raw.length - HEADER_SIZE) throw new Error("Corrupted data.");
  return raw.slice(HEADER_SIZE, HEADER_SIZE + length);
}

// ─── LSB ───────────────────────────────────────────────────────────────────────

export async function lsbEncode(
  imageData: ImageData,
  data: Uint8Array
): Promise<ImageData> {
  const payload = buildPayload(data);
  const bits = payload.length * 8;
  // Each pixel has 4 channels (RGBA); we write to R, G, B only (skip alpha)
  const capacity = Math.floor((imageData.data.length / 4) * 3);

  if (bits > capacity) {
    throw new Error(
      `Image too small. Need ${Math.ceil(bits / 8)} bytes capacity, have ${Math.floor(capacity / 8)}.`
    );
  }

  const pixels = new Uint8ClampedArray(imageData.data);
  let bitIdx = 0;

  for (let i = 0; i < pixels.length && bitIdx < bits; i++) {
    if ((i + 1) % 4 === 0) continue; // skip alpha channel
    const bytePos = Math.floor(bitIdx / 8);
    const bitPos = 7 - (bitIdx % 8);
    const bit = (payload[bytePos] >> bitPos) & 1;
    pixels[i] = (pixels[i] & 0xfe) | bit;
    bitIdx++;
  }

  return new ImageData(pixels, imageData.width, imageData.height);
}

export async function lsbDecode(imageData: ImageData): Promise<Uint8Array> {
  const pixels = imageData.data;
  const rawBits: number[] = [];

  for (let i = 0; i < pixels.length; i++) {
    if ((i + 1) % 4 === 0) continue;
    rawBits.push(pixels[i] & 1);
  }

  // Reconstruct bytes
  const rawBytes = new Uint8Array(Math.floor(rawBits.length / 8));
  for (let i = 0; i < rawBytes.length; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | rawBits[i * 8 + b];
    }
    rawBytes[i] = byte;
  }

  return extractPayload(rawBytes);
}

// ─── Append ────────────────────────────────────────────────────────────────────

export function appendEncode(imageBytes: Uint8Array, data: Uint8Array): Uint8Array {
  const payload = buildPayload(data);
  // Append sentinel + payload after the image bytes
  const sentinel = new TextEncoder().encode("PVLT_APPEND:");
  const result = new Uint8Array(imageBytes.length + sentinel.length + payload.length);
  result.set(imageBytes, 0);
  result.set(sentinel, imageBytes.length);
  result.set(payload, imageBytes.length + sentinel.length);
  return result;
}

export function appendDecode(imageBytes: Uint8Array): Uint8Array {
  const sentinel = new TextEncoder().encode("PVLT_APPEND:");
  const sentinelStr = "PVLT_APPEND:";

  // Search from end for sentinel
  for (let i = imageBytes.length - sentinel.length; i >= 0; i--) {
    let match = true;
    for (let j = 0; j < sentinel.length; j++) {
      if (imageBytes[i + j] !== sentinel[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      const payloadStart = i + sentinel.length;
      return extractPayload(imageBytes.slice(payloadStart));
    }
  }
  throw new Error("No hidden data found (append method).");
}

// ─── Capacity check ────────────────────────────────────────────────────────────

export function lsbCapacity(imageData: ImageData): number {
  // Returns max bytes storable via LSB (minus header)
  const pixels = Math.floor((imageData.data.length / 4) * 3);
  return Math.floor(pixels / 8) - HEADER_SIZE;
}
