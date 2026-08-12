export class PdfPasswordRequiredError extends Error {
  constructor() {
    super("This PDF is password-protected.");
    this.name = "PdfPasswordRequiredError";
  }
}

export class PdfPasswordIncorrectError extends Error {
  constructor() {
    super("That password didn't work.");
    this.name = "PdfPasswordIncorrectError";
  }
}

const MAX_PAGES = 10; // cap to keep OCR calls (and cost) bounded

/**
 * Renders every page of a PDF to a JPEG blob. If the PDF is encrypted,
 * pass `password` — pdf.js will use it to decrypt on load. Throws
 * PdfPasswordRequiredError if no password was given but one is needed, or
 * PdfPasswordIncorrectError if the one given was wrong. Callers should catch
 * both to prompt the person for a password and retry.
 *
 * pdfjs-dist is imported dynamically (not at module top level) because it
 * touches browser-only globals (e.g. DOMMatrix) as soon as its module code
 * runs. A static top-level import would get evaluated during Next.js's
 * server-side render pass of this client component and crash with
 * "DOMMatrix is not defined". A dynamic import() deferred until this
 * function actually runs (from a browser click handler, after hydration)
 * guarantees it only ever loads in the browser.
 */
export async function renderPdfPagesToImages(
  file: File,
  password?: string
): Promise<Blob[]> {
  if (typeof window === "undefined") {
    throw new Error("PDF rendering is only available in the browser.");
  }

  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    password: password || undefined,
  });

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err: any) {
    // pdf.js signals a wrong/missing password via error.name === "PasswordException".
    if (err?.name === "PasswordException") {
      if (password) {
        throw new PdfPasswordIncorrectError();
      }
      throw new PdfPasswordRequiredError();
    }
    throw new Error("Couldn't open that PDF. It may be corrupted or an unsupported format.");
  }

  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  const images: Blob[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 }); // 2x for OCR clarity

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser doesn't support PDF rendering.");

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );

    if (blob) images.push(blob);
  }

  if (images.length === 0) {
    throw new Error("Couldn't render any pages from that PDF.");
  }

  return images;
}