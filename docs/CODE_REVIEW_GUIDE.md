# 롯데 PB 시스템 코드리뷰 가이드 (Code Review Guide)

본 문서는 **롯데 PB 상품 재고·대여·편성표 관리 시스템**의 코드 리뷰 시 반드시 확인해야 하는 원칙, 아키텍처 규칙, 영역별 체크리스트를 정리한 가이드입니다.

---

## 1. 시스템 아키텍처 개요

```
[ Frontend: React + Vite + TS ] (GitHub Pages 배포)
       │ HTTP (apiClient)
       ▼
[ Backend: Cloudflare Worker ] (wrangler deploy)
   ├── Cloudflare D1 (lotte-db: SQLite 기반 서버리스 DB)
   └── Cloudflare R2 (lotte-images: 상품 및 누끼 이미지 스토리지)
```

- **프론트엔드**: 정적 빌드 후 GitHub Pages에 배포 (`base: /lotte/`). `data.json`, `weather.json`을 런타임에 fetch하며, 상태는 Cloudflare Worker와 통신.
- **백엔드**: Cloudflare Worker + D1(`lotte-db`). **GitHub 푸시와 Worker 배포는 별개**이므로, 백엔드 코드 수정 시 반드시 `npx wrangler deploy`가 수행되어야 함.
- **자동화 스크립트**: `scripts/update_schedule.py` (편성표 수집), `update_weather.py` (날씨 수집).

---

## 2. ⚠️ 절대 위반 금지: 재고 시스템 불변식 (Core Invariants)

