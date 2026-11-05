/**
 * U+2028 and U+2029 are legal inside a JSON string but are line terminators in
 * JavaScript, so they break anything that re-parses the block as JS.
 *
 * Built from char codes and matched with split/join rather than a regex: the raw
 * characters are invisible in an editor, and a constructed RegExp trips
 * security/detect-non-literal-regexp for no benefit here.
 */
const LINE_SEPARATOR = String.fromCharCode(0x2028)
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029)

/**
 * JSON-LD is embedded as raw text inside a <script>, so it is the one payload in
 * the app that has to be escaped by hand.
 *
 * This replaces `serialize-javascript`, which emits a *JavaScript* object literal
 * — single-quoted strings, literal `undefined` — and therefore is not JSON. Strict
 * consumers (validator.schema.org, most LLM extractors) reject it outright.
 *
 * `<`, `>` and `&` are escaped so no string value can close the script element or
 * open an HTML entity.
 */
export const serializeJsonLd = (data: object): string =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LINE_SEPARATOR)
    .join('\\u2028')
    .split(PARAGRAPH_SEPARATOR)
    .join('\\u2029')
