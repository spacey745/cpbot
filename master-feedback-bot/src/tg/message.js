/**
 * A telegram message handler
 */
import {TgUser} from './user';
import {TgChat} from './chat';

export class TgMessage {
  /**
   * Telegram message handler constructor
   *
   * @param {object} ctx Bot context
   * @param {object} message A telegram message
   */
  constructor(ctx, message) {
    this._ctx = ctx;
    this._instance = message;
  }

  /**
   * Get the related tg message instance
   *
   * @return {object} A tg message
   */
  getTgInstance() {
    return this._instance;
  }

  /**
   * Get the current message chat
   *
   * @return {TgChat} A chat handler
   */
  get chat() {
    if (!this._chat) {
      this._chat = new TgChat(this._ctx, this._instance.chat);
    }
    return this._chat;
  }

  /**
   * Get the current message sender
   *
   * @return {TgUser} A sender handler
   */
  get sender() {
    if (!this._sender) {
      this._sender = new TgUser(this._ctx, this._instance.from);
    }
    return this._sender;
  }

  /**
   * Forward the current message to a chat
   *
   * @param {string|number} chatId A chat id to forward
   */
  forward(chatId) {}
}
