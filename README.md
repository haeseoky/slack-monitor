# Slack Monitor

API 모니터링 도구로, 외부 API의 상태를 주기적으로 체크하고 결과를 Slack으로 전송합니다.

## 기능

- 외부 API 주기적 체크
- 응답 시간 측정
- Slack 알림 (성공/실패)
- PM2를 통한 백그라운드 실행

## 설치

```bash
npm install
```

## 설정

1. `.env.example` 파일을 복사하여 `.env` 파일을 생성하세요:
   ```bash
   cp .env.example .env
   ```

2. `.env` 파일에서 다음 환경 변수를 설정하세요:
   - `TARGET_URL`: 모니터링할 API URL
   - `SLACK_WEBHOOK_URL`: Slack Webhook URL (필수)
   - `CHECK_INTERVAL`: 체크 간격 (밀리초, 기본값: 60000)
   - `NOTIFY_ON_ERROR`: 에러 시 알림 여부 (기본값: true)
   - `NOTIFY_ON_SUCCESS`: 성공 시 알림 여부 (기본값: false)

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
