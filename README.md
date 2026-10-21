# PixelVault

**Hide secrets in plain sight.**

🌐 **Live Website:** [https://pixelvault-30v.pages.dev](https://pixelvault-30v.pages.dev)

Client-side image steganography with AES-256-GCM encryption. Zero uploads. Your secrets never leave your browser.

## Features

- **LSB (Least Significant Bit)** — hides data in pixel values, visually undetectable
- **Append method** — appends encrypted payload after image bytes, lossless
- **AES-256-GCM encryption** — PBKDF2 key derivation with 200,000 iterations
- **Client-side only** — no server, no uploads, no logs
- **Capacity indicator** — see how much of your image you're using (LSB mode)

## Stack

- Next.js 16 (App Router)
- Tailwind CSS
- WebCrypto API (native browser crypto)
- Canvas API (pixel manipulation)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

### LSB (Least Significant Bit)
Each pixel has R, G, B channels. We replace the least significant bit of each channel with one bit of your payload. The change is imperceptible (1 shade out of 256). A 1920x1080 image holds ~777KB of data.

### Append
The encrypted payload is appended after the image's last byte with a magic sentinel marker. Any image viewer renders it normally; the data sits in the tail.

### Encryption
1. PBKDF2 derives a 256-bit AES key from your password + random 16-byte salt
2. AES-256-GCM encrypts the message with a random 12-byte IV
3. Layout: `[salt 16B][IV 12B][ciphertext]`
4. This encrypted blob is then embedded via LSB or Append

## Privacy

- No analytics
- No network requests
- No server
- Source is fully auditable

## By

[risterz](https://github.com/risterz) — built with [Antigravity](https://antigravity.dev) + Antislop
