export const SENSITIVE_MESSAGE =
  "Looks like that might include sensitive info. Please remove it. We only need a general description."

const SSN = /\b\d{3}-\d{2}-\d{4}\b/
const SECRET_LABEL = /\b(password|pwd|passcode)\s*[:=]/i

function luhn(digits: string): boolean {
  let sum = 0
  let alt = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48
    if (digit < 0 || digit > 9) return false
    if (alt) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    alt = !alt
  }
  return sum % 10 === 0
}

function hasCardNumber(text: string): boolean {
  const matches = text.match(/\d[\d\s-]{11,22}\d/g) ?? []
  return matches.some((match) => {
    const digits = match.replace(/\D/g, "")
    return digits.length >= 13 && digits.length <= 19 && luhn(digits)
  })
}

export function textHasSensitive(text: string): boolean {
  return SSN.test(text) || SECRET_LABEL.test(text) || hasCardNumber(text)
}

export function valueHasSensitive(value: unknown): boolean {
  if (typeof value === "string") return textHasSensitive(value)
  if (Array.isArray(value)) return value.some(valueHasSensitive)
  if (value && typeof value === "object") return Object.values(value).some(valueHasSensitive)
  return false
}
