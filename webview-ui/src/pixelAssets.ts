import type { FurnitureKind } from './types';

export interface PixelSprite {
  id: string;
  width: number;
  height: number;
  pixels: string[];
}

export interface PixelSpritePalette {
  outline: string;
  primary: string;
  secondary: string;
  accent: string;
  light: string;
  dark: string;
  green: string;
  red: string;
}

export const FURNITURE_ASSET_MANIFEST: Record<FurnitureKind, PixelSprite> = {
  'review-table': {
    id: 'review-table',
    width: 16,
    height: 9,
    pixels: [
      '..oooooooooooo..',
      '.oppppppppppppo.',
      'oppppppaaaappppo',
      'oppppppaaaappppo',
      'oppppppppppppppo',
      '.oddddddddddddo.',
      '..oo..oooo..oo..',
      '...o..o..o..o...',
      '...o..o..o..o...',
    ],
  },
  'build-bench': {
    id: 'build-bench',
    width: 16,
    height: 10,
    pixels: [
      '..ooo......ooo..',
      '..osso....osso..',
      '..osso....osso..',
      'oooooooooooooooo',
      'oppppppppppppppo',
      'oddddddddddddddo',
      '..oo........oo..',
      '..oo........oo..',
      '..oo........oo..',
      '..oo........oo..',
    ],
  },
  'qa-station': {
    id: 'qa-station',
    width: 14,
    height: 12,
    pixels: [
      '..oooooooooo..',
      '.oggggggggggo.',
      'ogllllllllllgo',
      'ogllooolloolgo',
      'ogllllllllllgo',
      'ogllggggggllgo',
      'ogllllllllllgo',
      '.oggggggggggo.',
      '..oooo..oooo..',
      '....oo..oo....',
      '....oo..oo....',
      '....oo..oo....',
    ],
  },
  'release-board': {
    id: 'release-board',
    width: 12,
    height: 12,
    pixels: [
      'oooooooooooo',
      'ollllllllllo',
      'ollaaalllggo',
      'ollaaalllggo',
      'ollllllllllo',
      'ollrrrrrrllo',
      'ollllllllllo',
      'ollggggaallo',
      'ollggggaallo',
      'ollllllllllo',
      'oooooooooooo',
      '....oo......',
    ],
  },
  'docs-shelf': {
    id: 'docs-shelf',
    width: 12,
    height: 14,
    pixels: [
      'oooooooooooo',
      'oppppppppppo',
      'oprsagrsagpo',
      'oppppppppppo',
      'oooooooooooo',
      'opggrraasspo',
      'oppppppppppo',
      'oooooooooooo',
      'opssggaarrpo',
      'oppppppppppo',
      'oooooooooooo',
      'oppppppppppo',
      'oooooooooooo',
      'oo........oo',
    ],
  },
  plant: {
    id: 'plant',
    width: 10,
    height: 13,
    pixels: [
      '....gg....',
      '...gggg...',
      '..gggggg..',
      'gggggggggg',
      '..gggggg..',
      '.gggggggg.',
      '...gggg...',
      '....gg....',
      '...oooo...',
      '..oppppo..',
      '..oppppo..',
      '..oddddo..',
      '...oooo...',
    ],
  },
  'logo-wall': {
    id: 'logo-wall',
    width: 13,
    height: 13,
    pixels: [
      '....ooooo....',
      '..oooaaaooo..',
      '.ooaaoooaaoo.',
      '.oaaoo.ooaao.',
      'ooaoo...ooaoo',
      'oaoo.ooo.ooao',
      'oao.ooaoo.oao',
      'oao.oooao.oao',
      'ooaoo...ooaoo',
      '.oaaoo.ooaao.',
      '.ooaaoooaaoo.',
      '..oooaaaooo..',
      '....ooooo....',
    ],
  },
};

export function drawPixelSprite(
  ctx: CanvasRenderingContext2D,
  sprite: PixelSprite,
  x: number,
  y: number,
  size: number,
  palette: PixelSpritePalette,
) {
  const originX = Math.round(x - (sprite.width * size) / 2);
  const originY = Math.round(y - (sprite.height * size) / 2);
  for (let row = 0; row < sprite.pixels.length; row++) {
    const line = sprite.pixels[row];
    for (let col = 0; col < line.length; col++) {
      const color = colorForPixel(line[col], palette);
      if (!color) {
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(originX + col * size, originY + row * size, size, size);
    }
  }
}

function colorForPixel(pixel: string, palette: PixelSpritePalette): string | undefined {
  switch (pixel) {
    case 'o':
      return palette.outline;
    case 'p':
      return palette.primary;
    case 's':
      return palette.secondary;
    case 'a':
      return palette.accent;
    case 'l':
      return palette.light;
    case 'd':
      return palette.dark;
    case 'g':
      return palette.green;
    case 'r':
      return palette.red;
    default:
      return undefined;
  }
}
