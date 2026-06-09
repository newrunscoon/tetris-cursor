---
name: tetris-qa
description: >-
  Runs automated and manual QA for the pure HTML/CSS/JS Tetris game in this
  repository. Use when the user asks for QA, testing, verification, regression
  checks, or mentions tetris-cursor game quality. Also use after changes to
  script.js, index.html, or style.css.
---

# Tetris QA

순수 HTML/CSS/JavaScript 테트리스(`index.html`, `style.css`, `script.js`)의 품질을 점검한다.

## 빠른 실행

프로젝트 루트에서 자동화 테스트를 실행한다:

```bash
node .cursor/skills/tetris-qa/scripts/verify-logic.mjs
```

- 종료 코드 `0` → 자동화 QA 통과
- 종료 코드 `1` → 실패 항목 확인 후 `script.js` 수정

## 워크플로

1. **자동화 테스트 실행** — 위 명령을 Shell 도구로 실행한다.
2. **결과 보고** — PASS/FAIL 요약을 표로 정리한다.
3. **실패 시** — FAIL 항목명을 기준으로 `script.js`의 해당 로직(충돌, 줄 삭제, 점수, 스폰, 레벨)을 추적하고 수정한다.
4. **수정 후** — 테스트를 다시 실행해 전 항목 PASS를 확인한다.
5. **UI 점검(선택)** — 자동화 통과 후 `references/checklist.md`의 수동 항목을 안내하거나, 사용자에게 브라우저 확인을 요청한다.

## 자동화 테스트 범위

| # | 항목 |
|---|---|
| 1 | 7종 테트로미노(I,O,T,S,Z,J,L) 정의 및 랜덤 스폰 |
| 2 | 좌우 이동, 시계방향 회전, 하강, 벽 충돌 |
| 3 | 줄 삭제 및 점수 (1줄=100, 2줄=300, 3줄=500, 4줄=800) |
| 4 | 레벨 계산 및 낙하 간격 감소 |
| 5 | 게임 오버(스폰 불가) 및 재시작(보드·점수 초기화) |

## script.js와의 동기화

`scripts/verify-logic.mjs`는 `script.js`의 게임 규칙을 **독립적으로 재현**한다.  
다음 상수를 `script.js`에서 변경했다면 **verify-logic.mjs도 함께 갱신**한다:

- `LINE_SCORES` (1→100, 2→300, 3→500, 4→800)
- `COLS`, `ROWS`
- `BASE_DROP_INTERVAL`, `MIN_DROP_INTERVAL`, `DROP_SPEED_STEP`, `SCORE_PER_LEVEL`

## 수동 QA

DOM·캔버스·키 입력·반응형 UI는 브라우저에서 확인한다.  
체크리스트: [references/checklist.md](references/checklist.md)

## 출력 형식

QA 완료 후 사용자에게 다음 형식으로 보고한다:

```markdown
## Tetris QA 결과

| 항목 | 결과 |
|---|---|
| ... | PASS / FAIL |

**자동화:** N/N 통과
**수동 점검:** (필요 시 checklist 항목 나열)
```

실패가 있으면 원인과 수정 파일을 함께 기술한다.
