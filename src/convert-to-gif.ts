import { showToast, Toast } from "@raycast/api";
import {
  getClipboardImage,
  convertToGif,
  copyGifToClipboard,
  isPng,
  isJpeg,
  convertImageToPng,
  getRgbaFromPng,
} from "./lib";

export default async function Command() {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Converting image to GIF...",
  });

  try {
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

    try {
      getRgbaFromPng(imageBuffer);
    } catch {
      imageBuffer = await convertImageToPng(imageBuffer);
    }

    const gifBuffer = convertToGif(imageBuffer);
    await copyGifToClipboard(gifBuffer);

    toast.style = Toast.Style.Success;
    toast.title = "Image converted to GIF";
    toast.message = "The GIF has been copied to your clipboard";
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to convert image";
    toast.message =
      error instanceof Error ? error.message : "Unknown error occurred";
  }
}
