/**
 * @typedef {object} BotErrorOptions
 * @property {boolean} notifyUser Should a user be notified about the error (default: 'true')
 */

/**
 * Bot error types
 */
export const BotErrorTypes = {
  SERVER: 'SERVER',
  CLIENT: 'CLIENT',
};

/**
 * Create a server error
 *
 * @param {string} message An error message
 * @param {object} [meta] A meta information
 * @param {boolean} [isSilent] Should the error be silent (the user will not be notified about this error)
 * @return {Error} An error instance
 */
export function serverError(message, meta, isSilent) {
  const error = new Error(message);
  error.type = BotErrorTypes.SERVER;
  error.meta = meta;
  error.isSilent = isSilent;
  return error;
}

/**
 * Create a client error
 *
 * @param {string} message An error message
 * @return {Error} An error instance
 */
export function clientError(message) {
  const error = new Error(message);
  error.type = BotErrorTypes.CLIENT;
  return error;
}
