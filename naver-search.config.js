/**
 * 네이버 검색 모니터링 설정
 * 특정 키워드로 검색된 네이버 블로그, 뉴스, 카페 게시글을 실시간으로 모니터링합니다.
 */

module.exports = [
  {
    id: 'naver-blog-monimo',
    keyword: '모니모',
    searchType: 'blog', // blog, news, cafe
    channel: 'naver-monimo', // Slack 채널명
    webhookKey: 'health', // .env의 SLACK_WEBHOOK_URLS에서 사용할 키
    checkInterval: 300000, // 체크 간격 (밀리초) - 기본 5분
    enabled: true,
  },
  {
    id: 'naver-news-monimo',
    keyword: '모니모',
    searchType: 'news',
    channel: 'naver-monimo',
    webhookKey: 'health',
    checkInterval: 300000, // 체크 간격 (밀리초) - 기본 5분
    enabled: true,
  },
  {
    id: 'naver-cafe-monimo',
    keyword: '모니모',
    searchType: 'cafe',
    channel: 'naver-monimo',
    webhookKey: 'health',
    checkInterval: 300000, // 체크 간격 (밀리초) - 기본 5분
    enabled: true,
  },
  // 추가 검색 조건 예시
  // {
  //   id: 'naver-blog-example',
  //   keyword: '다른키워드',
  //   searchType: 'blog',
  //   channel: 'naver-other',
  //   webhookKey: 'health',
  //   checkInterval: 120000, // 2분
  //   enabled: false,
  // },
];
