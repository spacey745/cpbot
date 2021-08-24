import {botConfig} from 'config';
import nock from 'nock';

// Init global should variable
import 'should';

// Extend chance
import '../test/mixin/chance-mixin';

// Overwrite database url to protect from accidental tests execution on PROD database
botConfig.MONGO_DB_URL = `${botConfig.MONGO_DB_URL}-test`;

// Disable all non-localhost http requests from the app
nock.disableNetConnect();
nock.enableNetConnect(/(127.0.0.1|localhost)/);

// Switch the bot to webhook mode
botConfig.SERVER_URL = 'http://localhost';
