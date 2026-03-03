
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

/**
 * processImage - Handles normalization and templating using Sharp.
 * 
 * - Resizes to 1118x1630 (fit: contain)
 * - Adds white background
 * - Composites optional overlays
 * - Strips metadata
 */
export async function processImage({
  buffer,
  addBorder,
  addIcon,
}: {
  buffer: Buffer;
  addBorder: boolean;
  addIcon: boolean;
}) {
  // 1. Initial setup: Stripping metadata and setting base dimensions with contain fit
  let pipeline = sharp(buffer)
    .withMetadata(false)
    .resize(1118, 1630, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255 },
    });

  const composites = [];

  // 2. Add optional border overlay if asset exists
  if (addBorder) {
    const borderPath = path.join(process.cwd(), 'public', 'overlays', 'border.png');
    if (fs.existsSync(borderPath)) {
      composites.push({ input: borderPath, gravity: 'center' });
    }
  }

  // 3. Add optional icon/emoji overlay if asset exists
  if (addIcon) {
    const iconPath = path.join(process.cwd(), 'public', 'overlays', 'emoji1.png');
    if (fs.existsSync(iconPath)) {
      composites.push({ input: iconPath, gravity: 'south' }); // Default icon position
    }
  }

  // Apply compositing if any layers were added
  if (composites.length > 0) {
    pipeline = pipeline.composite(composites);
  }

  // 4. Export as high-quality JPEG with mozjpeg optimization
  return await pipeline
    .jpeg({
      quality: 88,
      mozjpeg: true,
    })
    .toBuffer();
}
