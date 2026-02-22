# Make It a GIF

A Raycast extension that converts clipboard images to GIF format.

## Commands

### Convert to GIF

Converts any image from your clipboard to GIF format and copies it back to the clipboard.

**Supported formats:**

- PNG
- JPEG (automatically converted)
- Screenshots (via system clipboard)
- Image files (when copied from Finder/Explorer)

### Speech Bubble GIF

Adds a speech bubble overlay on top of the clipboard image and converts it to GIF.

The speech bubble is:

- Always stretched/shrunk to match the image width
- Positioned at the top of the image
- Height constrained to a configurable maximum percentage of the image height

## Configuration

### Max Bubble Height

Sets the maximum height of the speech bubble as a percentage of the image height. Default is 10%.

Configure in Raycast: Extensions → Make It a GIF → Configure

## Requirements

### macOS

For best screenshot support, install `pngpaste`:

```bash
brew install pngpaste
```

### Windows

No additional requirements. Uses PowerShell with .NET for clipboard operations.

## How It Works

1. Reads image from clipboard (file or raw bitmap)
2. Converts to PNG if needed
3. Applies speech bubble overlay (for Speech Bubble GIF command)
4. Encodes to GIF format using gifenc
5. Copies the GIF file back to clipboard

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm run dev

# Build
pnpm run build

# Lint
pnpm run lint
```

## License

MIT
