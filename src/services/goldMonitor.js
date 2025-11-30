const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs').promises;
const path = require('path');
const { getWebhookUrl } = require('../config');
const { IncomingWebhook } = require('@slack/webhook');
const logger = require('../utils/logger');

const NAVER_FINANCE_URL = 'https://finance.naver.com/marketindex/';
const DATA_FILE = path.join(__dirname, '../../.gold-rates.json');

// Display configurations
const DISPLAY_CONFIG = [
  {
    id: 'DOM_GOLD',
    name: '🇰🇷 국내 금시세 (Domestic Gold)',
    targetUrl: 'https://finance.naver.com/marketindex/goldDetail.naver',
    unit: '원/g',
    searchKeywords: ['국내 금', '금']
  },
  {
    id: 'INT_GOLD',
    name: '🌎 국제 금시세 (International Gold)',
    targetUrl: 'https://finance.naver.com/marketindex/worldGoldDetail.naver?marketindexCd=CMDT_GC',
    unit: '달러/트로이온스',
    searchKeywords: ['국제 금']
  }
];

let monitorInterval = null;

/**
 * 저장된 시세 정보 로드
 */
async function loadRates() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

/**
 * 시세 정보 저장
 */
async function saveRates(rates) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(rates, null, 2));
  } catch (error) {
    logger.error('금 시세 데이터 저장 실패', error);
  }
}

/**
 * 금 시세 스크래핑 (네이버 금융)
 */
async function fetchGoldRates() {
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

    // #oilGoldList extraction
    const items = {};
    $('#oilGoldList li').each((i, el) => {
      const name = $(el).find('.h_lst').text().trim();
      const price = $(el).find('.value').text();
      items[name] = price;
    });

    // Map to config
    for (const config of DISPLAY_CONFIG) {
      let foundPrice = null;
      
      // Try to match by keywords
      for (const keyword of config.searchKeywords) {
        if (items[keyword]) {
          foundPrice = items[keyword];
          break;
        }
      }

      if (foundPrice) {
        results.push({
          ...config,
          price: foundPrice,
          success: true
        });
      } else {
        results.push({
          ...config,
          error: '데이터 추출 실패',
          success: false
        });
      }
    }

    return results;

  } catch (error) {
    logger.error('네이버 금융(금) 조회 실패', error.message || error);
    return DISPLAY_CONFIG.map(config => ({
      ...config,
      error: '접속 실패',
      success: false
    }));
  }
}

/**
 * 조회 및 알림
 */
async function checkAndNotify() {
  logger.info('금 시세 조회 시작...');
  
  const results = await fetchGoldRates();
  const previousRates = await loadRates();
  
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
    logger.info('금 시세 변동 없음.');
    return;
  }

  await saveRates(newRates);
  logger.info(`금 시세 변동 감지: ${changes.join(', ')}`);
  
  const webhookUrl = getWebhookUrl('gold');
  if (!webhookUrl) {
    logger.error('금 시세 알림 실패: gold 채널 웹훅 미설정');
    return;
  }

  const webhook = new IncomingWebhook(webhookUrl);

  try {
    const fields = results.map(result => {
      let valueText = '';
      if (!result.success) {
        valueText = `⚠️ ${result.error}`;
      } else {
        valueText = `💰 *${result.price} ${result.unit}*`; // Add unit
        
        if (result.id === 'DOM_GOLD') {
            const pricePerGram = parseFloat(result.price.replace(/,/g, ''));
            const pricePerDon = (pricePerGram * 3.75).toLocaleString(); // 1돈 = 3.75g
            valueText += ` (1돈: ${pricePerDon} 원)`;
        }
      }
      
      return {
        title: `${result.name}`,
        value: `${valueText}\n<${result.targetUrl}|👉 상세 보기>`, 
        short: false
      };
    });

    await webhook.send({
      text: '🥇 실시간 금 시세 (Source: Naver Finance)',
      channel: '#gold',
      attachments: [{
        color: '#FFD700', // Gold color
        fields: fields,
        footer: `🤖 Gold Monitor · ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
        ts: Math.floor(Date.now() / 1000)
      }]
    });
    
    logger.success('금 시세 알림 전송 완료 (#gold)');

  } catch (error) {
    logger.error('금 시세 알림 전송 실패', error);
  }
}

/**
 * 시작
 */
function startGoldMonitoring() {
  checkAndNotify();
  monitorInterval = setInterval(checkAndNotify, 5 * 60 * 1000); // 5 minutes
  logger.info('금 시세 모니터링 시작 (5분 간격)');
}

/**
 * 중지
 */
function stopGoldMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('금 시세 모니터링 중지');
  }
}

module.exports = {
  startGoldMonitoring,
  stopGoldMonitoring
};
