/**
 * The lead of a layer in Lead mode (spec 8.5): one object per section and layer that plays whichever style
 * its settings name. Hook, Phrase, Roll and Drift are planned styles (leadHook.ts, leadPhrase.ts, leadRoll.ts,
 * leadDrift.ts): each builds a phrase of notes from the knobs and per-slot random numbers, and the pitch of a
 * note is picked when it plays, over the chord sounding then. Pulse is G4's Euclidean generator (lead.ts),
 * which at its default knobs plays exactly what it played before P5.
 *
 * Pure and seeded: the same seed, knobs and chords give the same notes. Lock: before each phrase (Hook,
 * Phrase) or bar (Roll, Drift), every plan slot is rewritten with the chance Lock gives (none when frozen).
 */
import { GenerativeLead, mutationChance, type LeadContext, type LeadParams, type LeadStepView } from "./lead.ts";
import { createRng, deriveSeed, type Rng } from "./random.ts";
import { SLOTS, contour, decorate, leadKnobs, leadWindow, lengthFactor, makeRand, realize, type LeadKnobs, type Plan, type PlanNote, type Rand } from "./leadKit.ts";
import { hookPlan } from "./leadHook.ts";
import { phrasePlan } from "./leadPhrase.ts";
import { rollPlan } from "./leadRoll.ts";
import { driftPlan } from "./leadDrift.ts";

/** One note of the lead. */
export interface LeadEvent {
  midi: number;
  vel: number;
  /** Length in sixteenths. */
  len: number;
  /** The previous note slides into this one: its pitch glides from this MIDI note. */
  glideFrom?: number;
  /** Louder (already in `vel`) and brighter: the layer voice opens its filter for this note. */
  accent?: boolean;
  /** Plays as a quick double (2) or triple (3) inside its first sixteenth. */
  repeat?: number;
}

/** Pulse draws its shared-knob numbers per step of the phrase; Lock acts on its own slots (lead.ts). */
const NO_VERSIONS: readonly number[] = new Array<number>(SLOTS).fill(0);

/** Pulse's natural note length, in sixteenths (G4's 0.8). */
export const PULSE_LEN = 0.8;

const PLANNERS: Record<Exclude<LeadKnobs["style"], "pulse">, (k: LeadKnobs, rand: Rand) => Plan> = {
  hook: hookPlan,
  phrase: phrasePlan,
  roll: rollPlan,
  drift: driftPlan,
};

/** The whole phrase a planned style plays with these knobs and slot versions: decorated, by start step. */
export function planFor(k: LeadKnobs, rand: Rand): Plan {
  if (k.style === "pulse") throw new Error("Pulse is not planned");
  return decorate(PLANNERS[k.style](k, rand), k, rand);
}

/** Hook and Phrase change only at a phrase's end; Roll and Drift may change at any bar line. */
function lockEvery(k: LeadKnobs): number {
  return k.style === "hook" || k.style === "phrase" ? 16 * k.phrase : 16;
}

export class Lead {
  private seed: number;
  private pulse: GenerativeLead;
  private counter: number;
  private versions: number[];
  /** Bumped whenever Lock rewrites a slot, so the cached plan is rebuilt. */
  private generation = 0;
  private mutate: Rng;
  private planKey = "";
  private plan: Plan | null = null;
  private byStep = new Map<number, PlanNote>();
  /** The pitch of the last note when it slides into the next one. */
  private glide: number | null = null;
  private barStart = 0;
  private prevBarStart = 0;
  private lastStep = -1;

  /** `barStep`: where in the bar the lead starts, as GenerativeLead. */
  constructor(seed: number, barStep = 0) {
    this.seed = seed;
    this.pulse = new GenerativeLead(seed, barStep);
    this.counter = Math.max(0, Math.min(15, Math.round(barStep)));
    this.versions = new Array<number>(SLOTS).fill(0);
    this.mutate = createRng(deriveSeed(seed, 3));
  }

  get seedValue(): number {
    return this.seed;
  }

  /** An independent copy in the same state (for the lanes' look-ahead). */
  clone(): Lead {
    const c = Object.create(Lead.prototype) as Lead;
    Object.assign(c, this);
    c.pulse = this.pulse.clone();
    c.versions = [...this.versions];
    c.mutate = this.mutate.clone();
    return c;
  }

  /** Back to the state right after construction. */
  reset(): void {
    Object.assign(this, new Lead(this.seed));
  }

  /** Back to the top of the phrase, keeping the notes Lock has written so far. */
  rewind(): void {
    this.pulse.rewind();
    this.counter = 0;
    this.barStart = 0;
    this.prevBarStart = 0;
    this.lastStep = -1;
    this.glide = null;
  }

  private rand(): Rand {
    return makeRand(this.seed, this.versions);
  }

