#!/usr/bin/env node

/**
 * Slack Monitor - API 모니터링 애플리케이션
 * 여러 API를 모니터링하고 결과를 Slack으로 전송합니다.
 */

const { config, validateConfig } = require('./src/config');
const { startMonitoring, setupGracefulShutdown } = require('./src/services/monitoringService');
const { startPpomppuMonitoring, stopPpomppuMonitoring } = require('./src/services/ppomppuMonitor');
const { startAllSearchMonitoring, stopAllSearchMonitoring } = require('./src/services/ppomppuSearchMonitor');
const apiConfigs = require('./apis.config');
const ppomppuSearchConfigs = require('./ppomppu-search.config');
const logger = require('./src/utils/logger');

// 모니터링 인스턴스 저장
let ppomppuIntervalId = null;

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

    // API 모니터링 시작
    await startMonitoring(apiConfigs);

    // 뽐뿌 모니터링 시작 (활성화된 경우)
    if (config.ppomppu.enabled) {
      ppomppuIntervalId = startPpomppuMonitoring(config.ppomppu.checkInterval);
    } else {
      logger.info('뽐뿌 모니터링이 비활성화되어 있습니다');
    }

    // 뽐뿌 검색 모니터링 시작
    startAllSearchMonitoring(ppomppuSearchConfigs);

    // Graceful shutdown에 뽐뿌 관련 모니터링 중지 추가
    const originalHandlers = process.listeners('SIGTERM').concat(process.listeners('SIGINT'));
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');

    const shutdownHandler = () => {
      logger.info('종료 신호 수신. 뽐뿌 모니터링을 정리합니다...');

      // 뽐뿌 게시판 모니터링 중지
      if (ppomppuIntervalId) {
        stopPpomppuMonitoring(ppomppuIntervalId);
      }

      // 뽐뿌 검색 모니터링 중지
      stopAllSearchMonitoring();

      // 기존 핸들러 실행
      originalHandlers.forEach((handler) => handler());
    };

    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
  } catch (error) {
    logger.error('애플리케이션 시작 실패', error);
    process.exit(1);
  }
}

// 애플리케이션 실행
main();
