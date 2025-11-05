/**
 * 모니터링 서비스
 * API 체크와 알림 전송을 조율합니다.
 */

const { checkApis, calculateStats } = require('./apiChecker');
const { notify } = require('./slackNotifier');
const logger = require('../utils/logger');
const { config } = require('../config');

/**
 * 체크 결과 로그 출력
 */
function logCheckResults(stats) {
  logger.info(
    `체크 완료: 성공 ${stats.success}개, 실패 ${stats.error}개, 느림 ${stats.slow}개`
  );
}

/**
 * API 체크 및 알림 전송
 */
async function checkAndNotify(apiConfigs) {
  try {
    logger.separator();
    logger.info(`${apiConfigs.length}개 API 체크 시작 (${new Date().toLocaleString('ko-KR')})`);
    logger.separator();

    // API 체크
    const results = await checkApis(apiConfigs);

    // 결과 통계
    const stats = calculateStats(results);
    logCheckResults(stats);

    // 알림 전송
    await notify(results);

    return results;
  } catch (error) {
    logger.error('모니터링 실행 중 오류 발생', error);
    throw error;
  }
}

/**
 * 모니터링 시작 정보 출력
 */
function logMonitoringStart(apiConfigs) {
  const enabledApis = apiConfigs.filter((api) => api.enabled !== false);

  logger.header('🚀 API 모니터링 시작');
  logger.info(`📋 모니터링 API 개수: ${enabledApis.length}개`);

  enabledApis.forEach((api, index) => {
    logger.info(`   ${index + 1}. ${api.name} (${api.method} ${api.url})`);
  });

  logger.info(
    `⏱️  체크 간격: ${config.monitoring.checkInterval}ms (${
      config.monitoring.checkInterval / 1000
    }초)`
  );
  logger.info(`📢 알림 방식: ${config.notifications.sendSummary ? '요약' : '개별'}`);
  logger.separator();
}

/**
 * 모니터링 시작
 */
async function startMonitoring(apiConfigs) {
  const enabledApis = apiConfigs.filter((api) => api.enabled !== false);

  if (enabledApis.length === 0) {
    logger.error('활성화된 API가 없습니다. apis.config.js를 확인하세요.');
    process.exit(1);
  }

  logMonitoringStart(enabledApis);

  // 초기 체크
  await checkAndNotify(enabledApis);

  // 주기적 체크
  setInterval(async () => {
    await checkAndNotify(enabledApis);
  }, config.monitoring.checkInterval);
}

/**
 * 모니터링 종료 처리
 */
function setupGracefulShutdown() {
  process.on('SIGINT', () => {
    logger.info('👋 모니터링 종료');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('👋 모니터링 종료');
    process.exit(0);
  });
}

module.exports = {
  startMonitoring,
  checkAndNotify,
  setupGracefulShutdown,
};
