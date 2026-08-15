"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeToJpeg } from "@/lib/image";

const REQUEST_TIMEOUT_MS = 45000; // fail cleanly instead of hanging forever

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [flashOn, setFlashOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setCameraError(
          "Camera unavailable. Use the gallery button to upload a photo instead."
        );
      }
    }

    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function capturePhoto() {
    if (processing) return; // guard against a rapid double-tap firing twice
    if (!videoRef.current) return;

    // Guard against firing before the camera stream has actually started —
    // videoWidth/Height are 0 until the first frame decodes.
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      alert("Camera is still starting up — give it a second and try again.");
      return;
    }

    // Set this synchronously, before the async canvas.toBlob callback, so
    // the capture button disables on the very next render — otherwise
    // there's a brief window where a second tap could slip through before
    // React re-renders with the disabled state.
    setProcessing(true);

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setProcessing(false);
          alert("Couldn't capture that photo. Try again.");
          return;
        }
        try {
          const resized = await normalizeToJpeg(blob);
          await processImage(resized);
        } catch (err: any) {
          setProcessing(false);
          alert(err?.message || "Couldn't process that photo. Try again.");
        }
      },
      "image/jpeg",
      0.9
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    // Reset so choosing the exact same file again still fires onChange
    e.target.value = "";

    if (!file) return;
    if (processing) return; // guard against overlapping invocations

    if (!file.type.startsWith("image/")) {
      alert("That file isn't an image. Please choose a photo.");
      return;
    }

    const MAX_SIZE_MB = 25;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`That image is too large (max ${MAX_SIZE_MB}MB). Try a smaller photo.`);
      return;
    }

    setProcessing(true);

    // Normalize first — this converts HEIC (common on iPhone galleries) and
    // any oversized photo into a consistent JPEG before we ever hit the API,
    // so format/size issues get caught here with a clear message instead of
    // showing up as a confusing OCR failure later.
    let normalized: Blob;
    try {
      normalized = await normalizeToJpeg(file);
    } catch (err: any) {
      setProcessing(false);
      alert(err?.message || "Couldn't process that image. Try a different photo.");
      return;
    }

    await processImage(normalized);
  }

  async function processImage(blob: Blob) {
    setProcessing(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const formData = new FormData();
      formData.append("image", blob, "receipt.jpg");

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Show the server's actual reason instead of a generic guess.
        const message = data?.error || `Something went wrong (error ${res.status}).`;
        throw new Error(message);
      }

      // Store extracted data + image in sessionStorage to pass to confirm screen
      const imageUrl = URL.createObjectURL(blob);
      sessionStorage.setItem("receiptDraft", JSON.stringify(data));
      sessionStorage.setItem("receiptImagePreview", imageUrl);

      router.push("/receipts/new");
    } catch (err: any) {
      const message =
        err?.name === "AbortError"
          ? "That took too long to respond. Check your connection and try again."
          : err?.message ||
            "Couldn't reach the scanning service. Check your connection and try again.";
      alert(message);
      setProcessing(false);
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
    }
  }

  function cancelProcessing() {
    abortControllerRef.current?.abort();
    setProcessing(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-8 text-center text-sm text-white/80">
          {cameraError}
        </div>
      )}

      {/* Scan overlay guide */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-[10%] top-[20%] bottom-[25%] rounded-lg border-2 border-white/70" />
      </div>

      {/* Top bar */}
      <div className="safe-top absolute left-0 right-0 top-0 flex flex-col gap-6 px-container-margin pt-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5 backdrop-blur-md">
            <span className="material-symbols-outlined text-sm">imagesmode</span>
            <span className="text-sm font-medium">Scan</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold drop-shadow-md">
            Align receipt within frame
          </p>
          <p className="mt-1 text-sm text-white/70 drop-shadow-md">
            Ensure edges are visible
          </p>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="safe-bottom absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-container-margin pb-10 pt-8">
        <button
          onClick={() => setFlashOn((v) => !v)}
          className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
            flashOn ? "bg-white text-black" : "bg-black/40 text-white"
          }`}
          aria-label="Toggle flash"
        >
          <span className="material-symbols-outlined">
            {flashOn ? "flash_on" : "flash_off"}
          </span>
        </button>

        <button
          onClick={capturePhoto}
          disabled={processing || !!cameraError}
          aria-label="Take photo"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white p-1 disabled:opacity-40"
        >
          <div className="h-full w-full rounded-full bg-white transition-transform active:scale-90" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/20 bg-white/10 backdrop-blur-md"
          aria-label="Choose from gallery"
        >
          <span className="material-symbols-outlined">photo_library</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {processing && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/70">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm text-white/80">Reading receipt...</p>
          <button
            onClick={cancelProcessing}
            className="mt-2 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white active:bg-white/10"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
} 