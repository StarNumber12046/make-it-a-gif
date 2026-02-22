import {
  showToast,
  Toast,
  environment,
  getPreferenceValues,
} from "@raycast/api";
import {
  getClipboardImage,
  convertToGif,
  copyGifToClipboard,
  isPng,
  isJpeg,
  convertImageToPng,
  getRgbaFromPng,
  overlayPng,
  pngToBuffer,
  resizePng,
} from "./lib";
import { PNG } from "pngjs";
import { readFileSync } from "fs";
import { join } from "path";

interface Preferences {
  maxBubbleHeightPercent: string;
}

function getSpeechBubble(): PNG | null {
  try {
    const assetsPath = join(environment.assetsPath, "speech.png");
    const speechBuffer = readFileSync(assetsPath);
    const { png } = getRgbaFromPng(speechBuffer);
    return png;
  } catch (error) {
    console.log("[speech-bubble-gif] Failed to load speech bubble:", error);
    return null;
  }
}

export default async function Command() {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Adding speech bubble and converting to GIF...",
  });

  try {
    const preferences = getPreferenceValues<Preferences>();
    const maxPercent = parseInt(preferences.maxBubbleHeightPercent, 10) || 10;

    let speechBubble = getSpeechBubble();
    if (!speechBubble) {
      toast.style = Toast.Style.Failure;
      toast.title = "Speech bubble not found";
      toast.message = "Could not load assets/speech.png";
      return;
    }

    let imageBuffer = await getClipboardImage();

    if (!imageBuffer || imageBuffer.length === 0) {
      toast.style = Toast.Style.Failure;
      toast.title = "No image found in clipboard";
      toast.message = "Copy an image first, then run this command";
      return;
    }

    if (!isPng(imageBuffer)) {
      if (isJpeg(imageBuffer)) {
        imageBuffer = await convertImageToPng(imageBuffer);
      }
    }

    let basePng;
    try {
      basePng = getRgbaFromPng(imageBuffer).png;
    } catch {
      imageBuffer = await convertImageToPng(imageBuffer);
      basePng = getRgbaFromPng(imageBuffer).png;
    }

    const maxBubbleHeight = Math.floor((basePng.height * maxPercent) / 100);

    if (speechBubble.width !== basePng.width) {
      speechBubble = resizePng(
        speechBubble,
        basePng.width,
        speechBubble.height,
      );
    }

    if (speechBubble.height > maxBubbleHeight) {
      speechBubble = resizePng(
        speechBubble,
        speechBubble.width,
        maxBubbleHeight,
      );
    }

    const x = Math.floor((basePng.width - speechBubble.width) / 2);
    const y = 0;

    overlayPng(basePng, speechBubble, x, y);

    const compositedBuffer = pngToBuffer(basePng);

    const gifBuffer = convertToGif(compositedBuffer);
    await copyGifToClipboard(gifBuffer);

    toast.style = Toast.Style.Success;
    toast.title = "Speech bubble GIF created";
    toast.message = "The GIF has been copied to your clipboard";
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to create speech bubble GIF";
    toast.message =
      error instanceof Error ? error.message : "Unknown error occurred";
  }
}
