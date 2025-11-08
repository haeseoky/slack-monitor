# 프로젝트 구조

Slack Monitor는 클린 코드 원칙에 따라 모듈화된 구조로 설계되었습니다.

## 디렉토리 구조

```
slack-monitor/
├── index.js                      # 진입점 (메인 애플리케이션)
├── apis.config.js                # API 설정
├── ecosystem.config.js           # PM2 설정
├── .env                          # 환경 변수
├── src/
│   ├── config/
│   │   └── index.js             # 설정 관리
│   ├── services/
│   │   ├── apiChecker.js        # API 체크 로직
│   │   ├── slackNotifier.js     # Slack 알림 로직
│   │   └── monitoringService.js # 모니터링 오케스트레이션
│   └── utils/
│       └── logger.js            # 로깅 유틸리티
```

## 모듈 설명

### `index.js` - 애플리케이션 진입점
- 설정 초기화 및 검증
- 모니터링 서비스 시작
- Graceful shutdown 처리

### `src/config/index.js` - 설정 관리
- 환경 변수 로드 및 파싱
- 기본값 적용
- 설정 유효성 검증

### `src/utils/logger.js` - 로깅 유틸리티
- 일관된 로그 포맷
- 로그 레벨 (INFO, SUCCESS, WARNING, ERROR)
- 타임스탬프 및 아이콘 자동 추가

### `src/services/apiChecker.js` - API 체크 서비스
**책임**: API 상태 확인 및 응답 시간 측정

**주요 기능**:
- HTTP 요청 설정 생성
- 단일/다중 API 병렬 체크
- 응답 시간 측정 및 임계값 비교
- 결과 통계 계산

**주요 함수**:
- `checkApi(apiConfig)` - 단일 API 체크
- `checkApis(apiConfigs)` - 여러 API 병렬 체크
- `calculateStats(results)` - 결과 통계 계산

### `src/services/slackNotifier.js` - Slack 알림 서비스
**책임**: 체크 결과를 Slack으로 전송

**주요 기능**:
- 개별 알림 생성
- 요약 알림 생성
- 알림 색상 및 이모지 결정
- 상세 필드 생성

**주요 함수**:
- `notify(results)` - 알림 전송 (요약/개별 자동 선택)
- `sendSummaryNotification(results)` - 요약 알림
- `sendIndividualNotification(result)` - 개별 알림

### `src/services/monitoringService.js` - 모니터링 서비스
**책임**: API 체크와 알림을 조율

**주요 기능**:
- 주기적 체크 스케줄링
- 체크 결과 로깅
- 모니터링 시작/종료 관리

**주요 함수**:
- `startMonitoring(apiConfigs)` - 모니터링 시작
- `checkAndNotify(apiConfigs)` - 체크 및 알림 실행
- `setupGracefulShutdown()` - 종료 처리 설정

## 클린 코드 원칙 적용

### 1. 단일 책임 원칙 (SRP)
- 각 모듈은 하나의 명확한 책임을 가짐
- `apiChecker`: API 체크만
- `slackNotifier`: Slack 알림만
- `monitoringService`: 조율만

### 2. 개방-폐쇄 원칙 (OCP)
- 새로운 알림 채널 추가 시 기존 코드 수정 불필요
- 새로운 API 체크 로직 추가 가능

### 3. 의존성 역전 원칙 (DIP)
- 서비스들은 config 모듈에 의존
- 구체적인 구현이 아닌 인터페이스에 의존

### 4. 함수 작게, 명확하게
- 각 함수는 한 가지 일만 수행
- 함수명으로 동작을 명확히 표현
- 평균 함수 길이: 10-30줄

### 5. 의미 있는 이름
- 변수/함수명이 목적을 설명
- `createRequestConfig()` - 무엇을 하는지 명확
- `isSlowResponse()` - boolean 반환 명확

### 6. 주석보다 코드로 설명
- JSDoc으로 모듈 설명
- 코드 자체가 self-documenting
- 복잡한 로직에만 주석 추가

## 데이터 흐름

```
1. index.js
   ↓ (초기화)
2. config 로드
   ↓
3. monitoringService.startMonitoring()
   ↓
4. apiChecker.checkApis()
   ↓ (결과)
5. slackNotifier.notify()
   ↓
6. Slack으로 알림 전송
```

## 확장 가능성

### 새로운 알림 채널 추가
1. `src/services/` 에 새 알림 서비스 추가
2. `monitoringService.js` 에서 호출
3. 기존 코드 수정 최소화

### 새로운 체크 로직 추가
1. `apiChecker.js` 에 새 함수 추가
2. 기존 인터페이스 유지
3. 호환성 보장

### 데이터베이스 연동
1. `src/services/database.js` 생성
2. 결과 저장 로직 추가
3. 기존 로직과 독립적 운영

## 테스트 가능성

각 모듈이 독립적이어서 단위 테스트 작성 용이:

```javascript
// 예시: apiChecker 테스트
const { checkApi } = require('./src/services/apiChecker');

test('API 체크 성공', async () => {
  const result = await checkApi(mockApiConfig);
  expect(result.status).toBe('success');
});
```

## 유지보수 가이드

### 설정 변경
- `src/config/index.js` 수정

### 로그 포맷 변경
- `src/utils/logger.js` 수정

### API 체크 로직 수정
- `src/services/apiChecker.js` 수정

### Slack 메시지 포맷 변경
- `src/services/slackNotifier.js` 수정

## 성능 고려사항

- **병렬 처리**: `Promise.all`로 API 동시 체크
- **비동기 I/O**: 모든 네트워크 작업 비동기 처리
- **메모리 효율**: 대용량 데이터 스트리밍 미사용 (API 응답 작음)
- **에러 격리**: 한 API 실패가 다른 API 체크에 영향 없음
