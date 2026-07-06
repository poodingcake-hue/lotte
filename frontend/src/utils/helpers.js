export const getProductImage = (item) => {
  if (!item) return '';
  let resultUrl = '';

  if (item.image && typeof item.image === 'string' && item.image.trim() !== '') {
    try {
      const imgObj = JSON.parse(item.image);
      if (imgObj && imgObj.main) {
        resultUrl = imgObj.main;
      }
    } catch (e) {
      resultUrl = item.image;
    }
  }

  // Google Drive security bypass (uc -> thumbnail)
  if (resultUrl && resultUrl.includes('drive.google.com')) {
    const idMatch = resultUrl.match(/id=([^&]+)/) || resultUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      // Use uc?export=view to get original quality if possible, otherwise fallback to thumbnail
      resultUrl = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
    }
  }

  // Fallback to Lotte image server if no explicit image but valid code exists
  if (!resultUrl && item.code && String(item.code).length >= 8) {
    const code = String(item.code);
    const p1 = code.substring(0, 2);
    const p2 = code.substring(4, 6);
    const p3 = code.substring(2, 4);
    resultUrl = `https://image2.lotteimall.com/goods/${p1}/${p2}/${p3}/${code}_L.jpg`;
  }

  return resultUrl;
};
