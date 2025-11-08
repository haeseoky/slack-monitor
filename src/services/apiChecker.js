/**
 * API 체크 서비스
 * API 상태를 확인하고 응답 시간을 측정합니다.
 */

const axios = require('axios');
const logger = require('../utils/logger');
const { config } = require('../config');

const API_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
};

/**
 * HTTP 요청 설정 생성
 */
function createRequestConfig(apiConfig) {
  const requestConfig = {
    method: apiConfig.method || 'GET',
    url: apiConfig.url,
    headers: apiConfig.headers || {},
    timeout: apiConfig.timeout || 5000,
  };

  // POST/PUT/PATCH 메서드인 경우 body 추가
  const methodsWithBody = ['POST', 'PUT', 'PATCH'];
  if (methodsWithBody.includes(requestConfig.method.toUpperCase())) {
    requestConfig.data = apiConfig.body || {};
  }

  return requestConfig;
}

/**
 * 응답 시간이 느린지 확인
 */
function isSlowResponse(responseTime) {
  return responseTime > config.monitoring.responseTimeThreshold;
}

/**
 * 성공 결과 생성
 */
function createSuccessResult(apiConfig, responseTime, statusCode) {
  const isSlow = isSlowResponse(responseTime);
  const slowWarning = isSlow
    ? ` ⚠️ 느림 (임계값: ${config.monitoring.responseTimeThreshold}ms)`
    : '';

  logger.success(`[${apiConfig.name}] 체크 성공 - 응답시간: ${responseTime}ms${slowWarning}`);

  return {
    apiId: apiConfig.id,
    apiName: apiConfig.name,
    url: apiConfig.url,
    method: apiConfig.method,
    status: API_STATUS.SUCCESS,
    statusCode,
    responseTime,
    responseTimeStr: `${responseTime}ms`,
    isSlow,
    channel: apiConfig.channel, // 채널 정보 추가
    timestamp: new Date().toISOString(),
  };
}

/**
 * 실패 결과 생성
 */
function createErrorResult(apiConfig, error) {
  logger.error(`[${apiConfig.name}] 체크 실패`, error);

  return {
    apiId: apiConfig.id,
    apiName: apiConfig.name,
    url: apiConfig.url,
    method: apiConfig.method,
    status: API_STATUS.ERROR,
    error: error.message,
    statusCode: error.response?.status || 'N/A',
    channel: apiConfig.channel, // 채널 정보 추가
    timestamp: new Date().toISOString(),
  };
}

/**
 * 단일 API 체크
 */
async function checkApi(apiConfig) {
  const startTime = Date.now();

  try {
    const requestConfig = createRequestConfig(apiConfig);
    const response = await axios(requestConfig);
    const responseTime = Date.now() - startTime;

    return createSuccessResult(apiConfig, responseTime, response.status);
  } catch (error) {
    return createErrorResult(apiConfig, error);
  }
}

/**
 * 여러 API 동시 체크
 */
async function checkApis(apiConfigs) {
  const enabledApis = apiConfigs.filter((api) => api.enabled !== false);

  if (enabledApis.length === 0) {
    logger.warn('활성화된 API가 없습니다');
    return [];
  }

  logger.info(`${enabledApis.length}개 API 체크 시작`);

  const results = await Promise.all(
    enabledApis.map((apiConfig) => checkApi(apiConfig))
  );

  return results;
}

/**
 * 결과 통계 계산
 */
function calculateStats(results) {
  return {
    total: results.length,
    success: results.filter((r) => r.status === API_STATUS.SUCCESS).length,
    error: results.filter((r) => r.status === API_STATUS.ERROR).length,
    slow: results.filter((r) => r.status === API_STATUS.SUCCESS && r.isSlow).length,
  };
}

module.exports = {
  checkApi,
  checkApis,
  calculateStats,
  API_STATUS,
};
