/**
 * 네이버 검색 모니터링 서비스
 * 네이버 블로그, 뉴스, 카페에서 특정 키워드로 검색된 게시글을 실시간으로 모니터링하고 Slack으로 알림을 전송합니다.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const { IncomingWebhook } = require('@slack/webhook');
const { getWebhookUrl } = require('../config');
const logger = require('../utils/logger');

const NAVER_SEARCH_BASE_URL = 'https://search.naver.com/search.naver';
const STORAGE_DIR = path.join(__dirname, '../../');

// 검색별 타이머 저장
const searchTimers = new Map();

// 요청 간격 랜덤화를 위한 상수 (5~15초)
const MIN_REQUEST_DELAY = 5000;
const MAX_REQUEST_DELAY = 15000;

// 쿠키 및 세션 유지를 위한 axios 인스턴스
const axiosInstance = axios.create({
  timeout: 15000,
  maxRedirects: 5,
});

/**
 * 검색별 마지막 체크 파일 경로 생성
 */
function getStorageFilePath(searchId) {
  return path.join(STORAGE_DIR, `.naver-search-${searchId}.json`);
}

/**
 * 마지막 체크 정보 로드
 */
async function loadLastCheck(searchId) {
  try {
    const filePath = getStorageFilePath(searchId);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {
      lastPostId: null,
      lastCheckTime: null,
      seenPostIds: [],
    };
  }
}

/**
 * 마지막 체크 정보 저장
 */
async function saveLastCheck(searchId, data) {
  try {
    const filePath = getStorageFilePath(searchId);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    logger.error(`[${searchId}] 마지막 체크 정보 저장 실패`, error);
  }
}

/**
 * 검색 URL 생성
 */
function buildSearchUrl(searchConfig) {
  const keyword = encodeURIComponent(searchConfig.keyword);
  const searchType = searchConfig.searchType || 'blog';

  const baseParams = {
    query: keyword,
    nso: 'so:dd,p:all', // 최신순 정렬
  };

  let url = '';
  switch (searchType) {
    case 'blog':
      url = `${NAVER_SEARCH_BASE_URL}?ssc=tab.blog.all&sm=tab_jum&query=${keyword}&nso=so:dd,p:all`;
      break;
    case 'news':
      url = `${NAVER_SEARCH_BASE_URL}?ssc=tab.news.all&where=news&sm=tab_jum&query=${keyword}&nso=so:dd,p:all`;
      break;
    case 'cafe':
      url = `${NAVER_SEARCH_BASE_URL}?cafe_where=&prdtype=0&query=${keyword}&sm=mtb_opt&ssc=tab.cafe.all&st=date&stnm=rel&opt_tab=0&nso=so:dd,p:all`;
      break;
    default:
      url = `${NAVER_SEARCH_BASE_URL}?ssc=tab.blog.all&sm=tab_jum&query=${keyword}&nso=so:dd,p:all`;
  }

  return url;
}

/**
 * 랜덤 지연 시간 생성 (봇 차단 방지)
 */
function getRandomDelay() {
  return Math.floor(Math.random() * (MAX_REQUEST_DELAY - MIN_REQUEST_DELAY + 1)) + MIN_REQUEST_DELAY;
}

/**
 * CAPTCHA 페이지 여부 확인
 */
function isCaptchaPage(html) {
  return html.includes('자동입력 방지') ||
         html.includes('보안문자') ||
         html.includes('captcha') ||
         html.includes('nhncaptcha');
}

/**
 * 네이버 검색 결과 페이지에서 게시글 목록 가져오기
 */
