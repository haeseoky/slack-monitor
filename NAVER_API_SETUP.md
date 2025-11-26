# 네이버 검색 API 설정 가이드

네이버 검색 모니터링 기능을 사용하려면 네이버 개발자 센터에서 API 키를 발급받아야 합니다.

## 1. 네이버 개발자 센터 애플리케이션 등록

### 1.1 네이버 개발자 센터 접속
https://developers.naver.com/apps 에 접속하여 네이버 계정으로 로그인합니다.

### 1.2 애플리케이션 등록
1. **애플리케이션 등록** 버튼 클릭
2. **애플리케이션 정보** 입력:
   - **애플리케이션 이름**: Slack Monitor (또는 원하는 이름)
   - **사용 API**:
     - ✅ 검색 > 블로그 검색
     - ✅ 검색 > 뉴스 검색
     - ✅ 검색 > 카페글 검색

3. **환경 추가** (비로그인 오픈 API):
   - **WEB 설정**: http://localhost (테스트용)

4. **등록하기** 버튼 클릭

### 1.3 API 키 확인
애플리케이션 등록 후 다음 정보를 확인합니다:
- **Client ID**: `YOUR_CLIENT_ID`
- **Client Secret**: `YOUR_CLIENT_SECRET`

## 2. .env 파일에 API 키 설정

프로젝트 루트의 `.env` 파일을 열어 다음과 같이 설정합니다:

```bash
# 네이버 검색 API 인증 정보
NAVER_CLIENT_ID=YOUR_CLIENT_ID
NAVER_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

**주의사항:**
- `YOUR_CLIENT_ID`와 `YOUR_CLIENT_SECRET`를 실제 발급받은 값으로 변경하세요
- API 키는 절대 GitHub 등에 공개하지 마세요 (.env 파일은 .gitignore에 포함되어 있습니다)

## 3. 검색 설정

`naver-search.config.js` 파일에서 모니터링할 검색어와 타입을 설정합니다:

```javascript
module.exports = [
  {
    id: 'naver-blog-monimo',
    keyword: '모니모',
    searchType: 'blog', // blog, news, cafe
    channel: 'naver-monimo',
    webhookKey: 'health',
    checkInterval: 600000, // 10분
    enabled: true,
  },
  // ... 추가 설정
];
```

## 4. 애플리케이션 실행

```bash
npm start
```

## 5. API 사용량 제한

네이버 검색 API는 다음과 같은 제한이 있습니다:

- **하루 호출 한도**: 25,000건
- **초당 호출 한도**: 10건

따라서 체크 간격은 **최소 10분 이상** 권장합니다.

## 6. 문제 해결

### API 키 오류
```
네이버 API 키가 설정되지 않았습니다
```
→ .env 파일에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET이 올바르게 설정되었는지 확인하세요.

### 인증 실패 (401)
```
네이버 API 오류: 401
```
→ Client ID와 Client Secret이 정확한지 확인하세요.

### 할당량 초과 (429)
```
네이버 API 오류: 429
```
→ API 호출 한도를 초과했습니다. 체크 간격을 늘리거나 다음 날까지 기다리세요.

## 참고 자료

- [네이버 검색 API 가이드](https://developers.naver.com/docs/serviceapi/search/blog/blog.md)
- [네이버 개발자 센터](https://developers.naver.com/)
