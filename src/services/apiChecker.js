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
 * 브라우저처럼 보이는 기본 헤더 생성
 */
function createBrowserHeaders(customHeaders = {}) {
  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };

  // customHeaders가 우선순위를 가짐 (기존 설정 유지)
  return { ...defaultHeaders, ...customHeaders };
}

/**
 * HTTP 요청 설정 생성
 */
function createRequestConfig(apiConfig) {
  const requestConfig = {
    method: apiConfig.method || 'GET',
    url: apiConfig.url,
    headers: createBrowserHeaders(apiConfig.headers),
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
function isSlowResponse(responseTime, threshold) {
  return responseTime > threshold;
}

/**
 * 성공 결과 생성
 */
function createSuccessResult(apiConfig, responseTime, statusCode) {
  const threshold = apiConfig.responseTimeThreshold || config.monitoring.responseTimeThreshold;
  const isSlow = isSlowResponse(responseTime, threshold);
  const slowWarning = isSlow
    ? ` ⚠️ 느림 (임계값: ${threshold}ms)`
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
    threshold, // API별 임계값 추가
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
