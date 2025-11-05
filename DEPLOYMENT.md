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
- ✅ PM2 재시작
- ✅ 상태 확인

---

## 방법 2: GitHub Actions 자동 배포 (고급)

GitHub에 푸시하면 자동으로 서버에 배포됩니다.

### 1. GitHub Secrets 설정

GitHub 저장소 → Settings → Secrets and variables → Actions

다음 Secrets 추가:
- `ORACLE_HOST`: 서버 IP 또는 도메인
- `ORACLE_USERNAME`: SSH 사용자명
- `ORACLE_SSH_KEY`: SSH 개인키 (private key)
- `ORACLE_PORT`: SSH 포트 (기본값: 22)
- `DEPLOY_PATH`: 배포 경로 (예: `/home/user/slack-monitor`)

### 2. SSH 키 생성 (서버에서)

```bash
# 서버에서 SSH 키 생성
ssh-keygen -t ed25519 -C "github-actions"

# 공개키를 authorized_keys에 추가
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys

# 개인키 출력 (GitHub Secrets에 등록)
cat ~/.ssh/id_ed25519
```

### 3. 자동 배포 테스트

```bash
git add .
git commit -m "Test auto deployment"
git push origin main
```

GitHub Actions 탭에서 배포 진행 상황 확인 가능합니다.

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
