/**
 * JS port of backend App\Support\TextNormalizer — keep the rules in sync.
 * properCase: "JAKE musico" -> "Jake Musico" (names, addresses, short fields)
 * sentenceCase: uppercase first letter of each sentence only (long free text)
 */

const PARTICLES = new Set([
  'de', 'der', 'den', 'di', 'da', 'dos', 'das', 'du',
  'van', 'von', 'ten', 'ter', 'y', 'e', 'of', 'the',
])

const CHAIN_PARTICLES = new Set(['la', 'le', 'lo', 'al', 'el', 'bin', 'bint'])

const SMALL_WORDS = {
  jr: 'Jr.', sr: 'Sr.', esq: 'Esq.',
  ii: 'II', iii: 'III', iv: 'IV', v: 'V', vi: 'VI',
  vii: 'VII', viii: 'VIII', ix: 'IX', x: 'X', xi: 'XI', xii: 'XII',
  st: 'St.', mt: 'Mt.', sta: 'Sta.',
}

const lower = (s) => s.toLowerCase()

function capitalizeAfterApostrophes(s) {
  return s.replace(/(^|')([a-z])/g, (_, p, c) => p + c.toUpperCase())
}

function properSegment(seg, isFirstWord, prevWasParticle) {
  const lw = lower(seg)
  const key = lw.replace(/^[.,;:!?()]+|[.,;:!?()]+$/g, '')

  if (SMALL_WORDS[key]) return SMALL_WORDS[key]
  if (PARTICLES.has(key) && !isFirstWord) return lw
  if (CHAIN_PARTICLES.has(key)) {
    if (!isFirstWord && prevWasParticle) return lw
    return capitalizeAfterApostrophes(lw)
  }

  // Mc/Mac prefixes — 'mac' only splits before a vowel (Machado/Mackenzie stay intact)
  let m = lw.match(/^mc(.{2,})$/u)
  if (m) return 'Mc' + capitalizeAfterApostrophes(m[1])
  m = lw.match(/^mac([aeiou].{2,})$/u)
  if (m) return 'Mac' + capitalizeAfterApostrophes(m[1])

  return capitalizeAfterApostrophes(lw)
}

function properWord(word, isFirstWord, prevWasParticle) {
  if (!/[\p{L}]/u.test(word)) return word

  const m = word.match(/^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u)
  const prefix = m[1]
  const core = m[2]
  let suffix = m[3]

  let casedCore
  if (core.includes('-')) {
    casedCore = core
      .split('-')
      .map((seg, j) => properSegment(seg, isFirstWord && j === 0, false))
      .join('-')
  } else {
    casedCore = properSegment(core, isFirstWord, prevWasParticle)
  }

  if (casedCore.endsWith('.') && suffix.startsWith('.')) {
    suffix = suffix.replace(/^\.+/, '')
  }
  return prefix + casedCore + suffix
}

const isParticleWord = (word) => {
  const key = lower(word).replace(/^[.,;:!?()"']+|[.,;:!?()"']+$/g, '')
  return PARTICLES.has(key) || CHAIN_PARTICLES.has(key)
}

export function properCase(text) {
  if (text == null || String(text).trim() === '') return text
  const parts = String(text).split(/(\s+)/u)
  let out = ''
  let prevWasParticle = false
  for (const part of parts) {
    if (part === '' || /^\s+$/u.test(part)) {
      out += part
      continue
    }
    const isFirstWord = out.trim() === ''
    out += properWord(part, isFirstWord, prevWasParticle)
    prevWasParticle = isParticleWord(part)
  }
  return out
}

export function sentenceCase(text) {
  if (text == null || text === '') return text
  const s = String(text)
  let out = ''
  let newSentence = true
  for (let i = 0; i < s.length; i++) {
    let ch = s[i]
    if (newSentence && /\p{L}/u.test(ch)) {
      ch = ch.toUpperCase()
      newSentence = false
    }
    out += ch
    if (ch === '!' || ch === '?') {
      newSentence = true
    } else if (ch === '.') {
      // '.' ends a sentence unless it is part of an abbreviation/initial
      // ("e.g.", "U.S.A.", "2.5"): word-so-far must be >1 char and dot-free.
      let ws = i
      while (ws > 0 && !/\s/u.test(s[ws - 1])) ws--
      const wordSoFar = s.slice(ws, i + 1)
      const stem = wordSoFar.replace(/\.+$/, '')
      if (stem.length > 1 && !stem.includes('.')) newSentence = true
    }
  }
  return out
}
