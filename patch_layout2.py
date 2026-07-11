import sys

with open("frontend/src/pages/VtonPage.jsx", "r", encoding="utf-8") as f:
    content = f.read()

layout_target = """            <div className="d-flex flex-column flex-xl-row gap-4 mb-5" style={{ minHeight: '80vh' }}>
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
                <div className="d-flex flex-column" style={{ flex: '1 1 40%', minWidth: '400px' }}>"""

layout_replacement = """            <div className="d-flex flex-nowrap gap-3 mb-5 w-100" style={{ minHeight: '80vh', overflowX: 'auto' }}>
                {/* 1. Model Selection */}
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>
                    <div className="vton-model-section p-3 border rounded h-100 bg-white d-flex flex-column shadow-sm">
                        <h5 className="fw-bold mb-3 text-center text-dark">모델 선택</h5>
                        <div className="vton-mode-tabs mb-3 d-flex flex-column gap-2">
                            <div className="d-flex gap-2">
                                <button className={`btn btn-sm flex-grow-1 ${model.type === 'preset' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'preset'}))}>모델 선택</button>
                                <button className={`btn btn-sm flex-grow-1 ${model.type === 'url' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'url'}))}>URL 입력</button>
                            </div>
                        </div>
                        {model.type === 'preset' ? (
                            <div className="d-flex flex-column gap-2 mb-3">
                                <select className="form-select form-select-sm" value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))}>
                                    {allCustomModels && allCustomModels.map(m => (
                                        <option key={m.id} value={m.url}>[내 모델] {m.name}</option>
                                    ))}
                                    <option value="https://cdn.pixabay.com/photo/2021/01/29/14/41/wardrobe-5961193_1280.jpg">여성 모델 1 (전신)</option>
                                    <option value="https://cdn.pixabay.com/photo/2016/11/29/13/14/attractive-1869761_1280.jpg">여성 모델 2 (전신)</option>
                                    <option value="https://cdn.pixabay.com/photo/2017/08/01/11/48/woman-2564660_1280.jpg">여성 모델 3 (상반신)</option>
                                    <option value="https://cdn.pixabay.com/photo/2015/01/09/02/45/girl-593645_1280.jpg">남성 모델 1 (전신)</option>
                                </select>
                                <button className="btn btn-sm btn-outline-primary fw-bold text-nowrap w-100" onClick={() => setUploadModalOpen(true)} title="모델 등록">+ 내 모델 등록하기</button>
                            </div>
                        ) : (
                            <input type="text" className="form-control form-control-sm mb-3" placeholder="이미지 URL 입력" value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))} />
                        )}
                        <div className="flex-grow-1 d-flex justify-content-center align-items-center mt-2" style={{minHeight: '220px', background: '#f8f9fa', borderRadius: '8px', border: '2px dashed #e0e0e0'}}>
                            {model.url ? <img src={model.url} alt="Model" style={{maxWidth: '100%', maxHeight: '250px', objectFit: 'contain', padding: '10px'}} /> : <div className="text-muted fw-bold">이미지 없음</div>}
                        </div>
                    </div>
                </div>
                
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>{renderLayerBox('top', '상의', top)}</div>
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>{renderLayerBox('bottom', '하의', bottom)}</div>
                <div className="d-flex flex-column" style={{ flex: '1 1 16%', minWidth: '220px' }}>{renderLayerBox('outer', '아우터', outer)}</div>
                
                {/* Right Side: 35% Width for Final Result */}
                <div className="d-flex flex-column" style={{ flex: '0 0 35%', minWidth: '450px' }}>"""

content = content.replace(layout_target, layout_replacement)

with open("frontend/src/pages/VtonPage.jsx", "w", encoding="utf-8") as f:
    f.write(content)
