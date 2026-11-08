const { loadEnvFile } = require('node:process');
const { join } = require('node:path');
const { existsSync } = require('node:fs');

const envPath = join(__dirname, '.env');
if (existsSync(envPath)) loadEnvFile(envPath);

const target = process.env.NG_APP_API_URL?.trim().replace(/\/+$/, '');
if (!target || !/^https?:\/\//.test(target)) {
  throw new Error('Для dev-прокси укажите полный http(s) адрес NG_APP_API_URL в корневом .env.');
}

module.exports = {
  '/api/**': {
    target,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
  },
};
