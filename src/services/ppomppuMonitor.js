/**
 * 뽐뿌 게시글 모니터링 서비스
 * 뽐뿌 사이트의 신규 게시글을 모니터링하고 Slack으로 알림을 전송합니다.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const fs = require('fs').promises;
const path = require('path');
const { IncomingWebhook } = require('@slack/webhook');
const { getWebhookUrl } = require('../config');
const logger = require('../utils/logger');

const PPOMPPU_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu';
const STORAGE_FILE = path.join(__dirname, '../../.ppomppu-last-check.json');

/**
 * 마지막 체크 정보 로드
 */
async function loadLastCheck() {
  try {
    const data = await fs.readFile(STORAGE_FILE, 'utf-8');
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
async function saveLastCheck(data) {
  try {
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    logger.error('마지막 체크 정보 저장 실패', error);
  }
}

/**
 * 뽐뿌 페이지에서 게시글 목록 가져오기
 */
async function fetchPosts() {
  try {
    const response = await axios.get(PPOMPPU_URL, {
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

    // 뽐뿌 게시글은 tr.baseList 클래스를 사용
    $('tr.baseList').each((index, element) => {
      const $row = $(element);

      // 인기글(hotpop_bg_color) 제외 - 랜덤으로 표시되는 인기글이므로 신규 게시글이 아님
      if ($row.hasClass('hotpop_bg_color')) {
        return;
      }

      const tds = $row.find('td');

      if (tds.length >= 6) {
        // TD 구조: [번호, 제목, 작성자, 날짜, 추천수, 조회수]
        const postId = $(tds[0]).text().trim();

        // 제목 링크 찾기 (TD[1]에 있음, 두 번째 링크가 제목)
        const titleLinks = $(tds[1]).find('a[href*="view.php"]');
        const titleLink = titleLinks.length > 1 ? titleLinks.eq(1) : titleLinks.first();

        const title = titleLink.text().trim();
        const link = titleLink.attr('href');

        // 작성자 (TD[2])
        const author = $(tds[2]).text().trim();

        // 날짜 (TD[3])
        const date = $(tds[3]).text().trim();

        // 추천수 (TD[4])
        const recommend = $(tds[4]).text().trim();

        // 조회수 (TD[5])
        const hit = $(tds[5]).text().trim();

        // 썸네일 이미지 (TD[1]에 있음)
        const thumbImg = $(tds[1]).find('img').first();
        let imageUrl = '';
        if (thumbImg.length > 0) {
          const imgSrc = thumbImg.attr('src');
          if (imgSrc) {
            // 상대 경로를 절대 경로로 변환 (//로 시작하는 경우 https: 추가)
            imageUrl = imgSrc.startsWith('http')
              ? imgSrc
              : `https:${imgSrc}`;
          }
        }

        if (postId && title && link) {
          // 상대 경로를 절대 경로로 변환
          const fullLink = link.startsWith('http')
            ? link
            : `https://www.ppomppu.co.kr/zboard/${link}`;

          posts.push({
            postId,
            title,
            link: fullLink,
            author,
            date,
            hit,
            recommend,
            imageUrl,
          });
        }
      }
    });

    logger.info(`뽐뿌 게시글 ${posts.length}개 가져오기 완료`);

    if (posts.length > 0) {
      logger.info(`최신 게시글: ${posts[0].title} (ID: ${posts[0].postId})`);
    }

    return posts;
  } catch (error) {
    logger.error('뽐뿌 페이지 가져오기 실패', error);
    return [];
  }
}

/**
 * Slack으로 새 게시글 알림 전송
 */
async function notifyNewPost(post) {
  try {
    const webhookUrl = getWebhookUrl('ppomppu');

    if (!webhookUrl) {
      logger.error('ppomppu 채널의 웹훅 URL을 찾을 수 없습니다');
      return;
    }

    const webhook = new IncomingWebhook(webhookUrl);

    const fields = [
      {
        title: '제목',
        value: post.title,
        short: false,
      },
      {
        title: '링크',
        value: `<${post.link}|게시글 보기>`,
        short: false,
      },
    ];

    const attachment = {
      color: '#36a64f',
      fields,
      footer: `뽐뿌 모니터 | 게시글 번호: ${post.postId}`,
      ts: Math.floor(Date.now() / 1000),
    };

    // 썸네일 이미지가 있으면 추가
    if (post.imageUrl) {
      attachment.image_url = post.imageUrl;
    }

    await webhook.send({
      text: `🆕 뽐뿌 신규 게시글`,
      channel: '#ppomppu',
      attachments: [attachment],
    });

    logger.success(`뽐뿌 신규 게시글 알림 전송 완료: ${post.title}`);
  } catch (error) {
    logger.error('뽐뿌 알림 전송 실패', error);
  }
}

/**
 * 신규 게시글 확인 및 알림
 */
async function checkNewPosts() {
  try {
    logger.info('뽐뿌 신규 게시글 확인 시작');

    // 현재 게시글 목록 가져오기
    const currentPosts = await fetchPosts();

    if (currentPosts.length === 0) {
      logger.warn('가져온 게시글이 없습니다');
      return;
    }

    // 마지막 체크 정보 로드
    const lastCheck = await loadLastCheck();

    // 첫 실행인 경우 현재 게시글만 저장하고 알림은 보내지 않음
    if (!lastCheck.lastPostId) {
      logger.info('첫 실행입니다. 현재 게시글을 기록합니다.');
      const seenPostIds = currentPosts.map((p) => p.postId);
      await saveLastCheck({
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
      logger.info(`신규 게시글 ${newPosts.length}개 발견`);

      // 신규 게시글 알림 전송 (최신순으로 정렬된 상태)
      for (const post of newPosts.slice(0, 10)) {
        // 최대 10개까지만 알림
        await notifyNewPost(post);
        // 알림 간격을 두어 API 제한 방지
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (newPosts.length > 10) {
        logger.info(`${newPosts.length - 10}개의 추가 신규 게시글은 알림을 생략했습니다`);
      }
    } else {
      logger.info('신규 게시글이 없습니다');
    }

    // 마지막 체크 정보 업데이트 (기존 seenPostIds에 새로운 게시글 추가)
    const currentPostIds = currentPosts.map((p) => p.postId);
    const updatedSeenPostIds = [
      ...new Set([...currentPostIds, ...lastCheck.seenPostIds]), // 중복 제거하며 합침
    ].slice(0, 200); // 최근 200개만 유지

    await saveLastCheck({
      lastPostId: currentPosts[0]?.postId,
      lastCheckTime: new Date().toISOString(),
      seenPostIds: updatedSeenPostIds,
    });
  } catch (error) {
    logger.error('뽐뿌 신규 게시글 확인 실패', error);
  }
}

/**
 * 뽐뿌 모니터링 시작
 */
function startPpomppuMonitoring(intervalMs = 60000) {
  logger.info(`뽐뿌 모니터링 시작 (체크 간격: ${intervalMs / 1000}초)`);

  // 즉시 첫 체크 실행
  checkNewPosts();

  // 주기적으로 체크
  const intervalId = setInterval(checkNewPosts, intervalMs);

  return intervalId;
}

/**
 * 뽐뿌 모니터링 중지
 */
function stopPpomppuMonitoring(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    logger.info('뽐뿌 모니터링 중지');
  }
}

module.exports = {
  startPpomppuMonitoring,
  stopPpomppuMonitoring,
  checkNewPosts,
};
