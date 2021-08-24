import Chance from 'chance';
import {botConfig} from 'config';
import request from 'supertest';
import nock from 'nock';
import sinon from 'sinon';
import {app} from '../../../../server';
import {MessageForward, User} from '../../../../src/db';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import {encryptNumberWithConfigIV} from '../../../../src/helpers/cryptoHelper';
import {getBotId} from '../../../../src/services/botService';

const chance = new Chance();

describe('Telegram Service: Favorite User Tests', () => {
  cleanStateBetweenTests();

  let initDbUser;
  let userMessage;
  let botUserMessage;
  let sendMessageStub;

  before('generate a user message', () => {
    userMessage = chance.telegram.message();

    botUserMessage = chance.telegram.message({
      from: {id: getBotId()},
      chat: {id: botConfig.ADMIN_GROUP_ID},
    });
  });

  beforeEach('stub telegram services', () => {
    sendMessageStub = sinon.stub();
    nock.cleanAll();

    // Process the initial user message
    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .times(1)
      .reply(200, chance.telegram.httpResponse({result: botUserMessage}));

    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .reply((uri, body) => {
        sendMessageStub(body);
        return [200, chance.telegram.httpResponse({result: chance.telegram.message()})];
      })
      .persist();
  });

  beforeEach('delete existing data', async () => {
    await MessageForward.deleteMany();
    await User.deleteMany();
  });

  beforeEach('send a user message', async () => {
    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: userMessage}));
    res.status.should.eql(200);

    initDbUser = await User.findOne({tgUserId: encryptNumberWithConfigIV(userMessage.from.id)});
    should.exist(initDbUser);
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  it('should make the user favorite when an admin is reply to the user message with "/favorite" command', async () => {
    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_GROUP_ID,
      },
      reply_to_message: botUserMessage,
      text: '/favorite',
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    const dbUser = await User.findById(initDbUser._id);
    dbUser.isFavorite.should.be.true();

    sinon.assert.calledOnce(sendMessageStub);
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': botConfig.ADMIN_GROUP_ID,
      'text': 'Пользователь добавлен в избранные',
    });
  });

  it('should make the user favorite when a user does NOT exist in the database', async () => {
    await initDbUser.delete();

    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_GROUP_ID,
      },
      reply_to_message: botUserMessage,
      text: '/favorite',
    });

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    const dbUsers = await User.find();
    dbUsers.should.have.lengthOf(1);

    const dbUser = dbUsers[0].toObject();
    dbUser.isFavorite.should.be.true();

    sinon.assert.calledOnce(sendMessageStub);
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': botConfig.ADMIN_GROUP_ID,
      'text': 'Пользователь добавлен в избранные',
    });
  });

  it('should make the user unfavorite when an admin is reply to the user message with "/unfavorite" command', async () => {
    const newMessage = chance.telegram.message({
      chat: {
        id: botConfig.ADMIN_GROUP_ID,
      },
      reply_to_message: botUserMessage,
      text: '/unfavorite',
    });

    // Make the user favorite
    await initDbUser.updateOne({isFavorite: true});

    const res = await request(app)
      .post('/')
      .send(chance.telegram.update({message: newMessage}));
    res.status.should.eql(200);

    const dbUser = await User.findById(initDbUser.id);
    dbUser.isFavorite.should.be.false();

    sinon.assert.calledOnce(sendMessageStub);
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': botConfig.ADMIN_GROUP_ID,
      'text': 'Пользователь удален из избранных',
    });
  });
});
