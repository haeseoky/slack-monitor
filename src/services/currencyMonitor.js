const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs').promises;
const path = require('path');
const { getWebhookUrl } = require('../config');
const { IncomingWebhook } = require('@slack/webhook');
const logger = require('../utils/logger');

const NAVER_FINANCE_URL = 'https://finance.naver.com/marketindex/';
const DATA_FILE = path.join(__dirname, '../../currency-rates.json');

// Display configurations (User requested links)
const DISPLAY_CONFIG = [
  {
    id: 'USD_KRW',
    name: '🇺🇸/🇰🇷 원/달러 환율 (USD/KRW)',
    targetUrl: 'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW',
    unit: '원'
  },
  {
    id: 'JPY_KRW',
    name: '🇯🇵/🇰🇷 엔/원 환율 (JPY/KRW)',
    targetUrl: 'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_JPYKRW',
    unit: '원'
  }
];

let monitorInterval = null;

/**
 * 저장된 환율 정보 로드
 */
async function loadRates() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // 파일이 없거나 파싱 에러 시 빈 객체 반환
    return {};
  }
}

/**
 * 환율 정보 저장
 */
async function saveRates(rates) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(rates, null, 2));
  } catch (error) {
    logger.error('환율 데이터 저장 실패', error);
  }
}

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

    // 2. JPY/KRW Extraction
    // #exchangeList li (Need to find "일본 JPY")
    // We iterate over #exchangeList li to find JPY since it might not always be in a fixed position or "on" class
    let jpyKrwPrice = null;
    
    $('#exchangeList li').each((i, el) => {
      const name = $(el).find('.h_lst').text().trim();
      if (name.includes('일본 JPY') || name.includes('엔')) {
        jpyKrwPrice = $(el).find('.value').text();
        return false; // break
      }
    });

    if (jpyKrwPrice) {
      results.push({
        ...DISPLAY_CONFIG.find(c => c.id === 'JPY_KRW'),
        price: jpyKrwPrice,
        success: true
      });
    } else {
      results.push({
        ...DISPLAY_CONFIG.find(c => c.id === 'JPY_KRW'),
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
  const previousRates = await loadRates();
  
  // 변경 사항 확인
  let hasChanges = false;
  const changes = [];
  const newRates = { ...previousRates };

  for (const result of results) {
    if (result.success) {
      const prevPrice = previousRates[result.id];
      if (prevPrice !== result.price) {
        hasChanges = true;
        changes.push(`${result.name}: ${prevPrice || '최초'} -> ${result.price}`);
        newRates[result.id] = result.price;
      }
    }
  }

  if (!hasChanges) {
    logger.info('환율 변동 없음. 알림을 전송하지 않습니다.');
    return;
  }

  // 변경된 데이터 저장
  await saveRates(newRates);

  logger.info(`환율 변동 감지: ${changes.join(', ')}`);
  
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
      let descText = '';

      if (!result.success) {
        valueText = `⚠️ ${result.error || '조회 실패'}`;
      } else {
        // e.g. 💰 1,470.00 원
        valueText = `💰 *${result.price} ${result.unit}*`;
        
        // Description generation
        if (result.id === 'JPY_KRW') {
             descText = `(100엔 = ${result.price} ${result.unit})`;
        } else {
             descText = `(1달러 = ${result.price} ${result.unit})`;
        }
      }
      
      return {
        title: `${result.name}`,
        value: `${valueText}\n${descText}\n<${result.targetUrl}|👉 실시간 차트 확인하기>`, 
        short: false
      };
    });

    await webhook.send({
      text: '💵 실시간 환율 정보 (Source: Naver Finance)',
      channel: '#currency',
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
  // 시작 시 1회 즉시 실행
  checkAndNotify();
  
  // 5분(300초 * 1000ms) 간격으로 반복 실행
  monitorInterval = setInterval(checkAndNotify, 5 * 60 * 1000);
  logger.info('환율 모니터링이 시작되었습니다. (5분 간격, 변동 시 알림)');
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