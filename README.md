# AI Daily Report

매일 아침 9시(KST)에 AI 커뮤니티의 핵심 이슈를 자동 수집·요약하는 데일리 리포트.

## 주요 기능
- Reddit / Hacker News / arXiv / Product Hunt 키워드 기반 수집
- 트렌딩 점수 기반 랭킹 + 상승속도(velocity) 반영
- 크로스 소스 클러스터링으로 중복 이슈 묶기
- 근거 문장 포함 요약(LLM 미사용 시 추출 요약)
- SQLite 저장 + 리포트 아카이브 페이지

## 빠른 시작

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 데일리 리포트 생성

```bash
npm run daily
```

또는 API 호출:

```
GET /api/cron/daily?token=YOUR_SECRET
```

## 환경 변수

`.env.local`에 설정하세요.

```
# LLM 요약 (선택)
LLM_API_KEY=...
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Reddit (선택)
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=ai-daily-report/0.1

# Product Hunt (선택)
PRODUCT_HUNT_TOKEN=...

# Cron 보안
CRON_SECRET=...

# DB 경로 (선택, 권장: cwd 이슈 방지)
AI_DAILY_DB_PATH=/home/iamooo/repos/ai-daily-report/data/ai-daily-report.db
```

## 스케줄링
- KST 기준 오전 9시 실행을 권장
- 로컬: OS cron/작업 스케줄러에서 `npm run daily`
- 배포: `/api/cron/daily` 호출

## 구조
```
app/                # Next.js App Router
lib/                # 수집/요약/랭킹/DB
config/             # 키워드/소스 설정
scripts/            # 로컬 실행 스크립트
```

## 키워드 수정
`config/keywords.ts` 파일에서 키워드를 추가/삭제하세요.

## 랭킹/클러스터링 튜닝
`config/tuning.ts`에서 아래 값을 조절할 수 있습니다.
- `CLUSTER_THRESHOLD`: 같은 이슈로 묶을 유사도 기준
- `VELOCITY_WEIGHT`: 상승 속도 가중치
- `SOURCE_WEIGHTS`: 소스별 신뢰도/우선순위 가중치