async function fetchSearchResults(searchConfig) {
  try {
    const searchUrl = buildSearchUrl(searchConfig);
    logger.info(`[${searchConfig.id}] 검색 URL: ${searchUrl}`);

    // 랜덤 지연 추가 (봇 차단 방지)
    const delay = getRandomDelay();
    logger.info(`[${searchConfig.id}] 요청 전 ${(delay / 1000).toFixed(1)}초 대기 중...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    const response = await axiosInstance.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://www.naver.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
      },
    });

    const html = response.data;

    // CAPTCHA 페이지 확인
    if (isCaptchaPage(html)) {
      logger.error(`[${searchConfig.id}] ⚠️  봇으로 판단되어 CAPTCHA 페이지가 반환되었습니다!`);

      // CAPTCHA 감지 알림 전송
      await notifyCaptchaDetected(searchConfig);

      return [];
    }

    const $ = cheerio.load(html);
    const posts = [];

    const searchType = searchConfig.searchType || 'blog';

    // 검색 타입별로 다른 셀렉터 사용
    if (searchType === 'blog') {
      // 블로그 검색 결과
      $('div.detail_box, div.total_wrap').each((index, element) => {
        const $el = $(element);

        const titleLink = $el.find('a.title_link, a.api_txt_lines').first();
        const title = titleLink.text().trim();
        const link = titleLink.attr('href');

        const desc = $el.find('div.dsc_link, a.dsc_link').text().trim();
        const author = $el.find('a.name, a.sub_txt').text().trim();
        const date = $el.find('span.sub_time').text().trim();

        // 썸네일 이미지
        const thumbImg = $el.find('img').first();
        let imageUrl = '';
        if (thumbImg.length > 0) {
          imageUrl = thumbImg.attr('src') || thumbImg.attr('data-src') || '';
        }

    const crypto = require('crypto');

// ... imports ...

    // 게시글 ID는 링크의 logNo 또는 URL 해시로 생성
        let postId = '';
        if (link) {
          const logNoMatch = link.match(/logNo=(\d+)/);
          // 블로그 경로 기반 ID 추출 (blog.naver.com/아이디/글번호)
          const pathLogNoMatch = link.match(/blog\.naver\.com\/[^\/]+\/(\d+)/);
          
          if (logNoMatch) {
            postId = logNoMatch[1];
          } else if (pathLogNoMatch) {
            postId = pathLogNoMatch[1];
          } else {
            // URL 해시 사용 (SHA-256)
            postId = crypto.createHash('sha256').update(link).digest('hex').substring(0, 20);
          }
        }

        if (postId && title && link) {
          // ...
        }
      });
    } else if (searchType === 'news') {
      // 뉴스 검색 결과
      $('div.news_area, div.news_wrap').each((index, element) => {
        const $el = $(element);
        
        // ... (existing selector logic) ...
        const titleLink = $el.find('a.news_tit, a.dsc_txt_wrap').first();
        const title = titleLink.text().trim();
        const link = titleLink.attr('href');
        
        // ... (existing desc/author/date/thumb logic) ...
        const desc = $el.find('div.news_dsc, a.dsc_txt_wrap').text().trim();
        const author = $el.find('a.info.press, a.info').text().trim();
        const date = $el.find('span.info').text().trim();
        
        const thumbImg = $el.find('img').first();
        let imageUrl = '';
        if (thumbImg.length > 0) {
          imageUrl = thumbImg.attr('src') || thumbImg.attr('data-src') || '';
        }

        // 게시글 ID는 링크의 oid, aid 또는 URL 해시로 생성
        let postId = '';
        if (link) {
          const oidMatch = link.match(/oid=(\d+)/);
          const aidMatch = link.match(/aid=(\d+)/);
          // 뉴스 경로 기반 ID 추출 (n.news.naver.com/mnews/article/oid/aid)
          const pathNewsMatch = link.match(/article\/(\d+)\/(\d+)/);
          
          if (oidMatch && aidMatch) {
            postId = `${oidMatch[1]}_${aidMatch[1]}`;
          } else if (pathNewsMatch) {
            postId = `${pathNewsMatch[1]}_${pathNewsMatch[2]}`;
          } else {
            postId = crypto.createHash('sha256').update(link).digest('hex').substring(0, 20);
          }
        }

        if (postId && title && link) {
          // ...
        }
      });
    } else if (searchType === 'cafe') {
      // 카페 검색 결과
      $('li.bx, div.total_wrap').each((index, element) => {
        // ... (existing logic) ...
        const $el = $(element);

        const titleLink = $el.find('a.title_link, a.api_txt_lines').first();
        const title = titleLink.text().trim();
        const link = titleLink.attr('href');

        const desc = $el.find('div.dsc_link, a.dsc_link').text().trim();
        const author = $el.find('a.name, dd.txt_inline').text().trim();
        const cafe = $el.find('a.sub_txt').text().trim();
        const date = $el.find('span.sub_time, dd.txt_inline').last().text().trim();

        const thumbImg = $el.find('img').first();
        let imageUrl = '';
        if (thumbImg.length > 0) {
          imageUrl = thumbImg.attr('src') || thumbImg.attr('data-src') || '';
        }

        // 게시글 ID는 링크의 articleid 또는 URL 해시로 생성
        let postId = '';
        if (link) {
          const articleMatch = link.match(/articleid=(\d+)/);
          // 카페 경로 기반 ID 추출 (cafe.naver.com/카페이름/글번호)
          const pathArticleMatch = link.match(/cafe\.naver\.com\/[^\/]+\/(\d+)/);
          
          if (articleMatch) {
            postId = articleMatch[1];
          } else if (pathArticleMatch) {
            postId = pathArticleMatch[1];
          } else {
            postId = crypto.createHash('sha256').update(link).digest('hex').substring(0, 20);
          }
        }

        if (postId && title && link) {
          // ...
        }
      });
    }

    logger.info(`[${searchConfig.id}] 검색 결과 ${posts.length}개 가져오기 완료`);

    if (posts.length > 0) {
      logger.info(`[${searchConfig.id}] 최신 게시글: ${posts[0].title} (ID: ${posts[0].postId})`);
    }

    return posts;
  } catch (error) {
    logger.error(`[${searchConfig.id}] 검색 결과 가져오기 실패`, error);
    return [];
  }
}

/**
 * Slack으로 검색 결과 알림 전송
 */
async function notifySearchResult(searchConfig, post) {
  try {
    const webhookUrl = getWebhookUrl(searchConfig.webhookKey);

    if (!webhookUrl) {
      logger.error(`[${searchConfig.id}] 웹훅 URL을 찾을 수 없습니다 (키: ${searchConfig.webhookKey})`);
      return;
    }

    const webhook = new IncomingWebhook(webhookUrl);

    const searchTypeEmoji = {
      blog: '📝',
      news: '📰',
      cafe: '☕',
    };

    const searchTypeText = {
      blog: '블로그',
      news: '뉴스',
      cafe: '카페',
    };

    const fields = [
      {
        title: '🔍 검색어',
        value: `\`${searchConfig.keyword}\``,
        short: true,
      },
      {
        title: '📂 검색 타입',
        value: searchTypeText[post.searchType] || post.searchType,
        short: true,
      },
      {
        title: '📌 제목',
        value: post.title,
        short: false,
      },
    ];

    // 설명 추가 (있는 경우)
    if (post.desc) {
      fields.push({
        title: '📄 내용',
        value: post.desc,
        short: false,
      });
    }

    // 작성자/출처 추가
    if (post.author || post.cafe) {
      fields.push({
        title: '✍️ 작성자/출처',
        value: post.cafe ? `${post.author} (${post.cafe})` : post.author,
        short: true,
      });
    }

    // 날짜 추가
    if (post.date) {
      fields.push({
        title: '📅 날짜',
        value: post.date,
        short: true,
      });
    }

    fields.push({
      title: '🔗 링크',
      value: `<${post.link}|게시글 보기>`,
      short: false,
    });

    const attachment = {
      color: '#36a64f',
      fields,
      footer: `네이버 ${searchTypeText[post.searchType]} 검색 모니터`,
      ts: Math.floor(Date.now() / 1000),
    };

    // 썸네일 이미지가 있으면 추가
    if (post.imageUrl && post.imageUrl.startsWith('http')) {
      attachment.thumb_url = post.imageUrl;
    }

    await webhook.send({
      text: `${searchTypeEmoji[post.searchType] || '🔎'} 네이버 검색 알림: *${searchConfig.keyword}*`,
      channel: `#${searchConfig.channel}`,
      attachments: [attachment],
    });

    logger.success(`[${searchConfig.id}] 검색 결과 알림 전송 완료: ${post.title}`);
  } catch (error) {
    logger.error(`[${searchConfig.id}] 검색 결과 알림 전송 실패`, error);
  }
}

