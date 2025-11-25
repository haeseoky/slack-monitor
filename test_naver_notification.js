const axios = require('axios'); // axios는 더 이상 필요 없지만, 기존 코드에 남아있을까봐 일단 둠
const cheerio = require('cheerio'); // cheerio도 마찬가지
require('dotenv').config();
const { fetchSearchResults, notifySearchResult } = require('./src/services/naverSearchMonitor'); // fetchSearchResults는 호출 안함
const logger = require('./src/utils/logger');

// 테스트할 검색 설정 (기존 설정 파일 참조)
const testConfigs = [
  {
    id: 'test-naver-blog',
    keyword: '모니모',
    searchType: 'blog',
    channel: 'naver-monimo', // .env나 config에 설정된 실제 채널명이어야 함
    webhookKey: 'health',
    enabled: true,
  },
  {
    id: 'test-naver-news',
    keyword: '모니모',
    searchType: 'news',
    channel: 'naver-monimo',
    webhookKey: 'health',
    enabled: true,
  },
  {
    id: 'test-naver-cafe',
    keyword: '모니모',
    searchType: 'cafe',
    channel: 'naver-monimo',
    webhookKey: 'health',
    enabled: true,
  }
];

// 샘플 데이터
const samplePosts = {
  blog: {
    postId: 'sample-blog-12345',
    title: '[샘플] 블로그 테스트 글입니다. (모니모)',
    link: 'https://blog.naver.com/sampleblog/12345',
    desc: '이것은 블로그 알림 테스트를 위한 샘플 내용입니다.',
    author: '테스트블로거',
    date: '방금 전',
    imageUrl: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=BlogTest',
    searchType: 'blog',
  },
  news: {
    postId: 'sample-news-67890',
    title: '[샘플] 뉴스 테스트 헤드라인 (모니모 관련 소식)',
    link: 'https://n.news.naver.com/sample/article/000/67890',
    desc: '이것은 뉴스 알림 테스트를 위한 샘플 기사 내용입니다.',
    author: '테스트언론사',
    date: '1시간 전',
    imageUrl: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=NewsTest',
    searchType: 'news',
  },
  cafe: {
    postId: 'sample-cafe-11223',
    title: '[샘플] 카페 테스트 게시글 (모니모 정보 공유)',
    link: 'https://cafe.naver.com/samplecafe/11223',
    desc: '이것은 카페 알림 테스트를 위한 샘플 게시글 내용입니다.',
    author: '테스트카페회원',
    cafe: '샘플카페',
    date: '2분 전',
    imageUrl: 'https://via.placeholder.com/150/00FF00/FFFFFF?text=CafeTest',
    searchType: 'cafe',
  }
};

async function runTest() {
  logger.header('🧪 네이버 샘플 데이터 Slack 발송 테스트 시작');

  for (const config of testConfigs) {
    console.log(`
[${config.searchType}] Slack 알림 발송 시도...`);
    
    try {
      // 1. 샘플 데이터 사용
      const samplePost = samplePosts[config.searchType];

      if (!samplePost) {
        logger.error(`[${config.searchType}] 샘플 데이터를 찾을 수 없습니다.`);
        continue;
      }
      
      console.log(`   제목: ${samplePost.title}`);
      console.log(`   링크: ${samplePost.link}`);
      
      // 2. 샘플 데이터로 Slack 알림 발송
      await notifySearchResult(config, samplePost);
      
      // 너무 빠른 요청 방지 (Slack API Rate Limit)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      logger.error(`[${config.searchType}] 테스트 실패`, error);
    }
  }

  logger.separator();
  logger.success('테스트 완료');
}

runTest();
