"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import {
  lsbEncode,
  lsbDecode,
  appendEncode,
  appendDecode,
  lsbCapacity,
} from "@/lib/steganography";
import {
  loadImageData,
  imageDataToCanvas,
  downloadCanvas,
  downloadBytes,
  fileToBytes,
  formatBytes,
} from "@/lib/imageUtils";

type Method = "lsb" | "append";
type Tab = "encode" | "decode";
type Status = "idle" | "loading" | "success" | "error";

interface ProcessState {
  status: Status;
  message: string;
  detail?: string;
}

// ─── Reusable UI primitives ────────────────────────────────────────────────────

function Terminal({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-xs text-[#6b6b6b] leading-relaxed">
      {children}
    </div>
  );
}

function GreenText({ children }: { children: React.ReactNode }) {
  return <span className="text-[#00ff41]">{children}</span>;
}

function StatusLine({ state }: { state: ProcessState }) {
  if (state.status === "idle") return null;

  const color =
    state.status === "loading"
      ? "text-[#00ff41]"
      : state.status === "success"
      ? "text-[#00ff41]"
      : "text-red-400";

  const prefix =
    state.status === "loading"
      ? "[ ... ]"
      : state.status === "success"
      ? "[ OK  ]"
      : "[ ERR ]";

  return (
    <div className={`fade-in font-mono text-xs mt-3 ${color}`}>
      <div>
        {prefix} {state.message}
      </div>
      {state.detail && (
        <div className="text-[#6b6b6b] mt-1 ml-8">{state.detail}</div>
      )}
    </div>
  );
}

function DropZone({
  onFile,
  accept,
  label,
  sublabel,
  file,
}: {
  onFile: (f: File) => void;
  accept: string;
  label: string;
  sublabel: string;
  file: File | null;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`
        cursor-pointer border border-dashed rounded-sm p-6
        flex flex-col items-center justify-center gap-2 transition-colors
        ${
          dragging
            ? "dropzone-active border-[#00ff4177]"
            : file
            ? "border-[#00ff4144] bg-[#00ff410a]"
            : "border-[#1f1f1f] hover:border-[#00ff4133]"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {file ? (
        <Terminal>
          <GreenText>image loaded</GreenText>
          <div className="mt-1 text-[#d4d4d4]">{file.name}</div>
          <div className="text-[#6b6b6b]">{formatBytes(file.size)}</div>
        </Terminal>
      ) : (
        <Terminal>
          <div className="text-center">
            <div className="text-[#d4d4d4] mb-1">{label}</div>
            <div>{sublabel}</div>
          </div>
        </Terminal>
      )}
    </div>
  );
}

function CapacityBar({
  used,
  total,
}: {
  used: number;
  total: number;
}) {
  const pct = Math.min(100, (used / total) * 100);
  const color =
    pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-[#00ff41]";
  return (
    <div className="mt-2">
      <div className="flex justify-between font-mono text-[10px] text-[#6b6b6b] mb-1">
        <span>capacity used</span>
        <span>
          {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
      <div className="h-[2px] bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className={`h-full progress-bar ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Encode Panel ──────────────────────────────────────────────────────────────

function EncodePanel() {
  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<Method>("lsb");
  const [state, setState] = useState<ProcessState>({ status: "idle", message: "" });
  const [capacity, setCapacity] = useState<{ used: number; total: number } | null>(null);

  // Update capacity when image or message changes
  useEffect(() => {
    if (!image || method !== "lsb") {
      setCapacity(null);
      return;
    }
    loadImageData(image).then(({ imageData }) => {
      const total = lsbCapacity(imageData);
      const used = new TextEncoder().encode(message).length + 28; // approx encrypted overhead
      setCapacity({ used, total });
    }).catch(() => setCapacity(null));
  }, [image, message, method]);

  async function handleEncode() {
    if (!image) return setState({ status: "error", message: "No image selected." });
    if (!message.trim()) return setState({ status: "error", message: "Message is empty." });
    if (!password) return setState({ status: "error", message: "Password is required." });

    setState({ status: "loading", message: "Encrypting message..." });

    try {
      const encrypted = await encryptMessage(message, password);
      setState({ status: "loading", message: "Embedding into image..." });

      if (method === "lsb") {
        const { imageData } = await loadImageData(image);
        const encoded = await lsbEncode(imageData, encrypted);
        const canvas = imageDataToCanvas(encoded);
        downloadCanvas(canvas, `pixelvault_${Date.now()}.png`);
      } else {
        const bytes = await fileToBytes(image);
        const encoded = appendEncode(bytes, encrypted);
        downloadBytes(encoded, `pixelvault_${Date.now()}.png`);
      }

      setState({
        status: "success",
        message: "Image downloaded.",
        detail: `Method: ${method.toUpperCase()} | AES-256-GCM | ${formatBytes(new TextEncoder().encode(message).length)} payload`,
      });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  }

  return (
    <div className="space-y-5">
      <DropZone
        onFile={setImage}
        accept="image/png,image/jpeg,image/webp,image/bmp"
        label="drop image here"
        sublabel="png / jpg / webp — click or drag"
        file={image}
      />

      <div>
        <label className="block font-mono text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-2">
          Secret Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="type your secret..."
          rows={4}
          className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-sm px-3 py-2
            font-mono text-sm text-[#d4d4d4] placeholder:text-[#333]
            focus:border-[#00ff4155] focus:outline-none resize-none transition-colors"
        />
        {capacity && (
          <CapacityBar used={capacity.used} total={capacity.total} />
        )}
      </div>

      <div>
        <label className="block font-mono text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-2">
          Password (AES-256)
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="encryption password..."
          className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-sm px-3 py-2
            font-mono text-sm text-[#d4d4d4] placeholder:text-[#333]
            focus:border-[#00ff4155] focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block font-mono text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-2">
          Method
        </label>
        <div className="flex gap-2">
          {(["lsb", "append"] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 py-2 font-mono text-xs rounded-sm border transition-colors
                ${
                  method === m
                    ? "border-[#00ff4155] bg-[#00ff410d] text-[#00ff41]"
                    : "border-[#1a1a1a] text-[#6b6b6b] hover:border-[#2a2a2a] hover:text-[#d4d4d4]"
                }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="font-mono text-[10px] text-[#444] mt-1.5">
          {method === "lsb"
            ? "LSB: modifies pixel values — visually undetectable"
            : "Append: data appended after image bytes — lossless, simpler"}
        </div>
      </div>

      <button
        onClick={handleEncode}
        disabled={state.status === "loading"}
        className="w-full py-3 font-mono text-sm text-[#0a0a0a] bg-[#00ff41]
          rounded-sm glow-green hover:bg-[#00e83b] active:bg-[#00c832]
          disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {state.status === "loading" ? "processing..." : "encode + download"}
      </button>

      <StatusLine state={state} />
    </div>
  );
}

// ─── Decode Panel ──────────────────────────────────────────────────────────────

function DecodePanel() {
  const [image, setImage] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<Method>("lsb");
  const [state, setState] = useState<ProcessState>({ status: "idle", message: "" });
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleDecode() {
    if (!image) return setState({ status: "error", message: "No image selected." });
    if (!password) return setState({ status: "error", message: "Password is required." });

    setState({ status: "loading", message: "Extracting hidden data..." });
    setResult(null);

    try {
      let rawData: Uint8Array;

      if (method === "lsb") {
        const { imageData } = await loadImageData(image);
        rawData = await lsbDecode(imageData);
      } else {
        const bytes = await fileToBytes(image);
        rawData = appendDecode(bytes);
      }

      setState({ status: "loading", message: "Decrypting with AES-256..." });
      const message = await decryptMessage(rawData, password);

      setResult(message);
      setState({
        status: "success",
        message: "Message recovered.",
        detail: `Method: ${method.toUpperCase()} | ${formatBytes(new TextEncoder().encode(message).length)} payload`,
      });
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error
            ? err.message.includes("operation-specific reason")
              ? "Wrong password or corrupted data."
              : err.message
            : "Unknown error.",
      });
    }
  }

  function copyResult() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-5">
      <DropZone
        onFile={setImage}
        accept="image/png,image/jpeg,image/webp,image/bmp"
        label="drop encoded image here"
        sublabel="the image that contains the hidden message"
        file={image}
      />

      <div>
        <label className="block font-mono text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-2">
          Password (AES-256)
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="decryption password..."
          className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-sm px-3 py-2
            font-mono text-sm text-[#d4d4d4] placeholder:text-[#333]
            focus:border-[#00ff4155] focus:outline-none transition-colors"
        />
      </div>

      <div>
        <label className="block font-mono text-[10px] text-[#6b6b6b] uppercase tracking-widest mb-2">
          Method
        </label>
        <div className="flex gap-2">
          {(["lsb", "append"] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 py-2 font-mono text-xs rounded-sm border transition-colors
                ${
                  method === m
                    ? "border-[#00ff4155] bg-[#00ff410d] text-[#00ff41]"
                    : "border-[#1a1a1a] text-[#6b6b6b] hover:border-[#2a2a2a] hover:text-[#d4d4d4]"
                }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleDecode}
        disabled={state.status === "loading"}
        className="w-full py-3 font-mono text-sm text-[#0a0a0a] bg-[#00ff41]
          rounded-sm glow-green hover:bg-[#00e83b] active:bg-[#00c832]
          disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {state.status === "loading" ? "processing..." : "decode message"}
      </button>

      <StatusLine state={state} />

      {result !== null && (
        <div className="fade-in">
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-[10px] text-[#6b6b6b] uppercase tracking-widest">
              Recovered Message
            </label>
            <button
              onClick={copyResult}
              className="font-mono text-[10px] text-[#6b6b6b] hover:text-[#00ff41] transition-colors"
            >
              {copied ? "copied!" : "copy"}
            </button>
          </div>
          <div className="bg-[#0d0d0d] border border-[#00ff4133] rounded-sm p-3 font-mono text-sm text-[#d4d4d4] whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
            {result}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<Tab>("encode");

  return (
    <div className="scanlines min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[#141414] px-6 py-4">
        <div className="max-w-lg mx-auto flex items-baseline justify-between">
          <div>
            <h1 className="font-mono text-[#00ff41] text-lg font-bold cursor-blink">
              PixelVault
            </h1>
            <p className="font-mono text-[10px] text-[#444] mt-0.5">
              hide secrets in plain sight
            </p>
          </div>
          <div className="font-mono text-[10px] text-[#333] text-right">
            <div>zero uploads</div>
            <div>client-side only</div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-lg mx-auto">
          {/* Tab bar */}
          <div className="flex gap-0 border border-[#1a1a1a] rounded-sm overflow-hidden mb-6">
            {(["encode", "decode"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 font-mono text-xs uppercase tracking-widest transition-colors
                  ${
                    tab === t
                      ? "bg-[#00ff410d] text-[#00ff41] border-b-2 border-[#00ff41]"
                      : "text-[#6b6b6b] hover:text-[#d4d4d4] hover:bg-[#111]"
                  }`}
              >
                {t === "encode" ? "[ encode ]" : "[ decode ]"}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div className="bg-[#111] border border-[#1a1a1a] rounded-sm p-5">
            {tab === "encode" ? <EncodePanel /> : <DecodePanel />}
          </div>

          {/* How it works — content-driven, not template */}
          <div className="mt-8 border border-[#141414] rounded-sm p-4">
            <div className="font-mono text-[10px] text-[#444] uppercase tracking-widest mb-3">
              how it works
            </div>
            <div className="space-y-2">
              {[
                ["LSB", "Each pixel's least significant bit is flipped to store your data. One bit per channel means ~3 bits per pixel — invisible to the human eye, undetectable without this tool."],
                ["Append", "Your encrypted payload is appended after the image's byte stream. The image renders normally in any viewer; the data sits in the tail."],
                ["AES-256-GCM", "Your message is encrypted with AES-256-GCM before embedding. The password is never stored or transmitted. PBKDF2 with 200,000 iterations derives the key."],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3">
                  <span className="font-mono text-[10px] text-[#00ff41] shrink-0 mt-0.5 w-20">
                    {title}
                  </span>
                  <span className="font-mono text-[10px] text-[#444] leading-relaxed">
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#141414] px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between font-mono text-[10px] text-[#333]">
          <span>PixelVault by risterz</span>
          <span>no data leaves your browser</span>
        </div>
      </footer>
    </div>
  );
}
