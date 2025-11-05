#!/usr/bin/env node

/**
 * Slack Monitor - API 모니터링 애플리케이션
 * 여러 API를 모니터링하고 결과를 Slack으로 전송합니다.
 */

const { config, validateConfig } = require('./src/config');
const { startMonitoring, setupGracefulShutdown } = require('./src/services/monitoringService');
const apiConfigs = require('./apis.config');
const logger = require('./src/utils/logger');

/**
 * 애플리케이션 초기화
 */
function initialize() {
  // 설정 유효성 검증
  const validation = validateConfig();

  if (!validation.isValid) {
    logger.error('설정 오류:');
    validation.errors.forEach((error) => logger.error(`  - ${error}`));
    process.exit(1);
  }

  // Graceful shutdown 설정
  setupGracefulShutdown();
}

/**
 * 애플리케이션 시작
 */
async function main() {
  try {
    initialize();
    await startMonitoring(apiConfigs);
  } catch (error) {
    logger.error('애플리케이션 시작 실패', error);
    process.exit(1);
  }
}

// 애플리케이션 실행
main();
