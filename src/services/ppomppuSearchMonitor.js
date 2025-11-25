/**
 * 뽐뿌 검색 모니터링 서비스
 * 특정 키워드로 검색된 뽐뿌 게시글을 실시간으로 모니터링하고 Slack으로 알림을 전송합니다.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs').promises;
const path = require('path');
const { IncomingWebhook } = require('@slack/webhook');
const { getWebhookUrl } = require('../config');
const logger = require('../utils/logger');

const PPOMPPU_SEARCH_BASE_URL = 'https://www.ppomppu.co.kr/search_bbs.php';
const STORAGE_DIR = path.join(__dirname, '../../');

// 검색별 타이머 저장
const searchTimers = new Map();

/**
 * 검색별 마지막 체크 파일 경로 생성
 */
function getStorageFilePath(searchId) {
  return path.join(STORAGE_DIR, `.ppomppu-search-${searchId}.json`);
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
    // 파일이 없으면 기본값 반환
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
  const params = new URLSearchParams({
    keyword: searchConfig.keyword,
    bbs_cate: searchConfig.searchOptions.bbs_cate || '2',
    search_type: searchConfig.searchOptions.search_type || 'sub_memo',
    order_type: searchConfig.searchOptions.order_type || 'date',
  });

  return `${PPOMPPU_SEARCH_BASE_URL}?${params.toString()}`;
}

/**
 * 뽐뿌 검색 결과 페이지에서 게시글 목록 가져오기
 */
async function fetchSearchResults(searchConfig) {
  try {
    const searchUrl = buildSearchUrl(searchConfig);
    logger.info(`[${searchConfig.id}] 검색 URL: ${searchUrl}`);

    const response = await axios.get(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.ppomppu.co.kr/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
      },
      responseType: 'arraybuffer', // 바이너리로 받기
    });

    // EUC-KR을 UTF-8로 변환
    const html = iconv.decode(response.data, 'euc-kr');
    const $ = cheerio.load(html);
    const posts = [];

    // 검색 결과는 li > div.content 구조를 사용
    $('li').each((index, element) => {
      const $li = $(element);
      const $content = $li.find('div.content');

      if ($content.length > 0) {
        // 제목 링크 찾기
        const titleLink = $content.find('span.title a').first();
        const title = titleLink.text().trim().replace(/<\/?b>/g, ''); // <b> 태그 제거
        const link = titleLink.attr('href');

        // 게시글 ID 추출 (URL에서)
        let postId = '';
        let board = '';
        if (link) {
          const noMatch = link.match(/no=(\d+)/);
          const idMatch = link.match(/id=([^&]+)/);
          if (noMatch) {
            postId = noMatch[1];
          }
          if (idMatch) {
            board = idMatch[1];
          }
        }

        // 썸네일 이미지
        const thumbDiv = $li.find('div.thumb').first();
        let imageUrl = '';
        if (thumbDiv.length > 0) {
          const bgImage = thumbDiv.attr('style');
          if (bgImage) {
            const urlMatch = bgImage.match(/url\(([^)]+)\)/);
            if (urlMatch) {
              imageUrl = urlMatch[1].startsWith('http')
                ? urlMatch[1]
                : `https:${urlMatch[1]}`;
            }
          }
        }

        // 날짜와 조회수 (있는 경우)
        const dateText = $content.find('.date').text().trim();
        const hitText = $content.find('.hit').text().trim();

        if (postId && title && link) {
          // 상대 경로를 절대 경로로 변환
          const fullLink = link.startsWith('http')
            ? link
            : `https://www.ppomppu.co.kr${link}`;

          posts.push({
            postId,
            title,
            link: fullLink,
            board,
            author: '', // 검색 결과에는 작성자 정보가 없을 수 있음
            date: dateText,
            hit: hitText,
            imageUrl,
          });
        }
      }
    });

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

    const fields = [
      {
        title: '🔍 검색어',
        value: `\`${searchConfig.keyword}\``,
        short: true,
      },
      {
        title: '📋 게시판',
        value: post.board,
        short: true,
      },
      {
        title: '📌 제목',
        value: post.title,
        short: false,
      },
      {
        title: '🔗 링크',
        value: `<${post.link}|게시글 보기>`,
        short: false,
      },
    ];

    const attachment = {
      color: '#36a64f',
      fields,
      footer: `뽐뿌 검색 모니터 | 게시글 번호: ${post.postId}`,
      ts: Math.floor(Date.now() / 1000),
    };

    // 썸네일 이미지가 있으면 추가
    if (post.imageUrl) {
      attachment.image_url = post.imageUrl;
    }

    await webhook.send({
      text: `🔎 뽐뿌 검색 알림: *${searchConfig.keyword}*`,
      channel: `#${searchConfig.channel}`,
      attachments: [attachment],
    });

    logger.success(`[${searchConfig.id}] 검색 결과 알림 전송 완료: ${post.title}`);
  } catch (error) {
    logger.error(`[${searchConfig.id}] 검색 결과 알림 전송 실패`, error);
  }
}

