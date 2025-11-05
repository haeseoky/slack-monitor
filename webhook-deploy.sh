#!/bin/bash

# GitHub Webhook을 통한 자동 배포 스크립트
# 사용법: webhook-deploy.sh [secret_token]

SECRET_TOKEN="${1:-your_secret_token_here}"
PORT="${2:-9000}"

echo "========================================="
echo "Webhook 배포 서버 시작"
echo "포트: $PORT"
echo "========================================="

# webhook 서버 실행 (간단한 구현)
while true; do
    # HTTP 요청 대기
    echo "Webhook 요청 대기 중..."

    # 실제 구현을 위해서는 webhook 서버가 필요합니다
    # 아래는 수동 배포를 위한 루프입니다

    sleep 300  # 5분마다 체크 (실제로는 webhook 이벤트로 트리거)
done