/**
 * Slack으로 검색 결과 통계/상태 알림 전송 (무조건 발송)
 */
async function notifySearchStatus(searchConfig, stats) {
  try {
    const webhookUrl = getWebhookUrl(searchConfig.webhookKey);
    if (!webhookUrl) return;

    const webhook = new IncomingWebhook(webhookUrl);
    const searchTypeText = { blog: '블로그', news: '뉴스', cafe: '카페' };

    const fields = [
      { title: '검색어', value: searchConfig.keyword, short: true },
      { title: '타입', value: searchTypeText[searchConfig.searchType] || searchConfig.searchType, short: true },
      { title: '전체 조회', value: `${stats.totalCount}건`, short: true },
      { title: '신규 발견', value: `${stats.newCount}건`, short: true },
    ];

    const color = stats.newCount > 0 ? '#36a64f' : '#3AA3E3'; // 신규가 있으면 초록, 없으면 파랑

    await webhook.send({
      text: `📊 네이버 검색 통계: ${searchConfig.keyword} (${searchTypeText[searchConfig.searchType]})`,
      channel: `#${searchConfig.channel}`,
      attachments: [{
        color: color,
        fields: fields,
        footer: `상태: ${stats.message || '정상'}`,
        ts: Math.floor(Date.now() / 1000),
      }],
    });
  } catch (error) {
    logger.error(`[${searchConfig.id}] 상태 알림 전송 실패`, error);
  }
}

