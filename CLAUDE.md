# 프로젝트 개요

롯데홈쇼핑 PB 상품 재고·대여·편성표 관리 앱.

- `frontend/` — React + Vite + TypeScript, GitHub Pages 배포 (`base: /lotte/`)
- `backend/` — Cloudflare Worker + D1(`lotte-db`) + R2(`lotte-images`)
- `scripts/update_schedule.py` — 롯데아이몰 편성표 크롤러 (Playwright)
- `update_weather.py` — 기상청 단기예보 수집

프론트는 정적 파일(`data.json`, `weather.json`)을 런타임에 fetch하고,
나머지 데이터는 전부 Cloudflare Worker(D1)와 직접 통신합니다.

---

## ⚠️ 재고를 건드리기 전에 반드시 읽을 것

**[docs/INVENTORY_RULES.md](docs/INVENTORY_RULES.md)** — 재고·대여 시스템의 규칙, 알려진 문제, 사고 이력.

재고 관련 작업 전에 이 문서를 먼저 읽으세요. 아래는 요약입니다.

### 재고는 저장되지 않는다 — 이력에서 파생된다

`inventory_history`가 유일한 진실 공급원입니다. 재고 값은 어디에도 없습니다.

```sql
-- backend/src/index.js:126
SELECT code, color, size, SUM(qty) FROM inventory_history GROUP BY code, color, size
```

- 재고를 바꾸려면 **이력 행을 추가**해야 합니다
- 이력 행을 지우면 **재고가 즉시 변합니다**
- `inventory` 테이블은 존재하지 않습니다 (파생 값)

### 부호 규약

| type | 부호 | 의미 |
|---|---|---|
| `IN` | 양수 | 입고 |
| `RENT` | **음수** | 대여 반출 |
| `RETURN` | 양수 | 반납 (`ref_id`에 원본 RENT의 id 필수) |
| `ADJUST` | 자유 | 수동 보정 |

`SUM(qty)`가 타입 구분 없이 전부 더하므로 **부호가 틀리면 재고가 바로 깨집니다.**

### 대여현황 표시 조건

`type === 'RENT'` **이고** 자신을 `ref_id`로 가리키는 `RETURN`이 없을 것.
→ `type`이 `OUT`이면 **재고만 깎이고 화면에는 안 보입니다.** (과거 사고 원인)

### 절대 금지

- **`backfill_history.js` 재실행** — `data.json`의 `stockMap`이 2026-07-06에 동결된 죽은 데이터입니다.
  재실행하면 묵은 재고 5,539개가 통째로 다시 입고됩니다.
- **대여를 `OUT` 타입으로 기록** — 반납 처리가 불가능해집니다.

---

## 데이터 백업

실질적 안전망은 **Cloudflare D1 Time Travel (보존 30일)** 입니다.

```bash
npx wrangler d1 time-travel info lotte-db
```

`backup.js`가 만드는 루트 JSON은 `outfits`/`notes`/`supplies`만 담고
**재고·이력·상품은 백업하지 않습니다.** (`rentals`는 API에서 사라진 키라 항상 건너뜀)

---

## 자동화 워크플로

| 워크플로 | 주기 | 비고 |
|---|---|---|
| `update_schedule.yml` | 2시간마다 (09~21 KST) | 편성표 크롤링 |
| `update_weather.yml` | 매시간 | 기상청 예보 |
| `deploy.yml` | push + 위 두 워크플로 완료 시 | GitHub Pages |
| `auto_backup.yml` | 매일 03:00 KST | **현재 계속 실패 중** |

`deploy.yml`에 `workflow_run` 트리거가 필요합니다. 봇이 `GITHUB_TOKEN`으로 만든 푸시는
`push` 이벤트를 트리거하지 않기 때문입니다 (Actions 루프 방지 규칙).

`update_schedule.py`는 **수집 0건이어도 정상 종료(exit 0)** 합니다.
롯데가 사이트 구조를 바꾸면 초록불인 채로 편성표가 조용히 멈춥니다.

---

## 개발

```bash
cd frontend && npm install && npm run dev    # http://localhost:5173/lotte/
```

빌드 검증: `npx tsc --noEmit -p tsconfig.json` → `npm run lint` → `npm run build`

로컬 dev에서 백엔드 API 호출은 CORS로 막힐 수 있습니다 (`ALLOWED_ORIGINS`에
`http://localhost:5173`이 등록돼 있으나 환경에 따라 실패). 배포본에서는 정상입니다.
