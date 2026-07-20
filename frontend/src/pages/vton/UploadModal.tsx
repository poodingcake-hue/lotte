import React from 'react';

interface UploadModalProps {
    uploadModalOpen: boolean;
    setUploadModalOpen: (v: boolean) => void;
    uploadName: string;
    setUploadName: (v: string) => void;
    uploadHeight: string;
    setUploadHeight: (v: string) => void;
    setUploadFile: (file: File | null) => void;
    handleUploadModel: () => void;
    isUploading: boolean;
}

const UploadModal = ({
    uploadModalOpen,
    setUploadModalOpen,
    uploadName,
    setUploadName,
    uploadHeight,
    setUploadHeight,
    setUploadFile,
    handleUploadModel,
    isUploading
}: UploadModalProps) => {
    if (!uploadModalOpen) return null;

    return (
        <div className="modal-backdrop" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <div className="modal-content bg-white rounded shadow p-4" style={{width: '90%', maxWidth: '400px'}}>
                <h5 className="fw-bold mb-3">내 모델 등록하기</h5>
                <div className="mb-2">
                    <label className="form-label small fw-bold">모델 이름</label>
                    <input type="text" className="form-control form-control-sm" value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="예: 봄 시즌 신규 모델" />
                </div>
                <div className="mb-2">
                    <label className="form-label small fw-bold">모델 키 (cm)</label>
                    <input type="number" className="form-control form-control-sm" value={uploadHeight} onChange={e => setUploadHeight(e.target.value)} placeholder="예: 170" />
                </div>
                <div className="mb-3">
                    <label className="form-label small fw-bold">이미지 파일 (WebP 권장)</label>
                    <input type="file" className="form-control form-control-sm" accept="image/*" onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                            setUploadFile(e.target.files[0]);
                        } else {
                            setUploadFile(null);
                        }
                    }} />
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-secondary flex-grow-1" onClick={() => setUploadModalOpen(false)}>취소</button>
                    <button className="btn btn-primary flex-grow-1 fw-bold" onClick={handleUploadModel} disabled={isUploading}>
                        {isUploading ? '업로드 중...' : '등록하기'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadModal;
