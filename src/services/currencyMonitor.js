const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const { getWebhookUrl } = require('../config');
const { IncomingWebhook } = require('@slack/webhook');
const logger = require('../utils/logger');

const NAVER_FINANCE_URL = 'https://finance.naver.com/marketindex/';

// Display configurations (User requested links)
const DISPLAY_CONFIG = [
  {
    id: 'USD_KRW',
    name: '🇺🇸/🇰🇷 원/달러 환율 (USD/KRW)',
    targetUrl: 'https://kr.investing.com/currencies/usd-krw',
    unit: '원',
    desc: '1달러 = ?원'
  },
  {
    id: 'USD_JPY',
    name: '🇺🇸/🇯🇵 엔/달러 환율 (USD/JPY)',
    targetUrl: 'https://kr.investing.com/currencies/usd-jpy',
    unit: '엔',
    desc: '1달러 = ?엔'
  }
];

let monitorInterval = null;

/**
 * 환율 정보 스크래핑 (네이버 금융)
 * Investing.com의 봇 차단을 우회하기 위해 네이버 금융에서 데이터를 가져옵니다.
 */
async function fetchRates() {
  try {
    const response = await axios.get(NAVER_FINANCE_URL, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const content = iconv.decode(response.data, 'EUC-KR');
    const $ = cheerio.load(content);
    const results = [];

    // 1. USD/KRW Extraction
    // #exchangeList li.on (usually the first item is USD)
    const usdKrwItem = $('#exchangeList li.on').first();
    const usdKrwPrice = usdKrwItem.find('.value').text();
    
    // Validate if we got the right item
    const usdKrwName = usdKrwItem.find('.blind').text();
    if (usdKrwPrice && (usdKrwName.includes('미국') || usdKrwName.includes('USD'))) {
       results.push({
         ...DISPLAY_CONFIG.find(c => c.id === 'USD_KRW'),
         price: usdKrwPrice,
         success: true
       });
    } else {
       results.push({
         ...DISPLAY_CONFIG.find(c => c.id === 'USD_KRW'),
         error: '데이터 추출 실패',
         success: false
       });
    }

    // 2. USD/JPY Extraction
    // #worldExchangeList li (Need to find "달러/일본 엔")
    let usdJpyPrice = null;
    $('#worldExchangeList li').each((i, el) => {
      const name = $(el).find('.h_lst').text().trim();
      if (name.includes('달러/일본 엔') || name.includes('USD/JPY')) {
        usdJpyPrice = $(el).find('.value').text();
        return false; // break
      }
    });

    if (usdJpyPrice) {
      results.push({
        ...DISPLAY_CONFIG.find(c => c.id === 'USD_JPY'),
        price: usdJpyPrice,
        success: true
      });
    } else {
      results.push({
        ...DISPLAY_CONFIG.find(c => c.id === 'USD_JPY'),
        error: '데이터 추출 실패 (항목 못찾음)',
        success: false
      });
    }

    return results;

  } catch (error) {
    logger.error('네이버 금융 조회 실패', error.message || error);
    // Return error state for all configs
    return DISPLAY_CONFIG.map(config => ({
      ...config,
      error: '네이버 금융 접속 실패',
      success: false
    }));
  }
}

/**
 * 환율 정보 조회 및 슬랙 전송
 */
async function checkAndNotify() {
  logger.info('환율 정보 조회 시작...');
  
  const results = await fetchRates();
  
  // 'currency' 채널 웹훅 가져오기
  const webhookUrl = getWebhookUrl('currency');
  
  if (!webhookUrl) {
    logger.error('환율 알림 전송 실패: currency 채널 웹훅 URL이 설정되지 않았습니다.');
    return;
  }

  const webhook = new IncomingWebhook(webhookUrl);

  try {
    const fields = results.map(result => {
      let valueText = '';
      if (!result.success) {
        valueText = `⚠️ ${result.error || '조회 실패'}`;
      } else {
        valueText = `💰 *${result.price} ${result.unit}*`;
      }
      
      return {
        title: `${result.name}`,
        value: `${valueText}\n(${result.desc})\n<${result.targetUrl}|👉 실시간 확인하기>`, 
        short: false
      };
    });

    await webhook.send({
      text: '💵 실시간 환율 정보 (Source: Naver Finance)',
      attachments: [{
        color: '#2196F3',
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
  checkAndNotify();
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
  stopCurrencyMonitoring,
  fetchRates // For testing
};