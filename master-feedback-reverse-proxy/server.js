import express from 'express';
import {createProxyMiddleware} from 'http-proxy-middleware';
import {proxyConfig, routes} from 'config';
import https from 'https';
import fs from 'fs';
import {v4 as uuid} from 'uuid';
import {DEV} from './constants/enums';
import http from 'http';

const {PORT, SSL_PASSPHRASE, ENV} = proxyConfig;
const app = express();

app.get('/alive', (req, res) => {
  return res.status(200).send('Alive');
});

for (let route of routes) {
  app.use(
    route.route,
    createProxyMiddleware({
      target: route.address,
      pathRewrite: (path, req) => {
        const newPath = '/' + path.split('/').slice(2).join('/');
        return newPath; // Could use replace, but take care of the leading '/'
      },
    }),
  );
}

if (ENV === DEV) {
  http.createServer(app).listen(PORT, () => {
    console.log(`Reverse proxy http server running on port ${PORT}`);
  });
} else {
  const tlsOptions = {
    key: fs.readFileSync('./certs/key.pem'),
    cert: fs.readFileSync('./certs/cert.pem'),
    passphrase: SSL_PASSPHRASE || '',
  };

  https.createServer(tlsOptions, app).listen(PORT, () => {
    console.log(`Reverse proxy https server running on port ${PORT}`);
  });
}

// console.log('generated uuid', uuid());
