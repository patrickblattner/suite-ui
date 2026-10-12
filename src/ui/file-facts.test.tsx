import { cleanup, render, screen, within } from "@testing-library/react";
import i18n from "i18next";
import { afterEach, describe, expect, it } from "vitest";

import { FileFacts } from "./file-facts.js";

// SUI-FEATURE-060: the rows a kind shows, in order, as [label, value] pairs.
function rows() {
  const list = screen.getByTestId("facts");
  return within(list)
    .getAllByRole("term")
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
}

const VIDEO = {
  formatName: "MP4",
  mime: "video/mp4",
  width: 1920,
  height: 1080,
  durationSeconds: 3725,
  frameRate: 29.97,
  bytes: 1536,
};

describe("FileFacts", () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("is a description list with label and value styles", () => {
    render(<FileFacts kind="image" data-testid="facts" />);
    const list = screen.getByTestId("facts");
    expect(list.tagName).toBe("DL");
    expect(list).toHaveClass("grid", "grid-cols-[auto_minmax(0,1fr)]", "text-sm");
    expect(within(list).getAllByRole("term")[0]).toHaveClass("text-muted-foreground");
    expect(within(list).getAllByRole("definition")[0]).toHaveClass("text-foreground");
  });

  it("image: format, resolution and file size, no duration and no frame rate", () => {
    render(
      <FileFacts
        kind="image"
        formatName="PNG"
        mime="image/png"
        width={800}
        height={600}
        bytes={512}
        durationSeconds={10}
        frameRate={25}
        data-testid="facts"
      />,
    );
    expect(rows()).toEqual([
      ["Format", "PNG (image/png)"],
      ["Resolution", "800 × 600 px"],
      ["File size", "512 B"],
    ]);
  });

  it("video: all five rows in the fixed order", () => {
    render(<FileFacts kind="video" {...VIDEO} data-testid="facts" />);
    expect(rows()).toEqual([
      ["Format", "MP4 (video/mp4)"],
      ["Resolution", "1,920 × 1,080 px"],
      ["Duration", "1:02:05"],
      ["Frame rate", "29.97 fps"],
      ["File size", "1.5 KB"],
    ]);
  });

  it("audio: format, duration and file size", () => {
    render(
      <FileFacts
        kind="audio"
        formatName="MP3"
        mime="audio/mpeg"
        durationSeconds={185}
        bytes={5 * 1024 * 1024}
        width={1}
        height={1}
        frameRate={1}
        data-testid="facts"
      />,
    );
    expect(rows()).toEqual([
      ["Format", "MP3 (audio/mpeg)"],
      ["Duration", "3:05"],
      ["File size", "5.0 MB"],
    ]);
  });

  it("other: format and file size", () => {
    render(
      <FileFacts kind="other" mime="application/pdf" bytes={3 * 1024 ** 3} data-testid="facts" />,
    );
    expect(rows()).toEqual([
      ["Format", "application/pdf"],
      ["File size", "3.0 GB"],
    ]);
  });

  it("a video without frameRate reads 'nicht gemessen' in the frame rate row", async () => {
    await i18n.changeLanguage("de");
    render(<FileFacts kind="video" {...VIDEO} frameRate={undefined} data-testid="facts" />);
    expect(rows()[3]).toEqual(["Bildrate", "nicht gemessen"]);
  });

  it("every missing value an applicable row needs reads 'not measured'", () => {
    render(<FileFacts kind="video" width={1920} data-testid="facts" />);
    expect(rows().map(([, value]) => value)).toEqual(Array(5).fill("not measured"));
  });

  it.each([
    ["de", "1,5 KB", "29,97 fps"],
    ["en", "1.5 KB", "29.97 fps"],
  ])("numbers follow the active language (%s)", async (lng, size, rate) => {
    await i18n.changeLanguage(lng);
    render(<FileFacts kind="video" {...VIDEO} data-testid="facts" />);
    const values = rows().map(([, value]) => value);
    expect(values[4]).toBe(size);
    expect(values[3]).toBe(rate);
  });

  it.each([
    [0, "0:00"],
    [59, "0:59"],
    [600, "10:00"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [3725, "1:02:05"],
  ])("duration %d s reads %s", (seconds, text) => {
    render(<FileFacts kind="audio" durationSeconds={seconds} data-testid="facts" />);
    expect(rows()[1]?.[1]).toBe(text);
  });

  it("a long value without break points wraps instead of widening the list", () => {
    render(<FileFacts kind="other" mime={"application/" + "x".repeat(200)} data-testid="facts" />);
    for (const value of within(screen.getByTestId("facts")).getAllByRole("definition")) {
      expect(value).toHaveClass("[overflow-wrap:anywhere]");
    }
  });

  it.each([
    [1023, "1,023 B"],
    [1024, "1.0 KB"],
    [1_048_575, "1.0 MB"],
    [1_048_576, "1.0 MB"],
    [1_073_741_823, "1.0 GB"],
    [1_073_741_824, "1.0 GB"],
  ])("%d bytes read %s: the unit follows the rounded value", (bytes, text) => {
    render(<FileFacts kind="other" bytes={bytes} data-testid="facts" />);
    expect(rows()[1]?.[1]).toBe(text);
  });

  it("frame rate keeps at most two decimals", () => {
    render(<FileFacts kind="video" frameRate={23.976} data-testid="facts" />);
    expect(rows()[3]?.[1]).toBe("23.98 fps");
  });

  it.each([
    ["de", "Format", "Auflösung", "Dauer", "Bildrate", "Dateigröße"],
    ["es", "Formato", "Resolución", "Duración", "Velocidad de fotogramas", "Tamaño del archivo"],
  ])("labels in %s", async (lng, ...labels) => {
    await i18n.changeLanguage(lng);
    render(<FileFacts kind="video" data-testid="facts" />);
    expect(rows().map(([label]) => label)).toEqual(labels);
  });
});
