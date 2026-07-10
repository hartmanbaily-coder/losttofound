import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlobFile, downloadTextFile, shareHtmlAsPdf } from "@/lib/records/clientStore";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("native text export bridge", () => {
  it("sends CSV exports to the Lost to Found iOS bridge", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", {
      webkit: {
        messageHandlers: {
          lostToFoundDownload: { postMessage },
        },
      },
    });

    downloadTextFile("lost-to-found-report.csv", "date,event\n2026-07-10,Export", "text/csv");

    expect(postMessage).toHaveBeenCalledWith({
      fileName: "lost-to-found-report.csv",
      body: "date,event\n2026-07-10,Export",
      contentType: "text/csv",
    });
  });

  it("requests a native PDF when a printable report is exported", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", {
      webkit: {
        messageHandlers: {
          lostToFoundDownload: { postMessage },
        },
      },
    });

    expect(shareHtmlAsPdf("lost-to-found-report.pdf", "<h1>Report</h1>")).toBe(true);

    expect(postMessage).toHaveBeenCalledWith({
      fileName: "lost-to-found-report.pdf",
      body: "<h1>Report</h1>",
      contentType: "text/html",
      renderAsPDF: true,
    });
  });

  it("sends evidence files to the native bridge without using a browser download", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", {
      webkit: {
        messageHandlers: {
          lostToFoundDownload: { postMessage },
        },
      },
    });

    await downloadBlobFile("receipt.txt", new Blob(["receipt"], { type: "text/plain" }));

    expect(postMessage).toHaveBeenCalledWith({
      fileName: "receipt.txt",
      body: "cmVjZWlwdA==",
      contentType: "text/plain",
      base64Encoded: true,
    });
  });
});
