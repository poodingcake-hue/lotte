import React from 'react';
import { getProductImage } from './utils';

interface LayerBoxProps {
    layerName: 'top' | 'bottom' | 'outer';
    layerTitle: string;
    state: any;
    setState: any;
    targetCodes: string[];
    allItems: any[];
    handleQuickSelect: (layerName: 'top' | 'bottom' | 'outer', item: any) => void;
    openModal: (layerName: 'top' | 'bottom' | 'outer') => void;
    changeColor: (layerName: 'top' | 'bottom' | 'outer', direction: number) => void;
    // 상의/하의/아우터 세 박스 중 가장 긴 총장(cm)을 기준으로, 이 박스의 옷 총장이 그 대비 몇 %인지
    // 계산해서 미리보기 이미지 높이에 반영한다. 둘 다 없으면(치수 데이터 미확보) 기존처럼 박스에
    // 꽉 채워 보여준다.
    lengthCm?: number | null;
    maxLengthCm?: number | null;
}

// 가장 긴 옷 기준 표시 높이(px) — 세 박스 중 최장인 옷이 이 높이로 그려지고, 나머지는 비례해서 작아짐.
const REFERENCE_BOX_HEIGHT = 260;
// 극단적으로 짧은 옷(예: 니트 나시)이 안 보일 정도로 작아지지 않도록 하는 최소 비율.
const MIN_HEIGHT_RATIO = 0.35;

const LayerBox = ({
    layerName,
    layerTitle,
    state,
    setState,
    targetCodes,
    allItems,
    handleQuickSelect,
    openModal,
    changeColor,
    lengthCm,
    maxLengthCm
}: LayerBoxProps) => {
    let displayHeight = 180;
    if (lengthCm && maxLengthCm && maxLengthCm > 0) {
        const ratio = Math.max(lengthCm / maxLengthCm, MIN_HEIGHT_RATIO);
        displayHeight = Math.round(REFERENCE_BOX_HEIGHT * ratio);
    }
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
                <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100 mb-2 position-relative" style={{minHeight: `${REFERENCE_BOX_HEIGHT}px`, background: '#f8f9fa', borderRadius: '8px', border: '2px dashed #e0e0e0', overflow:'hidden'}}>
                    {state.url ? (
                        <>
                            <img src={state.url} alt={layerTitle} style={{maxWidth: '100%', height: displayHeight, objectFit: 'contain', padding: '5px'}} />
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
                            setState((prev: any) => ({ ...prev, sizeCode: newSize }));
                        }}
                    >
                        {(Array.isArray(state.item.sizes) ? state.item.sizes : String(state.item.sizes).split(',')).map((s: any) => {
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
