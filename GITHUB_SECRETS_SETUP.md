# GitHub Secrets 설정 가이드

GitHub Actions 자동 배포를 위한 Secrets 설정 방법입니다.

## 목차
1. [SSH 키 생성](#1-ssh-키-생성)
2. [GitHub Secrets 등록](#2-github-secrets-등록)
3. [배포 테스트](#3-배포-테스트)
4. [트러블슈팅](#4-트러블슈팅)

---

## 1. SSH 키 생성

### 1-1. 오라클 서버에서 SSH 키 생성

```bash
# 서버에 SSH 접속
ssh your-username@your-server-ip

# SSH 키 생성 (비밀번호 없이)
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key -N ""

# 또는 RSA 방식 (호환성이 더 좋음)
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions_key -N ""
```

### 1-2. 공개키를 authorized_keys에 추가

```bash
# 공개키 추가
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys

# 권한 설정
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 1-3. 개인키 확인

```bash
# 개인키 출력 (GitHub Secrets에 등록할 내용)
cat ~/.ssh/github_actions_key
```

**출력 예시:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
(여러 줄의 키 내용)
...
-----END OPENSSH PRIVATE KEY-----
```

⚠️ **중요**: 이 전체 내용을 복사하세요 (BEGIN부터 END까지 포함)

---

## 2. GitHub Secrets 등록

### 2-1. GitHub 저장소 페이지로 이동

1. https://github.com/haeseoky/slack-monitor
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Secrets and variables** → **Actions** 클릭

### 2-2. Secrets 추가

**New repository secret** 버튼을 클릭하여 다음 Secrets를 추가하세요:

#### 필수 Secrets:

| Name | Value | 설명 |
|------|-------|------|
| `ORACLE_HOST` | `123.45.67.89` | 서버 IP 또는 도메인 |
| `ORACLE_USERNAME` | `ubuntu` | SSH 로그인 사용자명 |
| `ORACLE_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | SSH 개인키 전체 내용 |

#### 선택 Secrets:

| Name | Value | 기본값 | 설명 |
|------|-------|--------|------|
| `ORACLE_PORT` | `22` | `22` | SSH 포트 |
| `DEPLOY_PATH` | `/home/ubuntu/slack-monitor` | `~/slack-monitor` | 배포 경로 |

### 2-3. Secrets 등록 예시

**ORACLE_HOST:**
```
132.145.67.89
```

**ORACLE_USERNAME:**
```
ubuntu
```

**ORACLE_SSH_KEY:**
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBJrL6k9XKqOWR7GvH0PqXzVl3GqBq8wYvXqzQ0gN7KkwAAAJhQ5F3zUO
... (실제 키 내용)
-----END OPENSSH PRIVATE KEY-----
```

⚠️ **주의사항:**
- 키 내용의 앞뒤 공백 제거
- `-----BEGIN` 부터 `-----END` 까지 전체 복사
- 줄바꿈이 포함되어야 함

---

## 3. 배포 테스트

### 3-1. 오라클 서버 초기 설정

Secrets 설정 전에 서버에서 한 번 수동으로 프로젝트를 클론해야 합니다:

```bash
# 서버 접속
ssh your-username@your-server-ip

# 프로젝트 클론
cd ~
git clone https://github.com/haeseoky/slack-monitor.git

# 프로젝트 디렉토리로 이동
cd slack-monitor

# 의존성 설치
npm install

# .env 파일 생성
cp .env.example .env
nano .env  # Webhook URL 등 설정

# PM2 초기 실행
pm2 start ecosystem.config.js
pm2 save
```

### 3-2. GitHub Actions 수동 실행

1. GitHub 저장소 → **Actions** 탭
2. 왼쪽에서 **Deploy to Oracle Server** 선택
3. **Run workflow** 버튼 클릭
4. **Run workflow** 확인

### 3-3. 로그 확인

- Actions 탭에서 실행 중인 워크플로우 클릭
- 각 단계의 로그 확인
- ✅ 성공 또는 ❌ 실패 확인

### 3-4. 자동 배포 테스트

```bash
# 로컬에서
git add .
git commit -m "Test auto deployment"
git push origin main
```

푸시하면 자동으로 배포가 시작됩니다! (단, .md 파일만 수정한 경우는 배포 안됨)

---

## 4. 트러블슈팅

### 문제 1: `ssh: handshake failed`

**원인**: SSH 키 인증 실패

**해결 방법:**
```bash
# 서버에서 authorized_keys 확인
cat ~/.ssh/authorized_keys

# 공개키가 없다면 추가
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys

# 권한 확인
ls -la ~/.ssh/
# authorized_keys는 600, .ssh는 700이어야 함

chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 문제 2: `Permission denied (publickey)`

**원인**: SSH 개인키가 올바르지 않음

**해결 방법:**
1. GitHub Secrets에서 `ORACLE_SSH_KEY` 재확인
2. 키 전체 내용이 복사되었는지 확인 (BEGIN~END)
3. 서버에서 키 재생성:
   ```bash
   # 기존 키 백업
   mv ~/.ssh/github_actions_key ~/.ssh/github_actions_key.old

   # 새 키 생성
   ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key -N ""

   # 공개키 추가
   cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys

   # 개인키 확인
   cat ~/.ssh/github_actions_key
   ```

### 문제 3: 배포 경로가 존재하지 않음

**에러 메시지:**
```
❌ 배포 경로가 존재하지 않습니다
```

**해결 방법:**
```bash
# 서버에서 프로젝트 클론
cd ~
git clone https://github.com/haeseoky/slack-monitor.git

# 또는 다른 경로에 클론하고 DEPLOY_PATH Secret 설정
git clone https://github.com/haeseoky/slack-monitor.git /var/www/slack-monitor
# GitHub Secrets에 DEPLOY_PATH=/var/www/slack-monitor 추가
```

### 문제 4: deploy.sh 실행 권한 없음

**해결 방법:**
```bash
# 서버에서
cd ~/slack-monitor
chmod +x deploy.sh
git add deploy.sh
git commit -m "Add execute permission to deploy.sh"
git push
```

### 문제 5: Secrets가 작동하지 않음

**확인 사항:**
1. Secrets 이름 정확히 입력했는지 확인 (대소문자 구분)
2. 저장소 Settings → Secrets and variables → Actions에서 확인
3. Secrets 값에 공백이나 특수문자가 잘못 들어갔는지 확인

---

## 5. SSH 키 테스트 (로컬에서)

Secrets 등록 전에 로컬에서 테스트:

```bash
# 서버에서 개인키 다운로드 (테스트용)
scp your-username@your-server:/home/your-username/.ssh/github_actions_key /tmp/test_key

# 권한 설정
chmod 600 /tmp/test_key

# SSH 테스트
ssh -i /tmp/test_key your-username@your-server

# 성공하면 Secrets에 등록
# 테스트 후 로컬 키 삭제
rm /tmp/test_key
```

---

## 6. 보안 권장사항

✅ **좋은 사례:**
- GitHub Actions 전용 SSH 키 사용
- 비밀번호 없는 키 생성
- 배포 후 로컬에 키 보관하지 않기

❌ **피해야 할 사례:**
- 개인 계정의 기본 SSH 키 사용
- 여러 서비스에서 동일 키 재사용
- 키를 코드 저장소에 커밋

---

## 참고 링크

- [GitHub Actions Secrets 문서](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [SSH 키 생성 가이드](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
- [appleboy/ssh-action 문서](https://github.com/appleboy/ssh-action)

---

## 요약

1. ✅ 서버에서 SSH 키 생성
2. ✅ 공개키를 authorized_keys에 추가
3. ✅ GitHub Secrets에 개인키 등록
4. ✅ 서버에 프로젝트 클론 (초기 1회)
5. ✅ GitHub Actions 워크플로우 실행
6. 🎉 자동 배포 완료!
