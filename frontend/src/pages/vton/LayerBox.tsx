import React from 'react';
import { getProductImage } from './utils';

const LayerBox = ({
    layerName,
    layerTitle,
    state,
    setState,
    targetCodes,
    allItems,
    handleQuickSelect,
    openModal,
    changeColor
}) => {
    let matchedItems = [];
    if (targetCodes.length > 0) {
        matchedItems = allItems.filter(i => i.isMaster && targetCodes.includes(i.code));
        if (layerName === 'top') matchedItems = matchedItems.filter(i => i.category === '상의');
        else if (layerName === 'bottom') matchedItems = matchedItems.filter(i => i.category === '하의' || i.category === '팬츠');
        else if (layerName === 'outer') matchedItems = matchedItems.filter(i => i.category === '아우터');
    }

    let sizeImageUrl = '';
    if (state.item && state.item.image) {
        try {
            const imgObj = JSON.parse(state.item.image);
            if (imgObj.size) {
                sizeImageUrl = imgObj.size;
            }
        } catch(e) {}
    }

    return (
        <div className="p-2 border rounded h-100 bg-white d-flex flex-column align-items-center shadow-sm">
            <h5 className="fw-bold mb-2 text-dark text-center" style={{fontSize:'15px'}}>{layerTitle}</h5>
            {matchedItems.length > 0 && (
                <div className="w-100 mb-2">
                    <select className="form-select form-select-sm w-100 text-primary border-primary fw-bold" style={{fontSize:'11px'}} onChange={(e) => {
                        const selected = matchedItems.find(i => i.code === e.target.value);
                        if (selected) handleQuickSelect(layerName, selected);
                        e.target.value = "";
                    }}>
                        <option value="">{layerTitle} 선택</option>
                        {matchedItems.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                    </select>
                </div>
            )}
            
            <div className="vton-tooltip-container w-100 flex-grow-1 d-flex flex-column">
                <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100 mb-2 position-relative" style={{minHeight: '180px', background: '#f8f9fa', borderRadius: '8px', border: '2px dashed #e0e0e0', overflow:'hidden'}}>
                    {state.url ? (
                        <>
                            <img src={state.url} alt={layerTitle} style={{maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', padding: '5px'}} />
                            {state.item && (
                                <>
                                    <button className="btn btn-sm btn-dark position-absolute border border-white" style={{left: 5, top: '50%', transform:'translateY(-50%)', opacity:0.8, padding:'2px 6px', borderRadius:'50%'}} onClick={() => changeColor(layerName, -1)}>{"<"}</button>
                                    <button className="btn btn-sm btn-dark position-absolute border border-white" style={{right: 5, top: '50%', transform:'translateY(-50%)', opacity:0.8, padding:'2px 6px', borderRadius:'50%'}} onClick={() => changeColor(layerName, 1)}>{">"}</button>
                                    <div className="position-absolute bottom-0 w-100 text-center text-white bg-dark bg-opacity-75 small fw-bold" style={{fontSize:'11px', padding:'4px 0'}}>
                                        {state.colorCode || '기본 색상'} {state.sizeCode ? `| ${state.sizeCode}` : ''}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="text-muted fw-bold" style={{fontSize:'13px'}}>이미지 없음</div>
                    )}
                </div>
                {state.item && (
                    <div className={layerName === 'outer' ? 'vton-tooltip-content-left' : 'vton-tooltip-content-right'}>
                        <div className="fw-bold mb-1" style={{fontSize: '12px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{state.item.name}</div>
                        <div className="small mb-1 text-light bg-dark bg-opacity-50 p-1 rounded" style={{fontSize: '10.5px'}}>전체 사이즈: {state.item.sizes || '없음'}</div>
                        {sizeImageUrl ? (
                            <>
                                <div className="small text-warning fw-bold" style={{fontSize: '10.5px', marginTop: '6px'}}>📏 상세 사이즈 스펙표</div>
                                <img src={sizeImageUrl} alt="상세사이즈 표" className="vton-tooltip-image" />
                            </>
                        ) : (
                            <div className="small text-muted" style={{fontSize: '10px', marginTop: '6px'}}>등록된 상세 사이즈 표 없음</div>
                        )}
                    </div>
                )}
            </div>

            {state.item && state.item.sizes && (
                <div className="w-100 mb-2">
                    <select 
                        className="form-select form-select-sm text-center fw-bold text-secondary" 
                        style={{fontSize:'11.5px', padding:'4px 8px'}}
                        value={state.sizeCode || ''}
                        onChange={(e) => {
                            const newSize = e.target.value;
                            setState(prev => ({ ...prev, sizeCode: newSize }));
                        }}
                    >
                        {(Array.isArray(state.item.sizes) ? state.item.sizes : String(state.item.sizes).split(',')).map(s => {
                            const trimmed = String(s).trim();
                            return <option key={trimmed} value={trimmed}>{trimmed} 사이즈</option>;
                        })}
                    </select>
                </div>
            )}

            <div className="w-100 d-flex gap-1 mt-auto">
                <button className="btn btn-sm btn-outline-primary flex-grow-1 fw-bold py-1" style={{fontSize:'12px'}} onClick={() => openModal(layerName)}>
                    {state.url ? '검색/변경' : '전체 검색'}
                </button>
                {state.url && (
                    <button className="btn btn-sm btn-outline-danger fw-bold py-1 px-2" style={{fontSize:'12px'}} onClick={() => {
                        setState({ type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' });
                    }}>삭제</button>
                )}
            </div>
        </div>
    );
};

export default LayerBox;
