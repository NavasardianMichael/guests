/**
 * The tutorial video's background music, synthesised here from sine waves and seeded noise:
 * no sample, loop, preset or recording of anyone else's. It is original to this repository and
 * belongs to its owner like the code, so there is no licence to track and nothing a third party
 * could claim (YouTube Content ID included). Same input, same output: the noise is seeded.
 *
 * An upbeat groove at 118 bpm over Am – F – C – G, one chord a bar: four-on-the-floor kick,
 * claps on 2 and 4, off-beat hi-hats, an eighth-note bass, a sixteenth-note arpeggio, and chords
 * that duck under the kick. One bar of intro without drums, a short fade at the end.
 *
 * `musicWav(seconds)` returns a 16-bit 44.1 kHz stereo WAV as a Buffer.
 */
/* eslint-disable security/detect-object-injection -- numeric indexes into sample arrays; no input reaches them */

const RATE = 44_100
const BPM = 118
const BEAT = 60 / BPM
const BAR = 4 * BEAT
/** MIDI notes: the bass root and the chord's voicing around middle C. */
const PROGRESSION = [
  { root: 45, notes: [57, 60, 64, 69] }, // Am
  { root: 41, notes: [57, 60, 65, 69] }, // F
  { root: 48, notes: [55, 60, 64, 67] }, // C
  { root: 43, notes: [55, 59, 62, 67] }, // G
]

const TAU = Math.PI * 2
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)

/** mulberry32: a small seeded generator, so the noise (drums) is the same on every run. */
const noise = (() => {
  let state = 0x9e3779b9
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1
  }
})()

export const musicWav = (seconds) => {
  const frames = Math.ceil(seconds * RATE)
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  const pad = new Float32Array(frames)

  /** Adds `length` seconds of `voice(t)` from `start`, panned (0 left … 1 right). */
  const add = (start, length, voice, pan = 0.5, target = null) => {
    const from = Math.max(0, Math.floor(start * RATE))
    const to = Math.min(frames, Math.ceil((start + length) * RATE))
    for (let i = from; i < to; i += 1) {
      const v = voice(i / RATE - start)
      if (target) target[i] += v
      else {
        left[i] += v * (1 - pan)
        right[i] += v * pan
      }
    }
  }

  const bars = Math.ceil(seconds / BAR)
  for (let bar = 0; bar < bars; bar += 1) {
    const chord = PROGRESSION[bar % PROGRESSION.length]
    const start = bar * BAR
    const drums = bar > 0

    // Chords: a bright, short-attack pad held through the bar (ducked below, under the kick).
    for (const note of chord.notes) {
      const f = hz(note)
      add(start, BAR + 0.25, (t) => {
        const env = Math.min(1, t / 0.02) * (t > BAR ? Math.max(0, 1 - (t - BAR) / 0.25) : 1)
        return 0.032 * env * (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * 2 * f * t) + 0.25 * Math.sin(TAU * 3 * f * t) + 0.12 * Math.sin(TAU * 4 * f * t))
      }, 0.5, pad)
    }

    // Bass: eighth notes, root and octave, each a plucked tone.
    for (let step = 0; step < 8; step += 1) {
      const f = hz(chord.root + (step % 2 === 1 ? 12 : 0))
      add(start + step * (BEAT / 2), BEAT / 2, (t) => 0.15 * Math.exp(-t * 7) * Math.min(1, t * 300) * (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * 2 * f * t)))
    }

    // Arpeggio: sixteenths up and down the chord, an octave up, panned side to side.
    const pattern = [0, 1, 2, 3, 2, 1, 2, 3]
    for (let step = 0; step < 16; step += 1) {
      const f = hz(chord.notes[pattern[step % pattern.length]] + 12)
      add(start + step * (BEAT / 4), 0.35, (t) => 0.04 * Math.exp(-t * 11) * Math.min(1, t * 400) * (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 3 * f * t)), step % 2 ? 0.72 : 0.28)
    }

    if (!drums) continue
    for (let beat = 0; beat < 4; beat += 1) {
      const at = start + beat * BEAT
      // Kick: a sine whose pitch falls from ~140 Hz to 50 Hz.
      add(at, 0.35, (t) => 0.5 * Math.exp(-t * 9) * Math.sin(TAU * (50 * t + (90 / 30) * (1 - Math.exp(-t * 30)))))
      // Clap on 2 and 4: a noise burst over a short tonal body.
      if (beat % 2 === 1) add(at, 0.25, (t) => 0.17 * Math.exp(-t * 18) * noise() + 0.08 * Math.exp(-t * 25) * Math.sin(TAU * 190 * t))
      // Hi-hats on the off-beats, and a quieter one on each sixteenth after them.
      add(at + BEAT / 2, 0.06, (t) => 0.06 * Math.exp(-t * 70) * noise(), 0.62)
      add(at + (3 * BEAT) / 4, 0.04, (t) => 0.025 * Math.exp(-t * 90) * noise(), 0.4)
    }
  }

  // Duck the chords under every kick (after the intro bar), then mix them in.
  for (let i = 0; i < frames; i += 1) {
    const t = i / RATE
    const sinceBeat = t % BEAT
    const duck = t >= BAR ? 1 - 0.55 * Math.exp(-sinceBeat * 9) : 1
    left[i] += pad[i] * duck * 0.97
    right[i] += pad[i] * duck * 1.03
  }

  // Fade in and out, soft-clip, normalise to a moderate peak.
  let peak = 0
  for (let i = 0; i < frames; i += 1) {
    const t = i / RATE
    const fade = Math.max(0, Math.min(1, t / 0.3, (seconds - t) / 1.5))
    left[i] = Math.tanh(left[i] * fade * 1.2)
    right[i] = Math.tanh(right[i] * fade * 1.2)
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  }
  const gain = peak > 0 ? 0.6 / peak : 1

  const data = Buffer.alloc(frames * 4)
  for (let i = 0; i < frames; i += 1) {
    data.writeInt16LE(Math.round(left[i] * gain * 32767), i * 4)
    data.writeInt16LE(Math.round(right[i] * gain * 32767), i * 4 + 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(2, 22) // stereo
  header.writeUInt32LE(RATE, 24)
  header.writeUInt32LE(RATE * 4, 28)
  header.writeUInt16LE(4, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}
