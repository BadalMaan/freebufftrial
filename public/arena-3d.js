import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

// Every champion is a rigged GLB. Two have full combat clip sets; the four new
// fighters ship with locomotion clips and are posed procedurally for actions.
const CHAR_FILES = {
  giant:     { url: '/models/animated-ogre-warrior.glb',  height: 5.15 },
  warrior:   { url: '/models/animated-plate-knight.glb',  height: 4.95 },
  zombie:    { url: '/models/zombie.glb',                 height: 4.85 },
  wizard:    { url: '/models/wizard.glb',                 height: 4.95 },
  soldier:   { url: '/models/soldier-tactical.glb',       height: 4.90 },
  superhero: { url: '/models/superhero.glb',              height: 5.00 }
};

// Per-champion action flavour: how far they lunge, how high they leap, how they
// react to a hit and how they celebrate. Keeps every fighter's motion distinct.
const STYLES = {
  giant:     { lean: 1.20, lunge: 1.22, jump: 1.10, lap: 1.10, recoil: 1.25, taunt: 'roar' },
  warrior:   { lean: 0.95, lunge: 1.05, jump: 0.95, lap: 1.00, recoil: 1.00, taunt: 'salute' },
  zombie:    { lean: 1.45, lunge: 0.72, jump: 0.55, lap: 0.62, recoil: 1.30, taunt: 'lurch' },
  wizard:    { lean: 0.82, lunge: 0.68, jump: 0.80, lap: 0.72, recoil: 0.90, taunt: 'spin' },
  soldier:   { lean: 1.00, lunge: 0.92, jump: 1.05, lap: 0.95, recoil: 1.15, taunt: 'march' },
  superhero: { lean: 0.90, lunge: 1.35, jump: 1.45, lap: 1.25, recoil: 0.85, taunt: 'fly' }
};

// ---- Skeleton control ---------------------------------------------------
// Both rig families are addressed through one set of slots (Mixamo style names
// for the four new champions, lowercase names for the ogre and the knight).
const RIG_SLOTS = {
  pelvis: [/^Hips$/, /pelvis/i],
  spineA: [/^Spine02$/, /^spine1$/],
  spineB: [/^Spine01$/, /^spine2$/],
  spineC: [/^Spine$/, /^chest$/],
  neck:   [/^neck$/i],
  head:   [/^Head$/i],
  armL:   [/^LeftArm$/, /^upperarm_L$/],
  armR:   [/^RightArm$/, /^upperarm_R$/],
  foreL:  [/^LeftForeArm$/, /^forearm_L$/],
  foreR:  [/^RightForeArm$/, /^forearm_R$/],
  handL:  [/^LeftHand$/, /^hand_L$/],
  handR:  [/^RightHand$/, /^hand_R$/],
  legL:   [/^LeftUpLeg$/, /^thigh_L$/],
  legR:   [/^RightUpLeg$/, /^thigh_R$/],
  shinL:  [/^LeftLeg$/, /^shin_L$/],
  shinR:  [/^RightLeg$/, /^shin_R$/],
  footL:  [/^LeftFoot$/, /^foot_L$/],
  footR:  [/^RightFoot$/, /^foot_R$/]
};

// Resting posture: each champion stands differently before anything happens.
const STANCE = {
  giant:     { spineB: [.05, 0, 0], armL: [-.12, 0, -.22], armR: [-.12, 0, .22], head: [.02, 0, 0] },
  warrior:   { spineB: [.02, .06, 0], armL: [-.22, 0, -.30], armR: [-.10, 0, .16], head: [0, .05, 0] },
  zombie:    { spineB: [.13, 0, 0], spineC: [.10, 0, .05], head: [.09, .04, 0], armL: [-.48, 0, -.14], armR: [-.42, 0, .14] },
  wizard:    { spineB: [-.02, 0, 0], armL: [-.16, 0, -.30], armR: [-.20, 0, .18], head: [-.02, 0, 0] },
  soldier:   { spineB: [.03, -.05, 0], armL: [-.16, 0, -.14], armR: [-.28, 0, .10], foreR: [-.55, 0, 0], head: [0, -.04, 0] },
  superhero: { spineB: [-.04, 0, 0], armL: [-.10, 0, -.30], armR: [-.10, 0, .30], head: [-.03, 0, 0] }
};

// Shared knockdown shape; per-champion parameters keep the sprawl different.
function makeFall(c) {
  const sp = c.spread == null ? 1.2 : c.spread;
  const head = c.head == null ? .24 : c.head;
  const legL = c.legL == null ? -.34 : c.legL;
  const legR = c.legR == null ? -.22 : c.legR;
  const knee = c.knee == null ? .45 : c.knee;
  return { dur: 1.15, keys: [
    { t: 0, p: { armL: [-.9, 0, -sp * .7], armR: [-.9, 0, sp * .7], spineB: [-.22, 0, 0], head: [-.28, 0, 0] } },
    { t: .5, p: { armL: [-1.9 - sp * .2, 0, -sp], armR: [-1.9 - sp * .2, 0, sp], foreL: [-.4, 0, 0], foreR: [-.3, 0, 0], spineB: [.16, 0, 0], head: [head, 0, 0], legL: [legL, 0, 0], legR: [legR, 0, 0], shinL: [knee, 0, 0], shinR: [knee * .7, 0, 0] } },
    { t: 1, p: { armL: [-2.0 - sp * .15, 0, -sp * 1.05], armR: [-2.0 - sp * .15, 0, sp * 1.05], foreL: [-.35, 0, 0], foreR: [-.25, 0, 0], spineB: [.1, 0, 0], head: [head * 1.1, 0, 0], legL: [legL * .9, 0, 0], legR: [legR * .9, 0, 0], shinL: [knee * .9, 0, 0], shinR: [knee * .65, 0, 0] } }
  ] };
}

// Shared recoil shape (arm spread and torso arch are per champion).
function makeHurt(c) {
  const sp = c.spread == null ? 1.0 : c.spread;
  const arch = c.arch == null ? -.28 : c.arch;
  const head = c.head == null ? -.3 : c.head;
  const twist = c.twist == null ? .08 : c.twist;
  return { dur: .8, keys: [
    { t: 0, p: { armL: [-1.1, 0, -sp], armR: [-1.1, 0, sp], foreL: [-.5, 0, 0], foreR: [-.5, 0, 0], spineB: [arch, 0, twist], spineC: [arch * .6, 0, twist * .5], head: [head, 0, 0], legL: [-.16, 0, 0], legR: [.12, 0, 0], shinL: [.28, 0, 0] } },
    { t: .34, p: { armL: [-.75, 0, -sp * .8], armR: [-.75, 0, sp * .8], foreL: [-.45, 0, 0], foreR: [-.45, 0, 0], spineB: [arch * .55, 0, twist * .6], head: [head * .6, 0, 0], legL: [-.08, 0, 0], legR: [.05, 0, 0], shinL: [.14, 0, 0] } },
    { t: 1, p: { armL: [-.4, 0, -sp * .35], armR: [-.4, 0, sp * .35], spineB: [.06, 0, 0], head: [.05, 0, 0] } }
  ] };
}

// Shared airborne, recovery and stride shapes. Every champion feeds its own
// amplitudes in, so the leap, the push off the floor and the victory run all
// stay recognisable per fighter.
function makeJump(c) {
  const arm = c.arm == null ? 1 : c.arm;
  const stride = c.stride == null ? .55 : c.stride;
  return { dur: .68, keys: [
    { t: 0, p: { legL: [-.3, 0, 0], legR: [-.3, 0, 0], shinL: [.5, 0, 0], shinR: [.5, 0, 0], spineB: [.16, 0, 0], armL: [-.25, 0, -.22], armR: [-.25, 0, .22] } },
    { t: .3, p: { legL: [stride * .5, 0, 0], legR: [-stride, 0, 0], shinL: [.85, 0, 0], shinR: [.2, 0, 0], spineB: [-.1, 0, 0], armL: [-1.35 * arm, 0, -.5], armR: [-1.35 * arm, 0, .5], foreL: [-.3, 0, 0], foreR: [-.3, 0, 0], head: [-.12, 0, 0] } },
    { t: .66, p: { legL: [-stride * .4, 0, 0], legR: [.18, 0, 0], shinL: [.3, 0, 0], shinR: [.62, 0, 0], spineB: [.1, 0, 0], armL: [-.5, 0, -.4], armR: [-.5, 0, .4] } },
    { t: 1, p: { legL: [-.1, 0, 0], legR: [-.1, 0, 0], shinL: [.18, 0, 0], shinR: [.18, 0, 0], armL: [-.2, 0, -.2], armR: [-.2, 0, .2] } }
  ] };
}

function makeGetup(c) {
  const brace = c.brace == null ? .6 : c.brace;
  return { dur: .86, keys: [
    { t: 0, p: { spineB: [.4, 0, 0], spineC: [.2, 0, 0], head: [.28, 0, 0], legL: [-.68, 0, 0], legR: [-.18, 0, 0], shinL: [.95, 0, 0], shinR: [.5, 0, 0], armL: [-1.5, 0, -.35], armR: [-1.4, 0, .3], foreL: [-.4, 0, 0], foreR: [-.35, 0, 0] } },
    { t: .42, p: { spineB: [.28, 0, 0], spineC: [.12, 0, 0], head: [.15, 0, 0], legL: [-.48 * brace, 0, 0], legR: [-.1, 0, 0], shinL: [.75 * brace, 0, 0], shinR: [.28, 0, 0], armL: [-.85, 0, -.5], armR: [-.8, 0, .45] } },
    { t: .74, p: { spineB: [.1, 0, 0], legL: [-.16, 0, 0], legR: [-.05, 0, 0], shinL: [.28, 0, 0], shinR: [.1, 0, 0], armL: [-.3, 0, -.3], armR: [-.3, 0, .3] } },
    { t: 1, p: { spineB: [0, 0, 0], legL: [0, 0, 0], legR: [0, 0, 0], shinL: [0, 0, 0], shinR: [0, 0, 0], armL: [0, 0, 0], armR: [0, 0, 0] } }
  ] };
}

function makeRun(c) {
  const s = c.stride == null ? .9 : c.stride;
  const lean = c.lean == null ? .16 : c.lean;
  const stride = (lead) => ({
    legL: [-lead * s, 0, 0], legR: [lead * s * .8, 0, 0],
    shinL: [lead > 0 ? s * .5 : s * .12, 0, 0], shinR: [lead > 0 ? s * .12 : s * .5, 0, 0],
    armL: [lead * .62, 0, -.12], armR: [-lead * .62, 0, .12],
    foreL: [-.55, 0, 0], foreR: [-.55, 0, 0], spineB: [lean, 0, 0], spineC: [lean * .4, 0, 0]
  });
  return { dur: .58, loop: true, keys: [
    { t: 0, p: stride(1) },
    { t: .5, p: stride(-1) },
    { t: 1, p: stride(1) }
  ] };
}

