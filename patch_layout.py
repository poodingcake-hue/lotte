import sys

with open("frontend/src/pages/VtonPage.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update renderLayerBox
render_box_target = """    const renderLayerBox = (layerName, layerTitle, state) => {
        return (
            <div className="col" style={{ minWidth: '150px' }}>
                <div className="p-2 border rounded h-100 bg-white d-flex flex-column align-items-center">
                    <h6 className="fw-bold mb-2 small">{layerTitle}</h6>
                    <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100 mb-2" style={{minHeight: '80px', background: '#f8f9fa', borderRadius: '4px', border: '1px dashed #ccc'}}>
                        {state.url ? (
                            <img src={state.url} alt={layerTitle} style={{maxWidth: '100%', maxHeight: '100px', objectFit: 'contain', padding: '5px'}} />
                        ) : (
                            <div className="text-muted" style={{fontSize: '11px'}}>이미지 없음</div>
                        )}
                    </div>
                    <button className="btn btn-outline-primary btn-sm w-100 mt-auto fw-bold" onClick={() => openModal(layerName)} style={{fontSize: '12px'}}>
                        {state.url ? '변경' : '선택'}
                    </button>
                    {state.url && (
                        <button className="btn btn-sm btn-outline-danger w-100 mt-1" onClick={() => {
                            if (layerName === 'top') setTop({ type: 'product', url: '', prompt: '', id: null });
                            if (layerName === 'bottom') setBottom({ type: 'product', url: '', prompt: '', id: null });
                            if (layerName === 'outer') setOuter({ type: 'product', url: '', prompt: '', id: null });
                        }} style={{fontSize: '12px'}}>
                            삭제
                        </button>
                    )}
                </div>
            </div>
        );
    };"""

render_box_replacement = """    const renderLayerBox = (layerName, layerTitle, state) => {
        return (
            <div className="p-3 border rounded h-100 bg-white d-flex flex-column align-items-center shadow-sm">
                <h5 className="fw-bold mb-3 text-dark">{layerTitle}</h5>
                <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100 mb-3" style={{minHeight: '220px', background: '#f8f9fa', borderRadius: '8px', border: '2px dashed #e0e0e0'}}>
                    {state.url ? (
                        <img src={state.url} alt={layerTitle} style={{maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', padding: '10px'}} />
                    ) : (
                        <div className="text-muted fw-bold">이미지 없음</div>
                    )}
                </div>
                <button className="btn btn-outline-primary w-100 mt-auto fw-bold py-2" onClick={() => openModal(layerName)}>
                    {state.url ? '변경하기' : '선택하기'}
                </button>
                {state.url && (
                    <button className="btn btn-outline-danger w-100 mt-2 py-2 fw-bold" onClick={() => {
                        if (layerName === 'top') setTop({ type: 'product', url: '', prompt: '', id: null });
                        if (layerName === 'bottom') setBottom({ type: 'product', url: '', prompt: '', id: null });
                        if (layerName === 'outer') setOuter({ type: 'product', url: '', prompt: '', id: null });
                    }}>
                        삭제하기
                    </button>
                )}
            </div>
        );
    };"""

content = content.replace(render_box_target, render_box_replacement)

# 2. Update Layout structure
layout_target = """            <div className="row flex-nowrap" style={{ overflowX: 'auto', paddingBottom: '10px' }}>
                {/* 1. Model Selection */}
                <div className="col" style={{ minWidth: '200px' }}>
                    <div className="vton-model-section p-2 border rounded h-100 bg-white d-flex flex-column">
                        <h6 className="fw-bold mb-2 text-center small">모델 선택</h6>
                        <div className="vton-mode-tabs mb-2 d-flex gap-1">
                            <button className={`btn btn-sm flex-grow-1 ${model.type === 'preset' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'preset'}))} style={{fontSize: '11px'}}>모델</button>
                            <button className={`btn btn-sm flex-grow-1 ${model.type === 'url' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'url'}))} style={{fontSize: '11px'}}>URL</button>
                        </div>
                        {model.type === 'preset' ? (
                            <div className="d-flex gap-1 mb-2">
                                <select className="form-select form-select-sm" style={{fontSize: '12px'}} value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))}>
                                    {allCustomModels.map(m => (
                                        <option key={m.id} value={m.url}>[내 모델] {m.name}</option>
                                    ))}
                                    <option value="https://cdn.pixabay.com/photo/2021/01/29/14/41/wardrobe-5961193_1280.jpg">여성 모델 1 (전신)</option>
                                    <option value="https://cdn.pixabay.com/photo/2016/11/29/13/14/attractive-1869761_1280.jpg">여성 모델 2 (전신)</option>
                                    <option value="https://cdn.pixabay.com/photo/2017/08/01/11/48/woman-2564660_1280.jpg">여성 모델 3 (상반신)</option>
                                    <option value="https://cdn.pixabay.com/photo/2015/01/09/02/45/girl-593645_1280.jpg">남성 모델 1 (전신)</option>
                                </select>
                                <button className="btn btn-outline-primary btn-sm fw-bold px-2" onClick={() => setUploadModalOpen(true)} title="모델 등록" style={{fontSize: '12px'}}>+</button>
                            </div>
                        ) : (
                            <input type="text" className="form-control form-control-sm mb-2" placeholder="이미지 URL 입력" value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))} style={{fontSize: '12px'}} />
                        )}
                        <div className="flex-grow-1 d-flex justify-content-center align-items-center mt-1" style={{minHeight: '100px', background: '#f8f9fa', borderRadius: '4px', border: '1px dashed #ccc'}}>
                            {model.url ? <img src={model.url} alt="Model" style={{maxWidth: '100%', maxHeight: '130px', objectFit: 'contain', padding: '2px'}} /> : <div className="text-muted" style={{fontSize: '11px'}}>이미지 없음</div>}
                        </div>
                    </div>
                </div>
                
                {renderLayerBox('top', '상의', top)}
                {renderLayerBox('bottom', '하의', bottom)}
                {renderLayerBox('outer', '아우터', outer)}
                
                {/* 5. Final Result */}
                <div className="col" style={{ minWidth: '380px' }}>
                    <div className="vton-result-section p-2 border rounded bg-white h-100 d-flex flex-column align-items-center justify-content-start" style={{minHeight: '220px'}}>
                        <h6 className="fw-bold w-100 text-center mb-2 small">최종 시뮬레이션 결과</h6>"""

layout_replacement = """            <div className="d-flex flex-column flex-xl-row gap-4 mb-5" style={{ minHeight: '80vh' }}>
                {/* Left Side: 60% Width for Inputs */}
                <div className="d-flex flex-column" style={{ flex: '1 1 60%' }}>
                    <div className="row g-4 flex-grow-1">
                        {/* 1. Model Selection */}
                        <div className="col-md-6">
                            <div className="vton-model-section p-3 border rounded h-100 bg-white d-flex flex-column shadow-sm">
                                <h5 className="fw-bold mb-3 text-center text-dark">모델 선택</h5>
                                <div className="vton-mode-tabs mb-3 d-flex gap-2">
                                    <button className={`btn flex-grow-1 ${model.type === 'preset' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'preset'}))}>모델 선택</button>
                                    <button className={`btn flex-grow-1 ${model.type === 'url' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'url'}))}>URL 입력</button>
                                </div>
                                {model.type === 'preset' ? (
                                    <div className="d-flex gap-2 mb-3">
                                        <select className="form-select form-select-lg" value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))}>
                                            {allCustomModels && allCustomModels.map(m => (
                                                <option key={m.id} value={m.url}>[내 모델] {m.name}</option>
                                            ))}
                                            <option value="https://cdn.pixabay.com/photo/2021/01/29/14/41/wardrobe-5961193_1280.jpg">여성 모델 1 (전신)</option>
                                            <option value="https://cdn.pixabay.com/photo/2016/11/29/13/14/attractive-1869761_1280.jpg">여성 모델 2 (전신)</option>
                                            <option value="https://cdn.pixabay.com/photo/2017/08/01/11/48/woman-2564660_1280.jpg">여성 모델 3 (상반신)</option>
                                            <option value="https://cdn.pixabay.com/photo/2015/01/09/02/45/girl-593645_1280.jpg">남성 모델 1 (전신)</option>
                                        </select>
                                        <button className="btn btn-outline-primary fw-bold px-3 text-nowrap" onClick={() => setUploadModalOpen(true)} title="모델 등록">+ 등록</button>
                                    </div>
                                ) : (
                                    <input type="text" className="form-control form-control-lg mb-3" placeholder="이미지 URL 입력" value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))} />
                                )}
                                <div className="flex-grow-1 d-flex justify-content-center align-items-center mt-2" style={{minHeight: '220px', background: '#f8f9fa', borderRadius: '8px', border: '2px dashed #e0e0e0'}}>
                                    {model.url ? <img src={model.url} alt="Model" style={{maxWidth: '100%', maxHeight: '250px', objectFit: 'contain', padding: '10px'}} /> : <div className="text-muted fw-bold">이미지 없음</div>}
                                </div>
                            </div>
                        </div>
                        
                        <div className="col-md-6">{renderLayerBox('top', '상의', top)}</div>
                        <div className="col-md-6">{renderLayerBox('bottom', '하의', bottom)}</div>
                        <div className="col-md-6">{renderLayerBox('outer', '아우터', outer)}</div>
                    </div>
                </div>
                
                {/* Right Side: 40% Width for Final Result */}
                <div className="d-flex flex-column" style={{ flex: '1 1 40%', minWidth: '400px' }}>
                    <div className="vton-result-section p-4 border rounded bg-white h-100 d-flex flex-column align-items-center justify-content-start shadow-sm position-relative">
                        <h4 className="fw-bold w-100 text-center mb-4 text-primary border-bottom pb-2">최종 시뮬레이션 결과</h4>"""

content = content.replace(layout_target, layout_replacement)

# 3. Final image display sizing
result_img_target = """<img src={finalResult} alt="VTON Result" style={{maxWidth: '100%', maxHeight: '35vh', objectFit: 'contain', border: '2px solid var(--primary)', borderRadius: '6px'}} />"""
result_img_replacement = """<img src={finalResult} alt="VTON Result" style={{maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain', border: '3px solid var(--primary)', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}} />"""
content = content.replace(result_img_target, result_img_replacement)

# 4. Gallery title padding
gallery_target = """<h5 className="fw-bold mb-3" style={{color: 'var(--primary)'}}>내 갤러리 피드</h5>"""
gallery_replacement = """<div style={{marginTop: '100px'}}></div>
            <h4 className="fw-bold mb-4 border-bottom pb-2" style={{color: 'var(--primary)'}}>📸 내 갤러리 피드</h4>"""
content = content.replace(gallery_target, gallery_replacement)

# 5. Fix Gallery map conditional rendering to prevent undefined
content = content.replace("{allGallery.map(g => (", "{allGallery && allGallery.map(g => (")

with open("frontend/src/pages/VtonPage.jsx", "w", encoding="utf-8") as f:
    f.write(content)
