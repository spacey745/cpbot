import _ from 'lodash';
import config from 'config';
import Chance from 'chance';
import mongoose from 'mongoose';
import nock from 'nock';
import sinon from 'sinon';
import {Telegram} from 'telegraf';
import '../server';

const chance = new Chance();

let configCopy;

export default function () {
  before('save bot config state', () => {
    configCopy = _.cloneDeep(config.botConfig);
  });

  before('drop database', (cb) => {
    if (mongoose.connection.db) {
      dropDatabase();
    } else {
      mongoose.connection.once('open', dropDatabase);
    }

    function dropDatabase() {
      mongoose.connection.name.should.endWith('-test', 'Be sure that you are NOT accidentally dropping PROD database');
      mongoose.connection.db.dropDatabase(cb);
    }
  });

  before('stub telegram init api calls', () => {
    sinon.stub(Telegram.prototype, 'setWebhook').resolves();
    sinon.stub(Telegram.prototype, 'getMe').resolves(chance.telegram.user());
  });

  after('restore bot config state', () => {
    config.botConfig = configCopy;
  });

  after('restore stubs', () => {
    nock.cleanAll();
    sinon.restore();
  });
}
