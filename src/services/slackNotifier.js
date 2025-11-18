/**
 * Slack 알림 서비스
 * API 체크 결과를 Slack으로 전송합니다.
 */

const { IncomingWebhook } = require('@slack/webhook');
const { config, getWebhookUrl } = require('../config');
const { calculateStats, API_STATUS } = require('./apiChecker');
const logger = require('../utils/logger');

// 채널별 Webhook 인스턴스 캐시
const webhookCache = new Map();

/**
 * 채널에 해당하는 Webhook 인스턴스 가져오기
 * @param {string} channel - 채널명
 * @returns {IncomingWebhook|null}
 */
function getWebhook(channel) {
  const webhookUrl = getWebhookUrl(channel);

  if (!webhookUrl) {
    logger.error(`웹훅 URL을 찾을 수 없습니다: ${channel}`);
    return null;
  }

  // 캐시에 있으면 재사용
  if (webhookCache.has(webhookUrl)) {
    return webhookCache.get(webhookUrl);
  }

  // 새로운 Webhook 인스턴스 생성 및 캐시
  const webhook = new IncomingWebhook(webhookUrl);
  webhookCache.set(webhookUrl, webhook);

  return webhook;
}

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
  const statusEmoji = result.status === API_STATUS.SUCCESS ? '✅' : '❌';
  const statusText = result.status === API_STATUS.SUCCESS ? '정상' : '실패';

  const fields = [
    {
      title: '📌 API 이름',
      value: `*${result.apiName}*`,
      short: false,
    },
    {
      title: '🔍 상태',
      value: `${statusEmoji} ${statusText}`,
      short: true,
    },
    {
      title: '📊 응답 코드',
      value: `\`${result.statusCode}\``,
      short: true,
    },
  ];

  // 성공인 경우 응답시간 추가
  if (result.status === API_STATUS.SUCCESS && result.responseTimeStr) {
    const speedEmoji = result.isSlow ? '🐢' : '⚡';
    const speedText = result.isSlow
      ? `${result.responseTimeStr} (임계값: ${result.threshold || config.monitoring.responseTimeThreshold}ms)`
      : result.responseTimeStr;

    fields.push({
      title: '⏱️ 응답시간',
      value: `${speedEmoji} ${speedText}`,
      short: true,
    });
  }

  fields.push({
    title: '🔗 메서드',
    value: `\`${result.method}\``,
    short: true,
  });

  // 에러 정보 추가
  if (result.error) {
    fields.push({
      title: '❗ 오류 상세',
      value: `\`\`\`${result.error}\`\`\``,
      short: false,
    });
  }

  fields.push({
    title: '🌐 URL',
    value: `\`${result.url}\``,
    short: false,
  });

  return fields;
}

/**
 * 개별 알림 전송
 */
