
import { NextResponse } from 'next/server';
import { generateVariants } from '@/lib/imageProcessor';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const addBorder = formData.get('addBorder') === 'true';
    const addIcon = formData.get('addIcon') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Supported: JPG, PNG, WEBP' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 15MB allowed.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process the image into 10 variants
    const variantBuffers = await generateVariants({
      buffer,
      addBorder,
      addIcon,
    });

    // Convert buffers to Base64 data URIs for the frontend
    const images = variantBuffers.map(buf => `data:image/jpeg;base64,${buf.toString('base64')}`);

    return NextResponse.json({
      success: true,
      images,
    });
  } catch (error: any) {
    console.error('Image Processing API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process variants', details: error.message },
      { status: 500 }
    );
  }
}
