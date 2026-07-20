import React from 'react';

interface ResultPanelProps {
    isGenerating: boolean;
    progressText: string;
    finalResult: string;
    generateCharacterSheet: () => Promise<void>;
    isGeneratingSheet: boolean;
    characterSheetResult: string;
    generateVideo: () => Promise<void>;
    isVideoGenerating: boolean;
    videoProgressText: string;
    videoResult: string;
    handleSaveGallery: (type: string, url: string) => Promise<void>;
}

const ResultPanel = ({
    isGenerating,
    progressText,
    finalResult,
    generateCharacterSheet,
    isGeneratingSheet,
    characterSheetResult,
    generateVideo,
    isVideoGenerating,
    videoProgressText,
    videoResult,
    handleSaveGallery
}: ResultPanelProps) => {
    return (
        <div className="vton-result-section p-4 border rounded bg-white h-100 d-flex flex-column align-items-center justify-content-start shadow-sm position-relative">
            <h4 className="fw-bold w-100 text-center mb-4 text-primary border-bottom pb-2">최종 시뮬레이션 결과</h4>
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
                            <img src={finalResult} alt="Result" style={{maxWidth: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #ddd'}} />
                            <button className="btn btn-sm btn-light shadow-sm position-absolute" style={{top: 10, right: 10, fontWeight: 'bold'}} onClick={() => handleSaveGallery('vton', finalResult)}>💾 갤러리에 저장</button>
                        </div>
                        
                        <div className="mt-4 w-100 d-flex gap-2">
                            <button className="btn btn-outline-primary flex-grow-1 fw-bold" onClick={generateCharacterSheet} disabled={isGeneratingSheet}>
                                {isGeneratingSheet ? '생성 중...' : '✨ 캐릭터시트 생성 (앞/옆/뒤)'}
                            </button>
                            <button className="btn btn-outline-success flex-grow-1 fw-bold" onClick={generateVideo} disabled={isVideoGenerating}>
                                {isVideoGenerating ? '영상 생성 중...' : '🎥 360도 화보 영상 생성'}
                            </button>
                        </div>
                        
                        {(isVideoGenerating || videoProgressText) && (
                            <div className="mt-3 text-center text-muted small fw-bold">
                                {isVideoGenerating && <span className="spinner-border spinner-border-sm text-success me-2"></span>}
                                {videoProgressText}
                            </div>
                        )}

                        <div className="mt-4 w-100 d-flex flex-wrap gap-3 justify-content-center">
                            {characterSheetResult && (
                                <div className="w-100 text-center mb-3">
                                    <h6 className="fw-bold mb-1" style={{fontSize:'11px'}}>캐릭터시트 (앞/옆/뒤)</h6>
                                    <div style={{position: 'relative'}}>
                                        <img src={characterSheetResult} alt="Sheet" style={{maxWidth: '100%', border: '1px solid #ccc', borderRadius: '4px'}} />
                                        <button className="btn btn-sm btn-light shadow-sm position-absolute" style={{top: 5, right: 5, fontSize: '10px', padding: '1px 4px'}} onClick={() => handleSaveGallery('sheet', characterSheetResult)}>💾 저장</button>
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
    );
};

export default ResultPanel;
