const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/solicitudes',
  method: 'GET',
  headers: {
    'x-api-key': 'dev-key-001',
    'x-user': 'admin01'
  },
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200 || res.statusCode === 401) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();