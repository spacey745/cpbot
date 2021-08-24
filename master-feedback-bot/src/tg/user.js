import {User} from '../db';
import {botConfig} from 'config';
import {encryptNumberWithConfigIV} from '../helpers/cryptoHelper';

/**
 * A telegram user handler
 */
export class TgUser {
  /**
   * Telegram user handler constructor
   *
   * @param {object} ctx Bot context
   * @param {object} user A telegram user
   */
  constructor(ctx, user) {
    this._ctx = ctx;
    this._instance = user;
  }

  /**
   * Get the related tg user instance
   *
   * @return {object} A tg user
   */
  getTgInstance() {
    return this._instance;
  }

  /**
   * Get related db user instance
   *
   * @return {User} A db user
   */
  async getDbInstance() {
    if (!this._dbInstanceFetched) {
      this._dbInstance = await User.findOne({tgUserId: encryptNumberWithConfigIV(this._instance.id)});
      this._dbInstanceFetched = true;
    }
    return this._dbInstance;
  }

  /**
   * Is the user banned
   *
   * @return {Promise<boolean>} Is banned flag
   */
  async isBanned() {
    return (await this.getDbInstance())?.isBanned || false;
  }

  /**
   * Save the current user data in the db
   */
  async save() {
    const tgUser = this._instance;
    let dbUser = await this.getDbInstance();

    if (!dbUser) {
      dbUser = new User();
      dbUser.tgUserId = this._instance.id;
    }

    if (botConfig.STORE_USER_DETAILS) {
      dbUser.firstUsername = dbUser.firstUsername || tgUser.username;
      dbUser.username = tgUser.username;
      dbUser.initFirstName = dbUser.initFirstName || tgUser.first_name;
      dbUser.firstName = tgUser.first_name;
      dbUser.initLastName = dbUser.initLastName || tgUser.last_name;
      dbUser.lastName = tgUser.last_name;
    }

    dbUser.langCode = tgUser.language_code;
    dbUser.lastUsed = Date.now();
    this._dbInstance = await dbUser.save();
  }
}
