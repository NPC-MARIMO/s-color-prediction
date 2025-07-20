const Cashfree = require('cashfree-pg');

const cashfree = new Cashfree.Cashfree({
  env: process.env.CASHFREE_ENV || 'TEST', // 'TEST' or 'PROD'
  appId: process.env.CASHFREE_APP_ID,
  secretKey: process.env.CASHFREE_SECRET_KEY,
});

module.exports = cashfree; 