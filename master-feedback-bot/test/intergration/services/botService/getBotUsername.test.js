import Chance from 'chance';
import {botConfig} from 'config';
import sinon from 'sinon';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import {getBot, getBotUsername} from '../../../../src/services/botService';

const chance = new Chance();

const {DB_TABLE} = botConfig;

describe('Bot Service: Get Bot Username Tests', () => {
  cleanStateBetweenTests();

  let optionsUserName;
  let username;

  beforeEach('init username', () => {
    optionsUserName = getBot().options.username;
    username = optionsUserName || chance.word();
    getBot().options.username = username;
  });

  afterEach('restore username', () => {
    getBot().options.username = optionsUserName;
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  it('should return bot username', () => {
    getBotUsername().should.eql(username);
  });

  it('should return "DB_TABLE" if the a username if not defined', () => {
    delete getBot().options.username;
    getBotUsername().should.eql(DB_TABLE);
  });
});
