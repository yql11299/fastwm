# ===========================================
# PM2 部署配置文件 - 证件水印处理系统
# ===========================================

module.exports = {
  apps: [
    {
      name: 'fastwm-server',
      script: 'src/index.js',
      cwd: './server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'fastwm-client',
      script: 'npx',
      args: 'serve dist -l 5173',
      cwd: './client',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/client-error.log',
      out_file: './logs/client-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};