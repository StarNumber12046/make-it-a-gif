import { showToast, Toast, Clipboard } from "@raycast/api";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { PNG } from "pngjs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "fs";

const isWindows = process.platform === "win32";

console.log(
  "[convert-to-gif] Starting extension, platform:",
  isWindows ? "Windows" : "macOS",
);

function getRgbaFromPng(pngBuffer: Buffer): {
  data: Uint8Array;
  width: number;
  height: number;
} {
  const png = PNG.sync.read(pngBuffer);
  return {
    data: new Uint8Array(png.data),
    width: png.width,
    height: png.height,
  };
}

async function getImageFromClipboard(): Promise<Buffer | null> {
  const tempPath = join(tmpdir(), `clipboard-image-${Date.now()}.png`);
  console.log("[getImageFromClipboard] Temp path:", tempPath);

  if (isWindows) {
    console.log("[getImageFromClipboard] Using Windows PowerShell method");
    try {
      const psScript = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $clipboard = [System.Windows.Forms.Clipboard]::GetDataObject(); if ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::Bitmap)) { $image = [System.Windows.Forms.Clipboard]::GetImage(); if ($image -ne $null) { $image.Save("${tempPath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png); Write-Output "success" } } elseif ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) { $files = [System.Windows.Forms.Clipboard]::GetFileDropList(); if ($files.Count -gt 0) { $file = $files[0]; if (Test-Path $file) { Write-Output $file } } }`;
      console.log("[getImageFromClipboard] Running PowerShell script...");
      const result = execSync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
        { encoding: "utf-8" },
      ).trim();
      console.log("[getImageFromClipboard] PowerShell result:", result);

      if (result === "success" && existsSync(tempPath)) {
        const buffer = readFileSync(tempPath);
        console.log(
          "[getImageFromClipboard] Got image from bitmap, size:",
          buffer.length,
          "bytes",
        );
        unlinkSync(tempPath);
        return buffer;
      } else if (result && existsSync(result.trim())) {
        console.log(
          "[getImageFromClipboard] Got image from file path:",
          result.trim(),
        );
        return readFileSync(result.trim());
      }
    } catch (error) {
      console.log("[getImageFromClipboard] PowerShell error:", error);
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }
  } else {
    console.log("[getImageFromClipboard] Using macOS method");
    try {
      console.log("[getImageFromClipboard] Trying pngpaste...");
      execSync(`pngpaste "${tempPath}"`, { encoding: "utf-8" });
      if (existsSync(tempPath)) {
        const buffer = readFileSync(tempPath);
        console.log(
          "[getImageFromClipboard] pngpaste success, size:",
          buffer.length,
          "bytes",
        );
        unlinkSync(tempPath);
        return buffer;
      }
    } catch (error) {
      console.log("[getImageFromClipboard] pngpaste failed:", error);
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }

    try {
      console.log("[getImageFromClipboard] Trying osascript PNGf method...");
      execSync(
        `osascript -e 'the clipboard as «class PNGf»' | xxd -r -p > "${tempPath}"`,
        { encoding: "utf-8" },
      );
      if (existsSync(tempPath)) {
        const buffer = readFileSync(tempPath);
        console.log(
          "[getImageFromClipboard] osascript PNGf success, size:",
          buffer.length,
          "bytes",
        );
        unlinkSync(tempPath);
        return buffer;
      }
    } catch (error) {
      console.log("[getImageFromClipboard] osascript PNGf failed:", error);
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }
  }

  console.log("[getImageFromClipboard] No image found in clipboard");
  return null;
}

function convertToGif(imageBuffer: Buffer): Buffer {
  console.log(
    "[convertToGif] Converting image, input size:",
    imageBuffer.length,
    "bytes",
  );

  const rgba = getRgbaFromPng(imageBuffer);
  console.log("[convertToGif] Image dimensions:", rgba.width, "x", rgba.height);

  const palette = quantize(rgba.data, 256, { format: "rgba4444" });
  console.log("[convertToGif] Quantized palette");

  const index = applyPalette(rgba.data, palette);
  console.log("[convertToGif] Applied palette");

  const gif = GIFEncoder(rgba.width, rgba.height);
  gif.writeFrame(index, rgba.width, rgba.height, { palette });
  gif.finish();
  console.log("[convertToGif] GIF encoded");

  return Buffer.from(gif.bytes());
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function isJpeg(buffer: Buffer): boolean {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

async function convertImageToPng(buffer: Buffer): Promise<Buffer> {
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

export default async function Command() {
  console.log("[Command] Starting conversion");
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Converting image to GIF...",
  });

  try {
    const clipboardRead = await Clipboard.read();
    console.log(
      "[Command] Clipboard.read result - file:",
      clipboardRead.file,
      "text:",
      clipboardRead.text ? "present" : "empty",
    );

    let imageBuffer: Buffer | null = null;

    if (clipboardRead.file) {
      console.log("[Command] Reading from file:", clipboardRead.file);
      imageBuffer = readFileSync(clipboardRead.file);
      console.log("[Command] File read, size:", imageBuffer.length, "bytes");
    } else {
      console.log(
        "[Command] No file in clipboard, trying system clipboard methods",
      );
      imageBuffer = await getImageFromClipboard();
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      console.log("[Command] No image found");
      toast.style = Toast.Style.Failure;
      toast.title = "No image found in clipboard";
      toast.message = "Copy an image first, then run this command";
      return;
    }

    if (!isPng(imageBuffer)) {
      console.log("[Command] Image is not PNG, converting...");
      if (isJpeg(imageBuffer)) {
        console.log("[Command] Detected JPEG, converting to PNG");
        imageBuffer = await convertImageToPng(imageBuffer);
      } else {
        console.log("[Command] Unknown format, attempting PNG parse anyway");
      }
    }

    console.log("[Command] Converting to GIF...");
    const gifBuffer = convertToGif(imageBuffer);
    console.log("[Command] GIF buffer size:", gifBuffer.length, "bytes");

    const tempPath = join(tmpdir(), `converted-${Date.now()}.gif`);
    writeFileSync(tempPath, gifBuffer);
    console.log("[Command] Wrote GIF to:", tempPath);

    console.log("[Command] Copying to clipboard via Raycast...");
    await Clipboard.copy({ file: tempPath });
    console.log("[Command] Copy complete");

    toast.style = Toast.Style.Success;
    toast.title = "Image converted to GIF";
    toast.message = "The GIF has been copied to your clipboard";
  } catch (error) {
    console.log("[Command] Error:", error);
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to convert image";
    toast.message =
      error instanceof Error ? error.message : "Unknown error occurred";
  }
}
