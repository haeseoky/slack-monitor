/**
 * 네이버 검색 모니터링 서비스 (네이버 검색 API 사용)
 * 네이버 블로그, 뉴스, 카페에서 특정 키워드로 검색된 게시글을 실시간으로 모니터링하고 Slack으로 알림을 전송합니다.
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { IncomingWebhook } = require('@slack/webhook');
const { getWebhookUrl } = require('../config');
const logger = require('../utils/logger');

const STORAGE_DIR = path.join(__dirname, '../../');

// 검색별 타이머 저장
const searchTimers = new Map();

// 네이버 API 설정
const NAVER_API_BASE_URL = 'https://openapi.naver.com/v1/search';
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

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
 * 네이버 검색 API로 게시글 목록 가져오기
 */
async function fetchSearchResults(searchConfig) {
  try {
    // API 키 확인
    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      logger.error(`[${searchConfig.id}] 네이버 API 키가 설정되지 않았습니다. .env 파일에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 추가하세요.`);
      return [];
    }

    if (NAVER_CLIENT_ID === 'your_client_id_here' || NAVER_CLIENT_SECRET === 'your_client_secret_here') {
      logger.error(`[${searchConfig.id}] 네이버 API 키를 실제 값으로 변경하세요.`);
      return [];
    }

    const searchType = searchConfig.searchType || 'blog';

    // API 엔드포인트 매핑
    const apiEndpoints = {
      blog: '/blog',
      news: '/news',
      cafe: '/cafearticle',
    };

    const endpoint = apiEndpoints[searchType];
    if (!endpoint) {
      logger.error(`[${searchConfig.id}] 지원하지 않는 검색 타입: ${searchType}`);
      return [];
    }

    const apiUrl = `${NAVER_API_BASE_URL}${endpoint}`;

    logger.info(`[${searchConfig.id}] 네이버 API 요청: ${searchType} - "${searchConfig.keyword}"`);

    const response = await axios.get(apiUrl, {
      params: {
        query: searchConfig.keyword,
        display: 10, // 한 번에 가져올 결과 수 (최대 100)
        sort: 'date', // 최신순 정렬
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
      timeout: 10000,
    });

    const data = response.data;
    const items = data.items || [];

    logger.info(`[${searchConfig.id}] API 응답: ${items.length}개 결과`);

    // API 응답을 통일된 포맷으로 변환
    const posts = items.map((item, index) => {
      // HTML 태그 제거
      const stripHtml = (html) => {
        return html
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/<b>/g, '')
          .replace(/<\/b>/g, '');
      };

      const title = stripHtml(item.title || '');
      const desc = stripHtml(item.description || '');
      const link = item.link || item.originallink || '';

      // postId 생성
      let postId = '';
      if (searchType === 'blog') {
        const logNoMatch = link.match(/logNo=(\d+)/);
        const pathMatch = link.match(/blog\.naver\.com\/[^\/]+\/(\d+)/);
        postId = logNoMatch ? logNoMatch[1] : (pathMatch ? pathMatch[1] : `blog_${index}_${Date.now()}`);
      } else if (searchType === 'news') {
        const oidMatch = link.match(/oid=(\d+)/);
        const aidMatch = link.match(/aid=(\d+)/);
        postId = (oidMatch && aidMatch) ? `${oidMatch[1]}_${aidMatch[1]}` : `news_${index}_${Date.now()}`;
      } else if (searchType === 'cafe') {
        const articleMatch = link.match(/articleid=(\d+)/);
        const pathMatch = link.match(/cafe\.naver\.com\/[^\/]+\/(\d+)/);
        postId = articleMatch ? articleMatch[1] : (pathMatch ? pathMatch[1] : `cafe_${index}_${Date.now()}`);
      }

      return {
        postId,
        title,
        link,
        desc,
        author: item.bloggername || item.bloggerlink || '',
        date: item.postdate || '',
        searchType,
        cafeName: item.cafename || '',
        cafeUrl: item.cafeurl || '',
      };
    });

    if (posts.length > 0) {
      logger.info(`[${searchConfig.id}] 최신 게시글: ${posts[0].title} (ID: ${posts[0].postId})`);
    }

    return posts;
  } catch (error) {
    if (error.response) {
      logger.error(`[${searchConfig.id}] 네이버 API 오류: ${error.response.status} - ${error.response.data?.errorMessage || error.message}`);
    } else {
      logger.error(`[${searchConfig.id}] 검색 결과 가져오기 실패`, error);
    }
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
        value: post.desc.substring(0, 200) + (post.desc.length > 200 ? '...' : ''),
        short: false,
      });
    }

    // 작성자/출처 추가
    if (post.author || post.cafeName) {
      fields.push({
        title: '✍️ 작성자/출처',
        value: post.cafeName ? `${post.author} (${post.cafeName})` : post.author,
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
      footer: `네이버 ${searchTypeText[post.searchType]} 검색 모니터 (API)`,
      ts: Math.floor(Date.now() / 1000),
    };

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
 * Slack으로 검색 결과 통계/상태 알림 전송
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

    const color = stats.newCount > 0 ? '#36a64f' : '#3AA3E3';

    await webhook.send({
      text: `📊 네이버 검색 통계: ${searchConfig.keyword} (${searchTypeText[searchConfig.searchType]})`,
      channel: `#${searchConfig.channel}`,
      attachments: [{
        color: color,
        fields: fields,
        footer: `상태: ${stats.message || '정상'} (API)`,
        ts: Math.floor(Date.now() / 1000),
      }],
    });
  } catch (error) {
    logger.error(`[${searchConfig.id}] 상태 알림 전송 실패`, error);
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

    // 통계 알림 발송
    await notifySearchStatus(searchConfig, {
      totalCount: currentPosts.length,
      newCount: isFirstRun ? currentPosts.length : newPosts.length,
      message: isFirstRun ? '첫 실행 (초기화)' : '모니터링 중'
    });

    // 조회 결과가 없으면 종료
    if (currentPosts.length === 0) {
      logger.warn(`[${searchConfig.id}] 가져온 검색 결과가 없습니다`);
      return;
    }

    // 첫 실행이면 데이터만 저장
    if (isFirstRun) {
      const seenPostIds = currentPosts.map((p) => p.postId);
      await saveLastCheck(searchConfig.id, {
        lastPostId: currentPosts[0]?.postId,
        lastCheckTime: new Date().toISOString(),
        seenPostIds,
      });
      return;
    }

    // 신규 게시글 개별 알림
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
  }
}

/**
 * 단일 검색 모니터링 시작
 */
function startSingleSearchMonitoring(searchConfig) {
  const interval = searchConfig.checkInterval || 600000; // 기본 10분
  const searchTypeText = { blog: '블로그', news: '뉴스', cafe: '카페' };
  logger.info(
    `[${searchConfig.id}] 네이버 ${searchTypeText[searchConfig.searchType]} 검색 모니터링 시작 (API) - 키워드: "${searchConfig.keyword}" (체크 간격: ${interval / 1000}초)`
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

  logger.header('🔎 네이버 검색 모니터링 시작 (API)');
  logger.info(`📋 모니터링 검색 개수: ${enabledSearches.length}개`);

  const searchTypeText = { blog: '블로그', news: '뉴스', cafe: '카페' };
  enabledSearches.forEach((search, index) => {
    logger.info(
      `   ${index + 1}. [${searchTypeText[search.searchType]}] "${search.keyword}" → #${search.channel} (${(search.checkInterval || 600000) / 1000}초)`
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
