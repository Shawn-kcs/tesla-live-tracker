# ⚡ 테슬라(TSLA) 실시간 주가 & 관련 뉴스 수집 대시보드

[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-181717?logo=github)](https://github.com/Shawn-kcs/tesla-live-tracker)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

테슬라(Tesla, Inc.)의 실시간 나스닥 주가 정보와 관련 언론사 최신 뉴스 10개를 실시간으로 자동 수집하여 시각화해 주는 웹 애플리케이션 및 서버입니다.

---

## 🚀 클라우드 원클릭 무료 서버 배포

아래 버튼을 클릭하여 GitHub 저장소를 무료 클라우드 서버로 1분 만에 배포할 수 있습니다:

### 1. Render로 배포 (추천 - 상시 구동 웹 서비스)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Shawn-kcs/tesla-live-tracker)
- 설정 없이 버튼 클릭 한 번으로 `https://tsla-live-tracker.onrender.com` 형태의 전용 도메인이 발급됩니다.

### 2. Vercel로 배포 (초고속 서버리스)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Shawn-kcs/tesla-live-tracker)
- Vercel과 GitHub 계정 연동 후 즉시 글로벌 엣지 서버로 배포됩니다.

---

## 🐳 Docker 컨테이너 실행

Docker 환경이 준비되어 있다면 명령어 2줄로 즉시 서버를 구동할 수 있습니다:

```bash
# Docker 이미지 빌드
docker build -t tsla-live-tracker .

# Docker 컨테이너 실행 (포트 3000)
docker run -d -p 3000:3000 --name tsla-tracker tsla-live-tracker
```

---

## 🌟 주요 기능

1. **실시간 테슬라(TSLA) 주가 모니터링**
   - 실시간 미국 달러($) 주가 및 전일 대비 변동폭 / 변동률(%)
   - **실시간 원/달러(USD/KRW) 환율 자동 반영**하여 원화(₩) 환산 가격 동시 표시
   - 정규장 / 프리마켓 / 애프터마켓 / 장 마감 상태 실시간 표시
   - 전일 종가, 당일 최고/최저, 52주 최고/최저, 거래량 등 핵심 지표 카드

2. **인터랙티브 주가 추이 차트 (Chart.js)**
   - 기간별 차트 조회: `1일(1D)`, `5일(5D)`, `1개월(1M)`, `6개월(6M)`, `1년(1Y)`
   - 반응형 툴팁 (일시, 가격, 상승/하락 그라디언트 테마)

3. **실시간 테슬라 관련 뉴스 10개 수집 피드**
   - **국내 주요 언론사 뉴스** (연합뉴스, 한국경제, 매일경제, MBC 등)
   - **글로벌 외신 뉴스** (Bloomberg, Reuters, CNBC 등) 탭 전환 지원
   - 최신 발행 시간 기준 상대 시간 표시 (예: *방금 전*, *15분 전*, *2시간 전*)
   - 기사 원문 바로가기 링크 및 헤드라인 검색 기능

4. **자동 갱신 & 사용자 편의 기능**
   - 자동 새로고침 타이머 (10초 / 30초 / 1분 단위 설정) 및 시각적 진행바
   - 수동 새로고침 단축키: `R` 키
   - 뉴스 검색 포커스 단축키: `/` 키
   - 모던 다크 모드 (Bloomberg / TradingView 스타일) UI

---

## 💻 로컬 환경 실행 방법

### 1. 저장소 클론 및 패키지 설치
```bash
git clone https://github.com/Shawn-kcs/tesla-live-tracker.git
cd tesla-live-tracker
npm install
```

### 2. 서버 실행
```bash
npm start
```

### 3. 브라우저 접속
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📁 프로젝트 구조

```
├── Dockerfile             # 도커 컨테이너 빌드 정의
├── render.yaml            # Render 클라우드 배포 청사진
├── vercel.json            # Vercel 서버리스 배포 설정
├── server.js              # Express 백엔드 API (Yahoo Finance & Google News 프록시)
├── package.json           # 의존성 및 실행 스크립트
├── README.md              # 프로젝트 안내 문서
└── public/                # 프론트엔드 정적 파일
    ├── index.html         # 웹 대시보드 마크업 구조
    ├── style.css          # 모던 다크 테마 및 반응형 스타일
    └── app.js             # 실시간 데이터 통신, 차트 렌더링, 검색 로직
```

---

## 📡 API 명세

- `GET /api/stock?range=1d`: 테슬라 현재 주가, 환율, 등락률, 시계열 데이터
- `GET /api/news?lang=ko&limit=10`: 최신 테슬라 관련 뉴스 10개 (한국어)
- `GET /api/news?lang=en&limit=10`: 최신 테슬라 관련 뉴스 10개 (글로벌 영문)
- `GET /api/health`: 서버 상태 확인
