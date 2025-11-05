# PM2 초기화 가이드

PM2를 완전히 초기화하고 깨끗한 상태로 재시작하는 방법입니다.

## 🔥 완전 초기화 (권장)

모든 PM2 프로세스와 캐시를 완전히 제거합니다.

```bash
# 1. 모든 PM2 프로세스 삭제
pm2 delete all

# 2. PM2 데몬 종료 (모든 저장된 상태 초기화)
pm2 kill

# 3. 저장된 프로세스 목록 확인 (비어있어야 함)
pm2 list

# 4. 저장된 설정 파일 삭제 (선택사항)
rm -f ~/.pm2/dump.pm2
```

## 📋 단계별 상세 설명

### 1단계: 실행 중인 프로세스 확인

```bash
pm2 list
```

**출력 예시**:
```
┌─────┬──────────────────┬─────────┬─────────┬──────────┐
│ id  │ name            │ status  │ restart │ uptime   │
├─────┼──────────────────┼─────────┼─────────┼──────────┤
│ 0   │ slack-monitor   │ online  │ 15      │ 2h       │
└─────┴──────────────────┴─────────┴─────────┴──────────┘
```

### 2단계: 특정 프로세스 삭제

```bash
# 이름으로 삭제
pm2 delete slack-monitor

# ID로 삭제
pm2 delete 0

# 모든 프로세스 삭제
pm2 delete all
```

### 3단계: PM2 데몬 완전 종료

```bash
pm2 kill
```

이 명령어는:
- 모든 PM2 프로세스 종료
- PM2 데몬 자체 종료
- 메모리에 있는 모든 캐시 삭제
- 저장된 프로세스 목록 유지 (dump.pm2)

### 4단계: 저장된 설정 초기화 (선택사항)

```bash
# 저장된 프로세스 목록 파일 삭제
rm -f ~/.pm2/dump.pm2

# 또는 PM2 홈 디렉토리 전체 삭제 (완전 리셋)
rm -rf ~/.pm2
```

⚠️ **주의**: `~/.pm2` 전체 삭제 시 로그 파일도 삭제됩니다!

---

## 🚀 초기화 후 재시작

### 방법 1: ecosystem.config.js 사용 (권장)

```bash
cd ~/slack-monitor
pm2 start ecosystem.config.js
pm2 save
```

### 방법 2: 직접 실행

```bash
cd ~/slack-monitor
pm2 start index.js --name slack-monitor
pm2 save
```

---

## 🔍 캐시 관련 이슈 해결

### Node.js 모듈 캐시 초기화

PM2만 초기화해도 안되는 경우:

```bash
# 1. PM2 완전 종료
pm2 kill

# 2. Node.js 캐시 초기화 (npm 캐시)
npm cache clean --force

# 3. node_modules 재설치
cd ~/slack-monitor
rm -rf node_modules package-lock.json
npm install

# 4. PM2 재시작
pm2 start ecosystem.config.js
pm2 save
```

### PM2 로그 캐시 정리

```bash
# 모든 로그 삭제
pm2 flush

# 또는 로그 파일 직접 삭제
rm -f ~/.pm2/logs/*
```

---

## 📝 자주 사용하는 PM2 명령어

### 프로세스 관리

```bash
# 시작
pm2 start ecosystem.config.js

# 중지
pm2 stop slack-monitor

# 재시작
pm2 restart slack-monitor

# 삭제 (프로세스 목록에서 제거)
pm2 delete slack-monitor

# 모두 삭제
pm2 delete all
```

### 상태 확인

```bash
# 프로세스 목록
pm2 list

# 상세 정보
pm2 describe slack-monitor

# 실시간 모니터링
pm2 monit
```

### 로그 관리

```bash
# 로그 보기
pm2 logs slack-monitor

# 최근 50줄
pm2 logs slack-monitor --lines 50

# 로그 스트리밍 중지
Ctrl + C

# 모든 로그 삭제
pm2 flush
```

### 저장 및 복원

```bash
# 현재 프로세스 목록 저장
pm2 save

# 저장된 프로세스 복원
pm2 resurrect

# 부팅 시 자동 시작 설정
pm2 startup
```

---

