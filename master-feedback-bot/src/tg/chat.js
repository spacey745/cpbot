/**
 * A telegram chat handler
 */
export class TgChat {
  /**
   * Telegram chat handler constructor
   *
   * @param {object} ctx Bot context
   * @param {object} chat A telegram chat
   */
  constructor(ctx, chat) {
    this._ctx = ctx;
    this._instance = chat;
  }

  /**
   * Get the related tg chat instance
   *
   * @return {object} A tg chat
   */
  getTgInstance() {
    return this._instance;
  }

  /**
   * Is the chat personal
   *
   * @return {boolean} Personal flag
   */
  isPersonal() {
    return this._instance.type === 'private';
  }
}
