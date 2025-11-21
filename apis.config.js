// API 목록 설정
// 각 API는 독립적으로 모니터링됩니다

module.exports = [
  {
    id: 'monimo-api',
    name: '모니모 API(inqrSvBasisPly)',
    url: 'https://api.monimo.com/restapi/cmn/ply/inqrSvBasisPly',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {},
    timeout: 5000,
    enabled: false,
    channel: 'health', // 알림을 받을 채널 (SLACK_WEBHOOK_URLS에서 정의된 채널명)
    checkInterval: 1000, // 체크 간격 (밀리초, 선택) - 미지정 시 .env의 CHECK_INTERVAL 사용
    responseTimeThreshold: 100, // 응답 시간 임계값 (밀리초, 선택) - 미지정 시 .env의 RESPONSE_TIME_THRESHOLD 사용
  },
  {
    id: '원앱-api-1',
    name: '원앱 서버시간 API(searchCrtlSvrDtm)',
    url: 'https://mapi.monimo.com/svc-common/sys/rsrc/v1/searchCrtlSvrDtm',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 5000,
    enabled: true,
    channel: 'health', // 알림을 받을 채널
    checkInterval: 1000, // 30초마다 체크
    responseTimeThreshold: 100, // 500ms 초과 시 느림 경고
  },
  {
    id: '원앱-api-2',
    name: '원앱 앱기본정책조회 API(searchSappBasPly)',
    url: 'https://mapi.monimo.com/svc-common/sapp/basis/v1/searchSappBasPly',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {'mblOsDvC':'01', 'apstDvC':'2','mblDvcDrmNo': '1234567890'},
    timeout: 5000,
    enabled: true,
    channel: 'health', // 알림을 받을 채널
    checkInterval: 1000, // 10초마다 체크
    responseTimeThreshold: 200, // 200ms 초과 시 느림 경고
    // checkInterval과 responseTimeThreshold를 지정하지 않으면 .env 기본값 사용
  },

  // 추가 API 예시 (필요시 주석 해제)
  /*
  {
    id: 'example-api-2',
    name: '예시 API 2',
    url: 'https://api.example.com/health',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 5000,
    enabled: true,
  },
  {
    id: 'example-api-3',
    name: '예시 API 3',
    url: 'https://api.example.com/status',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN',
    },
    body: {
      service: 'monitoring',
    },
    timeout: 3000,
    enabled: false,  // 비활성화된 API
  },
  */
];
