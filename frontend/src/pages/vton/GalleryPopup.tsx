import React from 'react';

interface GalleryPopupProps {
    selectedGalleryItem: any;
    setSelectedGalleryItem: (item: any) => void;
}

const GalleryPopup = ({ selectedGalleryItem, setSelectedGalleryItem }: GalleryPopupProps) => {
    if (!selectedGalleryItem) return null;

    return (
        <div 
            style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'}}
            onClick={() => setSelectedGalleryItem(null)}
        >
            <div style={{position: 'relative', maxWidth: '90vw', maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <button 
                    className="btn btn-close btn-close-white position-absolute" 
                    style={{top: -40, right: -10, fontSize: '20px'}}
                    onClick={() => setSelectedGalleryItem(null)}
                ></button>
                {selectedGalleryItem.type === 'video' ? (
                    <video src={selectedGalleryItem.url} style={{maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px'}} loop autoPlay playsInline controls />
                ) : (
                    <img src={selectedGalleryItem.url} style={{maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px'}} />
                )}
            </div>
        </div>
    );
};

export default GalleryPopup;
