const fs = require('fs');

async function run() {
  const url = 'https://lotte-backend.poodingcake.workers.dev';
  
  const history = [];
  
  // 1. Inventory from data.json
  const dataStr = fs.readFileSync('./frontend/public/data.json', 'utf-8');
  const masterData = JSON.parse(dataStr);
  const stockMap = masterData.stockMap || {};
  
  Object.keys(stockMap).forEach(code => {
    stockMap[code].forEach(item => {
      history.push({
        code: code,
        color: item.color || '-',
        size: item.size || '-',
        type: 'IN',
        qty: Number(item.qty || 0),
        actor: '시스템',
        date: '2026-01-01T00:00:00.000Z',
        note: '기초 재고 일괄 등록'
      });
    });
  });
  
  // 2. Rentals from rentals.json
  const rentalsStr = fs.readFileSync('./frontend/public/rentals.json', 'utf-8');
  const rentals = JSON.parse(rentalsStr);
  
  rentals.forEach(r => {
    history.push({
      code: r.code,
      color: r.color || '-',
      size: r.size || '-',
      type: 'OUT',
      qty: -Math.abs(Number(r.qty || 1)),
      actor: r.renter || '-',
      date: r.date || '2026-01-01T00:00:00.000Z',
      note: '기존 대여 내역 이관'
    });
  });
  
  console.log(`Prepared ${history.length} history records.`);
  
  if (history.length === 0) {
     console.log("No data found to backfill.");
     return;
  }
  
  // POST to save_history
  const postRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'save_history', data: history })
  });
  
  const result = await postRes.json();
  console.log('Result:', result);
}

run();
