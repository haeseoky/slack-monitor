#!/bin/bash

# 배포 스크립트
# 사용법: ./deploy.sh

set -e  # 에러 발생 시 스크립트 중단

echo "========================================="
echo "Slack Monitor 배포 시작"
echo "========================================="

# 1. Git Pull
echo "📥 최신 코드 가져오기..."
git pull origin main

# 2. 의존성 설치
echo "📦 npm 패키지 설치..."
npm install --production

# 3. .env 파일 확인
if [ ! -f .env ]; then
    echo "⚠️  경고: .env 파일이 없습니다!"
    echo "📝 .env.example을 참고하여 .env 파일을 생성하세요."
    exit 1
fi

# 4. PM2로 재시작
echo "🔄 PM2 프로세스 재시작..."
if pm2 list | grep -q "slack-monitor"; then
    echo "기존 프로세스 삭제 및 재시작..."
    # 완전히 삭제한 후 재시작 (캐시 초기화)
    pm2 delete slack-monitor
    pm2 start ecosystem.config.js
else
    echo "새 프로세스 시작..."
    pm2 start ecosystem.config.js
fi

# 5. PM2 저장 (부팅 시 자동 시작)
pm2 save

echo ""
echo "========================================="
echo "✅ 배포 완료!"
echo "========================================="
echo ""
echo "📊 현재 상태 확인:"
pm2 status slack-monitor
echo ""
echo "📝 로그 확인: pm2 logs slack-monitor"
echo "🛑 중지: pm2 stop slack-monitor"
echo "🔄 재시작: pm2 restart slack-monitor"
