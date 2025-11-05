/**
 * Slack 알림 서비스
 * API 체크 결과를 Slack으로 전송합니다.
 */

const { IncomingWebhook } = require('@slack/webhook');
const { config } = require('../config');
const { calculateStats, API_STATUS } = require('./apiChecker');
const logger = require('../utils/logger');

// Slack Webhook 초기화
const webhook = new IncomingWebhook(config.slack.webhookUrl);

const NOTIFICATION_COLORS = {
  SUCCESS: 'good',
  WARNING: 'warning',
  CRITICAL: 'danger',
};

const NOTIFICATION_EMOJIS = {
  SUCCESS: '🟢',
  WARNING: '🟡',
  CRITICAL: '🔴',
};

/**
 * 알림 색상 결정
 */
function getNotificationColor(result) {
  if (result.status === API_STATUS.ERROR) {
    return NOTIFICATION_COLORS.CRITICAL;
  }
  if (result.isSlow) {
    return NOTIFICATION_COLORS.WARNING;
  }
  return NOTIFICATION_COLORS.SUCCESS;
}

/**
 * 알림 이모지 결정
 */
function getNotificationEmoji(result) {
  if (result.status === API_STATUS.ERROR) {
    return NOTIFICATION_EMOJIS.CRITICAL;
  }
  if (result.isSlow) {
    return NOTIFICATION_EMOJIS.WARNING;
  }
  return NOTIFICATION_EMOJIS.SUCCESS;
}

/**
 * 개별 API 결과 필드 생성
 */
function createResultFields(result) {
  const fields = [
    {
      title: 'API',
      value: result.apiName,
      short: true,
    },
    {
      title: 'Status',
      value: result.status.toUpperCase(),
      short: true,
    },
    {
      title: 'Status Code',
      value: String(result.statusCode),
      short: true,
    },
    {
      title: 'Response Time',
      value: result.responseTimeStr
        ? result.isSlow
          ? `⚠️ ${result.responseTimeStr} (임계값: ${config.monitoring.responseTimeThreshold}ms 초과)`
          : result.responseTimeStr
        : 'N/A',
      short: true,
    },
    {
      title: 'Method',
      value: result.method,
      short: true,
    },
    {
      title: 'URL',
      value: result.url,
      short: false,
    },
  ];

  // 에러 정보 추가
  if (result.error) {
    fields.push({
      title: 'Error',
      value: result.error,
      short: false,
    });
  }

  return fields;
}

/**
 * 개별 알림 전송
 */
async function sendIndividualNotification(result) {
  try {
    const color = getNotificationColor(result);
    const emoji = getNotificationEmoji(result);

    await webhook.send({
      text: `${emoji} [${result.apiName}] API 모니터링 결과`,
      channel: config.slack.channel,
      attachments: [
        {
          color,
          fields: createResultFields(result),
          footer: 'API Monitor',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    });

    logger.success(`슬랙 알림 전송 완료: ${result.apiName}`);
  } catch (error) {
    logger.error('슬랙 전송 실패', error);
  }
}

/**
 * 요약 알림의 전체 상태 결정
 */
function determineOverallStatus(stats) {
  if (stats.error === 0 && stats.slow === 0) {
    return 'SUCCESS';
  }
  if (stats.error === stats.total) {
    return 'CRITICAL';
  }
  return 'WARNING';
}

/**
 * API 상태 텍스트 생성
 */
function createApiStatusText(results) {
  return results
    .map((result) => {
      const statusEmoji =
        result.status === API_STATUS.SUCCESS
          ? result.isSlow
            ? '⚠️'
            : '✅'
          : '❌';

      const timeInfo =
        result.status === API_STATUS.SUCCESS ? ` (${result.responseTimeStr})` : '';

      const slowWarning =
        result.isSlow && result.status === API_STATUS.SUCCESS ? ' 🐢' : '';

      return `${statusEmoji} *${result.apiName}*: ${result.statusCode}${timeInfo}${slowWarning}`;
    })
    .join('\n');
}

/**
 * 요약 알림 필드 생성
 */
function createSummaryFields(results, stats) {
  const fields = [
    {
      title: '전체 상태',
      value: `총 ${stats.total}개 | 성공 ${stats.success}개 | 실패 ${stats.error}개${
        stats.slow > 0 ? ` | 느림 ${stats.slow}개` : ''
      }`,
      short: false,
    },
    {
      title: 'API 상태',
      value: createApiStatusText(results),
      short: false,
    },
  ];

  // 오류 상세 추가
  if (stats.error > 0) {
    const errorDetails = results
      .filter((r) => r.status === API_STATUS.ERROR)
      .map((r) => `• ${r.apiName}: ${r.error}`)
      .join('\n');

    fields.push({
      title: '오류 상세',
      value: errorDetails,
      short: false,
    });
  }

  // 느린 응답 상세 추가
  if (stats.slow > 0) {
    const slowDetails = results
      .filter((r) => r.status === API_STATUS.SUCCESS && r.isSlow)
      .map(
        (r) =>
          `• ${r.apiName}: ${r.responseTimeStr} (임계값: ${config.monitoring.responseTimeThreshold}ms)`
      )
      .join('\n');

    fields.push({
      title: '느린 응답 상세',
      value: slowDetails,
      short: false,
    });
  }

  return fields;
}

/**
 * 요약 알림 전송
 */
async function sendSummaryNotification(results) {
  try {
    const stats = calculateStats(results);
    const overallStatus = determineOverallStatus(stats);

    // 알림 전송 조건 확인
    const shouldNotify =
      stats.error > 0 ||
      (stats.slow > 0 && config.notifications.onSlowResponse) ||
      config.notifications.onSuccess;

    if (!shouldNotify) {
      return;
    }

    const emoji = NOTIFICATION_EMOJIS[overallStatus];
    const color = NOTIFICATION_COLORS[overallStatus];

    await webhook.send({
      text: `${emoji} API 모니터링 요약`,
      channel: config.slack.channel,
      attachments: [
        {
          color,
          fields: createSummaryFields(results, stats),
          footer: `API Monitor | ${new Date().toLocaleString('ko-KR')}`,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    });

    logger.success('슬랙 요약 알림 전송 완료');
  } catch (error) {
    logger.error('슬랙 전송 실패', error);
  }
}

/**
 * 알림 전송 여부 확인
 */
function shouldNotifyIndividual(result) {
  if (result.status === API_STATUS.ERROR && config.notifications.onError) {
    return true;
  }

  if (result.status === API_STATUS.SUCCESS && config.notifications.onSuccess) {
    return true;
  }

  if (result.isSlow && config.notifications.onSlowResponse) {
    return true;
  }

  return false;
}

/**
 * 알림 전송 (요약 또는 개별)
 */
async function notify(results) {
  if (config.notifications.sendSummary) {
    await sendSummaryNotification(results);
  } else {
    for (const result of results) {
      if (shouldNotifyIndividual(result)) {
        await sendIndividualNotification(result);
      }
    }
  }
}

module.exports = {
  notify,
  sendIndividualNotification,
  sendSummaryNotification,
};
