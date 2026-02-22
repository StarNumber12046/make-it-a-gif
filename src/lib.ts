import { Clipboard } from "@raycast/api";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { PNG } from "pngjs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "fs";

const isWindows = process.platform === "win32";

export function getRgbaFromPng(pngBuffer: Buffer): {
  data: Uint8Array;
  width: number;
  height: number;
  png: PNG;
} {
  const png = PNG.sync.read(pngBuffer);
  return {
    data: new Uint8Array(png.data),
    width: png.width,
    height: png.height,
    png,
  };
}

export async function getImageFromClipboard(): Promise<Buffer | null> {
  const tempPath = join(tmpdir(), `clipboard-image-${Date.now()}.png`);

  if (isWindows) {
    try {
      const psScript = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $clipboard = [System.Windows.Forms.Clipboard]::GetDataObject(); if ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::Bitmap)) { $image = [System.Windows.Forms.Clipboard]::GetImage(); if ($image -ne $null) { $image.Save("${tempPath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png); Write-Output "success" } } elseif ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) { $files = [System.Windows.Forms.Clipboard]::GetFileDropList(); if ($files.Count -gt 0) { $file = $files[0]; if (Test-Path $file) { Write-Output $file } } }`;
      const result = execSync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
        { encoding: "utf-8" },
      ).trim();

      if (result === "success" && existsSync(tempPath)) {
        const buffer = readFileSync(tempPath);
        unlinkSync(tempPath);
        return buffer;
      } else if (result && existsSync(result.trim())) {
        return readFileSync(result.trim());
      }
    } catch {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }
  } else {
    try {
      execSync(`pngpaste "${tempPath}"`, { encoding: "utf-8" });
      if (existsSync(tempPath)) {
        const buffer = readFileSync(tempPath);
        unlinkSync(tempPath);
        return buffer;
      }
    } catch {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }

    try {
      execSync(
        `osascript -e 'the clipboard as «class PNGf»' | xxd -r -p > "${tempPath}"`,
        { encoding: "utf-8" },
      );
      if (existsSync(tempPath)) {
        const buffer = readFileSync(tempPath);
        unlinkSync(tempPath);
        return buffer;
      }
    } catch {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }
  }

  return null;
}

export function convertToGif(imageBuffer: Buffer): Buffer {
  const rgba = getRgbaFromPng(imageBuffer);

  const palette = quantize(rgba.data, 256, { format: "rgba4444" });
  const index = applyPalette(rgba.data, palette);

  const gif = GIFEncoder(rgba.width, rgba.height);
  gif.writeFrame(index, rgba.width, rgba.height, { palette });
  gif.finish();

  return Buffer.from(gif.bytes());
}

export function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

export function isJpeg(buffer: Buffer): boolean {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

export async function convertImageToPng(buffer: Buffer): Promise<Buffer> {
  if (isPng(buffer)) return buffer;

  const tempIn = join(tmpdir(), `input-${Date.now()}.jpg`);
  const tempOut = join(tmpdir(), `output-${Date.now()}.png`);

  writeFileSync(tempIn, buffer);

  if (isWindows) {
    try {
      const psScript = `Add-Type -AssemblyName System.Drawing; $img = [System.Drawing.Image]::FromFile("${tempIn.replace(/\\/g, "\\\\")}"); $img.Save("${tempOut.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png); $img.Dispose()`;
      execSync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
        { encoding: "utf-8" },
      );
      const result = readFileSync(tempOut);
      unlinkSync(tempIn);
      unlinkSync(tempOut);
      return result;
    } catch {
      if (existsSync(tempIn)) unlinkSync(tempIn);
      if (existsSync(tempOut)) unlinkSync(tempOut);
      throw new Error("Failed to convert JPEG to PNG");
    }
  } else {
    try {
      execSync(`sips -s format png "${tempIn}" --out "${tempOut}"`, {
        encoding: "utf-8",
      });
      const result = readFileSync(tempOut);
      unlinkSync(tempIn);
      unlinkSync(tempOut);
      return result;
    } catch {
      if (existsSync(tempIn)) unlinkSync(tempIn);
      if (existsSync(tempOut)) unlinkSync(tempOut);
      throw new Error(
        "Failed to convert image to PNG. sips may not be available.",
      );
    }
  }
}

export async function getClipboardImage(): Promise<Buffer | null> {
  const clipboardRead = await Clipboard.read();

  if (clipboardRead.file) {
    return readFileSync(clipboardRead.file);
  } else {
    return await getImageFromClipboard();
  }
}

export async function copyGifToClipboard(gifBuffer: Buffer): Promise<string> {
  const tempPath = join(tmpdir(), `converted-${Date.now()}.gif`);
  writeFileSync(tempPath, gifBuffer);
  await Clipboard.copy({ file: tempPath });
  return tempPath;
}

export function overlayPng(
  basePng: PNG,
  overlayPng: PNG,
  x: number,
  y: number,
): void {
  for (let oy = 0; oy < overlayPng.height; oy++) {
    for (let ox = 0; ox < overlayPng.width; ox++) {
      const bx = x + ox;
      const by = y + oy;

      if (bx < 0 || bx >= basePng.width || by < 0 || by >= basePng.height) {
        continue;
      }

      const overlayIdx = (overlayPng.width * oy + ox) << 2;
      const baseIdx = (basePng.width * by + bx) << 2;

      const overlayR = overlayPng.data[overlayIdx];
      const overlayG = overlayPng.data[overlayIdx + 1];
      const overlayB = overlayPng.data[overlayIdx + 2];
      const overlayA = overlayPng.data[overlayIdx + 3] / 255;

      const baseR = basePng.data[baseIdx];
      const baseG = basePng.data[baseIdx + 1];
      const baseB = basePng.data[baseIdx + 2];
      const baseA = basePng.data[baseIdx + 3] / 255;

      const outA = overlayA + baseA * (1 - overlayA);
      const outR =
        (overlayR * overlayA + baseR * baseA * (1 - overlayA)) / outA;
      const outG =
        (overlayG * overlayA + baseG * baseA * (1 - overlayA)) / outA;
      const outB =
        (overlayB * overlayA + baseB * baseA * (1 - overlayA)) / outA;

      basePng.data[baseIdx] = Math.round(outR);
      basePng.data[baseIdx + 1] = Math.round(outG);
      basePng.data[baseIdx + 2] = Math.round(outB);
      basePng.data[baseIdx + 3] = Math.round(outA * 255);
    }
  }
}

export function pngToBuffer(png: PNG): Buffer {
  return PNG.sync.write(png);
}

export function resizePng(
  source: PNG,
  newWidth: number,
  newHeight: number,
): PNG {
  const dest = new PNG({ width: newWidth, height: newHeight });

  for (let dy = 0; dy < newHeight; dy++) {
    for (let dx = 0; dx < newWidth; dx++) {
      const sx = Math.floor((dx / newWidth) * source.width);
      const sy = Math.floor((dy / newHeight) * source.height);

      const srcIdx = (source.width * sy + sx) << 2;
      const destIdx = (newWidth * dy + dx) << 2;

      dest.data[destIdx] = source.data[srcIdx];
      dest.data[destIdx + 1] = source.data[srcIdx + 1];
      dest.data[destIdx + 2] = source.data[srcIdx + 2];
      dest.data[destIdx + 3] = source.data[srcIdx + 3];
    }
  }

  return dest;
}
