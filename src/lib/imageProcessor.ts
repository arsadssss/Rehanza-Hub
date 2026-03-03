
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const BORDER_COLORS = [
  "#8B5CF6", // Violet
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#3B82F6", // Blue
  "#EC4899", // Pink
  "#22D3EE", // Cyan
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#14B8A6"  // Teal
];

const ICON_POSITIONS = [
  { top: 80, left: 900 },
  { top: 100, left: 100 },
  { top: 1450, left: 900 },
  { top: 1400, left: 100 },
  { top: 200, left: 800 },
  { top: 300, left: 150 },
  { top: 1200, left: 850 },
  { top: 1100, left: 200 },
  { top: 500, left: 850 },
  { top: 700, left: 150 }
];

/**
 * generateVariants - Creates 10 branded variations of a product image.
 * 
 * Logic:
 * 1. Normalize base to 1118x1630 (fit: contain, background: white).
 * 2. For each variant:
 *    - Add 30px colored border.
 *    - Re-normalize to 1118x1630.
 *    - Optionally add icon at specific position.
 *    - Export as optimized JPEG.
 */
export async function generateVariants({
  buffer,
  addBorder,
  addIcon,
}: {
  buffer: Buffer;
  addBorder: boolean;
  addIcon: boolean;
}) {
  // 1. Initial Normalization
  const normalizedBase = await sharp(buffer)
    .withMetadata(false)
    .resize(1118, 1630, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255 },
    })
    .toBuffer();

  const variantPromises = BORDER_COLORS.map(async (color, index) => {
    let pipeline = sharp(normalizedBase);

    // 2. Add Border
    if (addBorder) {
      pipeline = pipeline
        .extend({
          top: 30,
          bottom: 30,
          left: 30,
          right: 30,
          background: color,
        })
        // Guarantee final dimensions 1118x1630
        .resize(1118, 1630);
    }

    // 3. Add Icon Overlay
    if (addIcon) {
      const iconPath = path.join(process.cwd(), 'public', 'overlays', 'emoji1.png');
      if (fs.existsSync(iconPath)) {
        pipeline = pipeline.composite([
          {
            input: iconPath,
            top: ICON_POSITIONS[index].top,
            left: ICON_POSITIONS[index].left,
          },
        ]);
      }
    }

    // 4. Export
    return await pipeline
      .jpeg({
        quality: 88,
        mozjpeg: true,
      })
      .toBuffer();
  });

  return Promise.all(variantPromises);
}
