import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory storage for demo (replace with R2 in production)
// In production, you would use Cloudflare R2 or another storage service

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const customerName = formData.get('customerName') as string;
        const phone = formData.get('phone') as string;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Convert file to base64 for storage
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString('base64');

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = customerName.replace(/\s+/g, '_').substring(0, 20);
        const extension = file.name.split('.').pop() || 'png';
        const filename = `proof_${sanitizedName}_${timestamp}.${extension}`;

        // Log payment proof for admin review
        console.log('='.repeat(50));
        console.log('💰 NEW PAYMENT PROOF RECEIVED');
        console.log('='.repeat(50));
        console.log(`📅 Time: ${new Date().toISOString()}`);
        console.log(`👤 Customer: ${customerName}`);
        console.log(`📞 Phone: ${phone}`);
        console.log(`📁 Filename: ${filename}`);
        console.log(`📦 File Size: ${(buffer.length / 1024).toFixed(2)} KB`);
        console.log('='.repeat(50));

        // In production with Cloudflare R2:
        // 1. Create an R2 bucket in Cloudflare dashboard
        // 2. Bind it in wrangler.toml as [[r2_buckets]]
        // 3. Upload like this:
        //    await env.MY_BUCKET.put(filename, buffer);
        //    const url = `https://your-r2-public-url/${filename}`;

        // For now, we'll store the base64 data and return a data URL
        // This is temporary - in production use R2 or external storage
        const dataUrl = `data:${file.type};base64,${base64}`;

        // You can also send this to a webhook, email, or external API
        // Example: await sendToWebhook({ customerName, phone, filename, base64 });

        return NextResponse.json({
            success: true,
            url: dataUrl,
            filename: filename,
            message: 'Payment proof uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
};
