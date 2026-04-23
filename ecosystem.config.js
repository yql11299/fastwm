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
        HOST: '0.0.0.0',
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
    },
    {
      name: 'fastwm-client',
      script: './client/node_modules/.bin/vite',
      args: 'preview --port 5173 --host 0.0.0.0',
      cwd: './client',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/client-error.log',
      out_file: './logs/client-out.log',
    },
  ],
};