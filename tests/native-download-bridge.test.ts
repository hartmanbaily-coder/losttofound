import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "@/lib/records/clientStore";

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
});
