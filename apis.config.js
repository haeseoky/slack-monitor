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
    enabled: true,
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
  },
  {
    id: '원앱-api-2',
    name: '원앱 앱기본정책조회 API(searchSappBasPly)',
    url: 'https://mapi.monimo.com/svc-common/sapp/basis/v1/searchSappBasPly',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 5000,
    enabled: true,
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
