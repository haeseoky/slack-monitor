# Slack Monitor

여러 API를 동시에 모니터링하고 결과를 Slack으로 전송하는 도구입니다.

## 주요 기능

- ✅ **다중 API 모니터링**: 여러 API를 동시에 체크 (병렬 실행)
- ⏱️ **응답 시간 측정**: 각 API의 응답 시간 추적
- 📊 **요약 알림**: 여러 API 결과를 한 번에 Slack으로 전송
- 🎯 **개별 알림**: API별로 개별 알림도 가능
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
| `SLACK_WEBHOOK_URL` | Slack Webhook URL (필수) | - |
| `SLACK_CHANNEL` | Slack 채널 | `#ocean` |
| `CHECK_INTERVAL` | 체크 간격 (밀리초) | `60000` (1분) |
| `NOTIFY_ON_ERROR` | 에러 시 알림 여부 | `true` |
| `NOTIFY_ON_SUCCESS` | 성공 시 알림 여부 | `false` |
| `SEND_SUMMARY` | 요약 알림 전송 | `true` |

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
  },
  // 추가 API들...
];
```

**예시: 여러 API 모니터링**

```javascript
module.exports = [
  {
    id: 'main-api',
    name: '메인 API',
    url: 'https://api.example.com/health',
    method: 'GET',
    enabled: true,
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

## 실행

### 일반 실행
```bash
node slack-monitor.js
```

### PM2로 실행
```bash
pm2 start ecosystem.config.js
```

### PM2 상태 확인
```bash
pm2 status
pm2 logs slack-monitor
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
