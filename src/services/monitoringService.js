/**
 * 모니터링 서비스
 * API 체크와 알림 전송을 조율합니다.
 */

const { checkApi, checkApis, calculateStats } = require('./apiChecker');
const { notify, sendIndividualNotification } = require('./slackNotifier');
const logger = require('../utils/logger');
const { config } = require('../config');

// API별 타이머 저장
const apiTimers = new Map();

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
    const interval = api.checkInterval || config.monitoring.checkInterval;
    const threshold = api.responseTimeThreshold || config.monitoring.responseTimeThreshold;
    logger.info(
      `   ${index + 1}. ${api.name} (${api.method} ${api.url}) - 체크: ${interval / 1000}초, 임계값: ${threshold}ms`
    );
  });

  logger.info(`📢 알림 방식: ${config.notifications.sendSummary ? '요약' : '개별'}`);
  logger.separator();
}

/**
 * 단일 API 체크 및 알림
 */
async function checkAndNotifySingleApi(apiConfig) {
  try {
    const result = await checkApi(apiConfig);

    // 개별 알림 또는 결과 저장
    if (!config.notifications.sendSummary) {
      await sendIndividualNotification(result);
    }

    return result;
  } catch (error) {
    logger.error(`[${apiConfig.name}] 모니터링 실행 중 오류 발생`, error);
    return null;
  }
}

/**
 * 모니터링 시작
 */
async function startMonitoring(apiConfigs) {
  const enabledApis = apiConfigs.filter((api) => api.enabled !== false);

  if (enabledApis.length === 0) {
    logger.warn('활성화된 API가 없습니다. API 모니터링을 건너뜁니다.');
    return;
  }

  logMonitoringStart(enabledApis);

  // 요약 알림 사용 시 전체 API를 함께 체크
  if (config.notifications.sendSummary) {
    // 초기 체크
    await checkAndNotify(enabledApis);

    // 주기적 체크 (최소 checkInterval 사용)
    const intervals = enabledApis.map(api => api.checkInterval || config.monitoring.checkInterval);
    const minInterval = Math.min(...intervals);

    setInterval(async () => {
      await checkAndNotify(enabledApis);
    }, minInterval);
  } else {
    // 개별 알림 사용 시 API별로 독립적인 타이머 생성
    enabledApis.forEach(async (apiConfig) => {
      const interval = apiConfig.checkInterval || config.monitoring.checkInterval;

      // 초기 체크
      await checkAndNotifySingleApi(apiConfig);

      // 주기적 체크
      const timerId = setInterval(async () => {
        await checkAndNotifySingleApi(apiConfig);
      }, interval);

      apiTimers.set(apiConfig.id, timerId);
      logger.info(`[${apiConfig.name}] 모니터링 타이머 시작 (간격: ${interval / 1000}초)`);
    });
  }
}

/**
 * 모니터링 종료 처리
 */
function setupGracefulShutdown() {
  const shutdown = () => {
    logger.info('👋 모니터링 종료');

    // 모든 API 타이머 정리
    if (apiTimers.size > 0) {
      logger.info('타이머 정리 중...');
      apiTimers.forEach((timerId, apiId) => {
        clearInterval(timerId);
        logger.info(`[${apiId}] 타이머 종료`);
      });
      apiTimers.clear();
    }

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  startMonitoring,
  checkAndNotify,
  setupGracefulShutdown,
};
