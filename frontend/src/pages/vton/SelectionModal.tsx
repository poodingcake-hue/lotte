import React from 'react';

const SelectionModal = ({
    modalConfig,
    closeModal,
    modalTab,
    setModalTab,
    searchTerm,
    setSearchTerm,
    items,
    selectProductColor,
    promptText,
    setPromptText,
    handleGeneratePromptImage,
    isPromptGenerating
}) => {
    if (!modalConfig.isOpen) return null;

    const layerNames = { top: '상의', bottom: '하의', outer: '아우터' };

    return (
        <div className="modal-backdrop" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1050, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <div className="modal-content bg-white rounded shadow" style={{width: '90%', maxWidth: '850px', maxHeight: '85vh', display: 'flex', flexDirection: 'column'}}>
                <div className="modal-header p-3 border-bottom d-flex justify-content-between align-items-center">
                    <h5 className="m-0 fw-bold">{layerNames[modalConfig.layer]} 선택</h5>
                    <button className="btn-close" onClick={closeModal}></button>
                </div>
                <div className="modal-body p-3 overflow-auto" style={{flexGrow: 1}}>
                    <div className="d-flex gap-2 mb-3">
                        <button className={`btn flex-grow-1 ${modalTab === 'product' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setModalTab('product')}>내 상품</button>
                        <button className={`btn flex-grow-1 ${modalTab === 'prompt' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setModalTab('prompt')}>프롬프트</button>
                    </div>
                    {modalTab === 'product' && (
                        <div>
                            <input type="text" placeholder="브랜드 또는 상품명 검색" className="form-control mb-3" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            <div className="vton-modal-product-list" style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                {items.slice(0, 30).map((item, idx) => {
                                    let colors = [];
                                    let imgObj = null;
                                    try { imgObj = JSON.parse(item.image); colors = Object.keys(imgObj).filter(k => k !== 'main' && k !== 'size'); } catch(e) {}
                                    return (
                                        <div key={idx} className="p-3 border rounded d-flex align-items-center mb-2">
                                            <div style={{ width: '40%', paddingRight: '15px' }}>
                                                <div className="fw-bold" style={{fontSize: '14px', color: 'var(--primary)'}}>{item.brand}</div>
                                                <div style={{fontSize: '15px', fontWeight: 'bold', wordBreak: 'keep-all', margin: '4px 0'}}>{item.name}</div>
                                                <div className="text-muted" style={{fontSize: '12px'}}>{item.code}</div>
                                            </div>
                                            <div style={{ width: '60%', display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '5px', alignItems: 'center' }}>
                                                {colors.map((c, i) => {
                                                    let cUrl = imgObj[c];
                                                    const finalUrl = cUrl;
                                                    return (
                                                        <div key={i} onClick={() => selectProductColor(item, c)} style={{ cursor: 'pointer', textAlign: 'center', minWidth: '70px', transition: 'opacity 0.2s' }} onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'} onMouseOut={(e) => e.currentTarget.style.opacity = '1'}>
                                                            <div style={{ width: '70px', height: '90px', background: '#f8f9fa', borderRadius: '4px', overflow: 'hidden', border: '1px solid #eee' }}>
                                                                {finalUrl ? <img src={finalUrl} alt={c} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <div style={{fontSize:'10px', color:'#999', lineHeight:'90px'}}>No Img</div>}
                                                            </div>
                                                            <div style={{ fontSize: '11px', marginTop: '6px', color: '#555', fontWeight: 'bold' }}>{c}</div>
                                                        </div>
                                                    );
                                                })}
                                                {colors.length === 0 && <div className="text-muted small p-2">등록된 색상 이미지가 없습니다.</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                                {items.length === 0 && <div className="text-center text-muted p-4 border rounded">검색 결과가 없습니다.</div>}
                            </div>
                        </div>
                    )}
                    {modalTab === 'prompt' && (
                        <div>
                            <div className="mb-2 fw-bold text-secondary">원하는 옷의 스타일을 영문으로 입력하세요</div>
                            <textarea className="form-control mb-3" rows="4" placeholder="예: red leather jacket, white t-shirt" value={promptText} onChange={(e) => setPromptText(e.target.value)} />
                            <button className="btn btn-primary w-100 py-2 fw-bold" onClick={handleGeneratePromptImage} disabled={isPromptGenerating}>
                                {isPromptGenerating ? '이미지 생성 중...' : '이미지 생성 및 적용하기'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SelectionModal;