async function sendIndividualNotification(result) {
  try {
    const channel = result.channel || config.slack.defaultChannel;
    const webhook = getWebhook(channel);

    if (!webhook) {
      logger.error(`알림 전송 실패: 웹훅을 찾을 수 없습니다 (채널: ${channel})`);
      return;
    }

    const color = getNotificationColor(result);
    const emoji = getNotificationEmoji(result);

    // 상태에 따른 메시지 텍스트
    let statusText;
    if (result.status === API_STATUS.ERROR) {
      statusText = '⚠️ *API 오류 발생*';
    } else if (result.isSlow) {
      statusText = '⚠️ *응답 시간 느림*';
    } else {
      statusText = '✅ *정상 작동*';
    }

    await webhook.send({
      text: `${emoji} *[${result.apiName}]* API 모니터링 결과`,
      attachments: [
        {
          color,
          pretext: statusText,
          fields: createResultFields(result),
          footer: `🤖 API Monitor · #${channel}`,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    });

    logger.success(`슬랙 알림 전송 완료: ${result.apiName} → #${channel}`);
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
function createApiStatusText(results, stats) {
  return results.filter((r) => r.status === API_STATUS.ERROR || (r.status === API_STATUS.SUCCESS && r.isSlow))
    .map((result) => {
      let statusIcon;
      if (result.status === API_STATUS.ERROR) {
        statusIcon = '🔴';
      } else if (result.isSlow) {
        statusIcon = '🟡';
      } else {
        statusIcon = '🟢';
      }

      const timeInfo =
        result.status === API_STATUS.SUCCESS
          ? ` · \`${result.responseTimeStr}\``
          : ` · \`${result.statusCode}\``;

      const speedIndicator =
        result.status === API_STATUS.SUCCESS
          ? result.isSlow
            ? ' 🐢'
            : ' ⚡'
          : ' ❌';

      return `${statusIcon} *${result.apiName}*${timeInfo}(임계값:${result.threshold})${speedIndicator}`;
    })
    .join('\n');
}

/**
 * 요약 알림 필드 생성
 */
function createSummaryFields(results, stats) {
  const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : 0;
  const healthIcon = stats.error === 0 ? '💚' : stats.error === stats.total ? '💔' : '💛';

  const fields = [
    {
      title: '📊 전체 상태',
      value: `${healthIcon} 총 *${stats.total}개* API | 성공률 *${successRate}%*\n` +
        `🟢 정상: ${stats.success}개${stats.slow > 0 ? ` (🐢 느림: ${stats.slow}개)` : ''} | 🔴 실패: ${stats.error}개`,
      short: false,
    },
    {
      title: '🔍 API 상세 현황',
      value: createApiStatusText(results, stats),
      short: false,
    },
  ];

  // // 오류 상세 추가
  // if (stats.error > 0) {
  //   const errorDetails = results
  //     .filter((r) => r.status === API_STATUS.ERROR)
  //     .map((r) => `🔴 *${r.apiName}*\n   └ \`${r.error}\``)
  //     .join('\n\n');

  //   fields.push({
  //     title: '❗ 오류 상세',
  //     value: errorDetails,
  //     short: false,
  //   });
  // }

  // 느린 응답 상세 추가
  // if (stats.slow > 0) {
  //   const slowDetails = results
  //     .filter((r) => r.status === API_STATUS.SUCCESS && r.isSlow)
  //     .map(
  //       (r) =>
  //         `🐢 *${r.apiName}*\n   └ ${r.responseTimeStr} (임계값: ${r.threshold || config.monitoring.responseTimeThreshold}ms)`
  //     )
  //     .join('\n\n');

  //   fields.push({
  //     title: '⚠️ 느린 응답 상세',
  //     value: slowDetails,
  //     short: false,
  //   });
  // }

  return fields;
}

/**
 * 요약 알림 전송 (채널별로 그룹화)
 */
async function sendSummaryNotification(results) {
  try {
    // 채널별로 결과 그룹화
    const resultsByChannel = new Map();

    for (const result of results) {
      const channel = result.channel || config.slack.defaultChannel;

      if (!resultsByChannel.has(channel)) {
        resultsByChannel.set(channel, []);
      }

      resultsByChannel.get(channel).push(result);
    }

    // 각 채널별로 요약 알림 전송
    for (const [channel, channelResults] of resultsByChannel.entries()) {
      await sendChannelSummary(channel, channelResults);
    }

    logger.success('슬랙 요약 알림 전송 완료 (모든 채널)');
  } catch (error) {
    logger.error('슬랙 전송 실패', error);
  }
}

/**
 * 특정 채널에 요약 알림 전송
 */
async function sendChannelSummary(channel, results) {
  try {
    const webhook = getWebhook(channel);

    if (!webhook) {
      logger.error(`요약 알림 전송 실패: 웹훅을 찾을 수 없습니다 (채널: ${channel})`);
      return;
    }

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

    // 전체 상태 메시지
    let overallMessage;
    if (stats.error === 0 && stats.slow === 0) {
      overallMessage = '✨ *모든 API 정상 작동 중*';
    } else if (stats.error === stats.total) {
      overallMessage = '🚨 *모든 API 오류 발생*';
    } else if (stats.error > 0) {
      overallMessage = `⚠️ *일부 API 오류 발생* (${stats.error}개)`;
    } else {
      overallMessage = `⚠️ *일부 API 응답 느림* (${stats.slow}개)`;
    }

    await webhook.send({
      text: `${emoji} *API 모니터링 요약* · #${channel}`,
      attachments: [
        {
          color,
          pretext: overallMessage,
          fields: createSummaryFields(results, stats),
          footer: `🤖 API Monitor · ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    });

    logger.success(`슬랙 요약 알림 전송 완료: #${channel}`);
  } catch (error) {
    logger.error(`슬랙 전송 실패 (#${channel})`, error);
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
