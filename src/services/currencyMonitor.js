const axios = require('axios');
const cheerio = require('cheerio');
const { getWebhookUrl } = require('../config');
const { IncomingWebhook } = require('@slack/webhook');
const logger = require('../utils/logger');

// 모니터링 대상 환율 정보
const CURRENCIES = [
  {
    name: '🇺🇸/🇰🇷 원/달러 환율 (USD/KRW)',
    url: 'https://kr.investing.com/currencies/usd-krw',
    unit: '원',
    desc: '1달러 = ?원'
  },
  {
    name: '🇺🇸/🇯🇵 엔/달러 환율 (USD/JPY)',
    url: 'https://kr.investing.com/currencies/usd-jpy',
    unit: '엔',
    desc: '1달러 = ?엔'
  }
];

let monitorInterval = null;

/**
 * 환율 정보 스크래핑
 */
async function fetchCurrencyRate(currency) {
  try {
    const response = await axios.get(currency.url, {
      headers: {
        // 일반 브라우저처럼 보이게 설정
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 10000 // 10초 타임아웃
    });

    const $ = cheerio.load(response.data);
    let price = null;

    // 1. investing.com의 최신 data-test 속성 시도
    price = $('[data-test="instrument-price-last"]').text();

    // 2. 실패 시 클래스 기반 시도 (구형/변형 레이아웃 대응)
    if (!price) {
      price = $('.instrument-price_instrument-price__3uw25 .text-2xl').text();
    }

    // 3. 메타 태그 등 대체 수단 (페이지 타이틀 등)
    if (!price) {
      // 타이틀 예시: "USD/KRW - 1,432.50 | Investing.com"
      const title = $('title').text();
      // 숫자와 콤마, 소수점 매칭
      const match = title.match(/([\d,]+\.?\d*)/);
      if (match) {
        price = match[1];
      }
    }

    return {
      name: currency.name,
      price: price ? price.trim() : '정보 없음',
      url: currency.url,
      unit: currency.unit,
      desc: currency.desc
    };

  } catch (error) {
    logger.error(`환율 조회 실패 (${currency.name})`, error.message);
    return {
      name: currency.name,
      price: '조회 실패',
      url: currency.url,
      unit: currency.unit,
      desc: currency.desc,
      error: true
    };
  }
}

/**
 * 환율 정보 조회 및 슬랙 전송
 */
async function checkAndNotify() {
  logger.info('환율 정보 조회 시작...');
  
  // 병렬로 환율 정보 조회
  const results = await Promise.all(CURRENCIES.map(fetchCurrencyRate));
  
  // 'currency' 채널 웹훅 가져오기
  const webhookUrl = getWebhookUrl('currency');
  
  if (!webhookUrl) {
    logger.error('환율 알림 전송 실패: currency 채널 웹훅 URL이 설정되지 않았습니다. (.env 설정을 확인하세요)');
    return;
  }

  const webhook = new IncomingWebhook(webhookUrl);

  try {
    // Slack 메시지 필드 구성
    const fields = results.map(result => {
      let valueText = '';
      if (result.error) {
        valueText = '⚠️ 조회 실패';
      } else {
        valueText = `💰 *${result.price} ${result.unit}*`;
      }
      
      return {
        title: `${result.name}`,
        value: `${valueText}\n(${result.desc})\n<${result.url}|👉 실시간 확인하기> `,
        short: false
      };
    });

    await webhook.send({
      text: '💵 [Investing.com] 실시간 환율 정보',
      attachments: [{
        color: '#2196F3', // 파란색 계열
        fields: fields,
        footer: `🤖 Currency Monitor · ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
        ts: Math.floor(Date.now() / 1000)
      }]
    });
    
    logger.success('환율 정보 슬랙 전송 완료 (currency 채널)');

  } catch (error) {
    logger.error('환율 정보 슬랙 전송 실패', error);
  }
}

/**
 * 모니터링 시작
 */
function startCurrencyMonitoring() {
  // 시작 시 1회 즉시 실행
  checkAndNotify();
  
  // 1시간(3600초 * 1000ms) 간격으로 반복 실행
  monitorInterval = setInterval(checkAndNotify, 60 * 60 * 1000);
  logger.info('환율 모니터링이 시작되었습니다. (1시간 간격)');
}

/**
 * 모니터링 중지
 */
function stopCurrencyMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('환율 모니터링이 중지되었습니다.');
  }
}

module.exports = {
  startCurrencyMonitoring,
  stopCurrencyMonitoring
};
