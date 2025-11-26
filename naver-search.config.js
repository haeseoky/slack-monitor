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
    checkInterval: 600000, // 체크 간격 (밀리초) - 10분 (봇 차단 방지)
    enabled: true,
  },
  {
    id: 'naver-news-monimo',
    keyword: '모니모',
    searchType: 'news',
    channel: 'naver-monimo',
    webhookKey: 'health',
    checkInterval: 720000, // 체크 간격 (밀리초) - 12분 (봇 차단 방지, 각기 다른 간격)
    enabled: true,
  },
  {
    id: 'naver-cafe-monimo',
    keyword: '모니모',
    searchType: 'cafe',
    channel: 'naver-monimo',
    webhookKey: 'health',
    checkInterval: 840000, // 체크 간격 (밀리초) - 14분 (봇 차단 방지, 각기 다른 간격)
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
