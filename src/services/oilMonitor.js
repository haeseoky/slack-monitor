const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs').promises;
const path = require('path');
const { getWebhookUrl } = require('../config');
const { IncomingWebhook } = require('@slack/webhook');
const logger = require('../utils/logger');

const NAVER_FINANCE_URL = 'https://finance.naver.com/marketindex/';
const DATA_FILE = path.join(__dirname, '../../oil-rates.json');

// Display configurations
const DISPLAY_CONFIG = [
  {
    id: 'WTI_OIL',
    name: '⛽ WTI 유가 (WTI)',
    targetUrl: 'https://finance.naver.com/marketindex/worldOilDetail.naver?marketindexCd=OIL_CL',
    unit: '달러/배럴',
    searchKeywords: ['WTI'],
    source: 'MAIN'
  },
  {
    id: 'GASOLINE',
    name: '🚗 휘발유 (Gasoline)',
    targetUrl: 'https://finance.naver.com/marketindex/oilDetail.naver?marketindexCd=OIL_GSL',
    unit: '원/리터',
    searchKeywords: ['휘발유'],
    source: 'MAIN'
  },
  {
    id: 'DIESEL',
    name: '🚙 경유 (Diesel)',
    targetUrl: 'https://finance.naver.com/marketindex/oilDetail.naver?marketindexCd=OIL_LO',
    unit: '원/리터',
    source: 'DETAIL',
    detailUrl: 'https://finance.naver.com/marketindex/oilDetail.naver?marketindexCd=OIL_LO'
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
    logger.error('유가 데이터 저장 실패', error);
  }
}

/**
 * 상세 페이지에서 시세 추출
 */
async function fetchDetailRate(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const content = iconv.decode(response.data, 'EUC-KR');
    const $ = cheerio.load(content);
    
    // .no_today 텍스트에서 숫자, 콤마, 점만 추출
    const rawText = $('.no_today').text();
    const match = rawText.match(/([0-9,]+\.[0-9]+|[0-9,]+)/);
    
    if (match) {
        return match[1];
    }
    return null;
  } catch (error) {
    logger.error(`상세 페이지 조회 실패 (${url})`, error.message);
    return null;
  }
}

/**
 * 유가 시세 스크래핑 (네이버 금융)
 */
async function fetchOilRates() {
  try {
    // 1. 메인 페이지 요청 (WTI, 휘발유용)
    const mainPromise = axios.get(NAVER_FINANCE_URL, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    }).then(response => {
        const content = iconv.decode(response.data, 'EUC-KR');
        const $ = cheerio.load(content);
        const items = {};
        $('#oilGoldList li').each((i, el) => {
            const name = $(el).find('.h_lst').text().trim();
            const price = $(el).find('.value').text();
            items[name] = price;
        });
        return items;
    }).catch(err => {
        logger.error('네이버 금융 메인 조회 실패', err.message);
        return {};
    });

    // 2. 상세 페이지 요청들 (경유용 등)
    // DISPLAY_CONFIG 중 source가 DETAIL인 항목들만 필터링
    const detailConfigs = DISPLAY_CONFIG.filter(c => c.source === 'DETAIL');
    const detailPromises = detailConfigs.map(config => 
        fetchDetailRate(config.detailUrl).then(price => ({ id: config.id, price }))
    );

    // 병렬 실행 대기
    const [mainItems, ...detailResults] = await Promise.all([mainPromise, ...detailPromises]);
    
    // detailResults를 맵으로 변환
    const detailMap = {};
    detailResults.forEach(r => {
        if (r.price) detailMap[r.id] = r.price;
    });

    const results = [];

    // Map to config
    for (const config of DISPLAY_CONFIG) {
      let foundPrice = null;
      
      if (config.source === 'MAIN') {
          // Try to match by keywords
          for (const keyword of config.searchKeywords) {
            if (mainItems[keyword]) {
              foundPrice = mainItems[keyword];
              break;
            }
          }
      } else if (config.source === 'DETAIL') {
          foundPrice = detailMap[config.id];
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
    logger.error('네이버 금융(유가) 조회 프로세스 실패', error.message || error);
    return DISPLAY_CONFIG.map(config => ({
      ...config,
      error: '프로세스 오류',
      success: false
    }));
  }
}

/**
 * 조회 및 알림
 */
async function checkAndNotify() {
  logger.info('유가 시세 조회 시작...');
  
  const results = await fetchOilRates();
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
    logger.info('유가 시세 변동 없음.');
    return;
  }

  await saveRates(newRates);
  logger.info(`유가 시세 변동 감지: ${changes.join(', ')}`);
  
  const webhookUrl = getWebhookUrl('oil');
  if (!webhookUrl) {
    logger.error('유가 시세 알림 실패: oil 채널 웹훅 미설정');
    return;
  }

  const webhook = new IncomingWebhook(webhookUrl);

  try {
    const fields = results.map(result => {
      let valueText = '';
      if (!result.success) {
        valueText = `⚠️ ${result.error}`;
      } else {
        valueText = `⛽ *${result.price} ${result.unit}*`; 
      }
      
      return {
        title: `${result.name}`,
        value: `${valueText}\n<${result.targetUrl}|👉 상세 보기>`, 
        short: false
      };
    });

    await webhook.send({
      text: '⛽ 실시간 유가 (Source: Naver Finance)',
      channel: '#oil',
      attachments: [{
        color: '#008000', // Green color for oil
        fields: fields,
        footer: `🤖 Oil Monitor · ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
        ts: Math.floor(Date.now() / 1000)
      }]
    });
    
    logger.success('유가 시세 알림 전송 완료 (#oil)');

  } catch (error) {
    logger.error('유가 시세 알림 전송 실패', error);
  }
}

/**
 * 시작
 */
function startOilMonitoring() {
  checkAndNotify();
  monitorInterval = setInterval(checkAndNotify, 5 * 60 * 1000); // 5 minutes
  logger.info('유가 시세 모니터링 시작 (5분 간격)');
}

/**
 * 중지
 */
function stopOilMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('유가 시세 모니터링 중지');
  }
}

module.exports = {
  startOilMonitoring,
  stopOilMonitoring
};
