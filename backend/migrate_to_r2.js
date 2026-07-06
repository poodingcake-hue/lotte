const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const API_URL = 'https://lotte-backend.poodingcake.workers.dev';
const DATA_FILE = path.join(__dirname, '..', 'frontend', 'public', 'data.json');

async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function extractDriveId(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function runMigration() {
  console.log('Loading local data.json...');
  
  if (!fs.existsSync(DATA_FILE)) {
    console.error('data.json not found at:', DATA_FILE);
    return;
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(rawData);
  const items = data.items || [];
  
  let count = 0;
  let successCount = 0;

  for (let i = 0; i < items.length; i++) {
    const product = items[i];
    let originalUrl = product.image;
    
    // Ignore already migrated images or empty ones
    if (!originalUrl || originalUrl.includes('lotte-backend')) {
      continue;
    }

    let driveId = extractDriveId(originalUrl);
    let downloadUrl = originalUrl;
    
    // If it's a drive URL, use the export link for full resolution
    if (driveId) {
      downloadUrl = `https://drive.google.com/uc?export=view&id=${driveId}`;
    } else if (originalUrl.includes('lh3.googleusercontent.com')) {
      // In case it's an lh3 link without /d/ (though extractDriveId handles /d/ now)
      downloadUrl = originalUrl;
    }

    console.log(`[${product.code}] Downloading image...`);
    
    try {
      // 1. Download image
      const imgRes = await fetch(downloadUrl);
      if (!imgRes.ok) {
        console.error(`  -> Failed to download: ${imgRes.statusText}`);
        continue;
      }
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 2. Convert to WebP using sharp
      const webpBuffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();

      // 3. Upload to R2
      const formData = new FormData();
      const blob = new Blob([webpBuffer], { type: 'image/webp' });
      formData.append('file', blob, `${product.code}.webp`);

      const uploadRes = await fetch(API_URL, {
        method: 'POST',
        body: formData
      });
      
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
         console.error(`  -> Failed to upload to R2:`, uploadData.message);
         continue;
      }
      
      const newUrl = uploadData.imageUrl;
      
      // 4. Update memory object
      items[i].image = newUrl;
      console.log(`  -> Successfully migrated to ${newUrl}`);
      successCount++;
      count++;
      
      // We will save to disk every 10 images just in case
      if (successCount % 10 === 0) {
         fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
         console.log('  -> Saved checkpoint to data.json');
      }

      await delay(300); // 0.3s delay to prevent rate limits
      
    } catch (err) {
      console.error(`  -> Error processing ${product.code}: ${err.message}`);
    }
  }
  
  // Final save
  if (successCount > 0) {
     fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
     console.log('Final data.json updated successfully.');
  }

  console.log(`\nMigration Complete! Processed: ${count}, Success: ${successCount}`);
}

runMigration();
