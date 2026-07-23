/**
 * Crops transparent margins around a background-removed PNG image,
 * and optionally resizes the image height to be proportional to clothing length in cm (총장).
 * Default scale: 8 pixels per 1 cm (e.g., 60cm total length -> 480px image height).
 */
export async function cropTransparentMargins(imageSrc: string, targetLengthCm?: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageSrc;
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                resolve(imageSrc);
                return;
            }
            
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;
            
            let minX = img.width;
            let minY = img.height;
            let maxX = -1;
            let maxY = -1;
            
            // Scan pixels to find bounding box of non-transparent content
            for (let y = 0; y < img.height; y++) {
                for (let x = 0; x < img.width; x++) {
                    const alpha = data[(y * img.width + x) * 4 + 3];
                    if (alpha > 15) { // Non-transparent pixel
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            
            // If image is completely transparent or empty, return original
            if (maxX < minX || maxY < minY) {
                resolve(imageSrc);
                return;
            }
            
            // Add slight padding (2px)
            const padding = 2;
            const cropX = Math.max(0, minX - padding);
            const cropY = Math.max(0, minY - padding);
            const cropW = Math.min(img.width - cropX, (maxX - minX + 1) + padding * 2);
            const cropH = Math.min(img.height - cropY, (maxY - minY + 1) + padding * 2);
            
            // Determine target dimensions
            let finalW = cropW;
            let finalH = cropH;
            
            // If length in cm is provided, scale height proportionally (8px per 1cm)
            if (targetLengthCm && targetLengthCm > 0) {
                const SCALE_PX_PER_CM = 8;
                finalH = Math.round(targetLengthCm * SCALE_PX_PER_CM);
                const aspectRatio = cropW / cropH;
                finalW = Math.round(finalH * aspectRatio);
            }
            
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = finalW;
            croppedCanvas.height = finalH;
            const croppedCtx = croppedCanvas.getContext('2d');
            
            if (!croppedCtx) {
                resolve(imageSrc);
                return;
            }
            
            // Draw cropped & scaled clothing image
            croppedCtx.drawImage(
                img,
                cropX, cropY, cropW, cropH,
                0, 0, finalW, finalH
            );
            
            resolve(croppedCanvas.toDataURL('image/png'));
        };
        
        img.onerror = (err) => {
            console.error('Image crop failed:', err);
            resolve(imageSrc); // Fallback to original
        };
    });
}
