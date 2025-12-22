# API 설정 가이드


`apis.config.js` 파일에서 모니터링할 API를 관리하는 방법입니다.

## 기본 구조

```javascript
module.exports = [
  {
    id: 'unique-api-id',           // 필수: API 고유 식별자
    name: 'API 표시 이름',          // 필수: Slack 알림에 표시될 이름
    url: 'https://api.example.com', // 필수: API 엔드포인트 URL
    method: 'GET',                  // 필수: HTTP 메서드
    headers: {},                    // 선택: 요청 헤더
    body: {},                       // 선택: 요청 Body (POST/PUT/PATCH)
    timeout: 5000,                  // 선택: 타임아웃 (밀리초, 기본값: 5000)
    enabled: true,                  // 선택: 활성화 여부 (기본값: true)
  },
];
```

## HTTP 메서드별 예시

### GET 요청

```javascript
{
  id: 'health-check',
  name: '헬스 체크 API',
  url: 'https://api.example.com/health',
  method: 'GET',
  headers: {
    'Accept': 'application/json',
  },
  timeout: 3000,
  enabled: true,
}
```

### POST 요청

```javascript
{
  id: 'status-check',
  name: '상태 체크 API',
  url: 'https://api.example.com/status',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: {
    service: 'monitoring',
    timestamp: Date.now(),
  },
  timeout: 5000,
  enabled: true,
}
```

### 인증이 필요한 API

```javascript
{
  id: 'protected-api',
  name: '보호된 API',
  url: 'https://api.example.com/secure',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
    'Content-Type': 'application/json',
  },
  timeout: 5000,
  enabled: true,
}
```

## 실전 예시

### 여러 마이크로서비스 모니터링

```javascript
module.exports = [
  // 사용자 서비스
  {
    id: 'user-service',
    name: '사용자 서비스',
    url: 'https://user.example.com/health',
    method: 'GET',
    timeout: 3000,
    enabled: true,
  },

  // 주문 서비스
  {
    id: 'order-service',
    name: '주문 서비스',
    url: 'https://order.example.com/health',
    method: 'GET',
    timeout: 3000,
    enabled: true,
  },

  // 결제 서비스
  {
    id: 'payment-service',
    name: '결제 서비스',
    url: 'https://payment.example.com/status',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json',
    },
    body: {
      check: 'health',
    },
    timeout: 5000,
    enabled: true,
  },

  // 알림 서비스 (임시 비활성화)
  {
    id: 'notification-service',
    name: '알림 서비스',
    url: 'https://notification.example.com/health',
    method: 'GET',
    timeout: 3000,
    enabled: false,  // 점검 중이므로 비활성화
  },
];
```

### 외부 서드파티 API 모니터링

```javascript
module.exports = [
  // 결제 게이트웨이
  {
    id: 'payment-gateway',
    name: '결제 게이트웨이',
    url: 'https://api.paymentgateway.com/status',
    method: 'GET',
    headers: {
      'X-API-Key': 'your-api-key',
    },
    timeout: 10000,  // 외부 API는 타임아웃을 길게
    enabled: true,
  },

  // SMS 서비스
  {
    id: 'sms-provider',
    name: 'SMS 발송 서비스',
    url: 'https://api.smsprovider.com/health',
    method: 'GET',
    headers: {
      'Authorization': 'Basic YOUR_CREDENTIALS',
    },
    timeout: 8000,
    enabled: true,
  },

  // 이메일 서비스
  {
    id: 'email-service',
    name: '이메일 서비스',
    url: 'https://api.mailservice.com/v1/status',
    method: 'GET',
    headers: {
      'X-API-Token': 'your-token',
    },
    timeout: 8000,
    enabled: true,
  },
];
```

## API 추가/제거하기

### 새 API 추가

1. `apis.config.js` 파일 열기
2. 배열에 새 객체 추가
3. 저장
4. PM2 재시작: `pm2 restart slack-monitor`

```javascript
module.exports = [
  // 기존 API들...

  // 새로운 API 추가
  {
    id: 'new-api',
    name: '새로운 API',
    url: 'https://newapi.example.com/health',
    method: 'GET',
    enabled: true,
  },
];
```

### API 임시 비활성화

재시작 없이 특정 API만 비활성화:

```javascript
{
  id: 'maintenance-api',
  name: '점검 중인 API',
  url: 'https://maintenance.example.com/health',
  method: 'GET',
  enabled: false,  // 이 줄만 수정
}
```

### API 완전 제거

배열에서 해당 객체 전체를 삭제하거나 주석 처리:

```javascript
module.exports = [
  // 이 API는 제거됨
  /*
  {
    id: 'old-api',
    name: '구버전 API',
    url: 'https://old.example.com/health',
    method: 'GET',
    enabled: true,
  },
  */
];
```

## 동적 설정 (고급)

환경에 따라 다른 API 목록을 사용하려면:

```javascript
const isProduction = process.env.NODE_ENV === 'production';

const productionApis = [
  // 프로덕션 API들...
];

const developmentApis = [
  // 개발 환경 API들...
];

module.exports = isProduction ? productionApis : developmentApis;
```

## 주의사항

⚠️ **보안**
- API 토큰이나 인증 정보는 가급적 환경 변수로 관리하세요
- 예: `headers: { 'Authorization': process.env.API_TOKEN }`

⚠️ **타임아웃**
- 외부 API는 타임아웃을 충분히 길게 설정 (8000-10000ms)
- 내부 API는 짧게 설정 (3000-5000ms)

⚠️ **요청 빈도**
- `CHECK_INTERVAL`을 너무 짧게 설정하면 API 서버에 부담
- 권장: 60000ms (1분) 이상

## 테스트

설정 파일 문법 확인:

```bash
node -e "const apis = require('./apis.config'); console.log('✓ OK:', apis.length, 'APIs');"
```

특정 API만 테스트:

```bash
# index.js를 잠시 실행하여 확인
node index.js
# Ctrl+C로 중단
```