/**
 * Slack으로 CAPTCHA 감지 알림 전송
 */
async function notifyCaptchaDetected(searchConfig) {
  try {
    const webhookUrl = getWebhookUrl(searchConfig.webhookKey);
    if (!webhookUrl) return;

    const webhook = new IncomingWebhook(webhookUrl);
    const searchTypeText = { blog: '블로그', news: '뉴스', cafe: '카페' };

    await webhook.send({
      text: `🚨 네이버 검색 봇 차단 감지!`,
      channel: `#${searchConfig.channel}`,
      attachments: [{
        color: '#ff0000',
        fields: [
          { title: '검색어', value: searchConfig.keyword, short: true },
          { title: '타입', value: searchTypeText[searchConfig.searchType], short: true },
          { title: '문제', value: '봇으로 판단되어 CAPTCHA 페이지가 반환됨', short: false },
          { title: '조치사항', value: '• 체크 간격을 더 길게 조정하세요\n• IP 주소 변경을 고려하세요\n• 수동으로 네이버 검색을 실행하여 CAPTCHA를 해제하세요', short: false },
        ],
        footer: '네이버 검색 모니터 - 봇 차단 감지',
        ts: Math.floor(Date.now() / 1000),
      }],
    });

    logger.warn(`[${searchConfig.id}] CAPTCHA 감지 알림 전송 완료`);
  } catch (error) {
    logger.error(`[${searchConfig.id}] CAPTCHA 알림 전송 실패`, error);
  }
}

/**
 * 신규 검색 결과 확인 및 알림
 */
