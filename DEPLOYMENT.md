# 배포 가이드

오라클 서버에 Slack Monitor를 배포하는 방법입니다.

## 방법 1: 수동 배포 (추천 - 간단함)

### 1. 오라클 서버 초기 설정

```bash
# 서버에 SSH 접속
ssh user@oracle-server

# 프로젝트 디렉토리로 이동 (또는 생성)
mkdir -p ~/slack-monitor
cd ~/slack-monitor

# Git 저장소 클론
git clone https://github.com/haeseoky/slack-monitor.git .

# 의존성 설치
npm install

# .env 파일 생성
cp .env.example .env
nano .env  # 또는 vi .env
# ↑ Slack Webhook URL 등 설정

# PM2 전역 설치 (없는 경우)
npm install -g pm2

# 초기 실행
pm2 start ecosystem.config.js

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save
```

### 2. 코드 업데이트 시 배포

GitHub에 푸시한 후, 서버에서 실행:

```bash
cd ~/slack-monitor
./deploy.sh
```

**deploy.sh가 자동으로**:
- ✅ Git pull로 최신 코드 가져오기
- ✅ npm install로 패키지 업데이트
- ✅ PM2 완전 재시작 (캐시 초기화)
- ✅ 상태 확인

**⚠️ 중요**:
- `deploy.sh`는 `pm2 delete` + `pm2 start`를 사용합니다
- Node.js 모듈 캐시를 완전히 초기화합니다
- `apis.config.js` 같은 설정 파일 변경사항이 확실히 반영됩니다
- 단순히 `pm2 restart`만 하면 변경사항이 반영되지 않을 수 있습니다

**문제 발생 시**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) 참고

---

## 방법 2: GitHub Actions 자동 배포 (고급)

GitHub에 푸시하면 자동으로 서버에 배포됩니다.

### ⚠️ 현재 상태: SSH 인증 실패

GitHub Actions가 다음 에러로 실패했습니다:
```
ssh: handshake failed: ssh: unable to authenticate
```

**원인**: GitHub Secrets가 설정되지 않았습니다.

### 해결 방법

**상세 설정 가이드**: [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) 참고

#### 빠른 설정:

**1. 서버에서 SSH 키 생성**
```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key -N ""
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**2. GitHub Secrets 등록**

GitHub 저장소 → Settings → Secrets and variables → Actions

| Secret 이름 | 값 | 필수 |
|-------------|-----|------|
| `ORACLE_HOST` | 서버 IP (예: 132.145.67.89) | ✅ |
| `ORACLE_USERNAME` | SSH 사용자명 (예: ubuntu) | ✅ |
| `ORACLE_SSH_KEY` | `cat ~/.ssh/github_actions_key` 출력 내용 전체 | ✅ |
| `ORACLE_PORT` | SSH 포트 (기본값: 22) | ❌ |
| `DEPLOY_PATH` | 배포 경로 (기본값: ~/slack-monitor) | ❌ |

**3. 서버 초기 설정 (1회만)**
```bash
cd ~
git clone https://github.com/haeseoky/slack-monitor.git
cd slack-monitor
npm install
cp .env.example .env
nano .env  # Webhook URL 설정
pm2 start ecosystem.config.js
```

**4. 자동 배포 테스트**
```bash
git push origin main
```

GitHub Actions 탭에서 배포 진행 상황을 확인할 수 있습니다.

### 자동 배포 동작 방식

- `main` 브랜치에 푸시 시 자동 실행
- `.md` 파일만 변경된 경우는 배포 안함 (문서 업데이트)
- SSH로 서버 접속 → `./deploy.sh` 실행
- 배포 성공/실패 상태를 Actions 탭에서 확인

### 수동 실행

GitHub → Actions → Deploy to Oracle Server → Run workflow

---

## 방법 3: Cron을 이용한 주기적 업데이트

서버가 주기적으로 GitHub를 확인하고 자동 업데이트:

```bash
# crontab 편집
crontab -e

# 매 시간마다 업데이트 확인 (필요 시)
0 * * * * cd ~/slack-monitor && git pull origin main && ./deploy.sh > /dev/null 2>&1
```

---

## 배포 후 확인

```bash
# PM2 상태 확인
pm2 status

# 로그 확인
pm2 logs slack-monitor

# 실시간 로그 보기
pm2 logs slack-monitor --lines 50

# 프로세스 재시작
pm2 restart slack-monitor

# 프로세스 중지
pm2 stop slack-monitor

# 프로세스 삭제
pm2 delete slack-monitor
```

---

## 트러블슈팅

### .env 파일이 없다는 에러
```bash
cp .env.example .env
nano .env  # 설정 입력
```

### PM2가 없다는 에러
```bash
npm install -g pm2
```

### 포트가 이미 사용 중
```bash
pm2 list  # 실행 중인 프로세스 확인
pm2 delete 기존프로세스명
```

### Git pull 충돌
```bash
git stash  # 로컬 변경사항 임시 저장
git pull origin main
```

---

## 권장 배포 플로우

**개발 → 테스트 → 배포**

1. 로컬에서 코드 수정
2. GitHub에 푸시
3. 서버에서 `./deploy.sh` 실행 (또는 자동 배포)
4. PM2 로그로 정상 작동 확인

---

## 보안 주의사항

⚠️ **중요**: `.env` 파일은 절대 Git에 커밋하지 마세요!
- `.gitignore`에 `.env`가 포함되어 있는지 확인
- 서버에서만 `.env` 파일 생성 및 관리
- Slack Webhook URL 등 민감 정보는 환경 변수로만 관리
