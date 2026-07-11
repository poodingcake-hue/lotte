import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { callFalRestApi } from '../api/falClient';
import './VtonPage.css';

const VtonPage = () => {
    const allItems = useAppStore(state => state.allItems);
    
    const [model, setModel] = useState({ type: 'preset', url: 'https://cdn.pixabay.com/photo/2021/01/29/14/41/wardrobe-5961193_1280.jpg' });
    const [bottom, setBottom] = useState({ type: 'product', url: '', prompt: '', id: null });
    const [top, setTop] = useState({ type: 'product', url: '', prompt: '', id: null });
    const [outer, setOuter] = useState({ type: 'product', url: '', prompt: '', id: null });
    const [vtonEngine, setVtonEngine] = useState('fashn');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [progressText, setProgressText] = useState('');
    const [finalResult, setFinalResult] = useState('');
    
    const [characterSheetResult, setCharacterSheetResult] = useState('');
    const [isGeneratingSheet, setIsGeneratingSheet] = useState(false);
    
    const [videoResult, setVideoResult] = useState('');
    const [isVideoGenerating, setIsVideoGenerating] = useState(false);
    const [videoProgressText, setVideoProgressText] = useState('');
    
    // Modal State
    const [modalConfig, setModalConfig] = useState({ isOpen: false, layer: null });
    const [modalTab, setModalTab] = useState('product'); // 'product' or 'prompt'
    const [searchTerm, setSearchTerm] = useState('');
    const [promptText, setPromptText] = useState('');
    const [isPromptGenerating, setIsPromptGenerating] = useState(false);

    const openModal = (layer) => {
        setModalConfig({ isOpen: true, layer });
        setModalTab('product');
        setSearchTerm('');
        // Load existing prompt if any
        const currentState = layer === 'top' ? top : layer === 'bottom' ? bottom : outer;
        setPromptText(currentState.prompt || '');
    };

    const closeModal = () => {
        setModalConfig({ isOpen: false, layer: null });
    };

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

    const startVtonProcess = async () => {
        if (!model.url) { alert('모델 이미지가 없습니다.'); return; }
        
        const layers = [];
        if (bottom.url) layers.push({ url: bottom.url, cat: 'bottoms', name: '하의' });
        if (top.url) layers.push({ url: top.url, cat: 'tops', name: '상의' });
        if (outer.url) layers.push({ url: outer.url, cat: 'tops', name: '아우터' });
        
        if (layers.length === 0) {
            alert('합성할 옷(하의/상의/아우터) 중 하나 이상 선택해주세요.');
            return;
        }
        
        setIsGenerating(true);
        setFinalResult('');
        let currentBaseImage = model.url;
        
        try {
            if (vtonEngine === 'nano-banana') {
                setProgressText(`룩시트 일괄 합성 중... (Nano Banana)\n진행 상황: 구글 제미나이 에디트 처리 중`);
                const imageUrls = [currentBaseImage, ...layers.map(l => l.url)];
                const payload = {
                    image_urls: imageUrls,
                    prompt: "A highly photorealistic image of the person in the first image wearing all the exact garments shown in the subsequent images. The person's identity, pose, and background must remain exactly the same. Synthesize the clothes naturally onto the person.",
                    output_format: "png"
                };
                const res = await callFalRestApi('fal-ai/nano-banana-pro/edit', payload);
                if (res && res.images && res.images[0]) {
                    currentBaseImage = res.images[0].url;
                } else {
                    throw new Error('결과 이미지를 받지 못했습니다.');
                }
            } else {
                for (let i=0; i<layers.length; i++) {
                    const layer = layers[i];
                    setProgressText(`${layer.name} 합성 중... (${i+1}/${layers.length})\n진행 상황: ${layer.name} VTON 적용 중`);
                    
                    const payload = {
                        model_image: currentBaseImage,
                        garment_image: layer.url,
                        category: layer.cat,
                        garment_photo_type: "flat-lay"
                    };
                    
                    const res = await callFalRestApi('fal-ai/fashn/tryon/v1.6', payload);
                    if (res && res.images && res.images[0]) {
                        currentBaseImage = res.images[0].url;
                    } else {
                        throw new Error('결과 이미지를 받지 못했습니다.');
                    }
                }
            }
            
            setFinalResult(currentBaseImage);
            setProgressText('최종 착장 합성 완료! (우클릭 후 이미지 저장 가능)');
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
            alert('캐릭터 시트 생성 중 에러 발생:\n' + e.message);
        } finally {
            setIsGeneratingSheet(false);
        }
    };

    const generateVideo = async () => {
        if (!finalResult) return;
        setIsVideoGenerating(true);
        setVideoResult('');
        setVideoProgressText('씨댄스(SeaDance) 영상 생성 중... (약 1~3분 소요됩니다)');
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
            alert('비디오 생성 중 에러 발생:\n' + e.message);
            setVideoProgressText('영상 생성 실패');
        } finally {
            setIsVideoGenerating(false);
        }
    };

    const renderLayerBox = (layerName, layerTitle, state) => {
        return (
            <div className="col" style={{ minWidth: '220px' }}>
                <div className="p-3 border rounded h-100 bg-white d-flex flex-column align-items-center">
                    <h6 className="fw-bold mb-3">{layerTitle}</h6>
                    
                    <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100 mb-3" style={{minHeight: '150px', background: '#f8f9fa', borderRadius: '4px', border: '1px dashed #ccc'}}>
                        {state.url ? (
                            <img src={state.url} alt={layerTitle} style={{maxWidth: '100%', maxHeight: '180px', objectFit: 'contain', padding: '5px'}} />
                        ) : (
                            <div className="text-muted small">선택된 이미지가 없습니다</div>
                        )}
                    </div>
                    
                    <button className="btn btn-outline-primary w-100 mt-auto fw-bold" onClick={() => openModal(layerName)}>
                        {state.url ? '변경하기' : '선택하기'}
                    </button>
                    {state.url && (
                        <button className="btn btn-sm btn-outline-danger w-100 mt-2" onClick={() => {
                            if (layerName === 'top') setTop({ type: 'product', url: '', prompt: '', id: null });
                            if (layerName === 'bottom') setBottom({ type: 'product', url: '', prompt: '', id: null });
                            if (layerName === 'outer') setOuter({ type: 'product', url: '', prompt: '', id: null });
                        }}>
                            삭제
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // Modal Content
    const layerNames = { top: '상의', bottom: '하의', outer: '아우터' };
    let items = allItems.filter(i => i.isMaster && (searchTerm === '' || (i.brand && i.brand.includes(searchTerm)) || (i.name && i.name.includes(searchTerm))));
    
    items = items.sort((a, b) => {
        const codeA = a.code || '';
        const codeB = b.code || '';
        return codeB.localeCompare(codeA, undefined, { numeric: true, sensitivity: 'base' });
    });

    return (
        <div className="vton-container container-fluid p-3" style={{position: 'relative'}}>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-3">
                    <h4 className="fw-bold m-0" style={{color: 'var(--primary)'}}>가상착장 (VTON)</h4>
                    <select className="form-select form-select-sm" style={{width: '260px', fontWeight: 'bold'}} value={vtonEngine} onChange={(e) => setVtonEngine(e.target.value)}>
                        <option value="fashn">엔진: Fashn (순차 정밀 합성)</option>
                        <option value="nano-banana">엔진: Nano Banana (룩시트 일괄)</option>
                    </select>
                </div>
                <button 
                    className="btn btn-success fw-bold px-5 py-2" 
                    onClick={startVtonProcess}
                    disabled={isGenerating}
                >
                    {isGenerating ? '합성 진행 중...' : '가상착장 시작'}
                </button>
            </div>
            
            <div className="row flex-nowrap" style={{ overflowX: 'auto', paddingBottom: '15px' }}>
                {/* 1. Model Selection */}
                <div className="col" style={{ minWidth: '220px' }}>
                    <div className="vton-model-section p-3 border rounded h-100 bg-white d-flex flex-column">
                        <h6 className="fw-bold mb-3 text-center">모델 선택</h6>
                        <div className="vton-mode-tabs mb-2 d-flex gap-2">
                            <button className={`btn btn-sm flex-grow-1 ${model.type === 'preset' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'preset'}))}>프리셋</button>
                            <button className={`btn btn-sm flex-grow-1 ${model.type === 'url' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setModel(prev => ({...prev, type: 'url'}))}>URL 입력</button>
                        </div>
                        {model.type === 'preset' ? (
                            <select className="form-select form-select-sm mb-2" value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))}>
                                <option value="https://cdn.pixabay.com/photo/2021/01/29/14/41/wardrobe-5961193_1280.jpg">여성 모델 1 (전신)</option>
                                <option value="https://cdn.pixabay.com/photo/2016/11/29/13/14/attractive-1869761_1280.jpg">여성 모델 2 (전신)</option>
                                <option value="https://cdn.pixabay.com/photo/2017/08/01/11/48/woman-2564660_1280.jpg">여성 모델 3 (상반신)</option>
                                <option value="https://cdn.pixabay.com/photo/2015/01/09/02/45/girl-593645_1280.jpg">남성 모델 1 (전신)</option>
                            </select>
                        ) : (
                            <input type="text" className="form-control form-control-sm mb-2" placeholder="이미지 URL 입력" value={model.url} onChange={(e) => setModel(prev => ({...prev, url: e.target.value}))} />
                        )}
                        <div className="flex-grow-1 d-flex justify-content-center align-items-center mt-2" style={{minHeight: '150px', background: '#f8f9fa', borderRadius: '4px', border: '1px dashed #ccc'}}>
                            {model.url ? <img src={model.url} alt="Model Preview" style={{maxWidth: '100%', maxHeight: '250px', objectFit: 'contain', padding: '5px'}} /> : <div className="text-muted small p-2 text-center">모델 이미지가<br/>없습니다.</div>}
                        </div>
                    </div>
                </div>
                
                {/* 2. Top Selection */}
                {renderLayerBox('top', '상의', top)}

                {/* 3. Bottom Selection */}
                {renderLayerBox('bottom', '하의', bottom)}

                {/* 4. Outer Selection */}
                {renderLayerBox('outer', '아우터', outer)}
                
                {/* 5. Final Result */}
                <div className="col" style={{ minWidth: '320px' }}>
                    <div className="vton-result-section p-3 border rounded bg-white h-100 d-flex flex-column align-items-center justify-content-start" style={{minHeight: '400px'}}>
                        <h6 className="fw-bold w-100 text-center mb-3">최종 결과</h6>
                        <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100">
                            {isGenerating && (
                                <div className="text-center my-4">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <div className="mt-3 text-muted fw-bold" style={{whiteSpace: 'pre-line'}}>{progressText}</div>
                                </div>
                            )}
                            {!isGenerating && finalResult && (
                                <>
                                    <img src={finalResult} alt="Final VTON" style={{maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', border: '2px solid var(--primary)', borderRadius: '8px'}} />
                                    <div className="text-success fw-bold mt-3 text-center">{progressText}</div>
                                    <button 
                                        className="btn btn-warning fw-bold mt-3 w-100" 
                                        onClick={generateCharacterSheet}
                                        disabled={isGeneratingSheet}
                                    >
                                        {isGeneratingSheet ? '캐릭터 시트 생성 중...' : '이 착장으로 캐릭터 시트 뽑아내기 (Nano Banana)'}
                                    </button>
                                    
                                    {characterSheetResult && (
                                        <div className="mt-4 w-100">
                                            <h6 className="fw-bold text-center mb-2">캐릭터 시트 (16:9)</h6>
                                            <img src={characterSheetResult} alt="Character Sheet" style={{width: '100%', objectFit: 'contain', border: '2px solid #ffc107', borderRadius: '8px'}} />
                                        </div>
                                    )}
                                    
                                    <hr className="w-100 my-4" />
                                    
                                    <button 
                                        className="btn btn-dark fw-bold w-100" 
                                        onClick={generateVideo}
                                        disabled={isVideoGenerating}
                                    >
                                        {isVideoGenerating ? (
                                            <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> 영상 렌더링 중...</>
                                        ) : '🎬 이 착장으로 패션 화보 영상 만들기 (SeaDance)'}
                                    </button>
                                    
                                    {isVideoGenerating && (
                                        <div className="text-center mt-3 text-muted small fw-bold">
                                            {videoProgressText}
                                        </div>
                                    )}
                                    
                                    {videoResult && (
                                        <div className="mt-4 w-100 d-flex flex-column align-items-center">
                                            <h6 className="fw-bold text-center mb-2">🎬 씨댄스 화보 영상</h6>
                                            <video 
                                                controls 
                                                autoPlay 
                                                loop 
                                                style={{width: '100%', maxWidth: '400px', borderRadius: '8px', border: '2px solid #343a40', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'}}
                                            >
                                                <source src={videoResult} type="video/mp4" />
                                                브라우저가 비디오 태그를 지원하지 않습니다.
                                            </video>
                                        </div>
                                    )}
                                </>
                            )}
                            {!isGenerating && !finalResult && (
                                <div className="text-muted text-center p-4 border rounded" style={{background: '#f8f9fa'}}>
                                    우측 상단의<br/><strong className="text-success">가상착장 시작</strong><br/>버튼을 눌러주세요.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

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
                                    <input 
                                        type="text" 
                                        placeholder="브랜드 또는 상품명 검색" 
                                        className="form-control mb-3"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    <div className="vton-modal-product-list" style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                        {items.slice(0, 30).map((item, idx) => {
                                            let colors = [];
                                            let imgObj = null;
                                            try {
                                                imgObj = JSON.parse(item.image);
                                                colors = Object.keys(imgObj).filter(k => k !== 'main');
                                            } catch(e) {}
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
                                                                <div 
                                                                    key={i} 
                                                                    onClick={() => selectProductColor(item, c)}
                                                                    style={{ cursor: 'pointer', textAlign: 'center', minWidth: '70px', transition: 'opacity 0.2s' }}
                                                                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'}
                                                                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                                                                >
                                                                    <div style={{ width: '70px', height: '90px', background: '#f8f9fa', borderRadius: '4px', overflow: 'hidden', border: '1px solid #eee' }}>
                                                                        {finalUrl ? (
                                                                            <img src={finalUrl} alt={c} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                                        ) : (
                                                                            <div style={{fontSize:'10px', color:'#999', lineHeight:'90px'}}>No Img</div>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ fontSize: '11px', marginTop: '6px', color: '#555', fontWeight: 'bold' }}>{c}</div>
                                                                </div>
                                                            );
                                                        })}
                                                        {colors.length === 0 && (
                                                            <div className="text-muted small p-2">등록된 색상 이미지가 없습니다.</div>
                                                        )}
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
                                    <textarea 
                                        className="form-control mb-3" 
                                        rows="4" 
                                        placeholder="예: red leather jacket, white t-shirt, blue denim jeans"
                                        value={promptText}
                                        onChange={(e) => setPromptText(e.target.value)}
                                    />
                                    <button 
                                        className="btn btn-primary w-100 py-2 fw-bold" 
                                        onClick={handleGeneratePromptImage}
                                        disabled={isPromptGenerating}
                                    >
                                        {isPromptGenerating ? '이미지 생성 중...' : '이미지 생성 및 적용하기'}
                                    </button>
                                    <div className="text-muted small mt-2 text-center">
                                        * AI가 프롬프트를 바탕으로 흰 배경의 의류 이미지를 생성합니다.<br/>
                                        (생성에는 약 10~20초 소요됩니다)
                                    </div>
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
