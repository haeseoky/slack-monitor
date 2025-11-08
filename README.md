# Slack Monitor

여러 API를 동시에 모니터링하고 결과를 Slack으로 전송하는 도구입니다.

## 주요 기능

- ✅ **다중 API 모니터링**: 여러 API를 동시에 체크 (병렬 실행)
- 📢 **멀티 채널 지원**: 2개 이상의 Slack 채널에 알림 전송 가능
- 🎯 **채널별 API 매핑**: API마다 다른 채널로 알림 전송 가능
- 🆕 **뽐뿌 게시글 모니터링**: 뽐뿌 신규 게시글 자동 감지 및 알림
- ⏱️ **응답 시간 측정**: 각 API의 응답 시간 추적
- 📊 **요약 알림**: 채널별로 그룹화된 API 결과 요약 전송
- 🔧 **유연한 설정**: GET/POST/PUT/PATCH 등 다양한 HTTP 메서드 지원
- 🚀 **PM2 지원**: 백그라운드 실행 및 자동 재시작

## 설치

```bash
npm install
```

## 설정

### 1. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하세요:

```bash
cp .env.example .env
```

`.env` 파일에서 다음 환경 변수를 설정하세요:

| 환경 변수 | 설명 | 기본값 |
|-----------|------|--------|
| `SLACK_WEBHOOK_URLS` | 채널별 Webhook URLs (필수) | - |
| `SLACK_DEFAULT_CHANNEL` | 기본 Slack 채널 | `health` |
| `CHECK_INTERVAL` | API 체크 간격 (밀리초) | `60000` (1분) |
| `NOTIFY_ON_ERROR` | 에러 시 알림 여부 | `true` |
| `NOTIFY_ON_SUCCESS` | 성공 시 알림 여부 | `false` |
| `SEND_SUMMARY` | 요약 알림 전송 | `true` |
| `PPOMPPU_MONITOR_ENABLED` | 뽐뿌 모니터링 활성화 | `true` |
| `PPOMPPU_CHECK_INTERVAL` | 뽐뿌 체크 간격 (밀리초) | `60000` (1분) |

**SLACK_WEBHOOK_URLS 형식:**
```bash
# 단일 채널
SLACK_WEBHOOK_URLS=health=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# 다중 채널 (쉼표로 구분)
SLACK_WEBHOOK_URLS=health=https://hooks.slack.com/services/..., ocean=https://hooks.slack.com/services/..., ppomppu=https://hooks.slack.com/services/...
```

**뽐뿌 모니터링 설정:**
- `ppomppu` 채널을 `SLACK_WEBHOOK_URLS`에 추가해야 뽐뿌 알림이 전송됩니다
- `PPOMPPU_MONITOR_ENABLED=false`로 설정하면 뽐뿌 모니터링을 비활성화할 수 있습니다
- 첫 실행 시에는 현재 게시글만 기록하고 알림을 보내지 않습니다
- 이후 실행부터 신규 게시글을 감지하여 알림을 전송합니다
- **인기글(hotpop_bg_color) 자동 제외**: 랜덤으로 표시되는 인기글은 신규 게시글로 감지하지 않습니다

### 2. API 목록 설정

`apis.config.js` 파일에서 모니터링할 API를 설정하세요:

```javascript
module.exports = [
  {
    id: 'api-1',                    // API 고유 ID
    name: 'API 이름',               // 표시될 이름
    url: 'https://api.example.com', // API URL
    method: 'GET',                  // HTTP 메서드 (GET/POST/PUT/PATCH)
    headers: {                      // 요청 헤더 (선택)
      'Content-Type': 'application/json',
    },
    body: {},                       // 요청 Body (POST/PUT/PATCH용, 선택)
    timeout: 5000,                  // 타임아웃 (밀리초)
    enabled: true,                  // 활성화 여부
    channel: 'health',              // 알림 받을 채널명 (선택, 미지정 시 SLACK_DEFAULT_CHANNEL 사용)
  },
  // 추가 API들...
];
```

**예시: 채널별 API 모니터링**

```javascript
module.exports = [
  {
    id: 'main-api',
    name: '메인 API',
    url: 'https://api.example.com/health',
    method: 'GET',
    enabled: true,
    channel: 'health',  // #health 채널로 알림 전송
  },
  {
    id: 'payment-api',
    name: '결제 API',
    url: 'https://payment.example.com/status',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
    },
    body: { service: 'payment' },
    enabled: true,
    channel: 'alerts',  // #alerts 채널로 알림 전송
  },
  {
    id: 'user-api',
    name: '사용자 API',
    url: 'https://user.example.com/ping',
    method: 'GET',
    enabled: true,
    channel: 'ocean',   // #ocean 채널로 알림 전송
  },
  {
    id: 'legacy-api',
    name: '레거시 API',
    url: 'https://legacy.example.com/ping',
    method: 'GET',
    enabled: false,  // 비활성화
  },
];
```

**채널 매핑:**
- 각 API의 `channel` 속성은 `.env` 파일의 `SLACK_WEBHOOK_URLS`에 정의된 채널명과 일치해야 합니다
- `channel`을 지정하지 않으면 `SLACK_DEFAULT_CHANNEL`로 알림이 전송됩니다
- 요약 알림(`SEND_SUMMARY=true`)을 사용하면 채널별로 그룹화된 요약이 전송됩니다

## 실행

### 일반 실행
```bash
node index.js
```

실행 시 다음 모니터링이 시작됩니다:
- API 모니터링 (설정된 간격으로)
- 뽐뿌 게시글 모니터링 (활성화된 경우)

### PM2로 실행
```bash
pm2 start ecosystem.config.js
```

### PM2 상태 확인
```bash
pm2 status
pm2 logs slack-monitor
```

### 뽐뿌 모니터링 비활성화
뽐뿌 모니터링만 비활성화하려면 `.env` 파일에서:
```bash
PPOMPPU_MONITOR_ENABLED=false
```

## 배포

오라클 서버 등 프로덕션 환경에 배포하는 방법은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

### 간단 배포
```bash
# 서버에서
./deploy.sh
```

자세한 배포 방법 (자동 배포 포함): [DEPLOYMENT.md](./DEPLOYMENT.md)

## 주의사항

⚠️ **보안**: Slack Webhook URL은 민감한 정보입니다. 프로덕션 환경에서는 환경 변수로 관리하세요.

## 라이선스

ISC