재고 관련 코드를 리뷰할 때는 **[docs/INVENTORY_RULES.md](file:///c:/Users/엔플러스/Desktop/롯데다시/docs/INVENTORY_RULES.md)**의 규칙을 반드시 준수했는지 최우선으로 검증해야 합니다.

### ① 재고는 저장되지 않는다 — 이력에서 파생된다
```sql
SELECT code, color, size, SUM(qty) AS qty
FROM inventory_history
GROUP BY code, color, size
```
- 재고 수량 컬럼은 DB에 존재하지 않습니다.
- **체크포인트**: 재고를 변경할 때 수량을 직접 UPDATE하거나 별도 재고 테이블을 만들지 않고, 반드시 `inventory_history`에 신규 행을 추가(`save_history`)하고 있는지 확인합니다.

### ② 부호 규약 (Sign Convention)
`SUM(qty)`가 타입 구분 없이 전부 더하므로 부호가 틀리면 재고가 즉시 파손됩니다.

| type | 부호 | 의미 | 재고 영향 | 필수 파라미터 |
|---|---|---|---|---|
| `IN` | **양수(+)** | 신규 입고 | 증가 | `code`, `color`, `size`, `qty` |
| `RENT` | **음수(-)** | 대여 반출 | 감소 | `code`, `color`, `size`, `qty(< 0)`, `actor` |
| `RETURN` | **양수(+)** | 대여 반납 | 증가 | `ref_id` (원본 RENT 행의 id 필수) |
| `ADJUST` | **양수/음수** | 수동 보정 | 증감 | `note` 사유 권장 |

- **체크포인트**: 대여(`RENT`) 기록 시 `qty`가 음수로 들어가는지, 반납(`RETURN`) 시 `ref_id`가 빠짐없이 연결되는지 확인합니다.
- **절대 금지**: 대여를 `OUT` 타입으로 기록 금지 (반납 처리가 불가능해짐).

---

## 3. 핵심 신규 기능 리뷰 포인트

### A. 멀티상품코드 (`extra_codes`)
- **설계 의도**: 실물 상품 1개(대표 마스터 코드)에 다양한 판매채널(방송, 모바일, 라이브, 외부몰)의 상품코드를 1:N으로 연결.
- **DB 컬럼**: `products.extra_codes` (콤마로 구분된 최대 4개 코드 문자열, e.g. `"12909999, 12901111"`).
- **리뷰 체크포인트**:
  - `RegisterPage.tsx`: 입력 시 4개 초과 방지 유효성 검사(`split(',').length > 4`) 및 저장 전 `trim()` 처리 확인.
  - `SchedulePage.tsx`: `masterCodes` Set에 마스터의 `extra_codes`가 포함되어 편성표의 채널 코드가 '보유 상품'으로 정상 매칭되는지 확인.
  - `DetailPage.tsx`: URL 진입 시 `/detail/:extraCode`로 들어와도 마스터 상품으로 해석되어 재고·대여가 마스터 코드로 일원화되는지 확인.
  - `InventoryPage.tsx` / `ProductSearchModal.tsx`: 검색어 필터에 `extra_codes` 포함 여부 확인.

### B. 상품 및 재고 영구 삭제 ('바로삭제')
- **설계 의도**: 오등록 상품이나 완전 마감 상품을 5개 테이블에서 일괄 영구 삭제.
- **리뷰 체크포인트**:
  - **안전장치**: 입력란에 정확히 `'바로삭제'`가 입력되었는지 확인 (`deleteConfirmText.trim() === '바로삭제'`).
  - **2중 확인**: `window.confirm` 대화상자로 상품코드와 함께 최종 확인을 받는지 검증.
  - **D1 배치 쿼리**: 다음 5개 테이블이 하나의 배치(`env.DB.batch`)로 원자적 삭제되는지 확인:
    ```sql
    DELETE FROM products WHERE code = ?;
    DELETE FROM inventory_history WHERE code = ?;
    DELETE FROM outfits WHERE code = ?;
    DELETE FROM notes WHERE code = ?;
    DELETE FROM supplies WHERE code = ?;
    ```
  - **로컬 상태 정리**: `useAppStore.deleteProductFromBackend`가 `allItems`, `allStockMap`, `allHistory`, `allOutfits`, `allNotes`, `allSupplies`를 즉시 정리하여 화면 리렌더링을 보장하는지 확인.

### C. 반출 카테고리 시각적 구분
- **리뷰 체크포인트**:
  - `ProductSearchModal.tsx`: `item.category === '반출'`일 때 이미지 위에 반투명 음영 오버레이(`rgba(0,0,0,0.52)`)와 중앙 `반출` 뱃지가 올바르게 렌더링되는지 확인.

---

## 4. 영역별 상세 코드리뷰 체크리스트

### 🟦 프론트엔드 (React / TypeScript / Zustand)

- [ ] **빌드 및 타입 검사**:
  - `npx tsc --noEmit -p tsconfig.json` 통과 여부 (타입 에러 0건)
  - `npm run build` (Vite 번들링 정상 완료)
- [ ] **재고 낙관적 업데이트**:
  - `saveHistoryToBackend` 호출 시 서버에서 반환된 실제 auto-increment `id`를 가진 객체로 로컬 `allHistory` 및 `allStockMap`을 갱신하는지 확인 (이중 차감/가산 방지).
- [ ] **메모이제이션 최적화**:
  - `useMemo`, `useCallback`의 의존성 배열(`deps`)에 사용된 변수가 누락되지 않았는지 확인.
- [ ] **사용자 피드백**:
  - 비동기 작업 중 로딩 상태 표시 (`isUploading`, `isLoading`) 및 에러 발생 시 사용자 안내(`alert` 등) 적절성.

### 🟩 백엔드 (Cloudflare Worker & D1)

- [ ] **D1 SQL 바인딩 안전성**:
  - SQL 인젝션 방지를 위해 모든 파라미터는 `stmt.bind(...)`를 사용하는지 확인.
- [ ] **D1 배치 처리 한도 준수**:
  - SQLite/D1의 쿼리 제한을 고려하여 100건 단위 슬라이싱(`slice(i, i + 100)`) 후 배치 실행하는지 확인.
- [ ] **동적 스키마 마이그레이션 (`ensureSchema`)**:
  - 신규 컬럼 추가 시 D1 테이블 변경이 안전하게 `try ... catch`로 감싸져 기존 프로덕션에 영향을 주지 않는지 확인.
- [ ] **배포 동기화 확인**:
  - 백엔드 코드(`backend/src/index.js`)가 변경된 경우, PR 머지 후 로컬 또는 CI에서 `npx wrangler deploy` 배포가 누락되지 않도록 명시되어 있는지 확인.

### 🟧 데이터 파이프라인 (크롤러 & 정적 JSON)

- [ ] **마스터 데이터 보존**:
  - `scripts/update_schedule.py` 실행 시 `data.json`의 `isMaster === true` 항목이 유실되지 않고 편성표(`isMaster === false`) 항목만 교체되는지 확인.
- [ ] **크롤러 장애 허용성**:
  - 롯데 웹사이트 구조 변경 시 파싱 오류가 발생해도 스크립트가 크래시되지 않고 로그를 남기며 안전 종료되는지 확인.

---

## 5. 코드리뷰 및 PR 제출 템플릿

PR을 제출하거나 리뷰할 때 아래 양식을 활용하세요:

```markdown
### 1. 변경 요약 (Summary)
- 작업 목적 및 배경:
- 주요 변경 사항:

### 2. 재고/데이터베이스 불변식 영향 검토 (Safety Check)
- [ ] `inventory_history` 부호 규약(+/-)을 준수했는가?
- [ ] 기존 재고 데이터에 파괴적인 변경이 없는가?
- [ ] 백엔드 Worker 배포(`wrangler deploy`)가 필요한 변경인가? (예 / 아니오)

### 3. 테스트 및 검증 결과 (Verification)
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과
- [ ] 로컬 또는 스테이징 화면 동작 검증 완료
```
