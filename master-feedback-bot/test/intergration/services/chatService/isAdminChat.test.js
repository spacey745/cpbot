import Chance from 'chance';
import {botConfig} from 'config';
import cleanStateBetweenTests from '../../../cleanStateBetweenTests';
import {isAdminChat} from '../../../../src/services/chatService';

const chance = new Chance();

const {ADMIN_GROUP_ID, ADMIN_FAV_GROUP_ID} = botConfig;

describe('Chat Service: Is Admin Chat Tests', () => {
  cleanStateBetweenTests();

  it('should require "false" for undefined', () => {
    isAdminChat(undefined).should.be.false();
  });

  it('should require "false" for null', () => {
    isAdminChat(null).should.be.false();
  });

  it('should require "false" for a random number', () => {
    isAdminChat(chance.natural()).should.be.false();
  });

  it('should require "true" for the ADMIN_GROUP_ID', () => {
    isAdminChat(ADMIN_GROUP_ID).should.be.true();
  });

  it('should require "true" for the ADMIN_FAV_GROUP_ID', () => {
    isAdminChat(ADMIN_FAV_GROUP_ID).should.be.true();
  });
});