// Per-champion choreography. Keys are normalised time with bone offsets in
// radians around model-space axes: X pitch (negative swings a limb forward),
// Y yaw (twist), Z roll (negative lifts an arm out to the side).
const MOVES = {
  giant: {
    charge: { dur: 1.8, keys: [
      { t: 0, p: {} },
      { t: .55, p: { armL: [-.55, 0, -.35], armR: [-.55, 0, .35], foreL: [-.6, 0, 0], foreR: [-.6, 0, 0], spineB: [-.12, 0, 0], head: [-.12, 0, 0] } },
      { t: 1, p: { armL: [-1.05, 0, -.5], armR: [-1.05, 0, .5], foreL: [-.95, 0, 0], foreR: [-.95, 0, 0], spineB: [-.24, 0, 0], spineC: [-.14, .1, 0], head: [-.22, 0, 0] } }
    ] },
    attack: { dur: .92, keys: [
      { t: 0, p: { armL: [-1.05, 0, -.5], armR: [-1.05, 0, .5], foreL: [-.95, 0, 0], foreR: [-.95, 0, 0], spineB: [-.24, 0, 0], head: [-.22, 0, 0] } },
      { t: .28, p: { armL: [-2.25, 0, -.34], armR: [-2.25, 0, .34], foreL: [-.3, 0, 0], foreR: [-.3, 0, 0], spineB: [-.42, 0, 0], spineC: [-.26, 0, 0], head: [-.38, 0, 0], legL: [-.18, 0, 0], legR: [.14, 0, 0], shinL: [.3, 0, 0] } },
      { t: .56, p: { armL: [.42, 0, -.2], armR: [.42, 0, .2], foreL: [-.12, 0, 0], foreR: [-.12, 0, 0], spineB: [.5, 0, 0], spineC: [.32, 0, 0], head: [.3, 0, 0], legL: [-.3, 0, 0], legR: [.2, 0, 0], shinL: [.45, 0, 0] } },
      { t: 1, p: { armL: [-.3, 0, -.3], armR: [-.3, 0, .3], foreL: [-.55, 0, 0], foreR: [-.55, 0, 0], spineB: [.12, 0, 0], head: [.06, 0, 0] } }
    ] },
    hurt: makeHurt({ spread: 1.15, arch: -.32, head: -.36, twist: .12 }),
    fall: makeFall({ spread: 1.25, head: .22, legL: -.36, legR: -.24, knee: .5 }),
    win: { dur: 2.1, keys: [
      { t: 0, p: { armL: [-1.6, 0, -.9], armR: [-1.6, 0, .9], spineB: [-.22, 0, 0], head: [-.28, 0, 0] } },
      { t: .3, p: { armL: [-2.65, 0, -.55], armR: [-2.65, 0, .55], foreL: [-.28, 0, 0], foreR: [-.28, 0, 0], spineB: [-.42, 0, 0], spineC: [-.28, 0, 0], head: [-.46, 0, 0], legL: [-.1, 0, 0], legR: [.08, 0, 0] } },
      { t: .62, p: { armL: [-2.35, 0, -.75], armR: [-2.35, 0, .75], foreL: [-.5, 0, 0], foreR: [-.5, 0, 0], spineB: [-.28, 0, 0], spineC: [-.18, 0, 0], head: [-.34, 0, 0] } },
      { t: 1, p: { armL: [-2.65, 0, -.55], armR: [-2.65, 0, .55], foreL: [-.28, 0, 0], foreR: [-.28, 0, 0], spineB: [-.42, 0, 0], spineC: [-.28, 0, 0], head: [-.46, 0, 0], legL: [-.1, 0, 0], legR: [.08, 0, 0] } }
    ] }
  },
  warrior: {
    charge: { dur: 1.8, keys: [
      { t: 0, p: {} },
      { t: 1, p: { armR: [-1.5, .2, .35], foreR: [-.7, 0, 0], armL: [-.4, 0, -.5], spineC: [0, .34, 0], spineB: [-.06, .18, 0], head: [0, .2, 0] } }
    ] },
    attack: { dur: .88, keys: [
      { t: 0, p: { armR: [-1.5, .2, .35], foreR: [-.7, 0, 0], armL: [-.4, 0, -.5], spineC: [0, .34, 0] } },
      { t: .3, p: { armR: [-2.35, .3, .75], foreR: [-.45, 0, 0], armL: [-.55, 0, -.65], spineC: [-.12, .56, 0], spineB: [-.08, .22, 0], head: [-.12, .24, 0], legR: [.16, 0, 0] } },
      { t: .58, p: { armR: [-.32, -.2, -.5], foreR: [-.15, 0, 0], armL: [-.2, 0, -.95], spineC: [.24, -.55, 0], spineB: [.16, -.26, 0], head: [.18, -.26, 0], legR: [-.2, 0, 0], legL: [.16, 0, 0] } },
      { t: 1, p: { armR: [-.45, .1, .15], foreR: [-.6, 0, 0], armL: [-.24, 0, -.34], spineC: [.05, .08, 0] } }
    ] },
    hurt: makeHurt({ spread: .85, arch: -.18, head: -.22, twist: -.16 }),
    fall: makeFall({ spread: .95, head: .3, legL: -.28, legR: -.34, knee: .38 }),
    win: { dur: 2.0, keys: [
      { t: 0, p: { armR: [-.9, 0, .3], foreR: [-.9, 0, 0], armL: [-.3, 0, -.4] } },
      { t: .26, p: { armR: [-1.5, .35, .55], foreR: [-1.7, 0, 0], spineC: [.06, .2, 0], head: [.04, .16, 0] } },
      { t: .52, p: { armR: [-2.9, 0, .15], foreR: [-.2, 0, 0], armL: [-.35, 0, -.75], spineB: [-.18, 0, 0], spineC: [-.1, 0, 0], head: [-.3, 0, 0] } },
      { t: 1, p: { armR: [-2.75, 0, .1], foreR: [-.3, 0, 0], armL: [-.4, 0, -.85], spineB: [-.14, 0, 0], spineC: [-.06, 0, 0], head: [-.26, 0, 0] } }
    ] }
  },
  zombie: {
    charge: { dur: 1.8, keys: [
      { t: 0, p: {} },
      { t: 1, p: { armL: [-.9, 0, -.25], armR: [-.85, 0, .2], foreL: [-.6, 0, 0], foreR: [-.55, 0, 0], spineB: [.3, 0, 0], spineC: [.24, .1, 0], head: [.24, 0, 0], legL: [-.14, 0, 0], shinL: [.24, 0, 0] } }
    ] },
    attack: { dur: .96, keys: [
      { t: 0, p: { armL: [-.95, 0, -.3], armR: [-.9, 0, .25], foreL: [-.65, 0, 0], foreR: [-.6, 0, 0], spineB: [.32, 0, 0], spineC: [.26, .1, 0], head: [.26, 0, 0] } },
      { t: .26, p: { armL: [-.35, 0, -.6], armR: [-.3, 0, .55], foreL: [-1.0, 0, 0], foreR: [-.95, 0, 0], spineB: [.5, 0, 0], spineC: [.34, .16, 0], head: [.36, .1, 0], legL: [-.24, 0, 0], shinL: [.4, 0, 0] } },
      { t: .54, p: { armL: [-1.65, 0, -.15], armR: [-1.55, 0, .1], foreL: [-.25, 0, 0], foreR: [-.2, 0, 0], spineB: [.16, 0, 0], spineC: [.06, -.12, 0], head: [-.32, -.06, 0], legL: [-.1, 0, 0], shinL: [.18, 0, 0] } },
      { t: 1, p: { armL: [-.7, 0, -.2], armR: [-.65, 0, .18], foreL: [-.5, 0, 0], foreR: [-.45, 0, 0], spineB: [.2, 0, 0], head: [.12, 0, 0] } }
    ] },
    hurt: makeHurt({ spread: .55, arch: -.14, head: .42, twist: .2 }),
    fall: makeFall({ spread: .8, head: .38, legL: -.16, legR: -.3, knee: .3 }),
    win: { dur: 2.3, keys: [
      { t: 0, p: { armL: [-.9, 0, -.3], armR: [-.8, 0, .25], spineB: [.24, 0, 0], head: [.2, 0, 0] } },
      { t: .3, p: { armL: [-2.5, 0, -.7], armR: [-2.2, 0, .95], foreL: [-.5, 0, 0], foreR: [-.7, 0, 0], spineB: [-.18, .14, .06], spineC: [-.12, .1, 0], head: [-.3, .2, .12], legL: [-.12, 0, 0] } },
      { t: .6, p: { armL: [-2.25, 0, -.95], armR: [-2.45, 0, .7], foreL: [-.7, 0, 0], foreR: [-.45, 0, 0], spineB: [-.1, -.16, -.05], head: [-.24, -.2, -.1], legR: [-.1, 0, 0] } },
      { t: 1, p: { armL: [-2.5, 0, -.7], armR: [-2.2, 0, .95], foreL: [-.5, 0, 0], foreR: [-.7, 0, 0], spineB: [-.18, .14, .06], spineC: [-.12, .1, 0], head: [-.3, .2, .12], legL: [-.12, 0, 0] } }
    ] }
  },
  wizard: {
    charge: { dur: 1.8, keys: [
      { t: 0, p: {} },
      { t: 1, p: { armR: [-1.05, .15, .3], foreR: [-1.15, 0, 0], armL: [-.45, 0, -.7], spineC: [0, -.3, 0], spineB: [-.05, -.16, 0], head: [-.08, -.2, 0] } }
    ] },
    attack: { dur: .95, keys: [
      { t: 0, p: { armR: [-1.05, .15, .3], foreR: [-1.15, 0, 0], armL: [-.45, 0, -.7], spineC: [0, -.3, 0] } },
      { t: .28, p: { armR: [-.5, .5, .5], foreR: [-1.7, 0, 0], armL: [-.9, 0, -.95], spineC: [.1, -.5, 0], spineB: [.06, -.24, 0], head: [.08, -.3, 0], legR: [.14, 0, 0] } },
      { t: .56, p: { armR: [-1.75, -.3, -.2], foreR: [-.15, 0, 0], armL: [-1.75, 0, -.85], spineC: [-.08, .42, 0], spineB: [-.1, .2, 0], head: [-.2, .28, 0], legR: [-.18, 0, 0], legL: [.1, 0, 0] } },
      { t: 1, p: { armR: [-.6, 0, .18], foreR: [-.8, 0, 0], armL: [-.35, 0, -.35], spineC: [0, .1, 0] } }
    ] },
    hurt: makeHurt({ spread: .6, arch: .2, head: .28, twist: -.14 }),
    fall: makeFall({ spread: .9, head: .3, legL: -.4, legR: -.16, knee: .55 }),
    win: { dur: 2.4, keys: [
      { t: 0, p: { armR: [-1.0, 0, .2], foreR: [-.9, 0, 0], armL: [-.4, 0, -.4] } },
      { t: .25, p: { armL: [-2.9, 0, -.35], foreL: [-.2, 0, 0], armR: [-.35, 0, .85], foreR: [-1.3, 0, 0], spineB: [-.2, 0, 0], spineC: [-.14, .12, 0], head: [-.34, .1, 0] } },
      { t: .58, p: { armL: [-2.6, 0, -.6], armR: [-.3, 0, 1.0], foreR: [-1.45, 0, 0], spineB: [-.12, 0, 0], head: [-.2, -.12, 0] } },
      { t: 1, p: { armL: [-2.9, 0, -.35], foreL: [-.2, 0, 0], armR: [-.35, 0, .85], foreR: [-1.3, 0, 0], spineB: [-.2, 0, 0], spineC: [-.14, .12, 0], head: [-.34, .1, 0] } }
    ] }
  },
  soldier: {
    charge: { dur: 1.8, keys: [
      { t: 0, p: {} },
      { t: 1, p: { armR: [-.72, .1, .12], foreR: [-.55, 0, 0], armL: [-.62, 0, .45], foreL: [-.9, 0, 0], spineC: [0, -.18, 0], head: [-.08, -.08, 0], legL: [-.1, 0, 0], shinL: [.2, 0, 0] } }
    ] },
    attack: { dur: .8, keys: [
      { t: 0, p: { armR: [-.72, .1, .12], foreR: [-.55, 0, 0], armL: [-.62, 0, .45], foreL: [-.9, 0, 0], spineC: [0, -.18, 0] } },
      { t: .2, p: { armR: [-.8, .06, .08], foreR: [-.45, 0, 0], armL: [-.7, 0, .38], foreL: [-.8, 0, 0], spineC: [-.05, -.2, 0], head: [-.06, -.06, 0] } },
      { t: .3, p: { armR: [-.98, .04, .02], foreR: [-.72, 0, 0], armL: [-.82, 0, .32], foreL: [-.95, 0, 0], spineC: [-.14, -.22, 0], spineB: [-.08, -.1, 0], head: [.06, -.06, 0], legR: [.12, 0, 0] } },
      { t: .48, p: { armR: [-.76, .08, .1], foreR: [-.5, 0, 0], armL: [-.66, 0, .42], foreL: [-.86, 0, 0], spineC: [-.02, -.18, 0], head: [-.02, -.06, 0] } },
      { t: 1, p: { armR: [-.6, .1, .14], foreR: [-.42, 0, 0], armL: [-.55, 0, .3], foreL: [-.9, 0, 0], spineC: [0, -.1, 0] } }
    ] },
    hurt: makeHurt({ spread: .7, arch: .22, head: .24, twist: .1 }),
    fall: makeFall({ spread: 1.0, head: .26, legL: -.22, legR: -.36, knee: .42 }),
    win: { dur: 1.9, keys: [
      { t: 0, p: { armR: [-.7, 0, .14], foreR: [-.5, 0, 0], armL: [-.5, 0, -.4] } },
      { t: .24, p: { armR: [-1.65, .1, .05], foreR: [-.25, 0, 0], armL: [-.55, 0, -.45], spineB: [-.2, 0, 0], spineC: [-.12, 0, 0], head: [-.34, 0, 0], legL: [-.12, 0, 0], shinL: [.22, 0, 0] } },
      { t: .5, p: { armR: [-1.3, .1, .18], foreR: [-.45, 0, 0], spineB: [-.06, 0, 0], head: [-.14, 0, 0], legR: [-.1, 0, 0], shinR: [.2, 0, 0] } },
      { t: 1, p: { armR: [-1.65, .1, .05], foreR: [-.25, 0, 0], armL: [-.55, 0, -.45], spineB: [-.2, 0, 0], spineC: [-.12, 0, 0], head: [-.34, 0, 0], legL: [-.12, 0, 0], shinL: [.22, 0, 0] } }
    ] }
  },
  superhero: {
    charge: { dur: 1.8, keys: [
      { t: 0, p: {} },
      { t: 1, p: { armR: [.55, 0, .3], foreR: [-1.4, 0, 0], armL: [-.55, 0, -.55], spineC: [0, .42, 0], spineB: [-.12, .2, 0], head: [-.14, .24, 0], legL: [-.3, 0, 0], shinL: [.36, 0, 0] } }
    ] },
    attack: { dur: .86, keys: [
      { t: 0, p: { armR: [.55, 0, .3], foreR: [-1.4, 0, 0], armL: [-.55, 0, -.55], spineC: [0, .42, 0], legL: [-.3, 0, 0], shinL: [.36, 0, 0] } },
      { t: .26, p: { armR: [.9, -.2, .5], foreR: [-1.75, 0, 0], armL: [-.85, 0, -.9], spineC: [-.1, .6, 0], spineB: [-.16, .3, 0], head: [-.2, .34, 0], legL: [-.55, 0, 0], shinL: [.6, 0, 0] } },
      { t: .54, p: { armR: [-1.85, -.25, -.05], foreR: [-.1, 0, 0], armL: [.35, 0, -.7], spineC: [.12, -.5, 0], spineB: [.1, -.28, 0], head: [.1, -.3, 0], legL: [-1.15, 0, 0], shinL: [1.25, 0, 0], legR: [.2, 0, 0] } },
      { t: 1, p: { armR: [-.55, 0, -.1], foreR: [-.6, 0, 0], armL: [-.2, 0, -.35], spineC: [.02, -.1, 0], legL: [-.2, 0, 0], shinL: [.2, 0, 0] } }
    ] },
    hurt: makeHurt({ spread: 1.35, arch: -.42, head: -.14, twist: -.1 }),
    fall: makeFall({ spread: 1.4, head: .18, legL: -.46, legR: -.12, knee: .62 }),
    win: { dur: 2.2, keys: [
      { t: 0, p: { armL: [-.6, 0, -.3], armR: [-.6, 0, .2] } },
      { t: .28, p: { armR: [-1.95, .18, .12], foreR: [-.25, 0, 0], armL: [-.35, 0, -.95], foreL: [-.35, 0, 0], spineB: [-.24, -.1, 0], spineC: [-.14, -.14, 0], head: [-.38, -.12, 0], legL: [-.16, 0, 0], legR: [.12, 0, 0] } },
      { t: .58, p: { armR: [-1.6, .18, .28], armL: [-.45, 0, -1.15], spineB: [-.1, -.16, 0], head: [-.2, -.18, 0] } },
      { t: 1, p: { armR: [-1.95, .18, .12], foreR: [-.25, 0, 0], armL: [-.35, 0, -.95], foreL: [-.35, 0, 0], spineB: [-.24, -.1, 0], spineC: [-.14, -.14, 0], head: [-.38, -.12, 0], legL: [-.16, 0, 0], legR: [.12, 0, 0] } }
    ] }
  }
};

