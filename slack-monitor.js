require('dotenv').config();
const axios = require('axios');
const { IncomingWebhook } = require('@slack/webhook');

// 설정
const CONFIG = {
  // 모니터링할 외부 API URL
  targetUrl: process.env.TARGET_URL || 'https://api.monimo.com/restapi/cmn/ply/inqrSvBasisPly',

  // 슬랙 Webhook URL (환경 변수에서 로드)
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',

  // 체크 간격 (밀리초) - 1000ms = 1초
  checkInterval: parseInt(process.env.CHECK_INTERVAL) || 60000,

  // 알림 조건 (예: 에러 발생 시에만 알림)
  notifyOnError: process.env.NOTIFY_ON_ERROR !== 'false',
  notifyOnSuccess: process.env.NOTIFY_ON_SUCCESS === 'true',
};

// 슬랙 Webhook 초기화
const webhook = new IncomingWebhook(CONFIG.slackWebhookUrl);

// 외부 API 호출 함수
async function checkApi() {
  try {
    const startTime = Date.now();
    
    // POST 요청으로 변경
    const response = await axios.post(
      CONFIG.targetUrl,
      {}, // 빈 body
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000, // 5초 타임아웃
      }
    );

    const responseTime = Date.now() - startTime;

    const result = {
      status: 'success',
      statusCode: response.status,
      responseTime: `${responseTime}ms`,
      data: response.data,
      timestamp: new Date().toISOString(),
    };

    console.log(`✓ API 체크 성공 - 응답시간: ${responseTime}ms`);

    // 성공 시 알림 설정이 켜져있으면 슬랙 전송
    if (CONFIG.notifyOnSuccess) {
      await sendToSlack(result);
    }

    return result;
  } catch (error) {
    const result = {
      status: 'error',
      error: error.message,
      statusCode: error.response?.status || 'N/A',
      timestamp: new Date().toISOString(),
    };

    console.error(`✗ API 체크 실패 - ${error.message}`);

    // 에러 발생 시 슬랙 전송
    if (CONFIG.notifyOnError) {
      await sendToSlack(result);
    }

    return result;
  }
}

// 슬랙으로 결과 전송
async function sendToSlack(result) {
  try {
    const isError = result.status === 'error';
    const color = isError ? 'danger' : 'good';
    const emoji = isError ? '🔴' : '🟢';

    await webhook.send({
      text: `${emoji} API 모니터링 결과`,
      channel: '#ocean',
      attachments: [
        {
          color: color,
          fields: [
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
              value: result.responseTime || 'N/A',
              short: true,
            },
            {
              title: 'Timestamp',
              value: result.timestamp,
              short: true,
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

    console.log('슬랙 알림 전송 완료');
  } catch (error) {
    console.error('슬랙 전송 실패:', error.message);
  }
}

// 메인 실행 함수
async function startMonitoring() {
  console.log('='.repeat(50));
  console.log('API 모니터링 시작');
  console.log(`대상 URL: ${CONFIG.targetUrl}`);
  console.log(`체크 간격: ${CONFIG.checkInterval}ms (${CONFIG.checkInterval / 1000}초)`);
  console.log('='.repeat(50));

  // 초기 체크
  await checkApi();

  // 주기적 체크
  setInterval(async () => {
    await checkApi();
  }, CONFIG.checkInterval);
}

// 프로그램 시작
startMonitoring().catch(console.error);

// 프로세스 종료 처리
process.on('SIGINT', () => {
  console.log('\n모니터링 종료');
  process.exit(0);
});
