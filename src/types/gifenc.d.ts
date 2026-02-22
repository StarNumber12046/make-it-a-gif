declare module "gifenc" {
  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: { palette?: number[] },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    stream: {
      writeByte(byte: number): void;
      writeBytes(bytes: Uint8Array): void;
    };
  }

  export function GIFEncoder(width: number, height: number): GIFEncoderInstance;

  export interface QuantizeOptions {
    format?: "rgb444" | "rgba4444" | "rgb565";
    oneBitAlpha?: boolean;
  }

  export function quantize(
    data: Uint8Array,
    maxColors?: number,
    options?: QuantizeOptions,
  ): number[];

  export interface ApplyPaletteOptions {
    format?: "rgb444" | "rgba4444" | "rgb565";
  }

  export function applyPalette(
    data: Uint8Array,
    palette: number[],
    options?: ApplyPaletteOptions,
  ): Uint8Array;
}
