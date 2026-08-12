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

// Pinned to the version installed in package.json — bump both together if
// you ever upgrade pdfjs-dist.
const PDFJS_VERSION = "6.2.108";
const PDFJS_CDN_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

let pdfjsLibPromise: Promise<any> | null = null;

/**
 * Loads pdfjs-dist as a genuine browser-native ES module fetched from a CDN
 * at runtime, instead of importing it as an npm package through webpack.
 *
 * Why: pdfjs-dist v6+ ships pure ESM builds that use `import.meta.url` and
 * raw import/export syntax. Next.js's build pipeline (webpack, and whatever
 * transform runs over "use client" component dependencies during the
 * server prerender pass) can fail to parse that correctly — producing
 * errors like "'import.meta' cannot be used outside of module code" during
 * `next build` on Vercel, even though the code only ever runs in the
 * browser. pdfjs-dist's own source works around parts of this with
 * `/*webpackIgnore*\/` comments, but that doesn't cover every bundler code
 * path.
 *
 * The fix: build the module URL dynamically (not a static string literal)
 * so webpack can't statically analyze or attempt to bundle this import at
 * all — it's left as a plain runtime `import()` call, which the browser
 * itself resolves natively via real ES module loading. Next.js/webpack
 * never touches pdfjs-dist's source, so it can't break the build.
 */
function loadPdfjs(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDF rendering is only available in the browser."));
  }

  if (!pdfjsLibPromise) {
    const url = `${PDFJS_CDN_BASE}/pdf.min.mjs`;
    pdfjsLibPromise = import(/* webpackIgnore: true */ url);
  }

  return pdfjsLibPromise;
}

/**
 * Renders every page of a PDF to a JPEG blob. If the PDF is encrypted,
 * pass `password` — pdf.js will use it to decrypt on load. Throws
 * PdfPasswordRequiredError if no password was given but one is needed, or
 * PdfPasswordIncorrectError if the one given was wrong. Callers should catch
 * both to prompt the person for a password and retry.
 */
export async function renderPdfPagesToImages(
  file: File,
  password?: string
): Promise<Blob[]> {
  const pdfjsLib = await loadPdfjs();

  pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.mjs`;

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