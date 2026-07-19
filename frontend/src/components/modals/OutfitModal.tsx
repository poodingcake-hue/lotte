import { useState } from 'react';

const OutfitModal = ({ isOpen, onClose, onConfirm }) => {
  const [rows, setRows] = useState([
    { host: '', size: '' },
    { host: '', size: '' },
    { host: '', size: '' },
  ]);

  if (!isOpen) return null;

  const handleChange = (idx, field, val) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const handleConfirm = () => {
    const entries = rows.filter(r => r.host.trim() && r.size.trim());
    if (entries.length === 0) {
      alert('최소 한 명 이상의 이름과 사이즈를 입력해주세요.');
      return;
    }
    onConfirm(entries);
    setRows([{ host: '', size: '' }, { host: '', size: '' }, { host: '', size: '' }]);
    onClose();
  };

  return (
    <div className="custom-modal-overlay" style={{ display: 'flex' }}>
      <div className="custom-modal">
        <h5 className="modal-title">착장 정보 일괄 등록</h5>
        <div id="modal-rows">
          {rows.map((row, idx) => (
            <div key={idx} className="input-row">
              <div className="input-group">
                <span className="input-label">이름 {idx + 1}</span>
                <input type="text" className="modal-input outfit-name" placeholder="성함" value={row.host} onChange={e => handleChange(idx, 'host', e.target.value)} />
              </div>
              <div className="input-group">
                <span className="input-label">사이즈 {idx + 1}</span>
                <input type="text" className="modal-input outfit-size" placeholder="사이즈" value={row.size} onChange={e => handleChange(idx, 'size', e.target.value)} />
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="m-btn m-btn-cancel" onClick={onClose}>취소</button>
          <button className="m-btn m-btn-confirm" onClick={handleConfirm}>등록하기</button>
        </div>
      </div>
    </div>
  );
};

export default OutfitModal;
