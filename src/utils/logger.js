/**
 * 로깅 유틸리티
 * 일관된 로그 포맷과 레벨을 제공합니다.
 */

const LOG_LEVELS = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
};

const ICONS = {
  INFO: 'ℹ️',
  SUCCESS: '✓',
  WARNING: '⚠️',
  ERROR: '✗',
};

/**
 * 로그 메시지 포맷팅
 */
function formatMessage(level, message) {
  const timestamp = new Date().toLocaleString('ko-KR');
  const icon = ICONS[level] || '';
  return `[${timestamp}] ${icon} ${message}`;
}

/**
 * 정보 로그
 */
function info(message) {
  console.log(formatMessage(LOG_LEVELS.INFO, message));
}

/**
 * 성공 로그
 */
function success(message) {
  console.log(formatMessage(LOG_LEVELS.SUCCESS, message));
}

/**
 * 경고 로그
 */
function warn(message) {
  console.warn(formatMessage(LOG_LEVELS.WARNING, message));
}

/**
 * 에러 로그
 */
function error(message, err) {
  const fullMessage = err ? `${message} - ${err.message}` : message;
  console.error(formatMessage(LOG_LEVELS.ERROR, fullMessage));
}

/**
 * 구분선 출력
 */
function separator(char = '=', length = 50) {
  console.log(char.repeat(length));
}

/**
 * 헤더 출력
 */
function header(message) {
  separator();
  console.log(message);
  separator();
}

module.exports = {
  info,
  success,
  warn,
  error,
  separator,
  header,
};