async function checkNewSearchResults(searchConfig) {
  try {
    logger.info(`[${searchConfig.id}] 네이버 검색 모니터링 시작 - 키워드: ${searchConfig.keyword} (${searchConfig.searchType})`);

    const currentPosts = await fetchSearchResults(searchConfig);
    const lastCheck = await loadLastCheck(searchConfig.id);
    let newPosts = [];
    let isFirstRun = false;

    // 첫 실행 체크
    if (!lastCheck.lastPostId) {
      isFirstRun = true;
      logger.info(`[${searchConfig.id}] 첫 실행입니다.`);
    } else {
      // 신규 게시글 필터링
      newPosts = currentPosts.filter(
        (post) => !lastCheck.seenPostIds.includes(post.postId)
      );
    }

    // 1. [변경] 통계 알림 무조건 발송
    await notifySearchStatus(searchConfig, {
      totalCount: currentPosts.length,
      newCount: isFirstRun ? currentPosts.length : newPosts.length,
      message: isFirstRun ? '첫 실행 (초기화)' : '모니터링 중'
    });

    // 조회 결과가 없으면 여기서 종료하지만, 알림은 위에서 이미 보냈음
    if (currentPosts.length === 0) {
      logger.warn(`[${searchConfig.id}] 가져온 검색 결과가 없습니다`);
      return;
    }

    // 첫 실행이면 데이터만 저장하고 개별 알림은 생략 (또는 정책에 따라 다름, 여기선 저장만)
    if (isFirstRun) {
      const seenPostIds = currentPosts.map((p) => p.postId);
      await saveLastCheck(searchConfig.id, {
        lastPostId: currentPosts[0]?.postId,
        lastCheckTime: new Date().toISOString(),
        seenPostIds,
      });
      return;
    }

    // 2. 신규 게시글 개별 알림 (기존 로직 유지)
    if (newPosts.length > 0) {
      logger.info(`[${searchConfig.id}] 신규 검색 결과 ${newPosts.length}개 발견`);

      for (const post of newPosts.slice(0, 5)) {
        await notifySearchResult(searchConfig, post);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (newPosts.length > 5) {
        logger.info(`[${searchConfig.id}] ${newPosts.length - 5}개의 추가 신규 게시글은 알림을 생략했습니다`);
      }
    } else {
      logger.info(`[${searchConfig.id}] 신규 검색 결과가 없습니다`);
    }

    // 상태 저장
    const seenPostIds = currentPosts.map((p) => p.postId);
    await saveLastCheck(searchConfig.id, {
      lastPostId: currentPosts[0]?.postId,
      lastCheckTime: new Date().toISOString(),
      seenPostIds: seenPostIds.slice(0, 100),
    });
  } catch (error) {
    logger.error(`[${searchConfig.id}] 검색 모니터링 실패`, error);
    // 에러 발생 시에도 실패 알림을 보내고 싶다면 여기서 notifySearchStatus 호출 가능
  }
}

/**
 * 단일 검색 모니터링 시작
 */
function startSingleSearchMonitoring(searchConfig) {
  const interval = searchConfig.checkInterval || 60000;
  const searchTypeText = { blog: '블로그', news: '뉴스', cafe: '카페' };
  logger.info(
    `[${searchConfig.id}] 네이버 ${searchTypeText[searchConfig.searchType]} 검색 모니터링 시작 - 키워드: "${searchConfig.keyword}" (체크 간격: ${interval / 1000}초)`
  );

  checkNewSearchResults(searchConfig);

  const intervalId = setInterval(() => {
    checkNewSearchResults(searchConfig);
  }, interval);

  searchTimers.set(searchConfig.id, intervalId);

  return intervalId;
}

/**
 * 모든 검색 모니터링 시작
 */
function startAllSearchMonitoring(searchConfigs) {
  const enabledSearches = searchConfigs.filter((s) => s.enabled !== false);

  if (enabledSearches.length === 0) {
    logger.warn('활성화된 네이버 검색 모니터링이 없습니다');
    return;
  }

  logger.header('🔎 네이버 검색 모니터링 시작');
  logger.info(`📋 모니터링 검색 개수: ${enabledSearches.length}개`);

  const searchTypeText = { blog: '블로그', news: '뉴스', cafe: '카페' };
  enabledSearches.forEach((search, index) => {
    logger.info(
      `   ${index + 1}. [${searchTypeText[search.searchType]}] "${search.keyword}" → #${search.channel} (${(search.checkInterval || 60000) / 1000}초)`
    );
  });

  logger.separator();

  enabledSearches.forEach((searchConfig) => {
    startSingleSearchMonitoring(searchConfig);
  });
}

/**
 * 검색 모니터링 중지
 */
function stopSearchMonitoring(searchId) {
  const intervalId = searchTimers.get(searchId);
  if (intervalId) {
    clearInterval(intervalId);
    searchTimers.delete(searchId);
    logger.info(`[${searchId}] 검색 모니터링 중지`);
  }
}

/**
 * 모든 검색 모니터링 중지
 */
function stopAllSearchMonitoring() {
  if (searchTimers.size > 0) {
    logger.info('모든 네이버 검색 모니터링 중지 중...');
    searchTimers.forEach((intervalId, searchId) => {
      clearInterval(intervalId);
      logger.info(`[${searchId}] 타이머 종료`);
    });
    searchTimers.clear();
  }
}

module.exports = {
  startAllSearchMonitoring,
  startSingleSearchMonitoring,
  stopSearchMonitoring,
  stopAllSearchMonitoring,
  checkNewSearchResults,
  fetchSearchResults,
  notifySearchResult,
};
