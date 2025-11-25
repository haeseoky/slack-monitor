/**
 * 뽐뿌 검색 모니터링 설정
 * 특정 키워드로 검색된 게시글을 실시간으로 모니터링합니다.
 */

module.exports = [
  {
    id: 'ppomppu-monimo',
    keyword: '모니모',
    channel: 'ppomppu-monimo', // Slack 채널명
    webhookKey: 'health', // .env의 SLACK_WEBHOOK_URLS에서 사용할 키
    checkInterval: 60000, // 체크 간격 (밀리초) - 기본 1분
    enabled: true,
    // 검색 옵션
    searchOptions: {
      bbs_cate: '2', // 게시판 카테고리 (2: 뽐뿌게시판)
      search_type: 'sub_memo', // 검색 타입 (sub_memo: 제목+내용)
      order_type: 'date', // 정렬 방식 (date: 날짜순)
    },
  },
  // 추가 검색 조건 예시
  // {
  //   id: 'ppomppu-example',
  //   keyword: '다른키워드',
  //   channel: 'ppomppu-other',
  //   webhookKey: 'health',
  //   checkInterval: 120000, // 2분
  //   enabled: false,
  //   searchOptions: {
  //     bbs_cate: '2',
  //     search_type: 'sub_memo',
  //     order_type: 'date',
  //   },
  // },
];