/**
 * 신규 검색 결과 확인 및 알림
 */
async function checkNewSearchResults(searchConfig) {
  try {
    logger.info(`[${searchConfig.id}] 검색 모니터링 시작 - 키워드: ${searchConfig.keyword}`);

    // 현재 검색 결과 가져오기
    const currentPosts = await fetchSearchResults(searchConfig);

    if (currentPosts.length === 0) {
      logger.warn(`[${searchConfig.id}] 가져온 검색 결과가 없습니다`);
      return;
    }

    // 마지막 체크 정보 로드
    const lastCheck = await loadLastCheck(searchConfig.id);

    // 첫 실행인 경우 현재 게시글만 저장하고 알림은 보내지 않음
    if (!lastCheck.lastPostId) {
      logger.info(`[${searchConfig.id}] 첫 실행입니다. 현재 검색 결과를 기록합니다.`);
      const seenPostIds = currentPosts.map((p) => p.postId);
      await saveLastCheck(searchConfig.id, {
        lastPostId: currentPosts[0]?.postId,
        lastCheckTime: new Date().toISOString(),
        seenPostIds,
      });
      return;
    }

    // 신규 게시글 찾기 (이전에 본 적 없는 게시글)
    const newPosts = currentPosts.filter(
      (post) => !lastCheck.seenPostIds.includes(post.postId)
    );

    if (newPosts.length > 0) {
      logger.info(`[${searchConfig.id}] 신규 검색 결과 ${newPosts.length}개 발견`);

      // 신규 게시글 알림 전송
      for (const post of newPosts.slice(0, 5)) {
        // 최대 5개까지만 알림
        await notifySearchResult(searchConfig, post);
        // 알림 간격을 두어 API 제한 방지
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (newPosts.length > 5) {
        logger.info(`[${searchConfig.id}] ${newPosts.length - 5}개의 추가 신규 게시글은 알림을 생략했습니다`);
      }
    } else {
      logger.info(`[${searchConfig.id}] 신규 검색 결과가 없습니다`);
    }

    // 마지막 체크 정보 업데이트
    const seenPostIds = currentPosts.map((p) => p.postId);
    await saveLastCheck(searchConfig.id, {
      lastPostId: currentPosts[0]?.postId,
      lastCheckTime: new Date().toISOString(),
      seenPostIds: seenPostIds.slice(0, 100), // 최근 100개만 유지
    });
  } catch (error) {
    logger.error(`[${searchConfig.id}] 검색 모니터링 실패`, error);
  }
}

/**
 * 단일 검색 모니터링 시작
 */
function startSingleSearchMonitoring(searchConfig) {
  const interval = searchConfig.checkInterval || 60000;
  logger.info(`[${searchConfig.id}] 검색 모니터링 시작 - 키워드: "${searchConfig.keyword}" (체크 간격: ${interval / 1000}초)`);

  // 즉시 첫 체크 실행
  checkNewSearchResults(searchConfig);

  // 주기적으로 체크
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
    logger.warn('활성화된 검색 모니터링이 없습니다');
    return;
  }

  logger.header('🔎 뽐뿌 검색 모니터링 시작');
  logger.info(`📋 모니터링 검색 개수: ${enabledSearches.length}개`);

  enabledSearches.forEach((search, index) => {
    logger.info(
      `   ${index + 1}. 키워드: "${search.keyword}" → #${search.channel} (${(search.checkInterval || 60000) / 1000}초)`
    );
  });

  logger.separator();

  // 각 검색별로 독립적인 모니터링 시작
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
    logger.info('모든 검색 모니터링 중지 중...');
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
};
