/**
 * 애플리케이션 설정 관리
 * 환경 변수를 로드하고 기본값을 적용합니다.
 */

require('dotenv').config();

/**
 * Slack Webhook URLs 파싱
 * 형식: channel1=url1,channel2=url2
 * @returns {Map<string, string>} 채널명을 키로, 웹훅 URL을 값으로 하는 Map
 */
function parseWebhookUrls() {
  const webhookUrls = new Map();
  const urlsString = process.env.SLACK_WEBHOOK_URLS || '';

  if (!urlsString) {
    return webhookUrls;
  }

  // 쉼표로 구분된 항목들을 분리
  const entries = urlsString.split(',').map(entry => entry.trim());

  for (const entry of entries) {
    // '=' 기준으로 채널명과 URL 분리
    const [channel, url] = entry.split('=').map(part => part.trim());

    if (channel && url) {
      // 채널명에서 # 제거 (있다면)
      const cleanChannel = channel.replace(/^#/, '');
      webhookUrls.set(cleanChannel, url);
    }
  }

  return webhookUrls;
}

const config = {
  slack: {
    webhookUrls: parseWebhookUrls(),
    defaultChannel: (process.env.SLACK_DEFAULT_CHANNEL || 'health').replace(/^#/, ''),
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

  ppomppu: {
    enabled: process.env.PPOMPPU_MONITOR_ENABLED !== 'false',
    checkInterval: parseInt(process.env.PPOMPPU_CHECK_INTERVAL, 10) || 60000,
  },
};

/**
 * 설정 유효성 검증
 */
function validateConfig() {
  const errors = [];

  if (config.slack.webhookUrls.size === 0) {
    errors.push('SLACK_WEBHOOK_URLS is required (format: channel1=url1,channel2=url2)');
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

/**
 * 채널에 해당하는 웹훅 URL 가져오기
 * @param {string} channel - 채널명
 * @returns {string|null} 웹훅 URL
 */
function getWebhookUrl(channel) {
  const cleanChannel = (channel || '').replace(/^#/, '');
  const targetChannel = cleanChannel || config.slack.defaultChannel;

  return config.slack.webhookUrls.get(targetChannel) ||
         config.slack.webhookUrls.get(config.slack.defaultChannel) ||
         null;
}

module.exports = {
  config,
  validateConfig,
  getWebhookUrl,
};
