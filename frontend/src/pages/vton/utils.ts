export const getProductImage = (item) => {
    if (!item || !item.image) return '';
    try {
        const imgObj = JSON.parse(item.image);
        if (imgObj.main) {
            const id = imgObj.main.match(/id=([a-zA-Z0-9_-]+)/);
            return id ? `https://lh3.googleusercontent.com/d/${id[1]}` : imgObj.main;
        }
        return '';
    } catch (e) {
        const id = item.image.match(/id=([a-zA-Z0-9_-]+)/);
        return id ? `https://lh3.googleusercontent.com/d/${id[1]}` : item.image;
    }
};
