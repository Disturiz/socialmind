// Prioridad de voces: venezolano > latinoam > otras variantes hispanas
const VOICE_PRIORITY = ['es-VE', 'es-419', 'es-US', 'es-MX', 'es-CO', 'es-AR', 'es-CL', 'es-PE', 'es-ES']

export function getBestSpanishVoice() {
  const voices = window.speechSynthesis.getVoices()
  for (const lang of VOICE_PRIORITY) {
    const match = voices.find(v => v.lang === lang)
    if (match) return match
  }
  return voices.find(v => v.lang.startsWith('es-')) || null
}

// Elimina símbolos de Markdown que suenan raro al leerse en voz alta
export function cleanForTTS(text) {
  return text
    .replace(/#{1,6}\s*/g, '')   // encabezados
    .replace(/\*+/g, '')          // negrita / cursiva
    .replace(/`+/g, '')           // código inline / bloques
    .replace(/_+/g, '')           // cursiva alternativa
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → solo texto
    .trim()
}

export function speak({ text, onEnd, onError, rate = 0.93, pitch = 1.0 }) {
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(cleanForTTS(text))
  utterance.lang  = 'es-VE'
  utterance.rate  = rate
  utterance.pitch = pitch
  const voice = getBestSpanishVoice()
  if (voice) utterance.voice = voice
  if (onEnd)   utterance.onend   = onEnd
  if (onError) utterance.onerror = onError
  window.speechSynthesis.speak(utterance)
}