## 🎯 시나리오별 해결법

### 시나리오 1: 설정 파일 변경 후 반영 안됨

```bash
pm2 delete slack-monitor
pm2 start ecosystem.config.js
pm2 save
```

### 시나리오 2: 계속 재시작됨 (restart 횟수 증가)

```bash
# 로그 확인
pm2 logs slack-monitor --lines 100

# 완전 초기화
pm2 kill
cd ~/slack-monitor
pm2 start ecosystem.config.js
pm2 save
```

### 시나리오 3: "already running" 에러

```bash
# 모든 프로세스 확인
pm2 list

# 중복된 프로세스 모두 삭제
pm2 delete all

# 다시 시작
pm2 start ecosystem.config.js
```

### 시나리오 4: 이전 버전 코드가 계속 실행됨

```bash
# 완전 초기화
pm2 kill

# 코드 최신화
cd ~/slack-monitor
git pull origin main

# 캐시 초기화
rm -rf node_modules
npm install

# 재시작
pm2 start ecosystem.config.js
pm2 save
```

---

## 🛠️ 완전 리셋 스크립트

모든 것을 처음부터 다시 시작:

```bash
#!/bin/bash
# pm2-reset.sh

echo "🔥 PM2 완전 초기화 시작..."

# PM2 완전 종료
pm2 kill

# 저장된 설정 삭제
rm -f ~/.pm2/dump.pm2

# 로그 삭제
rm -f ~/.pm2/logs/*

# 프로젝트 디렉토리로 이동
cd ~/slack-monitor

# 최신 코드 받기
git pull origin main

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# PM2 재시작
pm2 start ecosystem.config.js
pm2 save

echo "✅ 초기화 완료!"
pm2 list
```

**사용법**:
```bash
chmod +x pm2-reset.sh
./pm2-reset.sh
```

---

## ⚠️ 주의사항

### PM2 kill vs delete

| 명령어 | 동작 | 프로세스 목록 | PM2 데몬 |
|--------|------|--------------|----------|
| `pm2 delete` | 특정 프로세스 삭제 | 목록에서 제거 | 계속 실행 |
| `pm2 delete all` | 모든 프로세스 삭제 | 모두 제거 | 계속 실행 |
| `pm2 kill` | PM2 데몬 종료 | 초기화 | 종료 |

### 데이터 백업

초기화 전에 중요한 데이터 백업:

```bash
# .env 파일 백업
cp .env .env.backup

# PM2 설정 백업
cp ecosystem.config.js ecosystem.config.js.backup

# 로그 백업
cp -r ~/.pm2/logs ~/pm2-logs-backup
```

---

## 🔍 문제 진단

초기화가 필요한 증상:

- ✅ 코드 변경했는데 반영 안됨
- ✅ 계속 재시작됨 (restart 횟수 높음)
- ✅ "already running" 에러
- ✅ 로그에 이상한 에러
- ✅ 프로세스가 여러 개 보임
- ✅ PM2 명령어가 느려짐

---

## 💡 예방 팁

### 1. 배포 시 deploy.sh 사용

```bash
# ✅ 좋은 방법
./deploy.sh

# ❌ 나쁜 방법
pm2 restart slack-monitor
```

### 2. 정기적인 정리

```bash
# 주기적으로 로그 정리
pm2 flush

# 한 달에 한 번 정도 완전 초기화
pm2 kill
pm2 start ecosystem.config.js
pm2 save
```

### 3. PM2 버전 업데이트

```bash
# PM2 최신 버전으로 업데이트
npm install -g pm2@latest

# PM2 업데이트 후 프로세스 재시작
pm2 update
```

---

## 📚 참고 자료

- [PM2 공식 문서](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Process Management](https://pm2.keymetrics.io/docs/usage/process-management/)
- [PM2 Restart Strategies](https://pm2.keymetrics.io/docs/usage/restart-strategies/)

---

## 빠른 참조

```bash
# 완전 초기화
pm2 kill

# 특정 프로세스 삭제
pm2 delete slack-monitor

# 모두 삭제
pm2 delete all

# 로그 삭제
pm2 flush

# 재시작
pm2 start ecosystem.config.js && pm2 save
```