// Every champion's leap, floor recovery and run get their own amplitudes too.
const AUX = {
  giant:     { jump: { arm: 1.05, stride: .46 }, getup: { brace: .45 }, run: { stride: .95, lean: .2 } },
  warrior:   { jump: { arm: .95, stride: .55 }, getup: { brace: .7 }, run: { stride: .85, lean: .12 } },
  zombie:    { jump: { arm: .68, stride: .3 }, getup: { brace: .5 }, run: { stride: .6, lean: .32 } },
  wizard:    { jump: { arm: .85, stride: .44 }, getup: { brace: .75 }, run: { stride: .7, lean: .08 } },
  soldier:   { jump: { arm: .9, stride: .6 }, getup: { brace: .65 }, run: { stride: .95, lean: .18 } },
  superhero: { jump: { arm: 1.2, stride: .7 }, getup: { brace: .55 }, run: { stride: 1.05, lean: .1 } }
};
Object.keys(MOVES).forEach((id) => {
  const aux = AUX[id] || AUX.giant;
  MOVES[id].jump = makeJump(aux.jump);
  MOVES[id].getup = makeGetup(aux.getup);
  MOVES[id].run = makeRun(aux.run);
});

// ---------------------------------------------------------------------------
// Per-champion reactions. Every fighter now braces the power struggle, takes a
// hit and hits the floor in its own way, instead of sharing one generic recoil
// shape with different amplitude.
// ---------------------------------------------------------------------------
const CLASH = {
  giant: { dur: 6, keys: [
    { t: 0, p: { armL: [-1.35, 0, -.42], armR: [-1.35, 0, .42], foreL: [-.55, 0, 0], foreR: [-.55, 0, 0], spineB: [-.30, 0, 0], spineC: [-.20, 0, 0], head: [-.26, 0, 0], legL: [-.30, 0, 0], legR: [.24, 0, 0], shinL: [.42, 0, 0] } },
    { t: .5, p: { armL: [-1.52, 0, -.30], armR: [-1.52, 0, .30], foreL: [-.38, 0, 0], foreR: [-.38, 0, 0], spineB: [-.38, 0, 0], spineC: [-.26, 0, 0], head: [-.34, 0, 0], legL: [-.36, 0, 0], legR: [.28, 0, 0], shinL: [.50, 0, 0] } },
    { t: 1, p: { armL: [-1.35, 0, -.42], armR: [-1.35, 0, .42], foreL: [-.55, 0, 0], foreR: [-.55, 0, 0], spineB: [-.30, 0, 0], spineC: [-.20, 0, 0], head: [-.26, 0, 0], legL: [-.30, 0, 0], legR: [.24, 0, 0], shinL: [.42, 0, 0] } }
  ] },
  warrior: { dur: 6, keys: [
    { t: 0, p: { armR: [-1.90, .25, .55], foreR: [-.75, 0, 0], armL: [-.70, 0, -.55], spineC: [.08, .42, 0], spineB: [.06, .20, 0], head: [.06, .20, 0], legR: [.22, 0, 0], legL: [-.22, 0, 0], shinL: [.30, 0, 0] } },
    { t: .5, p: { armR: [-2.10, .30, .60], foreR: [-.55, 0, 0], armL: [-.85, 0, -.70], spineC: [.14, .50, 0], spineB: [.10, .24, 0], head: [.10, .26, 0], legR: [.30, 0, 0], legL: [-.30, 0, 0], shinL: [.40, 0, 0] } },
    { t: 1, p: { armR: [-1.90, .25, .55], foreR: [-.75, 0, 0], armL: [-.70, 0, -.55], spineC: [.08, .42, 0], spineB: [.06, .20, 0], head: [.06, .20, 0], legR: [.22, 0, 0], legL: [-.22, 0, 0], shinL: [.30, 0, 0] } }
  ] },
  zombie: { dur: 6, keys: [
    { t: 0, p: { armL: [-1.60, 0, -.18], armR: [-1.50, 0, .16], foreL: [-.20, 0, 0], foreR: [-.18, 0, 0], spineB: [.42, 0, 0], spineC: [.30, .12, 0], head: [.30, 0, 0], legL: [-.24, 0, 0], shinL: [.42, 0, 0] } },
    { t: .5, p: { armL: [-1.75, 0, -.10], armR: [-1.62, 0, .08], foreL: [-.10, 0, 0], foreR: [-.10, 0, 0], spineB: [.50, 0, 0], spineC: [.36, .16, 0], head: [.36, .04, 0], legL: [-.30, 0, 0], shinL: [.50, 0, 0] } },
    { t: 1, p: { armL: [-1.60, 0, -.18], armR: [-1.50, 0, .16], foreL: [-.20, 0, 0], foreR: [-.18, 0, 0], spineB: [.42, 0, 0], spineC: [.30, .12, 0], head: [.30, 0, 0], legL: [-.24, 0, 0], shinL: [.42, 0, 0] } }
  ] },
  wizard: { dur: 6, keys: [
    { t: 0, p: { armL: [-2.50, 0, -.50], foreL: [-.30, 0, 0], armR: [-.60, .25, .75], foreR: [-1.50, 0, 0], spineB: [-.12, 0, 0], spineC: [-.08, -.30, 0], head: [-.20, -.24, 0], legR: [.18, 0, 0] } },
    { t: .5, p: { armL: [-2.75, 0, -.35], foreL: [-.18, 0, 0], armR: [-.45, .30, .90], foreR: [-1.62, 0, 0], spineB: [-.20, 0, 0], spineC: [-.14, -.38, 0], head: [-.30, -.30, 0], legR: [.26, 0, 0] } },
    { t: 1, p: { armL: [-2.50, 0, -.50], foreL: [-.30, 0, 0], armR: [-.60, .25, .75], foreR: [-1.50, 0, 0], spineB: [-.12, 0, 0], spineC: [-.08, -.30, 0], head: [-.20, -.24, 0], legR: [.18, 0, 0] } }
  ] },
  soldier: { dur: 6, keys: [
    { t: 0, p: { armR: [-1.15, .08, .12], foreR: [-.70, 0, 0], armL: [-1.20, 0, .20], foreL: [-.60, 0, 0], spineC: [-.08, -.20, 0], spineB: [-.10, 0, 0], head: [.04, -.06, 0], legL: [-.30, 0, 0], shinL: [.40, 0, 0], legR: [.20, 0, 0] } },
    { t: .5, p: { armR: [-1.30, .06, .10], foreR: [-.55, 0, 0], armL: [-1.35, 0, .16], foreL: [-.45, 0, 0], spineC: [-.14, -.24, 0], spineB: [-.16, 0, 0], head: [.10, -.04, 0], legL: [-.40, 0, 0], shinL: [.52, 0, 0], legR: [.26, 0, 0] } },
    { t: 1, p: { armR: [-1.15, .08, .12], foreR: [-.70, 0, 0], armL: [-1.20, 0, .20], foreL: [-.60, 0, 0], spineC: [-.08, -.20, 0], spineB: [-.10, 0, 0], head: [.04, -.06, 0], legL: [-.30, 0, 0], shinL: [.40, 0, 0], legR: [.20, 0, 0] } }
  ] },
  superhero: { dur: 6, keys: [
    { t: 0, p: { armR: [-1.95, 0, .05], foreR: [-.15, 0, 0], armL: [.50, 0, -.70], foreL: [-.40, 0, 0], spineC: [.05, .35, 0], spineB: [-.16, .18, 0], head: [-.16, .20, 0], legL: [-.60, 0, 0], shinL: [.70, 0, 0], legR: [.30, 0, 0] } },
    { t: .5, p: { armR: [-2.10, 0, .02], foreR: [-.05, 0, 0], armL: [.62, 0, -.82], foreL: [-.30, 0, 0], spineC: [.10, .42, 0], spineB: [-.24, .22, 0], head: [-.24, .26, 0], legL: [-.75, 0, 0], shinL: [.85, 0, 0], legR: [.38, 0, 0] } },
    { t: 1, p: { armR: [-1.95, 0, .05], foreR: [-.15, 0, 0], armL: [.50, 0, -.70], foreL: [-.40, 0, 0], spineC: [.05, .35, 0], spineB: [-.16, .18, 0], head: [-.16, .20, 0], legL: [-.60, 0, 0], shinL: [.70, 0, 0], legR: [.30, 0, 0] } }
  ] }
};

