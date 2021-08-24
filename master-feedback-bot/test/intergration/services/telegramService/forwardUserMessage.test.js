import _ from 'lodash';
import Chance from 'chance';
import {botConfig} from 'config';
import request from 'supertest';
import mongoose from 'mongoose';
import nock from 'nock';
import sinon from 'sinon';
import {app} from '../../../../server';
import {MessageForward, User} from '../../../../src/db';
import {decryptText, encryptNumberWithConfigIV, encryptText} from '../../../../src/helpers/cryptoHelper';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';

const chance = new Chance();

describe('Telegram Service: Forward User Messages Tests', () => {
  cleanStateBetweenTests();

  let messageByChatId = {};
  let sendMessageStub;
  let copyMessageStub;
  let sendPhotoStub;

  beforeEach('stub telegram services', () => {
    sendMessageStub = sinon.stub();
    copyMessageStub = sinon.stub();
    sendPhotoStub = sinon.stub();

    nock.cleanAll();
    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendMessage')
      .reply((uri, body) => {
        messageByChatId[body.chat_id] = chance.telegram.message();
        sendMessageStub(body);
        return [200, chance.telegram.httpResponse({result: messageByChatId[body.chat_id]})];
      })
      .persist();
    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/copyMessage')
      .reply((uri, body) => {
        messageByChatId[body.chat_id] = chance.telegram.message();
        copyMessageStub(body);
        return [200, chance.telegram.httpResponse({result: messageByChatId[body.chat_id]})];
      })
      .persist();
    nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
      .post('/sendPhoto')
      .reply((uri, body) => {
        messageByChatId[body.chat_id] = chance.telegram.message();
        sendPhotoStub(body);
        return [200, chance.telegram.httpResponse({result: messageByChatId[body.chat_id]})];
      })
      .persist();
  });

  beforeEach('delete existing data', async () => {
    messageByChatId = {};
    await MessageForward.deleteMany();
    await User.deleteMany();
  });

  beforeEach('reset stubs history', () => {
    sinon.resetHistory();
  });

  describe('when storing of user details is disabled', () => {
    before('enable storing of user details', () => {
      botConfig.STORE_USER_DETAILS = false;
    });

    it('should NOT store user data', async () => {
      const message = chance.telegram.message();
      const currentDate = new Date();

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      dbUser.should.eql({
        ..._.pick(dbUser, '_id', '__v', 'maskUid', 'created', 'lastUsed'),
        tgUserId: encryptNumberWithConfigIV(message.from.id),
        langCode: message.from.language_code,
      });
      dbUser.created.should.be.within(currentDate, new Date());
      dbUser.lastUsed.should.be.within(currentDate, new Date());
    });

    it('should forward a user message to admin groups and provide user info', async () => {
      const message = chance.telegram.message();

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const text =
        `#${dbUser.maskUid}\n` +
        `${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n${message.text}`;

      sinon.assert.calledTwice(sendMessageStub);
      sinon.assert.notCalled(copyMessageStub);

      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'text': text,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': text,
      });
    });

    it('should forward a user message to admin groups and provide user info in caption', async () => {
      const message = chance.telegram.message({
        photo: [chance.telegram.photoSize()],
        caption: chance.sentence(),
      });
      delete message.text;

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const caption =
        `#${dbUser.maskUid}\n` +
        `${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n${message.caption}`;

      sinon.assert.notCalled(sendMessageStub);
      sinon.assert.calledTwice(copyMessageStub);

      sinon.assert.calledWith(copyMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'from_chat_id': message.chat.id,
        'message_id': message.message_id,
        'caption': caption,
      });
      sinon.assert.calledWith(copyMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'from_chat_id': message.chat.id,
        'message_id': message.message_id,
        'caption': caption,
      });
    });

    it('should forward a user message to admin groups and shift user styles', async () => {
      const message = chance.telegram.message({
        from: {first_name: `${chance.first()} 🏝`},
        text: 'bo🏝ld italic underline strikethrough code www.google.com',
        entities: [
          {offset: 0, length: 6, type: 'bold'},
          {offset: 7, length: 6, type: 'italic'},
          {offset: 14, length: 9, type: 'underline'},
          {offset: 24, length: 13, type: 'strikethrough'},
          {offset: 38, length: 4, type: 'code'},
          {offset: 43, length: 14, type: 'link'},
        ],
      });

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const messageHeader = `#${dbUser.maskUid}\n${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n`;
      const text = `${messageHeader}${message.text}`;
      const entities = [
        {offset: messageHeader.length, length: 6, type: 'bold'},
        {offset: messageHeader.length + 7, length: 6, type: 'italic'},
        {offset: messageHeader.length + 14, length: 9, type: 'underline'},
        {offset: messageHeader.length + 24, length: 13, type: 'strikethrough'},
        {offset: messageHeader.length + 38, length: 4, type: 'code'},
        {offset: messageHeader.length + 43, length: 14, type: 'link'},
      ];

      sinon.assert.calledTwice(sendMessageStub);
      sinon.assert.notCalled(copyMessageStub);

      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'text': text,
        'entities': entities,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': text,
        'entities': entities,
      });
    });

    it('should forward a user message to admin groups and shift user styles in caption', async () => {
      const message = chance.telegram.message({
        from: {first_name: `${chance.first()} 🏝`},
        photo: [chance.telegram.photoSize()],
        caption: 'bo🏝ld italic underline strikethrough code www.google.com',
        caption_entities: [
          {offset: 0, length: 6, type: 'bold'},
          {offset: 7, length: 6, type: 'italic'},
          {offset: 14, length: 9, type: 'underline'},
          {offset: 24, length: 13, type: 'strikethrough'},
          {offset: 38, length: 4, type: 'code'},
          {offset: 43, length: 14, type: 'link'},
        ],
      });
      delete message.text;

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const messageHeader = `#${dbUser.maskUid}\n${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n`;
      const caption = `${messageHeader}${message.caption}`;
      const entities = [
        {offset: messageHeader.length, length: 6, type: 'bold'},
        {offset: messageHeader.length + 7, length: 6, type: 'italic'},
        {offset: messageHeader.length + 14, length: 9, type: 'underline'},
        {offset: messageHeader.length + 24, length: 13, type: 'strikethrough'},
        {offset: messageHeader.length + 38, length: 4, type: 'code'},
        {offset: messageHeader.length + 43, length: 14, type: 'link'},
      ];

      sinon.assert.notCalled(sendMessageStub);
      sinon.assert.calledTwice(copyMessageStub);

      sinon.assert.calledWith(copyMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'from_chat_id': message.chat.id,
        'message_id': message.message_id,
        'caption': caption,
        'caption_entities': entities,
      });
      sinon.assert.calledWith(copyMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'from_chat_id': message.chat.id,
        'message_id': message.message_id,
        'caption': caption,
        'caption_entities': entities,
      });
    });

    it('should forward user message halves to admin groups when the text is close to limit', async () => {
      const message = chance.telegram.message({text: chance.string({length: 4096})});

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const text1 =
        `#${dbUser.maskUid}\n` +
        `${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n` +
        `${message.text.substring(0, 2048)}...`;
      const text2 =
        `#${dbUser.maskUid}\n` +
        `${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n` +
        `${message.text.substring(2048)}`;

      sinon.assert.callCount(sendMessageStub, 4);
      sinon.assert.notCalled(copyMessageStub);

      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'text': text1,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': text1,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'text': text2,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': text2,
      });
    });

    it('should forward user message halves to admin groups when the caption is close to limit', async () => {
      const message = chance.telegram.message({
        photo: [chance.telegram.photoSize()],
        caption: chance.string({length: 1024}),
      });
      delete message.text;

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const caption1 =
        `#${dbUser.maskUid}\n` +
        `${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n` +
        `${message.caption.substring(0, 512)}...`;
      const caption2 =
        `#${dbUser.maskUid}\n` +
        `${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n` +
        `${message.caption.substring(512)}`;

      sinon.assert.calledTwice(sendMessageStub);
      sinon.assert.calledTwice(copyMessageStub);

      sinon.assert.calledWith(copyMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'from_chat_id': message.chat.id,
        'message_id': message.message_id,
        'caption': caption1,
      });
      sinon.assert.calledWith(copyMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'from_chat_id': message.chat.id,
        'message_id': message.message_id,
        'caption': caption1,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': caption2,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': caption2,
      });
    });

    it('should forward user message halves and fix styles when the text is close to limit', async () => {
      const startTextRandomString = `🏝🏝🏝${chance.string({length: 2017})}`;
      const finishTextRandomString = `${chance.string({length: 2017})}🏝🏝🏝`;

      const message = chance.telegram.message({
        text: `${startTextRandomString}bold_italic_underline_strikethrough_code_www.google.com${finishTextRandomString}`,
        entities: [
          {offset: 2023, length: 4, type: 'bold'},
          {offset: 2028, length: 6, type: 'italic'},
          {offset: 2035, length: 9, type: 'underline'},
          {offset: 2045, length: 13, type: 'strikethrough'},
          {offset: 2059, length: 4, type: 'code'},
          {offset: 2064, length: 14, type: 'link'},
        ],
      });

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const messageHeader = `#${dbUser.maskUid}\n${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n`;
      const text1 = `${messageHeader}${startTextRandomString}bold_italic_underline_strik...`;
      const text2 = `${messageHeader}ethrough_code_www.google.com${finishTextRandomString}`;
      const entities1 = [
        {offset: messageHeader.length + 2023, length: 4, type: 'bold'},
        {offset: messageHeader.length + 2028, length: 6, type: 'italic'},
        {offset: messageHeader.length + 2035, length: 9, type: 'underline'},
        {offset: messageHeader.length + 2045, length: 5, type: 'strikethrough'},
      ];
      const entities2 = [
        {offset: messageHeader.length, length: 8, type: 'strikethrough'},
        {offset: messageHeader.length + 9, length: 4, type: 'code'},
        {offset: messageHeader.length + 14, length: 14, type: 'link'},
      ];

      sinon.assert.callCount(sendMessageStub, 4);
      sinon.assert.notCalled(copyMessageStub);

      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'text': text1,
        'entities': entities1,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': text1,
        'entities': entities1,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'text': text2,
        'entities': entities2,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': text2,
        'entities': entities2,
      });
    });

    it('should forward user message halves and fix styles when the caption is close to limit', async () => {
      const startTextRandomString = `🏝🏝🏝${chance.string({length: 481})}`;
      const finishTextRandomString = `${chance.string({length: 481})}🏝🏝🏝`;

      const message = chance.telegram.message({
        photo: [chance.telegram.photoSize()],
        caption: `${startTextRandomString}bold_italic_underline_strikethrough_code_www.google.com${finishTextRandomString}`,
        caption_entities: [
          {offset: 487, length: 4, type: 'bold'},
          {offset: 492, length: 6, type: 'italic'},
          {offset: 499, length: 9, type: 'underline'},
          {offset: 509, length: 13, type: 'strikethrough'},
          {offset: 523, length: 4, type: 'code'},
          {offset: 528, length: 14, type: 'link'},
        ],
      });
      delete message.text;

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const messageHeader = `#${dbUser.maskUid}\n${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n`;
      const caption1 = `${messageHeader}${startTextRandomString}bold_italic_underline_strik...`;
      const caption2 = `${messageHeader}ethrough_code_www.google.com${finishTextRandomString}`;
      const entities1 = [
        {offset: messageHeader.length + 487, length: 4, type: 'bold'},
        {offset: messageHeader.length + 492, length: 6, type: 'italic'},
        {offset: messageHeader.length + 499, length: 9, type: 'underline'},
        {offset: messageHeader.length + 509, length: 5, type: 'strikethrough'},
      ];
      const entities2 = [
        {offset: messageHeader.length, length: 8, type: 'strikethrough'},
        {offset: messageHeader.length + 9, length: 4, type: 'code'},
        {offset: messageHeader.length + 14, length: 14, type: 'link'},
      ];

      sinon.assert.calledTwice(sendMessageStub);
      sinon.assert.calledTwice(copyMessageStub);

      sinon.assert.calledWith(copyMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'from_chat_id': message.chat.id,
        'message_id': message.message_id,
        'caption': caption1,
        'caption_entities': entities1,
      });
      sinon.assert.calledWith(copyMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'from_chat_id': message.chat.id,
        'message_id': message.message_id,
        'caption': caption1,
        'caption_entities': entities1,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': caption2,
        'entities': entities2,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': caption2,
        'entities': entities2,
      });
    });

    it('should forward a user message to admin favorite group when the user is favorite', async () => {
      const message = chance.telegram.message();
      const dbUser = await User.create({tgUserId: message.from.id, isFavorite: true});

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const text =
        `#${dbUser.maskUid}\n` +
        `${message.from.first_name} ${message.from.last_name} @${message.from.username}\n\n${message.text}`;

      sinon.assert.calledTwice(sendMessageStub);
      sinon.assert.notCalled(copyMessageStub);

      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_FAV_GROUP_ID,
        'text': text,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': text,
      });
    });
  });

  describe('when storing of user details is enabled', () => {
    before('enable storing of user details', () => {
      botConfig.STORE_USER_DETAILS = true;
    });

    it('should store user data', async () => {
      const message = chance.telegram.message();
      const currentDate = new Date();

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      dbUser.should.eql({
        ..._.pick(dbUser, '_id', '__v', 'maskUid', 'created', 'lastUsed'),
        tgUserId: encryptNumberWithConfigIV(message.from.id),
        firstUsername: encryptText(message.from.username),
        username: encryptText(message.from.username),
        initFirstName: encryptText(message.from.first_name),
        firstName: encryptText(message.from.first_name),
        initLastName: encryptText(message.from.last_name),
        lastName: encryptText(message.from.last_name),
        langCode: message.from.language_code,
      });
      dbUser.created.should.be.within(currentDate, new Date());
      dbUser.lastUsed.should.be.within(currentDate, new Date());
    });

    it('should update existing user data when a user exists but his initial data was NOT filled', async () => {
      const tgUserId = chance.natural();
      const initDbUser = await User.create({tgUserId});
      const message = chance.telegram.message({from: {id: tgUserId}});
      const currentDate = new Date();

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      dbUser.should.eql({
        ..._.pick(initDbUser.toObject(), '_id', '__v', 'tgUserId', 'maskUid', 'created', 'lastUsed'),
        ..._.pick(dbUser, 'lastUsed'),
        firstUsername: encryptText(message.from.username),
        username: encryptText(message.from.username),
        initFirstName: encryptText(message.from.first_name),
        firstName: encryptText(message.from.first_name),
        initLastName: encryptText(message.from.last_name),
        lastName: encryptText(message.from.last_name),
        langCode: message.from.language_code,
      });
      dbUser.created.should.be.below(new Date());
      dbUser.lastUsed.should.be.within(currentDate, new Date());
    });

    it('should update existing user data when a user sends a message again by different name', async () => {
      const tgUserId = chance.natural();
      const initDbUser = await User.create(chance.db.user({tgUserId}));
      const message = chance.telegram.message({from: {id: tgUserId}});
      const currentDate = new Date();

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      dbUser.should.eql({
        ..._.pick(
          initDbUser.toObject(),
          '_id',
          '__v',
          'firstUsername',
          'initFirstName',
          'initLastName',
          'maskUid',
          'created',
        ),
        ..._.pick(dbUser, 'lastUsed'),
        tgUserId: encryptNumberWithConfigIV(message.from.id),
        username: encryptText(message.from.username),
        firstName: encryptText(message.from.first_name),
        lastName: encryptText(message.from.last_name),
        langCode: message.from.language_code,
      });
      dbUser.created.should.be.below(new Date());
      dbUser.lastUsed.should.be.within(currentDate, new Date());
    });

    it('should forward a user message to admin groups and provide user info', async () => {
      const message = chance.telegram.message();

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const text =
        `#${dbUser.maskUid}\n` +
        `${decryptText(dbUser.firstName)} ${decryptText(dbUser.lastName)} @${decryptText(dbUser.username)}\n\n${
          message.text
        }`;

      sinon.assert.calledTwice(sendMessageStub);
      sinon.assert.notCalled(copyMessageStub);

      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'text': text,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': text,
      });
    });

    it('should forward a user message to admin favorite group when the user is favorite', async () => {
      const tgUserId = chance.natural();
      await User.create(chance.db.user({tgUserId, isFavorite: true}));
      const message = chance.telegram.message({from: {id: tgUserId}});

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbUsers = await User.find();
      dbUsers.should.have.lengthOf(1);

      const dbUser = dbUsers[0].toObject();
      const text =
        `#${dbUser.maskUid}\n` +
        `${decryptText(dbUser.firstName)} ${decryptText(dbUser.lastName)} @${decryptText(dbUser.username)}\n\n${
          message.text
        }`;

      sinon.assert.calledTwice(sendMessageStub);
      sinon.assert.notCalled(copyMessageStub);

      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_FAV_GROUP_ID,
        'text': text,
      });
      sinon.assert.calledWith(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'text': text,
      });
    });
  });

  it('should store user to admin groups messages mapping', async () => {
    const currentDate = new Date();
    const message = chance.telegram.message();

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    const dbMessageForwards = await MessageForward.find();
    dbMessageForwards.should.have.lengthOf(2);

    for (const adminGroupId of [botConfig.ADMIN_GROUP_ID, botConfig.ADMIN_MIRROR_GROUP_ID]) {
      const dbMessageForward = _.find(dbMessageForwards, {toChatId: Number.parseInt(adminGroupId)}).toObject();
      dbMessageForward.should.eql({
        ..._.pick(dbMessageForward, '_id', '__v', 'created'),
        fromUserId: encryptNumberWithConfigIV(message.from.id),
        fromChatId: encryptNumberWithConfigIV(message.chat.id),
        toChatId: encryptNumberWithConfigIV(adminGroupId),
        fromMessageId: message.message_id,
        toMessageId: messageByChatId[adminGroupId].message_id,
      });
      dbMessageForward.created.should.be.within(currentDate, new Date());
    }
  });

  it('should NOT forward a user message when the user is banned', async () => {
    const message = chance.telegram.message();
    await User.create({tgUserId: message.from.id, isBanned: true});

    const res = await request(app).post('/').send(chance.telegram.update({message}));
    res.status.should.eql(200);

    sinon.assert.calledOnce(sendMessageStub);
    sinon.assert.calledWith(sendMessageStub, {
      'chat_id': message.chat.id,
      'text': 'Вы заблокированы',
    });
  });

  describe('when a user previously sent messages to bot', () => {
    let userId;
    let adminGroupMessageForwards;
    let mirrorGroupMessageForwards;
    let expectedReplyToByChatId;

    beforeEach('create message forwards', async () => {
      userId = chance.natural();
      expectedReplyToByChatId = {};

      // Admin Group
      adminGroupMessageForwards = await Promise.all([
        MessageForward.create(
          chance.db.messageForward({fromUserId: userId, toChatId: botConfig.ADMIN_GROUP_ID, created: chance.date()}),
        ),
        MessageForward.create(
          chance.db.messageForward({fromUserId: userId, toChatId: botConfig.ADMIN_GROUP_ID, created: chance.date()}),
        ),
      ]);
      expectedReplyToByChatId[botConfig.ADMIN_GROUP_ID] = _.maxBy(adminGroupMessageForwards, 'created');

      // Admin Mirror Group
      mirrorGroupMessageForwards = await Promise.all([
        MessageForward.create(
          chance.db.messageForward({fromUserId: userId, toChatId: botConfig.ADMIN_MIRROR_GROUP_ID}),
        ),
        MessageForward.create(
          chance.db.messageForward({
            fromUserId: userId,
            toChatId: botConfig.ADMIN_MIRROR_GROUP_ID,
            replyToId: mongoose.Types.ObjectId(),
          }),
        ),
      ]);
      expectedReplyToByChatId[botConfig.ADMIN_MIRROR_GROUP_ID] = mirrorGroupMessageForwards[0];
    });

    it('should forward a user message to admin groups with appropriate reply to message id', async () => {
      const message = chance.telegram.message({from: {id: userId}});

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      sinon.assert.calledTwice(sendMessageStub);
      sinon.assert.notCalled(copyMessageStub);

      sinon.assert.calledWithMatch(sendMessageStub, {
        'chat_id': botConfig.ADMIN_GROUP_ID,
        'reply_to_message_id': expectedReplyToByChatId[botConfig.ADMIN_GROUP_ID].toMessageId,
      });
      sinon.assert.calledWithMatch(sendMessageStub, {
        'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
        'reply_to_message_id': expectedReplyToByChatId[botConfig.ADMIN_MIRROR_GROUP_ID].toMessageId,
      });
    });

    it('should store user to admin groups messages mapping with appropriate reply to id', async () => {
      const currentDate = new Date();
      const message = chance.telegram.message({from: {id: userId}});

      const res = await request(app).post('/').send(chance.telegram.update({message}));
      res.status.should.eql(200);

      const dbMessageForwards = await MessageForward.find({
        _id: {$nin: [..._.map(adminGroupMessageForwards, '_id'), ..._.map(mirrorGroupMessageForwards, '_id')]},
      });
      dbMessageForwards.should.have.lengthOf(2);

      for (const adminGroupId of [botConfig.ADMIN_GROUP_ID, botConfig.ADMIN_MIRROR_GROUP_ID]) {
        const dbMessageForward = _.find(dbMessageForwards, {toChatId: Number.parseInt(adminGroupId)}).toObject();
        dbMessageForward.should.eql({
          ..._.pick(dbMessageForward, '_id', '__v', 'created'),
          fromUserId: encryptNumberWithConfigIV(message.from.id),
          fromChatId: encryptNumberWithConfigIV(message.chat.id),
          toChatId: encryptNumberWithConfigIV(adminGroupId),
          fromMessageId: message.message_id,
          toMessageId: messageByChatId[adminGroupId].message_id,
          replyToId: expectedReplyToByChatId[adminGroupId]._id,
        });
        dbMessageForward.created.should.be.within(currentDate, new Date());
      }
    });

    describe('when a replied message was deleted from admin group', () => {
      beforeEach('stub telegram services', () => {
        nock.cleanAll();

        nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
          .post('/sendMessage')
          .times(1)
          .reply((uri, body) => {
            sendMessageStub(body);
            return [
              400,
              chance.telegram.httpResponse({
                ok: false,
                error_code: 400,
                description: 'Bad Request: replied message not found',
              }),
            ];
          });

        nock(`https://api.telegram.org/bot${botConfig.TELEGRAM_API_KEY}/`)
          .post('/sendMessage')
          .reply((uri, body) => {
            messageByChatId[body.chat_id] = chance.telegram.message();
            sendMessageStub(body);
            return [200, chance.telegram.httpResponse({result: messageByChatId[body.chat_id]})];
          })
          .persist();
      });

      it('should forward a user message to admin groups and start a new reply to chain in the error case', async () => {
        const message = chance.telegram.message({from: {id: userId}});

        const res = await request(app).post('/').send(chance.telegram.update({message}));
        res.status.should.eql(200);

        sinon.assert.calledThrice(sendMessageStub);
        sinon.assert.notCalled(copyMessageStub);

        sinon.assert.calledWithMatch(sendMessageStub, {
          'chat_id': botConfig.ADMIN_GROUP_ID,
          'reply_to_message_id': expectedReplyToByChatId[botConfig.ADMIN_GROUP_ID].toMessageId,
        });
        sinon.assert.calledWithMatch(sendMessageStub, {
          'chat_id': botConfig.ADMIN_GROUP_ID,
          'reply_to_message_id': undefined,
        });
        sinon.assert.calledWithMatch(sendMessageStub, {
          'chat_id': botConfig.ADMIN_MIRROR_GROUP_ID,
          'reply_to_message_id': expectedReplyToByChatId[botConfig.ADMIN_MIRROR_GROUP_ID].toMessageId,
        });
      });

      it('should store user to admin groups messages mapping without appropriate reply to id in the error case', async () => {
        const currentDate = new Date();
        const message = chance.telegram.message({from: {id: userId}});

        const res = await request(app).post('/').send(chance.telegram.update({message}));
        res.status.should.eql(200);

        const dbMessageForwards = await MessageForward.find({
          _id: {$nin: [..._.map(adminGroupMessageForwards, '_id'), ..._.map(mirrorGroupMessageForwards, '_id')]},
        });
        dbMessageForwards.should.have.lengthOf(2);

        for (const adminGroupId of [botConfig.ADMIN_GROUP_ID, botConfig.ADMIN_MIRROR_GROUP_ID]) {
          const dbMessageForward = _.find(dbMessageForwards, {toChatId: Number.parseInt(adminGroupId)}).toObject();
          dbMessageForward.should.eql({
            ..._.pick(dbMessageForward, '_id', '__v', 'created'),
            fromUserId: encryptNumberWithConfigIV(message.from.id),
            fromChatId: encryptNumberWithConfigIV(message.chat.id),
            toChatId: encryptNumberWithConfigIV(adminGroupId),
            fromMessageId: message.message_id,
            toMessageId: messageByChatId[adminGroupId].message_id,
            ...(adminGroupId !== botConfig.ADMIN_GROUP_ID
              ? {replyToId: expectedReplyToByChatId[adminGroupId]._id}
              : {}),
          });
          dbMessageForward.created.should.be.within(currentDate, new Date());
        }

        const forwardRelatedToDeletedMessage = await MessageForward.findOne({
          _id: expectedReplyToByChatId[botConfig.ADMIN_GROUP_ID]._id,
        });
        forwardRelatedToDeletedMessage.deleted.should.be.true();
      });
    });
  });
});
