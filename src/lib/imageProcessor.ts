
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

// Recalculated for 1200x1200px square canvas
const ICON_POSITIONS = [
  { top: 60, left: 1020 },
  { top: 60, left: 60 },
  { top: 1020, left: 1020 },
  { top: 1020, left: 60 },
  { top: 200, left: 900 },
  { top: 200, left: 200 },
  { top: 900, left: 900 },
  { top: 900, left: 200 },
  { top: 500, left: 1000 },
  { top: 500, left: 100 }
];

/**
 * generateVariants - Creates 10 branded variations of a product image.
 * 
 * Logic:
 * 1. Normalize base to 1200x1200px (Square 1:1, fit: contain, background: white).
 * 2. For each variant:
 *    - Add 33px colored border.
 *    - Re-normalize to 1200x1200px.
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
  // 1. Initial Normalization to Square
  const normalizedBase = await sharp(buffer)
    .withMetadata(false)
    .resize(1200, 1200, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255 },
    })
    .toBuffer();

  const variantPromises = BORDER_COLORS.map(async (color, index) => {
    let pipeline = sharp(normalizedBase);

    // 2. Add Border (Increased to 33px)
    if (addBorder) {
      pipeline = pipeline
        .extend({
          top: 33,
          bottom: 33,
          left: 33,
          right: 33,
          background: color,
        })
        // Guarantee final square dimensions
        .resize(1200, 1200);
    }

    // 3. Add Icon Overlay
    if (addIcon) {
      const iconPath = path.join(process.cwd(), 'public', 'overlays', 'emoji1.png');
      // We check if it exists, otherwise icons won't come in generated images
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
        quality: 90,
        mozjpeg: true,
      })
      .toBuffer();
  });

  return Promise.all(variantPromises);
}