  private currentPlan(k: LeadKnobs): Plan {
    const key = [k.style, k.busy, k.shape, k.noteLength, k.phrase, k.variation, k.repeats, k.slide, k.accent, this.generation].join(":");
    if (key !== this.planKey || !this.plan) {
      this.plan = planFor(k, this.rand());
      this.planKey = key;
      this.byStep = new Map(this.plan.notes.map((n) => [n.at, n]));
    }
    return this.plan;
  }

  /** The current bar: which steps start a note. Pulse shows its hits and which of them play. */
  preview(p: LeadParams, shownStep?: number): LeadStepView[] {
    const k = leadKnobs(p);
    if (k.style === "pulse") return this.pulse.preview(p, shownStep);
    const plan = this.currentPlan(k);
    const start = shownStep !== undefined && shownStep > this.lastStep ? this.prevBarStart : this.barStart;
    return Array.from({ length: 16 }, (_, s) => {
      const hit = this.byStep.has((start + s) % plan.steps);
      return { hit, plays: hit };
    });
  }

  /** Advance one sixteenth. `barStep` is the position in the bar (0..15). */
  step(barStep: number, p: LeadParams, ctx: LeadContext): LeadEvent | null {
    const k = leadKnobs(p);
    if (barStep === 0) {
      this.prevBarStart = this.barStart;
      this.barStart = this.counter;
    }
    this.lastStep = barStep;
    const c = this.counter++;
    const win = leadWindow(k.range, k.register);
    const phraseSteps = 16 * k.phrase;
    // Pulse runs on every step whatever the style, so switching back to it finds it on the beat.
    const shape = { ...win, contour: k.shape === "free" ? undefined : contour(k.shape, (c % phraseSteps) / (phraseSteps - 1), 0) };
    const pn = this.pulse.step(barStep, p, ctx, shape);
    if (k.style === "pulse") {
      if (!pn) return null;
      return this.decoratePulse(pn, barStep, c, k, p, ctx, win);
    }
    if (c > 0 && c % lockEvery(k) === 0) {
      const chance = mutationChance(k.lock);
      if (chance > 0) {
        let changed = false;
        for (let i = 0; i < SLOTS; i++) {
          if (this.mutate.chance(chance)) {
            this.versions[i]++;
            changed = true;
          }
        }
        if (changed) this.generation++;
      }
    }
    const plan = this.currentPlan(k);
    const n = this.byStep.get(c % plan.steps);
    if (!n) return null;
    const midi = realize(n, k.tension, ctx, win);
    return this.emit({ midi, vel: n.vel, len: n.len, accent: n.accent, repeat: n.repeat }, !!n.slide);
  }

  private emit(e: LeadEvent, slides: boolean): LeadEvent {
    const out: LeadEvent = { midi: e.midi, vel: e.vel, len: e.len };
    if (this.glide !== null && this.glide !== e.midi) out.glideFrom = this.glide;
    if (e.accent) out.accent = true;
    if (e.repeat && e.repeat > 1) out.repeat = e.repeat;
    this.glide = slides ? e.midi : null;
    return out;
  }

  /**
   * Pulse's note with the shared knobs: Variation re-picks notes of the phrase's last bar, Note length scales
   * G4's 0.8, Repeats, Accent and Slide are drawn per step of the phrase. At Pulse's defaults none of them acts.
   */
  private decoratePulse(
    pn: { midi: number; vel: number },
    barStep: number,
    c: number,
    k: LeadKnobs,
    p: LeadParams,
    ctx: LeadContext,
    win: { lo: number; hi: number },
  ): LeadEvent {
    const steps = 16 * k.phrase;
    const s = c % steps;
    const rand = makeRand(this.seed, NO_VERSIONS);
    let midi = pn.midi;
    if (s >= steps - 16 && rand(2000 + s, 1) < k.variation) midi = realize({ h: rand(2000 + s, 2), pool: rand(2000 + s, 3) }, k.tension, ctx, win);
    let len = PULSE_LEN * lengthFactor(k.noteLength);
    let vel = pn.vel;
    const accent = rand(s, 15) < k.accent;
    if (accent) vel = Math.min(1, vel * 1.3);
    const repeat = rand(s, 13) < k.repeats ? (rand(s, 14) < 0.6 ? 2 : 3) : 0;
    let slides = false;
    if (rand(s, 16) < k.slide) {
      // Look ahead on a copy for the next note, so this one holds until it starts.
      const ahead = this.pulse.clone();
      for (let j = 1; j <= 32; j++) {
        if (ahead.step((barStep + j) % 16, p, ctx)) {
          slides = true;
          len = Math.max(len, j);
          break;
        }
      }
    }
    return this.emit({ midi, vel, len, accent, repeat }, slides);
  }
}