const REACTIONS = {
  giant: {
    hurt: { dur: 1.0, keys: [
      { t: 0, p: { armL: [-1.20, 0, -1.30], armR: [-1.20, 0, 1.30], foreL: [-.50, 0, 0], foreR: [-.50, 0, 0], spineB: [-.34, 0, .10], spineC: [-.20, 0, .06], head: [-.40, 0, .06], legL: [-.20, 0, 0], legR: [.14, 0, 0], shinL: [.34, 0, 0] } },
      { t: .30, p: { armL: [-.90, 0, -1.50], armR: [-.90, 0, 1.50], foreL: [-.60, 0, 0], foreR: [-.60, 0, 0], spineB: [-.10, 0, -.06], spineC: [.04, 0, 0], head: [-.10, 0, -.08], legL: [-.34, 0, 0], shinL: [.55, 0, 0] } },
      { t: .62, p: { armL: [-.50, 0, -.55], armR: [-.50, 0, .55], foreL: [-.45, 0, 0], foreR: [-.45, 0, 0], spineB: [.30, 0, 0], spineC: [.18, 0, 0], head: [.28, 0, 0], legL: [-.40, 0, 0], legR: [.20, 0, 0], shinL: [.60, 0, 0] } },
      { t: 1, p: { spineB: [.06, 0, 0], head: [.05, 0, 0] } }
    ] },
    fall: { dur: 1.5, keys: [
      { t: 0, p: { spineB: [-.30, 0, 0], head: [-.40, 0, 0], armL: [-1.40, 0, -1.00], armR: [-1.40, 0, 1.00], legL: [-.20, 0, 0], shinL: [.40, 0, 0] } },
      { t: .35, p: { spineB: [-.50, 0, 0], head: [-.50, 0, 0], armL: [-2.20, 0, -1.30], armR: [-2.20, 0, 1.30], foreL: [-.30, 0, 0], foreR: [-.30, 0, 0], legL: [-.10, 0, 0], legR: [.30, 0, 0], shinL: [.90, 0, 0], shinR: [.50, 0, 0] } },
      { t: .70, p: { spineB: [.20, 0, 0], head: [.35, 0, 0], armL: [-2.40, 0, -1.10], armR: [-2.00, 0, 1.20], legL: [-.50, 0, 0], shinL: [1.00, 0, 0], legR: [-.10, 0, 0] } },
      { t: 1, p: { spineB: [.10, 0, 0], head: [.40, 0, 0], armL: [-2.50, 0, -1.00], armR: [-1.90, 0, 1.10], foreL: [-.30, 0, 0], foreR: [-.40, 0, 0], legL: [-.45, 0, 0], shinL: [.95, 0, 0], legR: [-.05, 0, 0] } }
    ] }
  },
  warrior: {
    hurt: { dur: .95, keys: [
      { t: 0, p: { armR: [-1.60, .30, .90], foreR: [-1.40, 0, 0], armL: [-.90, 0, -.70], spineC: [.10, .50, 0], head: [.05, .30, 0], legR: [.30, 0, 0], legL: [-.20, 0, 0] } },
      { t: .32, p: { armR: [-1.20, .20, .60], foreR: [-1.60, 0, 0], armL: [-.70, 0, -.55], spineC: [.22, .30, 0], spineB: [.24, -.10, 0], head: [.20, .10, 0], legR: [.10, 0, 0], legL: [-.35, 0, 0], shinL: [.40, 0, 0] } },
      { t: .68, p: { armR: [-.60, 0, .30], foreR: [-.90, 0, 0], armL: [-.50, 0, -.40], spineB: [-.06, .04, 0], head: [-.04, .04, 0] } },
      { t: 1, p: { spineB: [0, 0, 0], head: [0, 0, 0] } }
    ] },
    fall: { dur: 1.5, keys: [
      { t: 0, p: { spineB: [-.20, .10, 0], armR: [-1.80, .30, .80], armL: [-.90, 0, -.60], legR: [.30, 0, 0], shinR: [.40, 0, 0] } },
      { t: .40, p: { spineB: [.30, .20, 0], spineC: [.20, .30, 0], head: [.30, .20, 0], legL: [-.90, 0, 0], shinL: [1.50, 0, 0], legR: [.40, 0, 0], shinR: [1.10, 0, 0], armR: [-1.20, .20, 1.20], armL: [-.60, 0, -.90] } },
      { t: .75, p: { spineB: [.20, .30, .40], head: [.20, .30, .30], legL: [-1.10, 0, 0], shinL: [1.60, 0, 0], legR: [.30, 0, 0], shinR: [.90, 0, 0], armR: [-.80, 0, 1.40] } },
      { t: 1, p: { spineB: [.15, .40, .50], head: [.15, .30, .35], legL: [-1.15, 0, 0], shinL: [1.55, 0, 0], legR: [.25, 0, 0], shinR: [.85, 0, 0], armR: [-.60, 0, 1.50], armL: [-.40, 0, -.90] } }
    ] }
  },
  zombie: {
    hurt: { dur: .95, keys: [
      { t: 0, p: { armL: [-2.20, 0, -.60], armR: [-2.00, 0, .55], foreL: [-.30, 0, 0], foreR: [-.30, 0, 0], spineB: [-.20, 0, .12], spineC: [-.16, 0, .10], head: [-.50, 0, .15], shinR: [.40, 0, 0] } },
      { t: .35, p: { armL: [-1.00, 0, -.90], armR: [-.80, 0, .85], foreL: [-.50, 0, 0], foreR: [-.45, 0, 0], spineB: [.32, 0, -.10], spineC: [.30, 0, -.12], head: [.45, 0, -.10] } },
      { t: .70, p: { armL: [-1.40, 0, -.40], armR: [-1.30, 0, .30], spineB: [.10, 0, .05], head: [.20, 0, .05] } },
      { t: 1, p: { spineB: [.06, 0, 0], head: [.10, 0, 0] } }
    ] },
    fall: { dur: 1.6, keys: [
      { t: 0, p: { spineB: [.50, 0, 0], head: [.50, 0, 0], armL: [-.60, 0, -.50], armR: [-.50, 0, .50], legL: [-.30, 0, 0], shinL: [.50, 0, 0] } },
      { t: .40, p: { spineB: [.90, .10, 0], spineC: [.60, 0, 0], head: [.70, 0, 0], armL: [-1.00, 0, -1.20], armR: [-.90, 0, 1.10], legL: [-.70, 0, 0], shinL: [1.20, 0, 0], legR: [-.20, 0, 0], shinR: [.60, 0, 0] } },
      { t: .75, p: { spineB: [1.10, .10, 0], spineC: [.65, 0, 0], head: [.80, 0, 0], armL: [-.40, 0, -1.50], armR: [-.30, 0, 1.50], legL: [-.90, 0, 0], shinL: [1.30, 0, 0], legR: [-.40, 0, 0], shinR: [.70, 0, 0] } },
      { t: 1, p: { spineB: [1.15, .10, 0], spineC: [.65, 0, 0], head: [.85, 0, 0], armL: [-.20, 0, -1.60], armR: [-.20, 0, 1.55], legL: [-.95, 0, 0], shinL: [1.35, 0, 0], legR: [-.45, 0, 0], shinR: [.75, 0, 0] } }
    ] }
  },
  wizard: {
    hurt: { dur: 1.0, keys: [
      { t: 0, p: { armL: [-1.90, 0, .50], armR: [-1.70, 0, -.40], foreL: [-1.20, 0, 0], foreR: [-1.00, 0, 0], spineC: [0, -.55, 0], spineB: [-.10, -.30, 0], head: [-.20, -.40, 0] } },
      { t: .35, p: { armL: [-1.40, 0, .90], armR: [-1.20, 0, -.80], foreL: [-.90, 0, 0], foreR: [-.70, 0, 0], spineC: [.10, -.30, 0], spineB: [.10, -.16, 0], head: [.10, -.20, 0], legR: [-.20, 0, 0], shinR: [.30, 0, 0] } },
      { t: .70, p: { armL: [-.70, 0, .30], armR: [-.60, 0, -.30], spineC: [0, -.08, 0], head: [0, -.06, 0] } },
      { t: 1, p: { spineC: [0, 0, 0], head: [0, 0, 0] } }
    ] },
    fall: { dur: 1.7, keys: [
      { t: 0, p: { armL: [-1.20, 0, -.70], armR: [-1.00, 0, .60], spineC: [0, -.40, 0], head: [0, -.30, 0] } },
      { t: .38, p: { spineC: [.10, -.90, 0], spineB: [.30, -.30, 0], head: [.20, -.60, 0], armL: [-1.60, 0, -1.00], armR: [-1.40, 0, .90], legL: [-1.00, 0, 0], shinL: [1.50, 0, 0], legR: [-.80, 0, 0], shinR: [1.30, 0, 0] } },
      { t: .72, p: { spineC: [0, -1.30, 0], spineB: [.40, -.20, 0], head: [.10, -.80, 0], legL: [-1.20, 0, 0], shinL: [1.60, 0, 0], legR: [-1.00, 0, 0], shinR: [1.40, 0, 0] } },
      { t: 1, p: { spineC: [0, -1.50, 0], spineB: [.35, -.10, 0], head: [0, -.85, 0], armL: [-.50, 0, -1.10], armR: [-.40, 0, 1.00], legL: [-1.25, 0, 0], shinL: [1.60, 0, 0], legR: [-1.05, 0, 0], shinR: [1.40, 0, 0] } }
    ] }
  },
  soldier: {
    hurt: { dur: .9, keys: [
      { t: 0, p: { armR: [-1.50, 0, .50], foreR: [-1.50, 0, 0], armL: [-1.20, 0, .35], foreL: [-1.10, 0, 0], spineC: [.12, .35, 0], spineB: [.14, 0, 0], head: [.12, .20, 0], legL: [-.10, 0, 0], legR: [.30, 0, 0], shinR: [.45, 0, 0] } },
      { t: .32, p: { armR: [-1.10, 0, .35], foreR: [-1.70, 0, 0], armL: [-.90, 0, .25], foreL: [-1.30, 0, 0], spineC: [.20, .20, 0], spineB: [.30, 0, 0], head: [.26, .10, 0], legR: [.40, 0, 0], shinR: [.70, 0, 0], legL: [-.20, 0, 0] } },
      { t: .68, p: { armR: [-.80, 0, .20], foreR: [-1.10, 0, 0], spineB: [.12, 0, 0], head: [.10, .04, 0] } },
      { t: 1, p: { spineB: [0, 0, 0], head: [0, 0, 0] } }
    ] },
    fall: { dur: 1.5, keys: [
      { t: 0, p: { spineC: [-.20, .30, 0], armR: [-1.60, .10, .60], foreR: [-1.40, 0, 0], armL: [-1.20, 0, .40], legR: [.30, 0, 0], shinR: [.50, 0, 0] } },
      { t: .35, p: { spineB: [-.30, .20, .30], head: [-.30, .20, .20], legL: [-.40, 0, 0], shinL: [.70, 0, 0], legR: [.50, 0, 0], shinR: [.90, 0, 0], armR: [-1.10, 0, 1.20] } },
      { t: .70, p: { spineB: [.10, .30, .70], head: [.10, .30, .50], legL: [-.60, 0, 0], shinL: [.90, 0, 0], legR: [.20, 0, 0], shinR: [.60, 0, 0], armR: [-.70, 0, 1.40], armL: [-.30, 0, .60] } },
      { t: 1, p: { spineB: [.05, .35, .80], head: [.05, .30, .60], legL: [-.65, 0, 0], shinL: [.95, 0, 0], legR: [.15, 0, 0], shinR: [.55, 0, 0], armR: [-.50, 0, 1.45], armL: [-.20, 0, .70] } }
    ] }
  },
  superhero: {
    hurt: { dur: 1.05, keys: [
      { t: 0, p: { armL: [-2.40, 0, -1.10], armR: [-2.40, 0, 1.10], foreL: [-.20, 0, 0], foreR: [-.20, 0, 0], spineB: [-.45, 0, 0], spineC: [-.30, 0, 0], head: [-.45, 0, 0], legL: [-.50, 0, 0], shinL: [.60, 0, 0], legR: [.20, 0, 0] } },
      { t: .30, p: { armL: [-2.20, 0, -.80], armR: [-2.20, 0, .80], spineB: [-.20, 0, .08], head: [-.20, 0, .10], legL: [-.90, 0, 0], shinL: [1.00, 0, 0], legR: [.30, 0, 0] } },
      { t: .65, p: { armL: [-1.20, 0, -.50], armR: [-1.20, 0, .50], foreL: [-.40, 0, 0], foreR: [-.40, 0, 0], spineB: [.20, 0, 0], head: [.25, 0, 0], legL: [-.30, 0, 0], shinL: [.35, 0, 0] } },
      { t: 1, p: { spineB: [.05, 0, 0], head: [.06, 0, 0] } }
    ] },
    fall: { dur: 1.6, keys: [
      { t: 0, p: { spineB: [-.50, 0, 0], head: [-.50, 0, 0], armL: [-2.60, 0, -1.30], armR: [-2.60, 0, 1.30], legL: [-.60, 0, 0], shinL: [.70, 0, 0] } },
      { t: .32, p: { spineB: [-.45, 0, 0], head: [-.30, 0, 0], armL: [-2.80, 0, -1.10], armR: [-2.80, 0, 1.10], legL: [-1.00, 0, 0], shinL: [.90, 0, 0], legR: [-.20, 0, 0], shinR: [.40, 0, 0] } },
      { t: .68, p: { spineB: [.10, 0, 0], head: [.20, 0, 0], armL: [-2.20, 0, -1.40], armR: [-1.80, 0, 1.20], legL: [-1.10, 0, 0], shinL: [1.40, 0, 0], legR: [-.30, 0, 0], shinR: [.60, 0, 0] } },
      { t: 1, p: { spineB: [.05, 0, 0], head: [.25, 0, 0], armL: [-2.00, 0, -1.45], armR: [-1.60, 0, 1.25], legL: [-1.05, 0, 0], shinL: [1.35, 0, 0], legR: [-.25, 0, 0], shinR: [.55, 0, 0] } }
    ] }
  }
};

