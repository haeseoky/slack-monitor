# 긴급 수정: MODULE_NOT_FOUND 에러

## 문제
```
Error: Cannot find module '/home/ubuntu/slack-monitor/slack-monitor.js'
```

## 원인
- PM2가 이전 설정 (slack-monitor.js)을 저장하고 있음
- 새 코드는 index.js를 사용
- PM2 저장된 설정이 업데이트되지 않음

## 즉시 해결 (서버에서 실행)

### 방법 1: PM2 완전 초기화 (가장 확실)

```bash
cd /home/ubuntu/slack-monitor

# 1. 모든 PM2 프로세스 삭제
pm2 delete all

# 2. PM2 저장된 설정 삭제
pm2 kill
pm2 resurrect

# 3. 최신 코드 받기
git pull origin main

# 4. 새로 시작
pm2 start ecosystem.config.js

# 5. 저장
pm2 save

# 6. 확인
pm2 logs slack-monitor
```

### 방법 2: 빠른 수정

```bash
cd /home/ubuntu/slack-monitor

# PM2 프로세스 삭제 및 재시작
pm2 delete slack-monitor 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

# 로그 확인
pm2 logs slack-monitor --lines 20
```

### 방법 3: 수동 확인 및 수정

```bash
cd /home/ubuntu/slack-monitor

# 1. 파일 확인
ls -la index.js
ls -la ecosystem.config.js

# 2. ecosystem.config.js 내용 확인
cat ecosystem.config.js | grep script

# 출력 확인: script: './index.js' 여야 함
# 만약 './slack-monitor.js'면 파일이 업데이트 안된 것

# 3. Git 상태 확인
git status
git log -1

# 4. 최신 코드로 업데이트
git fetch origin
git reset --hard origin/main

# 5. PM2 재시작
pm2 delete slack-monitor
pm2 start ecosystem.config.js
pm2 save
```

## 확인 사항

### 1. ecosystem.config.js가 올바른지 확인
```bash
cat ecosystem.config.js | grep script
```

**올바른 출력**:
```
script: './index.js',
```

**잘못된 출력**:
```
script: './slack-monitor.js',
```

### 2. index.js 파일이 있는지 확인
```bash
ls -la index.js
```

파일이 없으면:
```bash
git pull origin main
```

### 3. PM2 프로세스 상태 확인
```bash
pm2 list
pm2 describe slack-monitor
```

## 완전한 재설정 (모든 방법이 실패한 경우)

```bash
cd /home/ubuntu/slack-monitor

# 1. PM2 완전 중지 및 삭제
pm2 kill

# 2. Git 완전 리셋
git fetch origin
git reset --hard origin/main
git clean -fd

# 3. 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 4. .env 확인 (백업되어 있어야 함)
ls -la .env

# .env가 없으면 재생성
cp .env.example .env
nano .env  # Webhook URL 등 설정

# 5. PM2 재시작
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 부팅 시 자동 시작

# 6. 로그 확인
pm2 logs slack-monitor
```

## 예방 방법

앞으로는 deploy.sh를 사용하세요:

```bash
cd /home/ubuntu/slack-monitor
./deploy.sh
```

deploy.sh가 자동으로:
- Git pull
- npm install
- PM2 delete + start (완전 재시작)
- 상태 확인

## 빠른 복구 명령어 (한 줄)

```bash
cd /home/ubuntu/slack-monitor && pm2 delete all && git pull origin main && pm2 start ecosystem.config.js && pm2 save && pm2 logs slack-monitor
```

## 도움이 필요하면

1. 서버 로그 전체 복사:
   ```bash
   pm2 logs slack-monitor --lines 50
   ```

2. Git 상태 확인:
   ```bash
   git status
   git log --oneline -5
   ```

3. 파일 목록 확인:
   ```bash
   ls -la | grep -E "index.js|slack-monitor.js|ecosystem"
   ```
