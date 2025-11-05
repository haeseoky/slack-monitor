module.exports = {
  apps: [{
    name: 'slack-monitor',
    script: './index.js',
    
    // 재시작 설정
    autorestart: true,
    watch: false,
    max_memory_restart: '700M',
    
    // 인스턴스 설정
    instances: 1,
    exec_mode: 'fork',
    
    // 환경변수
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 로그 설정
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 재시작 정책
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000
  }]
}
