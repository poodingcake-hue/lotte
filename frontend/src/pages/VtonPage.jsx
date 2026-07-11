import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { callFalRestApi } from '../api/falClient';
import './VtonPage.css';

const VtonPage = () => {
    const allItems = useAppStore(state => state.allItems);
    const allCustomModels = useAppStore(state => state.allCustomModels);
    const allGallery = useAppStore(state => state.allGallery);
    const saveCustomModelToBackend = useAppStore(state => state.saveCustomModelToBackend);
    const saveGalleryToBackend = useAppStore(state => state.saveGalleryToBackend);
    
    const [model, setModel] = useState({ type: 'preset', url: 'https://cdn.pixabay.com/photo/2021/01/29/14/41/wardrobe-5961193_1280.jpg' });
    const [bottom, setBottom] = useState({ type: 'product', url: '', prompt: '', id: null });
    const [top, setTop] = useState({ type: 'product', url: '', prompt: '', id: null });
    const [outer, setOuter] = useState({ type: 'product', url: '', prompt: '', id: null });
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [progressText, setProgressText] = useState('');
    const [finalResult, setFinalResult] = useState('');
    
    const [characterSheetResult, setCharacterSheetResult] = useState('');
    const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
    
    const [videoResult, setVideoResult] = useState('');
    const [isVideoGenerating, setIsVideoGenerating] = useState(false);
    const [videoProgressText, setVideoProgressText] = useState('');
    
    // Selection Modal State
    const [modalConfig, setModalConfig] = useState({ isOpen: false, layer: null });
    const [modalTab, setModalTab] = useState('product'); // 'product' or 'prompt'
    const [searchTerm, setSearchTerm] = useState('');
    const [promptText, setPromptText] = useState('');
    const [isPromptGenerating, setIsPromptGenerating] = useState(false);

    // Upload Model Modal State
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const openModal = (layer) => {
        setModalConfig({ isOpen: true, layer });
        setModalTab('product');
        setSearchTerm('');
        const currentState = layer === 'top' ? top : layer === 'bottom' ? bottom : outer;
        setPromptText(currentState.prompt || '');
    };

    const closeModal = () => setModalConfig({ isOpen: false, layer: null });

    const getProductImage = (item) => {
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

    const selectProductColor = (item, colorCode) => {
        const layer = modalConfig.layer;
        let imgUrl = "";
        try {
            const imgObj = JSON.parse(item.image);
            if (colorCode && imgObj[colorCode]) {
                const id = imgObj[colorCode].match(/id=([a-zA-Z0-9_-]+)/);
                imgUrl = id ? `https://lh3.googleusercontent.com/d/${id[1]}` : imgObj[colorCode];
            } else {
                imgUrl = getProductImage(item);
            }
        } catch (e) {
            imgUrl = getProductImage(item);
        }

        if (imgUrl) {
            if (layer === 'bottom') setBottom(prev => ({ ...prev, url: imgUrl, type: 'product' }));
            if (layer === 'top') setTop(prev => ({ ...prev, url: imgUrl, type: 'product' }));
            if (layer === 'outer') setOuter(prev => ({ ...prev, url: imgUrl, type: 'product' }));
            closeModal();
        } else {
            alert("해당 컬러의 이미지를 찾을 수 없습니다.");
        }
    };

    const handleGeneratePromptImage = async () => {
        const layer = modalConfig.layer;
        if (!promptText) { alert('프롬프트를 입력하세요.'); return; }
        
        setIsPromptGenerating(true);
        try {
            const payload = {
                prompt: `A highly detailed, clean studio photography of a clothing item laid flat on a solid white background. The item is: ${promptText}. Professional e-commerce style.`,
                image_size: "square",
                num_inference_steps: 28
            };
            const res = await callFalRestApi('fal-ai/flux-pro/v1.1', payload);
            if (res && res.images && res.images[0]) {
                const url = res.images[0].url;
                if (layer === 'bottom') setBottom(prev => ({ ...prev, url, prompt: promptText, type: 'prompt' }));
                if (layer === 'top') setTop(prev => ({ ...prev, url, prompt: promptText, type: 'prompt' }));
                if (layer === 'outer') setOuter(prev => ({ ...prev, url, prompt: promptText, type: 'prompt' }));
                closeModal();
            }
        } catch (e) {
            alert('이미지 생성 실패:\n' + e.message);
        } finally {
            setIsPromptGenerating(false);
        }
    };

    const handleUploadModel = async () => {
        if (!uploadName || !uploadFile) {
            alert('모델 이름과 이미지를 모두 입력하세요.');
            return;
        }
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            const res = await fetch('https://lotte-backend.poodingcake.workers.dev', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success && data.imageUrl) {
                await saveCustomModelToBackend(uploadName, data.imageUrl);
                alert('모델이 등록되었습니다.');
                setUploadModalOpen(false);
                setUploadName('');
                setUploadFile(null);
                setModel({ type: 'preset', url: data.imageUrl });
            } else {
                throw new Error('Upload failed');
            }
        } catch (e) {
            console.error(e);
            alert('업로드 실패: ' + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveGallery = async (type, url) => {
        if (!url) return;
        try {
            await saveGalleryToBackend(type, url);
            alert('갤러리에 저장되었습니다! (하단에서 확인하세요)');
        } catch (e) {
            alert('저장 실패: ' + e.message);
        }
    };

    const startVtonProcess = async () => {
        if (!model.url) { alert('모델 이미지가 없습니다.'); return; }
        const layers = [];
        if (bottom.url) layers.push({ url: bottom.url, cat: 'bottoms', name: '하의' });
        if (top.url) layers.push({ url: top.url, cat: 'tops', name: '상의' });
        if (outer.url) layers.push({ url: outer.url, cat: 'tops', name: '아우터' });
        
        if (layers.length === 0) {
            alert('합성할 옷을 하나 이상 선택해주세요.');
            return;
        }
        
        setIsGenerating(true);
        setFinalResult('');
        let currentBaseImage = model.url;
        
        try {
            setProgressText(`룩시트 일괄 합성 중... (Nano Banana)`);
            const imageUrls = [currentBaseImage, ...layers.map(l => l.url)];
            const payload = {
                image_urls: imageUrls,
                prompt: "A highly photorealistic image of the person in the first image wearing all the exact garments shown in the subsequent images. The person's identity, pose, and background must remain exactly the same. Synthesize the clothes naturally onto the person.",
                output_format: "png"
            };
            const res = await callFalRestApi('fal-ai/nano-banana-pro/edit', payload);
            if (res && res.images && res.images[0]) {
                setFinalResult(res.images[0].url);
                setProgressText('합성 완료!');
            } else {
                throw new Error('결과 이미지를 받지 못했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('VTON 합성 중 에러 발생:\n' + e.message);
            setProgressText('합성 실패');
        } finally {
            setIsGenerating(false);
        }
    };

    const generateCharacterSheet = async () => {
        if (!finalResult) return;
        setIsGeneratingSheet(true);
        setCharacterSheetResult('');
        try {
            const payload = {
                image_urls: [finalResult],
                system_prompt: "You are an expert concept artist and fashion illustrator.",
                prompt: "A highly photorealistic character design sheet showing 3 different angles (front, side, and back) of this exact person wearing this exact outfit. They are standing against a solid white background. Preserve the facial identity, body proportions, and clothing details perfectly across all angles.",
                aspect_ratio: "16:9",
                resolution: "2K",
                output_format: "png"
            };
            const res = await callFalRestApi('fal-ai/nano-banana-pro/edit', payload);
            if (res && res.images && res.images[0]) {
                setCharacterSheetResult(res.images[0].url);
            } else {
                throw new Error('결과 이미지를 받지 못했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('에러 발생:\n' + e.message);
        } finally {
            setIsGeneratingSheet(false);
        }
    };

    const generateVideo = async () => {
        if (!finalResult) return;
        setIsVideoGenerating(true);
        setVideoResult('');
        setVideoProgressText('씨댄스 영상 생성 중... (1~3분 소요)');
        try {
            const payload = {
                image_url: finalResult,
                prompt: "A high-quality, photorealistic video of a female model in a minimalist indoor studio, performing natural fashion modeling poses. She smoothly transitions between poses: bending her knees slightly, crossing her arms and looking away, walking slowly while holding a wicker basket prop, and standing at a diagonal angle. The camera is static at eye-level, capturing a medium-full shot. No panning or zooming. The lighting is soft, diffused natural light coming from the side like window light, creating a warm, bright, and clean aesthetic. The background is a plain light-grey wall, and the floor is dark wood. The movement is fluid, elegant, and realistic, mimicking a professional photo shoot."
            };
            const res = await callFalRestApi('fal-ai/minimax-video/image-to-video', payload);
            if (res && res.video && res.video.url) {
                setVideoResult(res.video.url);
                setVideoProgressText('영상 생성 완료!');
            } else {
                throw new Error('비디오 URL을 받지 못했습니다.');
            }
        } catch (e) {
            console.error(e);
            alert('비디오 생성 에러:\n' + e.message);
            setVideoProgressText('생성 실패');
        } finally {
            setIsVideoGenerating(false);
        }
    };

    const renderLayerBox = (layerName, layerTitle, state) => {
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
    };

    // Modal Content filters
    const layerNames = { top: '상의', bottom: '하의', outer: '아우터' };
    let items = allItems.filter(i => i.isMaster && (searchTerm === '' || (i.brand && i.brand.includes(searchTerm)) || (i.name && i.name.includes(searchTerm))));
    items = items.sort((a, b) => {
        const codeA = a.code || '';
        const codeB = b.code || '';
        return codeB.localeCompare(codeA, undefined, { numeric: true, sensitivity: 'base' });
    });

    return (
        <div className="vton-container container-fluid p-3" style={{position: 'relative'}}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="fw-bold m-0" style={{color: 'var(--primary)', fontSize: '18px'}}>가상착장 스튜디오</h4>
                <button className="btn btn-success fw-bold px-4 py-1" onClick={startVtonProcess} disabled={isGenerating}>
                    {isGenerating ? '합성 중...' : '▶ 가상착장 시작'}
                </button>
            </div>
            
            <div className="row flex-nowrap" style={{ overflowX: 'auto', paddingBottom: '10px' }}>
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
                        <h6 className="fw-bold w-100 text-center mb-2 small">최종 시뮬레이션 결과</h6>
                        <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100 overflow-auto">
                            {isGenerating && (
                                <div className="text-center my-3">
                                    <div className="spinner-border spinner-border-sm text-primary mb-2"></div>
                                    <div className="text-muted fw-bold small">{progressText}</div>
                                </div>
                            )}
                            {!isGenerating && finalResult && (
                                <div className="d-flex flex-column align-items-center w-100">
                                    <div style={{position: 'relative', display: 'inline-block'}}>
                                        <img src={finalResult} alt="VTON Result" style={{maxWidth: '100%', maxHeight: '35vh', objectFit: 'contain', border: '2px solid var(--primary)', borderRadius: '6px'}} />
                                        <button className="btn btn-sm btn-light shadow-sm position-absolute" style={{top: 5, right: 5, fontSize: '12px', padding: '2px 6px'}} onClick={() => handleSaveGallery('vton', finalResult)}>💾 저장</button>
                                    </div>
                                    <div className="d-flex gap-2 w-100 mt-2">
                                        <button className="btn btn-sm btn-warning fw-bold flex-grow-1" onClick={generateCharacterSheet} disabled={isGeneratingSheet} style={{fontSize: '11px'}}>
                                            {isGeneratingSheet ? '시트 생성 중...' : '캐릭터 시트 생성'}
                                        </button>
                                        <button className="btn btn-sm btn-dark fw-bold flex-grow-1" onClick={generateVideo} disabled={isVideoGenerating} style={{fontSize: '11px'}}>
                                            {isVideoGenerating ? '영상 렌더링 중...' : '🎬 영상 렌더링'}
                                        </button>
                                    </div>
                                    
                                    {(characterSheetResult || videoResult) && <hr className="w-100 my-2" />}

                                    <div className="d-flex gap-2 w-100 justify-content-center">
                                        {characterSheetResult && (
                                            <div className="w-50 text-center">
                                                <h6 className="fw-bold mb-1" style={{fontSize:'11px'}}>캐릭터 시트</h6>
                                                <div style={{position: 'relative'}}>
                                                    <img src={characterSheetResult} style={{width: '100%', border: '1px solid #ccc', borderRadius: '4px'}} />
                                                    <button className="btn btn-sm btn-light shadow-sm position-absolute" style={{bottom: 5, right: 5, fontSize: '10px', padding: '1px 4px'}} onClick={() => handleSaveGallery('sheet', characterSheetResult)}>💾 저장</button>
                                                </div>
                                            </div>
                                        )}
                                        {videoResult && (
                                            <div className="w-50 text-center">
                                                <h6 className="fw-bold mb-1" style={{fontSize:'11px'}}>화보 영상</h6>
                                                <div style={{position: 'relative'}}>
                                                    <video src={videoResult} controls autoPlay loop muted style={{width: '100%', border: '1px solid #ccc', borderRadius: '4px'}} />
                                                    <button className="btn btn-sm btn-light shadow-sm position-absolute" style={{top: 5, right: 5, fontSize: '10px', padding: '1px 4px', zIndex: 10}} onClick={() => handleSaveGallery('video', videoResult)}>💾 저장</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {!isGenerating && !finalResult && (
                                <div className="text-muted text-center p-3 border rounded small" style={{background: '#f8f9fa'}}>
                                    모델과 의상을 선택한 후<br/>가상착장 시작을 누르세요.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Gallery Section */}
            <hr className="my-4 border-2" />
            <h5 className="fw-bold mb-3" style={{color: 'var(--primary)'}}>내 갤러리 피드</h5>
            <div className="row g-2 mb-4">
                {allGallery.map(g => (
                    <div key={g.id} className="col-4 col-md-3 col-lg-2">
                        <div className="border rounded overflow-hidden shadow-sm" style={{aspectRatio: '1', position: 'relative', background: '#f8f9fa'}}>
                            {g.type === 'video' ? (
                                <video src={g.url} style={{width: '100%', height: '100%', objectFit: 'cover'}} loop muted autoPlay playsInline />
                            ) : (
                                <img src={g.url} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                            )}
                            <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', padding: '3px 6px', textAlign: 'center', fontWeight: 'bold'}}>
                                {g.type === 'vton' ? '가상착장' : g.type === 'sheet' ? '캐릭터시트' : '🎬 화보영상'}
                            </div>
                        </div>
                    </div>
                ))}
                {allGallery.length === 0 && <div className="text-muted small w-100 p-3 bg-light rounded text-center">저장된 갤러리 항목이 없습니다. 결과 창에서 [저장] 버튼을 눌러보세요.</div>}
            </div>

            {/* Upload Modal */}
            {uploadModalOpen && (
                <div className="modal-backdrop" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                    <div className="modal-content bg-white rounded shadow p-4" style={{width: '90%', maxWidth: '400px'}}>
                        <h5 className="fw-bold mb-3">내 모델 등록하기</h5>
                        <div className="mb-3">
                            <label className="form-label small fw-bold">모델 이름</label>
                            <input type="text" className="form-control" value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="예: 봄 시즌 신규 모델" />
                        </div>
                        <div className="mb-4">
                            <label className="form-label small fw-bold">이미지 파일 (WebP 권장)</label>
                            <input type="file" className="form-control" accept="image/*" onChange={e => setUploadFile(e.target.files[0])} />
                        </div>
                        <div className="d-flex gap-2">
                            <button className="btn btn-secondary flex-grow-1" onClick={() => setUploadModalOpen(false)}>취소</button>
                            <button className="btn btn-primary flex-grow-1 fw-bold" onClick={handleUploadModel} disabled={isUploading}>
                                {isUploading ? '업로드 중...' : '등록하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selection Modal */}
            {modalConfig.isOpen && (
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
                                            try { imgObj = JSON.parse(item.image); colors = Object.keys(imgObj).filter(k => k !== 'main'); } catch(e) {}
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
                                                            const idMatch = cUrl && cUrl.match(/id=([a-zA-Z0-9_-]+)/);
                                                            const finalUrl = idMatch ? `https://lh3.googleusercontent.com/d/${idMatch[1]}` : cUrl;
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
            )}
        </div>
    );
};

export default VtonPage;
