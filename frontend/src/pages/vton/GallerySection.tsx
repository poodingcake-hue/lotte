import React from 'react';

interface GallerySectionProps {
    allGallery: any[];
    setSelectedGalleryItem: (item: any) => void;
    deleteGalleryFromBackend: (id: any) => Promise<void>;
}

const GallerySection = ({ allGallery, setSelectedGalleryItem, deleteGalleryFromBackend }: GallerySectionProps) => {
    return (
        <>
            <hr className="my-4 border-2" />
            <div style={{marginTop: '100px'}}></div>
            <h4 className="fw-bold mb-4 border-bottom pb-2" style={{color: 'var(--primary)'}}>📸 갤러리</h4>
            <div className="row g-2 mb-4">
                {allGallery && allGallery.map((g: any) => (
                    <div key={g.id} className="col-4 col-md-3 col-lg-2">
                        <div 
                            className="border rounded overflow-hidden shadow-sm gallery-item-container" 
                            style={{aspectRatio: '1', position: 'relative', background: '#f8f9fa', cursor: 'pointer'}}
                            onClick={() => setSelectedGalleryItem(g)}
                        >
                            {g.type === 'video' ? (
                                <video src={g.url} style={{width: '100%', height: '100%', objectFit: 'cover'}} loop muted autoPlay playsInline />
                            ) : (
                                <img src={g.url} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                            )}
                            <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', padding: '3px 6px', textAlign: 'center', fontWeight: 'bold'}}>
                                {g.type === 'vton' ? '가상착장' : g.type === 'sheet' ? '캐릭터시트' : '🎬 화보영상'}
                            </div>
                            <button 
                                className="btn btn-sm btn-danger delete-btn position-absolute" 
                                style={{top: 5, right: 5, padding: '2px 6px', fontSize: '10px', opacity: 0, transition: 'opacity 0.2s', borderRadius: '50%'}}
                                onClick={(e) => { e.stopPropagation(); if(window.confirm('정말 삭제하시겠습니까?')) deleteGalleryFromBackend(g.id); }}
                            >
                                ❌
                            </button>
                        </div>
                    </div>
                ))}
                {allGallery.length === 0 && <div className="text-muted small w-100 p-3 bg-light rounded text-center">저장된 갤러리 항목이 없습니다. 결과 창에서 [저장] 버튼을 눌러보세요.</div>}
            </div>
            <style>{`
                .gallery-item-container:hover .delete-btn { opacity: 1 !important; }
            `}</style>
        </>
    );
};

export default GallerySection;
