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
    checkInterval: 600000, // 체크 간격 (밀리초) - 10분
    enabled: false, // 블로그 검색 비활성화
    blockedKeywords: [], // 제목이나 내용에 포함 시 알림 제외할 키워드 목록
  },
  {
    id: 'naver-news-monimo',
    keyword: '모니모',
    searchType: 'news',
    channel: 'naver-monimo',
    webhookKey: 'health',
    checkInterval: 180000, // 체크 간격 (밀리초) - 3분 (하루 480회, API 한도의 1.9%)
    enabled: true,
    blockedKeywords: [], // 예: ['광고', '스팸', '홍보']
  },
  {
    id: 'naver-cafe-monimo',
    keyword: '모니모',
    searchType: 'cafe',
    channel: 'naver-monimo',
    webhookKey: 'health',
    checkInterval: 180000, // 체크 간격 (밀리초) - 3분 (하루 480회, API 한도의 1.9%)
    enabled: true,
    blockedKeywords: ['텍사모','출석','걷기','출첵'],
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
  //   blockedKeywords: ['제외키워드1', '제외키워드2'], // 제목/내용에 이 단어들이 포함되면 알림 제외
  // },
];
