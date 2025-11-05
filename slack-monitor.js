require('dotenv').config();
const axios = require('axios');
const { IncomingWebhook } = require('@slack/webhook');
const apiConfigs = require('./apis.config');

// 설정
const CONFIG = {
  // 슬랙 Webhook URL (환경 변수에서 로드)
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',

  // 슬랙 채널
  slackChannel: process.env.SLACK_CHANNEL || '#ocean',

  // 체크 간격 (밀리초) - 1000ms = 1초
  checkInterval: parseInt(process.env.CHECK_INTERVAL) || 60000,

  // 알림 조건
  notifyOnError: process.env.NOTIFY_ON_ERROR !== 'false',
  notifyOnSuccess: process.env.NOTIFY_ON_SUCCESS === 'true',
  notifyOnSlowResponse: process.env.NOTIFY_ON_SLOW_RESPONSE !== 'false',

  // 요약 알림 (여러 API 결과를 한 번에 전송)
  sendSummary: process.env.SEND_SUMMARY !== 'false',

  // 응답 시간 임계값 (밀리초)
  responseTimeThreshold: parseInt(process.env.RESPONSE_TIME_THRESHOLD) || 1000,
};

// 슬랙 Webhook 초기화
const webhook = new IncomingWebhook(CONFIG.slackWebhookUrl);

// 단일 API 체크 함수
async function checkSingleApi(apiConfig) {
  try {
    const startTime = Date.now();

    // HTTP 요청 설정
    const requestConfig = {
      method: apiConfig.method || 'GET',
      url: apiConfig.url,
      headers: apiConfig.headers || {},
      timeout: apiConfig.timeout || 5000,
    };

    // POST/PUT/PATCH 메서드인 경우 body 추가
    if (['POST', 'PUT', 'PATCH'].includes(requestConfig.method.toUpperCase())) {
      requestConfig.data = apiConfig.body || {};
    }

    const response = await axios(requestConfig);
    const responseTime = Date.now() - startTime;

    // 응답 시간이 임계값을 초과하는지 확인
    const isSlow = responseTime > CONFIG.responseTimeThreshold;

    const result = {
      apiId: apiConfig.id,
      apiName: apiConfig.name,
      url: apiConfig.url,
      method: apiConfig.method,
      status: 'success',
      statusCode: response.status,
      responseTime: responseTime,
      responseTimeStr: `${responseTime}ms`,
      isSlow: isSlow,
      timestamp: new Date().toISOString(),
    };

    const slowWarning = isSlow ? ` ⚠️ 느림 (임계값: ${CONFIG.responseTimeThreshold}ms)` : '';
    console.log(`✓ [${apiConfig.name}] 체크 성공 - 응답시간: ${responseTime}ms${slowWarning}`);

    return result;
  } catch (error) {
    const result = {
      apiId: apiConfig.id,
      apiName: apiConfig.name,
      url: apiConfig.url,
      method: apiConfig.method,
      status: 'error',
      error: error.message,
      statusCode: error.response?.status || 'N/A',
      timestamp: new Date().toISOString(),
    };

    console.error(`✗ [${apiConfig.name}] 체크 실패 - ${error.message}`);

    return result;
  }
}

