/**
 * Image Utilities
 * Handles conversion of base64 images to Blob URLs for better performance
 */

/**
 * Convert a base64 data URL to a Blob URL
 * This is more efficient for displaying large images in the browser
 */
export function base64ToBlobUrl(base64DataUrl: string): string {
    // If it's not a base64 data URL, return as-is
    if (!base64DataUrl || !base64DataUrl.startsWith('data:')) {
        return base64DataUrl;
    }

    try {
        // Extract the base64 data and mime type
        const [header, base64Data] = base64DataUrl.split(',');
        if (!base64Data) {
            console.warn('Invalid base64 data URL format');
            return base64DataUrl;
        }

        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

        // Clean the base64 string - remove any whitespace or invalid characters
        const cleanBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');

        // Validate base64 string length
        if (cleanBase64.length === 0) {
            console.warn('Empty base64 data');
            return base64DataUrl;
        }

        // Validate base64 characters
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(cleanBase64)) {
            console.warn('Invalid base64 characters detected');
            return base64DataUrl;
        }

        // Pad with = if needed for atob to work
        let paddedBase64 = cleanBase64;
        while (paddedBase64.length % 4 !== 0) {
            paddedBase64 += '=';
        }

        // Convert base64 to binary
        const binaryString = atob(paddedBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Create Blob and URL
        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        console.log(`✅ Converted base64 (${cleanBase64.length} chars) to Blob URL`);
        return blobUrl;
    } catch (error) {
        console.error('Failed to convert base64 to Blob URL:', error);
        return base64DataUrl; // Return original on error
    }
}

/**
 * Check if a string is a base64 data URL
 */
export function isBase64DataUrl(str: string): boolean {
    return typeof str === 'string' && str.startsWith('data:') && str.includes('base64');
}

/**
 * Check if a string is a Blob URL
 */
export function isBlobUrl(str: string): boolean {
    return typeof str === 'string' && str.startsWith('blob:');
}

/**
 * Revoke a Blob URL to free memory
 * Call this when the image is no longer needed
 */
export function revokeBlobUrl(blobUrl: string): void {
    if (isBlobUrl(blobUrl)) {
        URL.revokeObjectURL(blobUrl);
        console.log('🗑️ Revoked Blob URL');
    }
}