Object.keys(CLASH).forEach((id) => { if (MOVES[id]) MOVES[id].clash = CLASH[id]; });
Object.keys(REACTIONS).forEach((id) => {
  if (!MOVES[id]) return;
  MOVES[id].hurt = REACTIONS[id].hurt;
  MOVES[id].fall = REACTIONS[id].fall;
});

// Which bone choreography an animation pose maps to.
const POSE_MOVE = {
  charge: 'charge', thrust: 'attack', strike: 'attack', clash: 'clash',
  hurt: 'hurt', recoil: 'hurt', fall: 'fall', down: 'fall',
  getup: 'getup', jump: 'jump', run: 'run', celebrate: 'win'
};

// Poses where a real baked clip is already working the torso and legs: the rig
// only adds flavour there, otherwise the two combine into a folded-over crouch.
const CLIP_BLEND_POSES = new Set(['thrust', 'strike', 'clash', 'hurt', 'recoil', 'fall', 'jump', 'down']);

const AXIS_VECTORS = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const RIG_GAIN = { spineA: .45, spineB: .45, spineC: .5, head: .8, foreL: .6, foreR: .6, neck: .6, pelvis: .35 };

(() => {
  const host = document.getElementById('warrior3DLayer');
  if (!host) return;

  let renderer;
  // MSAA on a full-screen transparent overlay is expensive and, at the pixel ratios
  // used here, invisible: the adaptive scaler below already supersamples the models
  // on hi-dpi panels. Turning it off is the cheapest steady-frame win available.
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', stencil: false, depth: true });
  } catch (e) {
    console.error('3D renderer unavailable', e);
    return;
  }
  // Cap the backing store: full DPR on a big panel is the main reason the arena
  // crawls. The adaptive scaler in the render loop lowers it further at runtime.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, 1, .1, 100);
  camera.position.set(0, 3.2, 12.6);
  camera.lookAt(0, 3.72, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x59677d, 2.05));
  const key = new THREE.DirectionalLight(0xfff4e2, 2.45); key.position.set(-3, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9dcff, 1.15); rim.position.set(4, 4, -4); scene.add(rim);
  // Warm bounce from the terrace so faces are never lit from one side only.
  const bounce = new THREE.DirectionalLight(0xffd9a8, .55); bounce.position.set(2, -1.5, 5); scene.add(bounce);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const FACE_TURN = 1.12;
  const FIGHTER_Z = 1.2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // ---- Model cache: each champion is downloaded once, then cloned per use ----
  const assets = new Map();
  function loadCharacter(id) {
    const spec = CHAR_FILES[id] || CHAR_FILES.giant;
    if (!assets.has(id)) {
      assets.set(id, loader.loadAsync(spec.url).then((gltf) => {
        const model = gltf.scene;
        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        model.traverse((o) => {
          if (!o.isMesh) return;
          // Skinned bounds are computed from the bind pose, so a big attack pose
          // can cull a limb-readable chunk of the champion. Never cull a skinned
          // mesh; there are only six fighters on screen.
          o.frustumCulled = !o.isSkinnedMesh;
          if (o.material) {
            o.material.side = THREE.FrontSide;
            // 4x anisotropy is indistinguishable from 16x at this size but much
            // cheaper to sample on integrated graphics.
            const aniso = Math.min(4, maxAniso);
            ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'].forEach((k) => {
              const t = o.material[k];
              if (t && t.isTexture) { t.anisotropy = aniso; t.needsUpdate = true; }
            });
          }
        });
        // Skinned meshes need resolved world matrices before measuring, otherwise
        // the bind-pose bounds are tiny and the fighter gets blown up to giant size.
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        return {
          scene: model,
          clips: gltf.animations || [],
          rawHeight: Math.max(size.y, .001),
          targetHeight: spec.height
        };
      }).catch((e) => {
        console.error('Character GLB load failed:', id, e);
        assets.delete(id);
        throw e;
      }));
    }
    return assets.get(id);
  }

  function instantiate(asset) {
    const model = cloneSkeleton(asset.scene);
    model.scale.setScalar(asset.targetHeight / asset.rawHeight);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    model.position.y -= bounds.min.y;
    model.updateMatrixWorld(true);
    return model;
  }

  // ---- Animation helpers -------------------------------------------------
  function chooseClip(clips, patterns) {
    return clips.find((c) => patterns.some((p) => p.test(c.name))) || null;
  }
  function setPose(f, clip, freeze) {
    // The four champion models only ship locomotion clips, and their walk poses
    // are strongly stylised (hunched shamble, strutting wizard). For them a
    // frozen clip reads as a broken stance, so they stand in their own rest pose
    // and every limb is animated by the rig layer instead.
    if (f.restOnly && freeze != null) {
      if (f.action) { f.action.stop(); f.action = null; }
      f.currentClip = null; f.poseKey = 'rest';
      return;
    }
    if (!clip) return;
    const key = `${clip.name}|${freeze == null ? 'live' : freeze}`;
    if (f.poseKey === key) return;
    const next = f.mixer.clipAction(clip);
    next.stop(); next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    next.setLoop(THREE.LoopRepeat, Infinity);
    if (freeze == null) {
      next.paused = false; next.setEffectiveTimeScale(1);
    } else {
      // A frozen mid-stride frame reads as a stance; root motion carries the action.
      next.paused = true; next.setEffectiveTimeScale(0); next.time = clip.duration * freeze;
    }
    next.play();
    if (f.action && f.action !== next) f.action.stop();
    f.action = next;
    f.currentClip = clip;
    f.poseKey = key;
  }
  function setAction(f, clip, freezeFallback) {
    if (clip) {
      const key = `${clip.name}|once`;
      if (f.poseKey === key) return;
      const next = f.mixer.clipAction(clip);
      next.stop(); next.reset(); next.enabled = true; next.setEffectiveWeight(1);
      next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true;
      next.paused = false; next.setEffectiveTimeScale(1);
      next.play();
      if (f.action && f.action !== next) f.action.stop();
      f.action = next; f.currentClip = clip; f.poseKey = key;
    } else {
      setPose(f, f.walk || f.run, freezeFallback);
    }
  }

  // Sustained poses (the clash hold is over two seconds) must not freeze the
  // attack halfway through: the clip loops so the champion keeps driving into the
  // deadlock instead of standing there mid-windup.
  function setActionLoop(f, clip, freezeFallback) {
    if (clip) {
      const key = `${clip.name}|loop`;
      if (f.poseKey === key) return;
      const next = f.mixer.clipAction(clip);
      next.stop(); next.reset(); next.enabled = true; next.setEffectiveWeight(1);
      next.setLoop(THREE.LoopRepeat, Infinity); next.clampWhenFinished = false;
      next.paused = false; next.setEffectiveTimeScale(1);
      next.play();
      if (f.action && f.action !== next) f.action.stop();
      f.action = next; f.currentClip = clip; f.poseKey = key;
    } else {
      setPose(f, f.idle || f.walk, freezeFallback);
    }
  }

  // ---- Skeletal acting ---------------------------------------------------
  // Each champion's skeleton is driven in model space so the limbs really move:
  // a negative pitch swings an arm or leg forward, a negative roll lifts an arm
  // out to the side, and yaw twists the torso. Offsets are layered on top of the
  // mixer pose every frame, then eased, so motion stays smooth and never snaps.
  // Fixed slot layout with flat typed buffers. The old path built a fresh
  // object, array and Set for every bone on every frame, which is exactly the
  // kind of garbage that turns a locked 60 fps into a visible hitch.
  const RIG_SLOT_NAMES = Object.keys(RIG_SLOTS);
  const SLOT_COUNT = RIG_SLOT_NAMES.length;
  const SLOT_INDEX = {};
  RIG_SLOT_NAMES.forEach((n, i) => { SLOT_INDEX[n] = i; });
  const I_SPINE_B = SLOT_INDEX.spineB, I_SPINE_C = SLOT_INDEX.spineC;
  const I_HEAD = SLOT_INDEX.head, I_ARM_L = SLOT_INDEX.armL, I_ARM_R = SLOT_INDEX.armR;
  const RIG_GAIN_BUF = new Float32Array(SLOT_COUNT).fill(1);
  RIG_SLOT_NAMES.forEach((n, i) => { if (RIG_GAIN[n] != null) RIG_GAIN_BUF[i] = RIG_GAIN[n]; });
  const STANCE_BUF = {};
  Object.keys(STANCE).forEach((id) => {
    const buf = new Float32Array(SLOT_COUNT * 3);
    const src = STANCE[id];
    Object.keys(src).forEach((slot) => {
      const i = SLOT_INDEX[slot];
      if (i == null) return;
      buf[i * 3] = src[slot][0];
      buf[i * 3 + 1] = src[slot][1];
      buf[i * 3 + 2] = src[slot][2];
    });
    STANCE_BUF[id] = buf;
  });

  function buildRig(f) {
    f.model.updateMatrixWorld(true);
    f.rigBones = new Array(SLOT_COUNT).fill(null);
    f.restQ = new Array(SLOT_COUNT).fill(null);
    f.rigInvQ = new Array(SLOT_COUNT).fill(null);
    f.targetBuf = new Float32Array(SLOT_COUNT * 3);
    f.curBuf = new Float32Array(SLOT_COUNT * 3);
    f.sampleBuf = new Float32Array(SLOT_COUNT * 3);
    f.pose = '';
    f.moveT = 0;
    RIG_SLOT_NAMES.forEach((name, i) => {
      const bone = findBone(f.model, RIG_SLOTS[name]);
      if (!bone) return;
      f.rigBones[i] = bone;
      f.restQ[i] = bone.quaternion.clone();
      f.rigInvQ[i] = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    });
    f.hasRig = !!(f.rigBones[SLOT_INDEX.armR] || f.rigBones[SLOT_INDEX.armL]);
  }

  // Samples the keyframe track straight into a reusable buffer.
  function sampleMoveInto(move, u, out) {
    out.fill(0);
    const keys = move.keys;
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (u >= keys[i].t && u <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
    }
    const span = Math.max(1e-4, b.t - a.t);
    const k = ease((u - a.t) / span);
    const pa = a.p, pb = b.p;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const name = RIG_SLOT_NAMES[i];
      const A = pa && pa[name], B = pb && pb[name];
      if (!A && !B) continue;
      const o = i * 3;
      const ax = A ? A[0] : 0, ay = A ? A[1] : 0, az = A ? A[2] : 0;
      const bx = B ? B[0] : 0, by = B ? B[1] : 0, bz = B ? B[2] : 0;
      out[o] = ax + (bx - ax) * k;
      out[o + 1] = ay + (by - ay) * k;
      out[o + 2] = az + (bz - az) * k;
    }
  }

  const tmpAxis = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
  function applyRig(f, pose, elapsed, dt) {
    if (!f.hasRig) return;
    const lib = MOVES[f.charId] || MOVES.giant;
    const t = f.targetBuf;
    t.set(STANCE_BUF[f.charId] || STANCE_BUF.giant);

    // Constant breathing keeps every stance alive between moves.
    const breath = Math.sin(elapsed * 2.05 + f.seed);
    const sway = Math.sin(elapsed * 1.15 + f.seed * 1.7);
    t[I_SPINE_B * 3] += breath * .014; t[I_SPINE_B * 3 + 1] += sway * .012; t[I_SPINE_B * 3 + 2] += sway * .01;
    t[I_SPINE_C * 3] += breath * .008; t[I_SPINE_C * 3 + 1] += sway * .016;
    t[I_HEAD * 3] -= breath * .012; t[I_HEAD * 3 + 1] += sway * .03;
    t[I_ARM_L * 3] += breath * .012; t[I_ARM_L * 3 + 2] -= Math.abs(breath) * .012;
    t[I_ARM_R * 3] -= breath * .012; t[I_ARM_R * 3 + 2] += Math.abs(breath) * .012;

    const kind = POSE_MOVE[pose];
    // The baked locomotion already carries the four new champions' baked Run;
    // the ogre and knight have a real Run clip too, so the stride layer is only
    // used by the posed champions.
    if (kind && lib[kind] && !(kind === 'run' && !f.restOnly)) {
      const move = lib[kind];
      const raw = f.moveT / move.dur;
      const u = (kind === 'win' || kind === 'run') ? raw % 1 : clamp(raw, 0, 1);
      // Half-strength on the champions whose clip is already acting the pose.
      const blend = !f.restOnly && CLIP_BLEND_POSES.has(pose) ? .55 : 1;
      sampleMoveInto(move, u, f.sampleBuf);
      const s = f.sampleBuf;
      for (let i = 0, n = s.length; i < n; i++) t[i] += s[i] * blend;
    }

    // Stacked spine bones compound quickly: scale them so a full bend reads as a
    // lean instead of folding the champion over.
    for (let i = 0; i < SLOT_COUNT; i++) {
      const g = RIG_GAIN_BUF[i];
      if (g === 1) continue;
      t[i * 3] *= g; t[i * 3 + 1] *= g; t[i * 3 + 2] *= g;
    }

    const rate = kind ? 19 : 6;
    const k = 1 - Math.exp(-dt * rate);
    const cur = f.curBuf;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const bone = f.rigBones[i];
      if (!bone) continue;
      // Without an active clip nothing resets the skeleton, so restore the bind
      // rotation before layering the acting offsets on top of it.
      if (f.restOnly && !f.action) bone.quaternion.copy(f.restQ[i]);
      const o = i * 3;
      cur[o] += (t[o] - cur[o]) * k;
      cur[o + 1] += (t[o + 1] - cur[o + 1]) * k;
      cur[o + 2] += (t[o + 2] - cur[o + 2]) * k;
      const cx = cur[o], cy = cur[o + 1], cz = cur[o + 2];
      if (Math.abs(cx) + Math.abs(cy) + Math.abs(cz) < 1e-5) continue;
      const inv = f.rigInvQ[i];
      tmpQ.set(0, 0, 0, 1);
      for (let axis = 0; axis < 3; axis++) {
        const angle = axis === 0 ? cx : axis === 1 ? cy : cz;
        if (!angle) continue;
        tmpAxis.copy(AXIS_VECTORS[axis]).applyQuaternion(inv).normalize();
        tmpQ2.setFromAxisAngle(tmpAxis, angle);
        tmpQ.multiply(tmpQ2);
      }
      bone.quaternion.multiply(tmpQ);
    }
  }

  // ---- Character props (rifle for the soldier, cape for the superhero) ----
  function findBone(root, patterns) {
    let hit = null;
    root.traverse((o) => {
      if (hit || !o.isBone) return;
      if (patterns.some((p) => p.test(o.name))) hit = o;
    });
    return hit;
  }
  function attachProps(f) {
    if (f.charId === 'soldier') {
      // The rifle is parented to the fighter root (world-sized) and then glued
      // to the right hand every frame, so no bone-space surprises.
      const hand = findBone(f.model, [/right.*hand/i, /hand.*r\b/i, /hand_r/i]);
      if (!hand) return;
      const L = f.bodyH * .40, T = f.bodyH * .026;
      const rifle = new THREE.Group();
      const gunmetal = new THREE.MeshStandardMaterial({ color: 0x1b2430, metalness: .85, roughness: .38 });
      const steel = new THREE.MeshStandardMaterial({ color: 0x0a1119, metalness: .95, roughness: .28 });
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(T * 2.2, T * 3.0, L * .46), gunmetal);
      receiver.position.z = L * .10;
      rifle.add(receiver);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(T * .5, T * .5, L * .46, 8), steel);
      barrel.rotation.x = Math.PI / 2; barrel.position.set(0, T * .2, L * .55);
      rifle.add(barrel);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(T * 1.5, T * 4.2, T * 2.2), gunmetal);
      mag.position.set(0, -T * 3.4, L * .06);
      mag.rotation.x = .22;
      rifle.add(mag);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(T * 1.9, T * 2.6, L * .26), gunmetal);
      stock.position.set(0, -T * .3, -L * .28);
      rifle.add(stock);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(T * 1.4, T * 3.2, T * 1.6), gunmetal);
      grip.position.set(0, -T * 2.4, -L * .06);
      rifle.add(grip);
      rifle.rotation.x = -.12;
      f.root.add(rifle);
      f.prop = rifle;
      f.propBone = hand;
    }

  }

  // ---- Fighters ----------------------------------------------------------
  const fighters = [];
  let spread = 3.35;
  function applySpread(f) {
    f.baseX = -f.toward * spread;
    f.baseRot = f.toward * FACE_TURN;
    f.root.position.set(f.baseX, 0, FIGHTER_Z);
    f.root.rotation.set(0, f.baseRot, 0);
    f.sX = f.baseX; f.sY = 0; f.sRz = 0; f.sRy = f.baseRot;
  }
  // Soft contact shadow so the champions sit on the terrace instead of floating.
  const SHADOW_TEX = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(6, 10, 16, .62)');
    grd.addColorStop(.5, 'rgba(6, 10, 16, .26)');
    grd.addColorStop(1, 'rgba(6, 10, 16, 0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  function makeFighter(index, charId, asset) {
    const model = instantiate(asset);
    const root = new THREE.Group();
    root.add(model);
    scene.add(root);
    const clips = asset.clips;
    const toward = index === 0 ? 1 : -1;
    const f = {
      root, model, index, charId, clips,
      mixer: new THREE.AnimationMixer(model),
      action: null, currentClip: null, poseKey: '', pose: '',
      idle: chooseClip(clips, [/^idle$/i]),
      walk: chooseClip(clips, [/walk/i]),
      run: chooseClip(clips, [/^run$/i, /run/i]),
      jump: chooseClip(clips, [/jump/i]),
      attack: chooseClip(clips, [/^atk0?1$|^attack$/i]),
      special: chooseClip(clips, [/groundslam|special|slam/i]),
      kick: chooseClip(clips, [/^kick$/i]),
      hit: chooseClip(clips, [/^hit$|hurt/i]),
      death: chooseClip(clips, [/^death$|fall|ground/i]),
      win: chooseClip(clips, [/^win$|victory/i]),
      toward, bodyH: asset.targetHeight, rawHeight: asset.rawHeight,
      baseX: 0, baseRot: toward * FACE_TURN, seed: index * 1.9,
      restOnly: !chooseClip(clips, [/^idle$/i]),
      victoryAt: 0, wasVictory: false,
      sX: 0, sY: 0, sRz: 0, sRy: toward * FACE_TURN
    };
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(f.bodyH * .95, f.bodyH * .95),
      new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: .9 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .015;
    root.add(shadow);
    f.shadow = shadow;
    buildRig(f);
    attachProps(f);
    applySpread(f);
    setPose(f, f.idle || f.walk, f.idle ? null : .18);
    return f;
  }

  let baseCamY = 3.2, baseCamZ = 12.6, cineZoom = 0;
  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const aspect = w / h;
    camera.fov = aspect < 1 ? 48 : 44;
    camera.position.set(0, aspect < 1 ? 3.4 : 3.2, aspect < 1 ? 13.6 : 12.6);
    baseCamY = aspect < 1 ? 3.4 : 3.2;
    baseCamZ = aspect < 1 ? 13.6 : 12.6;
    camera.lookAt(0, 3.72, 0);
    camera.updateProjectionMatrix();
    const halfW = Math.tan(camera.fov * Math.PI / 360) * (camera.position.z - FIGHTER_Z) * aspect;
    const stance = aspect >= 1.6 ? .68 : .6;
    spread = Math.max(1.2, Math.min(9.5, halfW * stance));
    fighters.forEach((f) => { if (f) applySpread(f); });
  }

  // ---- Champion-select previews -----------------------------------------
  const previewViews = [];
  function fitPreview(v) {
    const w = Math.max(1, v.holder.clientWidth), h = Math.max(1, v.holder.clientHeight);
    if (w === v.w && h === v.h) return;
    v.w = w; v.h = h;
    v.pr.setSize(w, h, false);
    const aspect = w / h, dist = 6.9 * (aspect < 1.4 ? 1.24 : 1) * (v.bodyH / 3.9);
    v.cam.aspect = aspect;
    v.cam.position.set(0, v.bodyH * .5, dist);
    v.cam.lookAt(0, v.bodyH * .48, 0);
    v.cam.updateProjectionMatrix();
  }
  function buildPreviews() {
    [['p1PreviewCanvas', 0], ['p2PreviewCanvas', 1]].forEach(([canvasId, side]) => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const holder = canvas.parentElement;
      if (!holder) return;
      let pr;
      // Portrait canvases: native resolution with MSAA so the champion cards are
      // as crisp as the arena layer.
      try { pr = new THREE.WebGLRenderer({ alpha: true, antialias: true, stencil: false }); } catch (e) { return; }
      pr.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      pr.outputColorSpace = THREE.SRGBColorSpace;
      pr.toneMapping = THREE.ACESFilmicToneMapping;
      pr.toneMappingExposure = 1.08;
      pr.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
      holder.appendChild(pr.domElement);
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x59677d, 2.0));
      const k = new THREE.DirectionalLight(0xffffff, 2.6); k.position.set(-2.5, 5, 4); sc.add(k);
      const cam = new THREE.PerspectiveCamera(34, 1, .1, 40);
      previewViews.push({ pr, sc, cam, holder, side, body: null, mixer: null, w: 0, h: 0, bodyH: 4.95, charId: null });
      canvas.style.display = 'none';
      window.gshPreview3d = true;
    });
  }
  async function setPreviewCharacter(view, charId) {
    if (view.charId === charId) return;
    // Claim the slot immediately so a slower earlier download cannot win the race
    // and repaint an old champion over the one the player just picked.
    view.charId = charId;
    const asset = await loadCharacter(charId);
    if (view.charId !== charId) return;
    if (view.body) view.sc.remove(view.body);
    const model = instantiate(asset);
    model.rotation.y = view.side === 0 ? .5 : -.5;
    view.sc.add(model);
    view.body = model;
    view.charId = charId;
    view.bodyH = asset.targetHeight;
    view.mixer = new THREE.AnimationMixer(model);
    if (asset.clips.length) {
      const idle = asset.clips.find((c) => /^idle$/i.test(c.name));
      const walk = asset.clips.find((c) => /walk/i.test(c.name));
      if (idle) view.mixer.clipAction(idle).play();
      else if (walk) {
        const a = view.mixer.clipAction(walk);
        a.play(); a.paused = true; a.time = walk.duration * .18;
      }
    }
    fitPreview(view);
  }

  // ---- Selection sync ----------------------------------------------------
  function currentIds() {
    try {
      if (typeof window.gshGetCharacters === 'function') return window.gshGetCharacters();
      if (typeof game !== 'undefined') return [game.p1.characterId, game.p2.characterId];
    } catch (_) { /* fall through */ }
    return ['giant', 'warrior'];
  }
  let fighterToken = 0;
  async function refreshFighters(ids) {
    if (fighters[0] && fighters[1] && fighters[0].charId === ids[0] && fighters[1].charId === ids[1]) return;
    const token = ++fighterToken;
    let loaded;
    try { loaded = await Promise.all(ids.map(loadCharacter)); } catch (e) { console.error(e); return; }
    if (token !== fighterToken) return; // a newer selection already took over
    fighters.forEach((f) => { if (f) scene.remove(f.root); });
    fighters[0] = makeFighter(0, ids[0], loaded[0]);
    fighters[1] = makeFighter(1, ids[1], loaded[1]);
    resize();
    window.gsh3dReady = true;
  }
  async function refreshAll() {
    const ids = currentIds();
    await Promise.all(previewViews.map((v) => setPreviewCharacter(v, ids[v.side]).catch(() => {})));
    await refreshFighters(currentIds());
  }
  // Serialise refresh requests so two quick champion picks cannot interleave.
  let refreshQueue = Promise.resolve();
  window.gshRefresh3D = () => {
    refreshQueue = refreshQueue.then(refreshAll).catch((e) => console.error('3D refresh failed', e));
  };

  // Small diagnostic hook used while tuning the champion-select cards.
  window.gshPreviewDebug = () => previewViews.map((v) => ({
    charId: v.charId, hasBody: !!v.body, w: v.w, h: v.h, bodyH: v.bodyH,
    frames: v.pr.info.render.frame,
    rect: v.pr.domElement.isConnected ? [v.pr.domElement.clientWidth, v.pr.domElement.clientHeight] : null
  }));

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  buildPreviews();
  resize();

  // ---- Adaptive 3D resolution ------------------------------------------
  // The scene is a full-screen transparent layer over a full-screen 2D canvas, so
  // fill rate is the whole frame budget. One pixel-ratio step changes the number of
  // shaded pixels quadratically. The scaler steps down at once on a slow window and
  // creeps back up only after several fast ones, so it can never flap.
  // Native panel sharpness upward: the champions are the whole point of the
  // screen, so tier 0 renders at the full device pixel ratio.
  const SCALE_STEPS = [0.75, 1.0, 1.25, 1.5, 2.0];
  const DPR_BASE = window.devicePixelRatio || 1;
  let qualityTier = 0;
  let pageCap = 1.0;      // set by the page's own 2D quality tier
  let scaleStep = SCALE_STEPS.length - 1;
  const currentCap = () => Math.min(pageCap, SCALE_STEPS[scaleStep]);
  function applyRenderScale() {
    renderer.setPixelRatio(Math.min(DPR_BASE, currentCap()));
    resize();
  }
  window.gshSetQuality = (tier) => {
    qualityTier = Math.max(0, Math.min(2, Number(tier) || 0));
    pageCap = qualityTier === 0 ? 2 : qualityTier === 1 ? 1.5 : 1;
    applyRenderScale();
  };
  refreshAll().catch((e) => { console.error('Initial 3D load failed', e); window.gsh3dReady = false; window.gsh3dAnchors = null; });

  // ---- Render loop -------------------------------------------------------
  const clock = new THREE.Clock();
  let elapsed = 0;
  const handLocal = new THREE.Vector3(), handWorld = new THREE.Vector3();
  const propWorld = new THREE.Vector3(), propQuat = new THREE.Quaternion(), rootQuat = new THREE.Quaternion();
  const handY = new THREE.Vector3(), barrelAxis = new THREE.Vector3(0, 0, 1);
  const anchors = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } };

  const arenaScreenEl = document.getElementById('arenaScreen');
  const onArenaScreen = () => !!arenaScreenEl && !arenaScreenEl.classList.contains('hidden');

  let perfAcc = 0, perfFrames = 0, fastWindows = 0;
  let previewAcc = 0, sinceArenaRender = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) { clock.getDelta(); return; }
    const rawDt = clock.getDelta();
    elapsed += Math.min(rawDt, .05);

    // Only step and draw the arena while it is on screen. The champion-select
    // cards keep their own tiny canvases; the arena renderer costs nothing
    // while the player is on another screen.
    if (!onArenaScreen()) {
      if (previewViews.length) {
        const selectScreenEl = document.getElementById('selectScreen');
        if (selectScreenEl && !selectScreenEl.classList.contains('hidden')) {
          // Idle preview loops at ~16 fps: a standing pose reads the same and this
          // keeps the two extra WebGL contexts nearly free.
          previewAcc += rawDt;
          if (previewAcc >= 1 / 16) {
            const pdt = Math.min(previewAcc, .1);
            previewAcc = 0;
            for (const v of previewViews) {
              if (!v.body) continue;
              fitPreview(v);
              v.mixer.update(pdt);
              v.pr.render(v.sc, v.cam);
            }
          }
        }
      }
      return;
    }

    // A 90-144 Hz panel buys nothing visible on a full-screen skinned layer this
    // heavy. Above ~100 Hz the arena renders at 60-80 fps while the clock keeps
    // running, which removes up to half of the GPU work on those screens.
    sinceArenaRender += rawDt;
    if (sinceArenaRender < 0.010) return;
    const dt = Math.min(sinceArenaRender, .05);
    sinceArenaRender = 0;

    const state = window.gsh3dFrame;

    if (state && fighters[0] && fighters[1]) {
      const phase = state.phase || 'PICKING', timer = state.timer || 0, victory = phase === 'VICTORY';
      // Hit-stop: the page freezes its own clocks at the moment of impact and asks
      // the rig to do the same, so the champions hang dead still for a beat while
      // the screen shakes. A tiny tremble keeps it from looking like a dropped frame.
      // Cinematic push-in while the powers grind together, plus a slow handheld
      // drift so the arena never looks like a frozen camera.
      const wantZoom = phase === 'CENTER_CLASH' || phase === 'SURGE_HIT' ? 1 : 0;
      cineZoom += (wantZoom - cineZoom) * Math.min(1, dt * 2.6);
      camera.position.set(
        Math.sin(elapsed * .55) * .07 * (1 - cineZoom),
        baseCamY + cineZoom * .24 + Math.cos(elapsed * .47) * .045,
        baseCamZ - cineZoom * 1.3
      );
      camera.lookAt(0, 3.72 + cineZoom * .06, 0);
      // The hit-stop jolt: a small kick that settles as the freeze ends.
      if (freeze > 0) camera.position.x += Math.sin(elapsed * 90) * .02;
      // The page owns the cinematic tempo; read it here so both stay in sync.
      const DURS = state.durs || { charge: 1.85, travel: 1.28, draw: 1.15 };
      const FT = state.fallTimings || { stagger: .30, riseStart: 1.86, riseEnd: 2.55 };
      if (victory) {
        if (!fighters[0].wasVictory) fighters.forEach((f) => { f.victoryAt = elapsed; f.wasVictory = true; });
      } else if (fighters[0].wasVictory) {
        fighters.forEach((f) => { f.wasVictory = false; });
      }

      fighters.forEach((f, i) => {
        const q = i === 0 ? state.p1 : state.p2;
        const toward = f.toward;
        const sig = STYLES[f.charId] || STYLES.giant;
        const winner = state.winnerSide === (i + 1);
        let x = f.baseX, y = 0, rz = 0, ry = f.baseRot, pose = 'idle';

        if (victory && winner) {
          // Champion's lap: crouch → leap → sprint at the fallen rival → air strike
          // → second leap → jog back → signature taunt, looping under the sparks.
          const vt = Math.max(0, elapsed - (f.victoryAt || elapsed));
          const t = vt % 6.2;
          const lap = sig.lap, jump = sig.jump;
          if (t < .42) {
            pose = 'celebrate';
            const k = ease(t / .42); y = -.10 * k * lap; rz = toward * .04 * k;
          } else if (t < 1.35) {
            const u = (t - .42) / .93, a = Math.sin(u * Math.PI);
            pose = 'jump'; y = a * .92 * jump; rz = -toward * .06 * a;
            x += toward * .14 * ease(Math.min(1, u * 1.8)) * lap;
          } else if (t < 2.5) {
            const u = ease((t - 1.35) / 1.15);
            pose = 'run'; x += toward * (.14 + 1.00 * u) * lap;
            y = Math.abs(Math.sin(elapsed * 13)) * .09; rz = -toward * .09 * u;
          } else if (t < 3.16) {
            const u = (t - 2.5) / .66;
            pose = 'strike'; x += toward * (1.14 - .34 * ease(u)) * lap;
            y = Math.max(0, Math.sin(u * Math.PI)) * .06; rz = -toward * .05;
          } else if (t < 4.06) {
            const u = (t - 3.16) / .90, a = Math.sin(u * Math.PI);
            pose = 'jump'; x += toward * .80 * lap; y = a * .64 * jump; rz = toward * .05 * a;
          } else if (t < 5.02) {
            const u = ease((t - 4.06) / .96);
            pose = 'run'; x += toward * .80 * lap * (1 - u);
            y = Math.abs(Math.sin(elapsed * 13)) * .09; rz = -toward * .09 * (1 - u);
          } else {
            pose = 'celebrate';
            const b = Math.sin(elapsed * 3.1);
            y = Math.max(0, b) * .05; rz = toward * .03 * b; x += toward * .06;
            if (sig.taunt === 'spin') ry = f.baseRot + (elapsed * 2.4) % (Math.PI * 2);
            else if (sig.taunt === 'roar') { rz += toward * .10 * Math.abs(Math.sin(elapsed * 2.2)); y += Math.abs(Math.sin(elapsed * 2.6)) * .03; }
            else if (sig.taunt === 'march') { y += Math.abs(Math.sin(elapsed * 6)) * .05; }
            else if (sig.taunt === 'lurch') { ry = f.baseRot + Math.sin(elapsed * 1.3) * .18; x += toward * Math.sin(elapsed * 1.3) * .10; }
            else if (sig.taunt === 'fly') { y += Math.abs(Math.sin(elapsed * 1.7)) * .22 * jump; rz += -toward * .05; }
          }
        } else if (victory) {
          const vt = Math.max(0, elapsed - (f.victoryAt || elapsed));
          const kd = ease(clamp(vt / .85, 0, 1));
          pose = 'down';
          y = .03 + .02 * kd;
          // Thrown away from the winner, tipping out onto the terrace.
          x -= toward * .62 * kd;
          rz = toward * 1.12 * kd;
          if (kd >= 1) rz += toward * Math.sin(elapsed * 1.3) * .01;
        } else if ((q.fall || 0) > .02) {
          // Full knockdown arc: stagger → fall → lie still → stand back up.
          const since = Math.max(0, (q.fallMax || 2.6) - (q.fall || 0));
          const riseStart = FT.riseStart, riseEnd = FT.riseEnd;
          if (since < FT.stagger) {
            pose = 'hurt';
            const amt = (1 - since / FT.stagger) * sig.recoil;
            x -= toward * (.12 + .18 * amt); y = Math.sin(elapsed * 46) * .014 * amt;
            rz = toward * .16 * amt; ry = f.baseRot - toward * .12 * amt;
          } else if (since < riseStart) {
            // Knocked off both feet: the body is thrown back, arcs over, slams the
            // terrace, rebounds once on the shoulder and settles flat before the
            // slow get-up. Gravity accelerates the arc so the fall reads as weight,
            // not as a slow tip-over.
            const fallT = clamp((since - FT.stagger) / .62, 0, 1);
            const e = fallT * fallT;
            pose = 'fall';
            y = .03 + .045 * e;
            // Knocked AWAY from the strike, never gliding into the attacker.
            // Kept short enough that the body stays inside the frame.
            x -= toward * .55 * e - toward * .14 * (1 - e);
            rz = toward * 1.08 * e;
            ry = f.baseRot - toward * .18 * e;
            const bt = clamp((since - FT.stagger - .62) / .62, 0, 1);
            if (bt > 0) {
              const bounce = Math.sin(bt * Math.PI) * (1 - bt * .45);
              y += bounce * .08;
              x -= toward * .10 * bounce;
              rz += toward * .075 * bounce;
              // Momentum keeps the limbs twitching a beat after the torso lands.
              rz -= toward * Math.sin(elapsed * 9) * .014 * (1 - bt);
              x += toward * Math.sin(elapsed * 6.4) * .006 * (1 - bt);
            }
          } else {
            const u = clamp((since - riseStart) / (riseEnd - riseStart), 0, 1), e = ease(u);
            pose = 'getup';
            y = -(1 - e) * .02 + Math.sin(u * Math.PI) * .045;
            x -= toward * .55 * (1 - e);
            rz = toward * 1.08 * (1 - e);
            ry = f.baseRot - toward * .18 * (1 - e);
          }
        } else if ((q.hurt || 0) > .02) {
          pose = 'hurt';
          const amt = clamp((q.hurt || 0) / 1.2, 0, 1) * sig.recoil;
          x -= toward * (.10 + .18 * amt); y = Math.sin(elapsed * 42) * .012 * amt;
          rz = toward * .13 * amt; ry = f.baseRot - toward * .10 * amt;
        } else if (phase === 'CHARGING') {
          // Both fighters coil back and channel power into their raised fists.
          pose = 'charge';
          const t = clamp(timer / DURS.charge, 0, 1), gather = ease(t);
          x -= toward * .16 * gather * sig.lean; y = Math.sin(elapsed * 22) * .014 * gather;
          rz = toward * .055 * gather * sig.lean; ry = f.baseRot + toward * .03 * gather;
        } else if (phase === 'SURGE_HIT' && state.applied) {
          // The winner stays thrown forward while the power is still landing.
          pose = 'thrust';
          const ss = clamp(state.surge || 0, 0, 1);
          x += toward * (.3 + .3 * ss); y = Math.max(0, Math.sin(elapsed * 2.6)) * .012;
        } else if (phase === 'TRAVEL_TO_CENTER' || phase === 'CENTER_CLASH' || phase === 'SURGE_HIT') {
          // Release: both fighters thrust forward and stay locked in the clash.
          // At the centre each champion braces in its own posture instead of
          // replaying its attack swing.
          pose = phase === 'CENTER_CLASH' ? 'clash' : 'thrust';
          const push = ease(phase === 'TRAVEL_TO_CENTER' ? clamp(timer / DURS.travel, 0, 1) : 1);
          x += toward * .58 * push * sig.lunge; y = Math.max(0, Math.sin(push * Math.PI)) * .05;
          rz = -toward * .11 * push; ry = f.baseRot + toward * .06 * push;
          // Both champions brace into the deadlock: the strain shows as a tremble
          // that grows until the breakthrough fires.
          if (phase === 'CENTER_CLASH') {
            const strain = Math.min(1, timer / 1.2);
            x += toward * Math.sin(elapsed * 27) * .022 * strain;
            rz += Math.sin(elapsed * 21) * .016 * strain;
            y += Math.abs(Math.sin(elapsed * 17)) * .012 * strain;
          }
        } else if (phase === 'DRAW_PULSE') {
          pose = 'recoil';
          const t = ease(clamp(timer / DURS.draw, 0, 1));
          x -= toward * .34 * t; rz = toward * .14 * t;
        } else {
          const b = Math.sin(elapsed * 1.9 + f.seed);
          y = Math.max(0, b) * .014; ry = f.baseRot + toward * .03 * b;
        }


        // Every action starts exactly once per pose so attack, hurt and fall read cleanly.
        if (pose !== f.pose) {
          // Charge from a standing base: freezing a deep crouch frame of the baked
          // GroundSlam made the giant and knight fold to half height mid-attack.
          if (pose === 'charge') setPose(f, f.idle || f.walk, f.idle ? null : .18);
          else if (pose === 'thrust') setActionLoop(f, f.attack || f.special, .45);
          else if (pose === 'clash') setActionLoop(f, f.special || f.attack, .28);
          else if (pose === 'hurt') setAction(f, f.hit, .55);
          else if (pose === 'fall') setAction(f, f.death || f.hit, .70);
          else if (pose === 'down') setPose(f, f.death || f.hit || f.walk, .85);
          else if (pose === 'getup') setPose(f, f.idle || f.walk, f.idle ? null : .22);
          else if (pose === 'recoil') setAction(f, f.hit, .55);
          else if (pose === 'run') setPose(f, f.run || f.walk, null);
          else if (pose === 'jump') setAction(f, f.jump || f.kick || f.attack, .40);
          else if (pose === 'strike') setAction(f, f.attack || f.special, .55);
          else if (pose === 'celebrate') setPose(f, f.win || f.walk, f.win ? null : .20);
          else setPose(f, f.idle || f.walk, f.idle ? null : .18);
          f.pose = pose;
        }

        x = clamp(x, -8, 8);
        // Ease the placed root so phase changes never snap the whole fighter.
        const kRoot = 1 - Math.exp(-adt * 17);
        f.sX += (x - f.sX) * kRoot;
        f.sY += (y - f.sY) * kRoot;
        f.sRz += (rz - f.sRz) * kRoot;
        f.sRy += (ry - f.sRy) * Math.min(1, kRoot * .85);
        f.root.position.set(f.sX, f.sY, FIGHTER_Z);
        f.root.rotation.set(0, f.sRy, f.sRz);
        if (freeze > 0) {
          f.root.position.x += Math.sin(elapsed * 130 + f.seed) * .022;
          f.root.position.y += Math.cos(elapsed * 105 + f.seed) * .012;
        }
        f.mixer.update(adt);
        f.moveT = pose === f.pose ? f.moveT + adt : 0;
        applyRig(f, pose, elapsed, adt);
        // Only the fighter carrying a prop needs its children's world matrices
        // before the render. Every other champion was walked twice per frame (once
        // here, once by the renderer) for nothing; the root matrix alone is enough
        // to place the fist anchor below.
        f.root.updateWorldMatrix(false, false);
        if (f.prop) f.model.updateMatrixWorld(true);

        if (f.prop && f.propBone) {
          f.propBone.getWorldPosition(propWorld);
          f.root.worldToLocal(propWorld);
          f.prop.position.copy(propWorld);
          f.prop.position.y += f.bodyH * .03;
          // The rifle rides along the hand's own axis, so raising the arm aims it.
          f.propBone.getWorldQuaternion(propQuat);
          handY.set(0, 0, 1).applyQuaternion(propQuat).normalize();
          f.root.getWorldQuaternion(rootQuat).invert();
          handY.applyQuaternion(rootQuat);
          f.prop.quaternion.setFromUnitVectors(barrelAxis, handY);
        }

        // Publish each fist's screen position so powers launch from the real gauntlets.
        const bodyScale = f.bodyH / 2.9;
        handLocal.set(toward * .18 * bodyScale, 1.92 * bodyScale, .62 * bodyScale);
        // Reuse the published anchor objects: a fresh {x,y} pair per fighter per
        // frame is small, but it is still steady garbage on a 60-120 Hz loop.
        handWorld.copy(handLocal).applyMatrix4(f.root.matrixWorld).project(camera);
        const anchor = i === 0 ? anchors.p1 : anchors.p2;
        anchor.x = clamp(handWorld.x * .5 + .5, 0, 1);
        anchor.y = clamp(-handWorld.y * .5 + .5, 0, 1);
      });
      window.gsh3dAnchors = anchors;
    }

    // Keep the layer honest about its own cost: a slow window steps the render
    // scale down immediately, a long run of fast windows earns one step back.
    perfAcc += dt; perfFrames += 1;
    if (perfFrames >= 24) {
      const avg = perfAcc / perfFrames;
      perfAcc = 0; perfFrames = 0;
      if (avg > 0.020 && scaleStep > 0) {
        // A badly blown frame budget drops two steps at once, so a weak GPU
        // reaches a smooth resolution in well under a second.
        scaleStep = Math.max(0, scaleStep - (avg > 0.032 ? 2 : 1));
        fastWindows = 0; applyRenderScale();
      } else if (avg < 0.0145) {
        fastWindows += 1;
        if (fastWindows >= 4 && scaleStep < SCALE_STEPS.length - 1) {
          scaleStep += 1; fastWindows = 0; applyRenderScale();
        }
      } else {
        fastWindows = 0;
      }
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
