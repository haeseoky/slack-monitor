/**
 * 애플리케이션 설정 관리
 * 환경 변수를 로드하고 기본값을 적용합니다.
 */

require('dotenv').config();

const config = {
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    channel: process.env.SLACK_CHANNEL || '#ocean',
  },

  monitoring: {
    checkInterval: parseInt(process.env.CHECK_INTERVAL, 10) || 60000,
    responseTimeThreshold: parseInt(process.env.RESPONSE_TIME_THRESHOLD, 10) || 1000,
  },

  notifications: {
    onError: process.env.NOTIFY_ON_ERROR !== 'false',
    onSuccess: process.env.NOTIFY_ON_SUCCESS === 'true',
    onSlowResponse: process.env.NOTIFY_ON_SLOW_RESPONSE !== 'false',
    sendSummary: process.env.SEND_SUMMARY !== 'false',
  },
};

/**
 * 설정 유효성 검증
 */
function validateConfig() {
  const errors = [];

  if (!config.slack.webhookUrl) {
    errors.push('SLACK_WEBHOOK_URL is required');
  }

  if (config.monitoring.checkInterval < 1000) {
    errors.push('CHECK_INTERVAL must be at least 1000ms');
  }

  if (config.monitoring.responseTimeThreshold < 0) {
    errors.push('RESPONSE_TIME_THRESHOLD must be positive');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  config,
  validateConfig,
};
