export const getProductImage = (item: any) => {
    if (!item || !item.image) return '';
    try {
        const imgObj = JSON.parse(item.image);
        if (imgObj.main) {
            return imgObj.main;
        }
        return '';
    } catch (e) {
        return item.image;
    }
};