// 모든 API 체크 (병렬 실행)
async function checkAllApis() {
  // 활성화된 API만 필터링
  const enabledApis = apiConfigs.filter(api => api.enabled !== false);

  if (enabledApis.length === 0) {
    console.warn('⚠️ 활성화된 API가 없습니다!');
    return [];
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 ${enabledApis.length}개 API 체크 시작 (${new Date().toLocaleString('ko-KR')})`);
  console.log('='.repeat(50));

  // 모든 API를 동시에 체크 (Promise.all)
  const results = await Promise.all(
    enabledApis.map(apiConfig => checkSingleApi(apiConfig))
  );

  // 결과 요약
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const slowCount = results.filter(r => r.status === 'success' && r.isSlow).length;

  console.log(`\n📈 체크 완료: 성공 ${successCount}개, 실패 ${errorCount}개, 느림 ${slowCount}개`);

  // 슬랙 알림 전송
  if (CONFIG.sendSummary) {
    // 요약 알림
    await sendSummaryToSlack(results);
  } else {
    // 개별 알림
    for (const result of results) {
      if ((result.status === 'error' && CONFIG.notifyOnError) ||
          (result.status === 'success' && CONFIG.notifyOnSuccess) ||
          (result.isSlow && CONFIG.notifyOnSlowResponse)) {
        await sendToSlack(result);
      }
    }
  }

  return results;
}

// 슬랙으로 개별 결과 전송
async function sendToSlack(result) {
  try {
    const isError = result.status === 'error';
    const isSlow = result.isSlow && !isError;
    const color = isError ? 'danger' : isSlow ? 'warning' : 'good';
    const emoji = isError ? '🔴' : isSlow ? '🟡' : '🟢';

    await webhook.send({
      text: `${emoji} [${result.apiName}] API 모니터링 결과`,
      channel: CONFIG.slackChannel,
      attachments: [
        {
          color: color,
          fields: [
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
              value: result.responseTimeStr ?
                (result.isSlow ? `⚠️ ${result.responseTimeStr} (임계값: ${CONFIG.responseTimeThreshold}ms 초과)` : result.responseTimeStr) :
                'N/A',
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
            ...(result.error ? [{
              title: 'Error',
              value: result.error,
              short: false,
            }] : []),
          ],
          footer: 'API Monitor',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    });

    console.log(`  → 슬랙 알림 전송 완료: ${result.apiName}`);
  } catch (error) {
    console.error(`  → 슬랙 전송 실패: ${error.message}`);
  }
}

// 슬랙으로 요약 결과 전송
async function sendSummaryToSlack(results) {
  try {
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const slowCount = results.filter(r => r.status === 'success' && r.isSlow).length;
    const totalCount = results.length;

    // 전체 상태 결정
    const overallStatus = errorCount === 0 ? (slowCount > 0 ? 'warning' : 'success') : errorCount === totalCount ? 'critical' : 'warning';
    const emoji = overallStatus === 'success' ? '🟢' : overallStatus === 'critical' ? '🔴' : '🟡';
    const color = overallStatus === 'success' ? 'good' : overallStatus === 'critical' ? 'danger' : 'warning';

    // 에러가 있거나 느린 응답이 있거나 성공 알림이 활성화된 경우만 전송
    if (errorCount > 0 || (slowCount > 0 && CONFIG.notifyOnSlowResponse) || CONFIG.notifyOnSuccess) {
      // API별 상태 텍스트 생성
      const apiStatusText = results.map(r => {
        const statusEmoji = r.status === 'success' ? (r.isSlow ? '⚠️' : '✅') : '❌';
        const timeInfo = r.status === 'success' ? ` (${r.responseTimeStr})` : '';
        const slowWarning = r.isSlow && r.status === 'success' ? ' 🐢' : '';
        return `${statusEmoji} *${r.apiName}*: ${r.statusCode}${timeInfo}${slowWarning}`;
      }).join('\n');

      await webhook.send({
        text: `${emoji} API 모니터링 요약`,
        channel: CONFIG.slackChannel,
        attachments: [
          {
            color: color,
            fields: [
              {
                title: '전체 상태',
                value: `총 ${totalCount}개 | 성공 ${successCount}개 | 실패 ${errorCount}개${slowCount > 0 ? ` | 느림 ${slowCount}개` : ''}`,
                short: false,
              },
              {
                title: 'API 상태',
                value: apiStatusText,
                short: false,
              },
              ...(errorCount > 0 ? [{
                title: '오류 상세',
                value: results
                  .filter(r => r.status === 'error')
                  .map(r => `• ${r.apiName}: ${r.error}`)
                  .join('\n'),
                short: false,
              }] : []),
              ...(slowCount > 0 ? [{
                title: '느린 응답 상세',
                value: results
                  .filter(r => r.status === 'success' && r.isSlow)
                  .map(r => `• ${r.apiName}: ${r.responseTimeStr} (임계값: ${CONFIG.responseTimeThreshold}ms)`)
                  .join('\n'),
                short: false,
              }] : []),
            ],
            footer: `API Monitor | ${new Date().toLocaleString('ko-KR')}`,
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      });

      console.log(`  → 슬랙 요약 알림 전송 완료`);
    }
  } catch (error) {
    console.error(`  → 슬랙 전송 실패: ${error.message}`);
  }
}

// 메인 실행 함수
async function startMonitoring() {
  // 활성화된 API 개수 확인
  const enabledApis = apiConfigs.filter(api => api.enabled !== false);

  console.log('\n' + '='.repeat(50));
  console.log('🚀 API 모니터링 시작');
  console.log('='.repeat(50));
  console.log(`📋 모니터링 API 개수: ${enabledApis.length}개`);
  enabledApis.forEach((api, index) => {
    console.log(`   ${index + 1}. ${api.name} (${api.method} ${api.url})`);
  });
  console.log(`⏱️  체크 간격: ${CONFIG.checkInterval}ms (${CONFIG.checkInterval / 1000}초)`);
  console.log(`📢 알림 방식: ${CONFIG.sendSummary ? '요약' : '개별'}`);
  console.log('='.repeat(50));

  if (enabledApis.length === 0) {
    console.error('❌ 활성화된 API가 없습니다. apis.config.js를 확인하세요.');
    process.exit(1);
  }

  // 초기 체크
  await checkAllApis();

  // 주기적 체크
  setInterval(async () => {
    await checkAllApis();
  }, CONFIG.checkInterval);
}

// 프로그램 시작
startMonitoring().catch(console.error);

// 프로세스 종료 처리
process.on('SIGINT', () => {
  console.log('\n👋 모니터링 종료');
  process.exit(0);
});
