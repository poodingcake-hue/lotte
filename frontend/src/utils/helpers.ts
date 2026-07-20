export const getProductImage = (item: any) => {
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

  // Legacy Google Drive URLs are completely removed from the dataset,
  // so no filtering logic is needed here.

  // Fallback to Lotte image server if no explicit image but valid code exists
  if (!resultUrl && item.code && String(item.code).length >= 8) {
    const code = String(item.code);
    const p1 = code.substring(6, 8);
    const p2 = code.substring(4, 6);
    const p3 = code.substring(2, 4);
    resultUrl = `https://image2.lotteimall.com/goods/${p1}/${p2}/${p3}/${code}_L.jpg`;
  }

  return resultUrl;
};
