/**
 * MagicwashGateway Transport
 *
 * Pure HTTP transport layer for the MagicwashGateway (Google Apps Script web app).
 * Accepts any payload object, serialises it, and returns the parsed response.
 * Does not validate, transform, or inspect the payload — that is the caller's responsibility.
 *
 * The gateway follows the SheetLib envelope contract:
 *   { resource, action, target, ...actionFields }
 * Supported actions: APPEND, UPDATE, MOVE_STATUS, DELETE (POST) and GET/QUERY (not handled here).
 *
 * Content-Type is set to `text/plain` intentionally — Apps Script does not respond to CORS
 * preflight OPTIONS requests, so using `application/json` would silently fail in the browser.
 * The body is still a JSON string; Apps Script reads it via `e.postData.contents`.
 *
 * @module gateway
 *
 * @example
 * import { postToGateway } from '../utils/gateway'
 *
 * const result = await postToGateway({
 *   resource: 'sheet',
 *   action: 'APPEND',
 *   target: 'appointments',
 *   data: { customerId: 'CUS-001', date: '2026-05-20', time: '10:00-12:00' },
 * })
 * // result: { status: 'ok', updated_range: 'appointments!A42' }
 *
 * @author Mark
 * @copyright Copyright 2026, Magic Wash
 * @version 0.1.0
 * @since 2026-05-19
 */

const GATEWAY_URL = 'https://script.google.com/macros/s/AKfycbycje0WWsGgIXjrH6uVJpkUnyoVNzOuATLMq3uc2T-Jr_Fnno_KFKVYuGpf5wLPWaVC/exec'

/**
 * Sends a payload to the MagicwashGateway and returns the parsed response.
 *
 * Throws if the HTTP request fails or if the gateway returns `status !== 'ok'`.
 * The caller is responsible for building a valid SheetLib envelope and for
 * handling the returned data according to the action performed.
 *
 * @async
 * @param {Object} payload - A SheetLib-compatible request envelope.
 * @param {string} payload.resource - Always `'sheet'`.
 * @param {string} payload.action - One of `'APPEND'`, `'UPDATE'`, `'MOVE_STATUS'`, `'DELETE'`.
 * @param {string} payload.target - Sheet target name as registered in the gateway schema.
 * @returns {Promise<Object>} The full parsed gateway response (includes `status: 'ok'`).
 * @throws {Error} On HTTP failure or when the gateway returns a non-ok status.
 */
export async function postToGateway(payload) {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`Gateway HTTP ${res.status}`)
  }

  const json = await res.json()

  if (json.status !== 'ok') {
    throw new Error(json.message ?? json.error ?? 'Gateway error')
  }

  return json
}

export function handleAppend(target, data) {
  return postToGateway({ resource: 'sheet', action: 'APPEND', target, data })
}

export function handleUpdate(target, keyValue, data) {
  return postToGateway({ resource: 'sheet', action: 'UPDATE', target, key_value: keyValue, data })
}
