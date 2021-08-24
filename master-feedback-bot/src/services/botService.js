import {Telegraf} from 'telegraf';
import {botConfig} from 'config';

const {DB_TABLE, TELEGRAM_API_KEY, SERVER_URL} = botConfig;

let bot = new Telegraf(TELEGRAM_API_KEY, {
  telegram: {webhookReply: isPooling()},
});

/**
 * Is bot should be running in pooling mode
 *
 * @return {boolean} Is pooling mode flag
 */
export function isPooling() {
  return !SERVER_URL;
}

/**
 * Get a bot instance
 *
 * @return {Telegraf} A bot instance
 */
export function getBot() {
  return bot;
}

/**
 * Get the current bot id
 *
 * @return {number} The bot id
 */
export function getBotId() {
  return Number.parseInt(TELEGRAM_API_KEY.split(':')[0]);
}

/**
 * Get a bot username
 *
 * @return {string} A bot username
 */
export function getBotUsername() {
  return bot.options?.username || DB_TABLE;
}

/**
 * Get a telegram client
 *
 * @return {Telegram} A telegram client
 */
export function getTelegram() {
  return bot.telegram;
}
