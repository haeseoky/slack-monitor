# 트러블슈팅 가이드

## 배포 후 변경사항이 반영되지 않는 문제

### 문제 증상
- `apis.config.js`에서 API name을 변경했는데 반영되지 않음
- 코드를 수정했는데 이전 코드가 계속 실행됨
- 배포는 성공했지만 로그에 변경사항이 보이지 않음

### 원인

**Node.js 모듈 캐싱**

Node.js는 `require()`로 로드된 모듈을 메모리에 캐시합니다:

```javascript
// 첫 번째 require - 파일을 읽고 캐시에 저장
const config = require('./apis.config.js');

// 두 번째 require - 캐시에서 가져옴 (파일을 다시 읽지 않음)
const config2 = require('./apis.config.js');
```

**PM2 restart의 한계**

`pm2 restart`는 경우에 따라:
- 프로세스를 완전히 종료하지 않고 재시작
- Node.js 모듈 캐시가 남아있을 수 있음
- 특히 `require()`로 로드된 설정 파일

### 해결 방법

#### 1. 완전한 재시작 (권장) ✅

배포 스크립트가 이제 자동으로 처리합니다:

```bash
cd ~/slack-monitor
./deploy.sh
```

**내부 동작**:
```bash
pm2 delete slack-monitor  # 완전히 삭제
pm2 start ecosystem.config.js  # 새로 시작
```

#### 2. 수동 완전 재시작

배포 스크립트를 사용하지 않는 경우:

```bash
# 방법 1: delete + start
pm2 delete slack-monitor
pm2 start ecosystem.config.js

# 방법 2: stop + delete + start
pm2 stop slack-monitor
pm2 delete slack-monitor
pm2 start ecosystem.config.js
```

#### 3. 변경사항 확인

```bash
# 서버에서 파일 내용 확인
cat apis.config.js | grep "name:"

# 또는
grep -A 1 "id:" apis.config.js
```

### PM2 명령어 비교

| 명령어 | 동작 | 캐시 | 추천 |
|--------|------|------|------|
| `pm2 restart` | 프로세스 재시작 | 남을 수 있음 | ❌ |
| `pm2 reload` | 무중단 재시작 | 남을 수 있음 | ❌ |
| `pm2 delete + start` | 완전 삭제 후 시작 | 완전 초기화 | ✅ |

---

## 기타 일반적인 문제

### 문제 1: .env 변경이 반영되지 않음

**원인**: `.env` 파일은 애플리케이션 시작 시 한 번만 로드됩니다.

**해결**:
```bash
pm2 delete slack-monitor
pm2 start ecosystem.config.js
```

### 문제 2: Git pull 후에도 이전 코드 실행

**원인 1**: Git pull이 실패했을 수 있음

**확인**:
```bash
cd ~/slack-monitor
git status
git log -1  # 최신 커밋 확인
```

**원인 2**: PM2가 재시작되지 않음

**해결**:
```bash
./deploy.sh  # 배포 스크립트 다시 실행
```

### 문제 3: PM2 로그에 에러가 보이지 않음

**확인 방법**:
```bash
# 실시간 로그
pm2 logs slack-monitor

# 최근 로그 (50줄)
pm2 logs slack-monitor --lines 50

# 에러 로그만
pm2 logs slack-monitor --err

# 로그 파일 직접 확인
cat logs/err.log
cat logs/out.log
```

### 문제 4: "EADDRINUSE" 포트 이미 사용 중

**원인**: 이전 프로세스가 남아있음

**해결**:
```bash
# PM2 프로세스 확인
pm2 list

# 모든 slack-monitor 프로세스 종료
pm2 delete all

# 또는 포트를 사용하는 프로세스 찾기
lsof -i :3000  # 포트 번호 확인
kill -9 <PID>  # 프로세스 강제 종료
```

### 문제 5: npm install 실패

**원인**: 권한 문제 또는 디스크 공간 부족

**해결**:
```bash
# 캐시 삭제
npm cache clean --force

# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install

# 디스크 공간 확인
df -h
```

---

## 디버깅 체크리스트

배포 후 문제가 있을 때 다음을 순서대로 확인하세요:

### 1단계: 파일 확인
```bash
cd ~/slack-monitor
git status  # 변경사항 확인
git log -1  # 최신 커밋 확인
cat apis.config.js  # 설정 파일 내용 확인
```

### 2단계: PM2 상태 확인
```bash
pm2 list  # 프로세스 상태
pm2 describe slack-monitor  # 상세 정보
pm2 logs slack-monitor --lines 20  # 최근 로그
```

### 3단계: 완전 재시작
```bash
pm2 delete slack-monitor
pm2 start ecosystem.config.js
pm2 logs slack-monitor  # 로그 확인
```

### 4단계: 수동 실행 테스트
```bash
# PM2를 거치지 않고 직접 실행
node index.js

# Ctrl+C로 중지 후 PM2로 다시 시작
pm2 start ecosystem.config.js
```

---

## 예방 방법

### 1. 배포 스크립트 항상 사용
```bash
# ✅ 좋은 방법
./deploy.sh

# ❌ 나쁜 방법
git pull
pm2 restart slack-monitor  # 캐시 문제 발생 가능
```

### 2. 변경사항 커밋 전 로컬 테스트
```bash
# 로컬에서 테스트
node index.js

# 정상 동작 확인 후 커밋
git add .
git commit -m "..."
git push
```

### 3. 배포 후 로그 확인
```bash
./deploy.sh
pm2 logs slack-monitor --lines 10
```

---

## 빠른 해결 명령어

```bash
# 가장 확실한 방법 (99% 문제 해결)
cd ~/slack-monitor
git pull origin main
pm2 delete slack-monitor
pm2 start ecosystem.config.js
pm2 save
pm2 logs slack-monitor

# 한 줄로
cd ~/slack-monitor && git pull && pm2 delete slack-monitor && pm2 start ecosystem.config.js && pm2 logs slack-monitor
```

---

## 추가 도움말

### PM2 공식 문서
- [PM2 Restart Strategies](https://pm2.keymetrics.io/docs/usage/restart-strategies/)
- [PM2 Process Management](https://pm2.keymetrics.io/docs/usage/process-management/)

### Node.js 모듈 캐싱
- [Node.js Module Caching](https://nodejs.org/api/modules.html#modules_caching)
- [require.cache](https://nodejs.org/api/modules.html#modules_require_cache)

### 여전히 문제가 해결되지 않으면

1. 서버 재부팅 (최후의 수단)
2. Node.js 재설치
3. PM2 재설치: `npm install -g pm2`
