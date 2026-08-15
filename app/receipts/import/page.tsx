"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";
import { normalizeToJpeg } from "@/lib/image";
import {
  renderPdfPagesToImages,
  PdfPasswordRequiredError,
  PdfPasswordIncorrectError,
} from "@/lib/pdf";
import { getCurrencySymbol, DEFAULT_CURRENCY } from "@/lib/currency";

type Mode = "sms" | "statement";

type StatementTxn = {
  date: string;
  description: string;
  amount: number;
  direction: "expense" | "income";
  reference_no: string | null;
  selected: boolean;
  isDuplicate: boolean;
};

const REQUEST_TIMEOUT_MS = 45000; // single-message calls (SMS parse)
const STATEMENT_TIMEOUT_MS = 120000; // multi-page statements batch several API calls sequentially, so this needs more headroom

export default function ImportPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("sms");

  // SMS mode state
  const [smsText, setSmsText] = useState("");
  const [smsLoading, setSmsLoading] = useState(false);

  // Statement mode state
  const [statementLoading, setStatementLoading] = useState(false);
  const [transactions, setTransactions] = useState<StatementTxn[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(getCurrencySymbol(DEFAULT_CURRENCY));
  const [pageWarning, setPageWarning] = useState<string | null>(null);

  // Password-protected PDF state
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const [pdfPasswordError, setPdfPasswordError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrencySymbol(getCurrencySymbol(user?.user_metadata?.currency));
    });
  }, [supabase]);

  async function handleParseSms() {
    if (!smsText.trim()) return;
    setSmsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/ocr/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: smsText }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `Something went wrong (error ${res.status}).`);
      }

      sessionStorage.setItem("receiptDraft", JSON.stringify(data));
      sessionStorage.removeItem("receiptImagePreview");

      router.push("/receipts/new");
    } catch (err: any) {
      const message =
        err?.name === "AbortError"
          ? "That took too long to respond. Check your connection and try again."
          : err?.message || "Couldn't parse that message. Try again.";
      alert(message);
      setSmsLoading(false);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function handleStatementFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isPdf = file.type === "application/pdf";

    if (!isPdf && !file.type.startsWith("image/")) {
      alert("Please choose an image or a PDF of your statement.");
      return;
    }

    setStatementLoading(true);
    setTransactions(null);
    setPageWarning(null);

    try {
      if (isPdf) {
        await processPdf(file);
      } else {
        // A single image is inherently limited to what's visible on that one
        // screen — if you need a wider date range, export a PDF instead so
        // every page/transaction gets processed.
        const normalized = await normalizeToJpeg(file);
        await uploadPagesForOcr([normalized]);
      }
    } catch (err: any) {
      alert(err?.message || "Couldn't read that statement. Try again.");
      setStatementLoading(false);
    }
  }

  async function processPdf(file: File, password?: string) {
    try {
      const { images, truncated, renderedPages, totalPages } = await renderPdfPagesToImages(
        file,
        password
      );
      setPendingPdf(null);
      setPdfPassword("");
      setPdfPasswordError(null);

      if (truncated) {
        setPageWarning(
          `This PDF has ${totalPages} pages — only processed the first ${renderedPages}. If some transactions are missing, try splitting the statement into smaller date ranges and importing each separately.`
        );
      }

      await uploadPagesForOcr(images);
    } catch (err) {
      if (err instanceof PdfPasswordRequiredError) {
        // Pause here and ask for the password instead of failing outright.
        setPendingPdf(file);
        setStatementLoading(false);
        return;
      }
      if (err instanceof PdfPasswordIncorrectError) {
        setPdfPasswordError("That password didn't work. Try again.");
        setStatementLoading(false);
        return;
      }
      throw err;
    }
  }

  async function handleSubmitPdfPassword() {
    if (!pendingPdf || !pdfPassword) return;
    setPdfPasswordError(null);
    setStatementLoading(true);
    try {
      await processPdf(pendingPdf, pdfPassword);
    } catch (err: any) {
      setStatementLoading(false);
      alert(err?.message || "Couldn't open that PDF. Try again.");
    }
  }

  async function uploadPagesForOcr(images: Blob[]) {
    setStatementLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STATEMENT_TIMEOUT_MS);

    try {
      const formData = new FormData();
      images.forEach((img, i) => formData.append("file", img, `page-${i + 1}.jpg`));

      const res = await fetch("/api/ocr/statement", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `Something went wrong (error ${res.status}).`);
      }

      const rawTxns = data.transactions as Omit<StatementTxn, "selected" | "isDuplicate">[];
      const withDuplicateFlags = await flagDuplicates(rawTxns);

      setTransactions(
        withDuplicateFlags.map((t) => ({
          ...t,
          // Uncheck likely duplicates by default so you don't double-import
          // by accident — you can still tap to select one if it's a
          // legitimate repeat charge on the same day for the same amount.
          selected: !t.isDuplicate,
        }))
      );
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("That took too long to process. Try a shorter statement or fewer pages.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      setStatementLoading(false);
    }
  }

  /**
   * Checks each extracted transaction against what's already saved for this
   * user (same date + same amount, within a cent). This is what stops the
   * same statement — or an overlapping date range from a second statement —
   * from silently creating duplicate entries every time you import.
   */
  async function flagDuplicates(
    txns: Omit<StatementTxn, "selected" | "isDuplicate">[]
  ): Promise<Omit<StatementTxn, "selected">[]> {
    if (txns.length === 0) return [];

    const dates = txns.map((t) => t.date).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    const { data: existing } = await supabase
      .from("receipts")
      .select("purchased_at, amount")
      .gte("purchased_at", minDate)
      .lte("purchased_at", `${maxDate}T23:59:59`);

    const existingRows = existing || [];

    return txns.map((t) => {
      const isDuplicate = existingRows.some((row) => {
        const rowDate = new Date(row.purchased_at).toISOString().slice(0, 10);
        return rowDate === t.date && Math.abs(Number(row.amount) - t.amount) < 0.01;
      });
      return { ...t, isDuplicate };
    });
  }

  function toggleTxn(index: number) {
    setTransactions((prev) =>
      prev
        ? prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
        : prev
    );
  }

  function toggleDirection(index: number) {
    setTransactions((prev) =>
      prev
        ? prev.map((t, i) =>
            i === index
              ? { ...t, direction: t.direction === "expense" ? "income" : "expense" }
              : t
          )
        : prev
    );
  }

  function selectAll(selected: boolean) {
    setTransactions((prev) => (prev ? prev.map((t) => ({ ...t, selected })) : prev));
  }

  async function handleImportSelected() {
    if (!transactions) return;
    const toImport = transactions.filter((t) => t.selected);
    if (toImport.length === 0) return;

    setImporting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const rows = toImport.map((t) => ({
      user_id: user.id,
      store_name: t.description,
      purchased_at: t.date,
      amount: t.amount,
      category: "Transfer",
      items: [],
      receipt_type: "transfer",
      direction: t.direction,
      payment_method: null,
      counterparty: t.description,
      reference_no: t.reference_no,
    }));

    const { error } = await supabase.from("receipts").insert(rows);

    setImporting(false);

    if (error) {
      alert("Couldn't import: " + error.message);
      return;
    }

    router.push("/receipts");
  }

  const selectedCount = transactions?.filter((t) => t.selected).length ?? 0;
  const duplicateCount = transactions?.filter((t) => t.isDuplicate).length ?? 0;

  return (
    <>
      <TopBar title="Import" />
      <main className="flex-1 overflow-y-auto px-container-margin pt-md pb-32 no-scrollbar">
        <div className="mb-lg flex w-full rounded-input bg-surface-low p-1">
          <button
            onClick={() => setMode("sms")}
            className={`flex-1 rounded py-2 text-sm font-semibold transition-colors ${
              mode === "sms" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"
            }`}
          >
            Bank SMS
          </button>
          <button
            onClick={() => setMode("statement")}
            className={`flex-1 rounded py-2 text-sm font-semibold transition-colors ${
              mode === "statement" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"
            }`}
          >
            Bank Statement
          </button>
        </div>

        {mode === "sms" ? (
          <div className="space-y-md">
            <p className="text-sm text-on-surface-variant">
              No photo, no screenshot — just paste the raw text of a bank or
              wallet SMS/notification and we'll pull out the details.
            </p>
            <textarea
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              placeholder={`e.g. "Rs 2,500.00 debited from your account ending 1234 on 12-Aug-26 at KFC BAHRIA TOWN. Avl bal Rs 45,000."`}
              rows={6}
              className="w-full rounded-input border border-outline-variant bg-surface-low p-md text-sm text-primary outline-none focus:border-primary"
            />
            <button
              onClick={handleParseSms}
              disabled={smsLoading || !smsText.trim()}
              className="w-full rounded-input bg-primary py-3 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {smsLoading ? "Parsing..." : "Parse Message"}
            </button>
          </div>
        ) : (
          <div className="space-y-md">
            {!transactions && !pendingPdf && (
              <>
                <p className="text-sm text-on-surface-variant">
                  Upload a PDF export of your bank/wallet statement for the
                  widest date range — a screenshot only captures what's
                  visible on one screen. Password-protected PDFs are supported.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={statementLoading}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-input border-2 border-dashed border-outline-variant bg-surface-low py-xl transition-colors active:bg-surface-high disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                    upload_file
                  </span>
                  <span className="text-sm font-semibold text-on-surface-variant">
                    {statementLoading ? "Reading statement..." : "Choose image or PDF"}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleStatementFile}
                />
              </>
            )}

            {pendingPdf && !transactions && (
              <div className="space-y-md rounded-input border border-outline-variant bg-surface-low p-md">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">lock</span>
                  <p className="text-sm font-semibold text-primary">
                    This PDF is password-protected
                  </p>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Enter the password to open <strong>{pendingPdf.name}</strong> — it's
                  only used locally in your browser to unlock the file, never stored.
                </p>
                <input
                  type="password"
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitPdfPassword()}
                  placeholder="PDF password"
                  autoFocus
                  className="w-full rounded-input border border-outline-variant bg-white px-md py-sm text-sm outline-none focus:border-primary"
                />
                {pdfPasswordError && (
                  <p className="text-xs text-error">{pdfPasswordError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPendingPdf(null);
                      setPdfPassword("");
                      setPdfPasswordError(null);
                    }}
                    className="flex-1 rounded-input border border-outline-variant py-2 text-sm font-semibold text-on-surface-variant"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitPdfPassword}
                    disabled={!pdfPassword || statementLoading}
                    className="flex-1 rounded-input bg-primary py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
                  >
                    {statementLoading ? "Unlocking..." : "Unlock"}
                  </button>
                </div>
              </div>
            )}

            {pageWarning && (
              <div className="flex items-start gap-2 rounded-input border border-amber-300 bg-amber-50 p-md">
                <span className="material-symbols-outlined text-amber-600">info</span>
                <p className="text-xs text-amber-800">{pageWarning}</p>
              </div>
            )}

            {transactions && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-primary">
                    {transactions.length} transaction{transactions.length === 1 ? "" : "s"} found
                    {duplicateCount > 0 && (
                      <span className="ml-1 font-normal text-on-surface-variant">
                        ({duplicateCount} possible duplicate{duplicateCount === 1 ? "" : "s"}, unchecked)
                      </span>
                    )}
                  </p>
                  <div className="flex gap-3 text-xs font-semibold text-secondary">
                    <button onClick={() => selectAll(true)}>Select all</button>
                    <button onClick={() => selectAll(false)}>Deselect all</button>
                  </div>
                </div>

                <div className="space-y-2">
                  {transactions.map((t, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-input border p-md transition-colors ${
                        t.selected ? "border-outline-variant bg-surface" : "border-outline-variant bg-surface-low opacity-60"
                      }`}
                    >
                      <button
                        onClick={() => toggleTxn(i)}
                        aria-label={t.selected ? "Deselect" : "Select"}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-outline-variant"
                      >
                        {t.selected && (
                          <span className="material-symbols-outlined text-[16px] text-secondary">
                            check
                          </span>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-primary">
                          {t.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-on-surface-variant">
                            {new Date(t.date).toLocaleDateString("en-US", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          {t.isDuplicate && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              Already in Receipts?
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => toggleDirection(i)}
                        className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${
                          t.direction === "income"
                            ? "bg-secondary/10 text-secondary"
                            : "bg-surface-high text-on-surface-variant"
                        }`}
                        title="Tap to flip income/expense"
                      >
                        {t.direction === "income" ? "+" : "-"}
                        {currencySymbol} {t.amount.toFixed(2)}
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setTransactions(null);
                    setPendingPdf(null);
                    setPdfPassword("");
                    setPdfPasswordError(null);
                    setPageWarning(null);
                  }}
                  className="w-full text-center text-sm font-semibold text-on-surface-variant"
                >
                  Upload a different file
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {mode === "statement" && transactions && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-outline-variant bg-background p-container-margin">
          <button
            onClick={handleImportSelected}
            disabled={importing || selectedCount === 0}
            className="w-full rounded-input bg-primary py-3 text-sm font-semibold text-on-primary transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {importing ? "Importing..." : `Import ${selectedCount} Selected`}
          </button>
        </div>
      )}
    </>
  );
}