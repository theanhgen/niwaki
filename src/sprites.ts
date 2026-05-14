import type { Sprite } from "./types.js"

export const TREE_TYPES: string[] = [
  "oak", "pine", "birch", "willow", "cherry",
  "maple", "ginkgo", "acacia", "baobab", "dragonblood",
  "araucaria", "olive", "banyan", "eucalyptus",
]

const COLORS: Record<string, string> = {
  // existing
  canopyDark: "#3f7132",
  canopyMid: "#5b9a4a",
  canopyLight: "#7cc96a",
  canopyDeep: "#2d5b29",
  canopyBright: "#a4e28d",
  trunkDark: "#6f4c2f",
  trunkMid: "#8e6238",
  trunkLight: "#b18552",
  birchTrunk: "#d9d6d2",
  cherryPink: "#de93b8",
  cherryBloom: "#f0b7cf",
  // maple (North America)
  mapleRed: "#c0392b",
  mapleOrange: "#e67e22",
  mapleTrunk: "#6b3a2a",
  // ginkgo (East Asia)
  ginkgoGold: "#ffd700",
  ginkgoDark: "#b8960c",
  ginkgoTrunk: "#7a5c3a",
  // acacia (East Africa)
  acaciaCanopy: "#8b9b55",
  acaciaTrunk: "#6b4226",
  // baobab (Madagascar / Africa)
  baobabTrunk: "#8b6914",
  baobabLeaf: "#6b8b45",
  // dragon blood (Socotra)
  dragonDome: "#5b7b6f",
  dragonDomeDark: "#3d5c52",
  dragonTrunk: "#9a9a9a",
  // araucaria / monkey puzzle (South America)
  araucariaGreen: "#3d7a3d",
  araucariaDark: "#2a5a2a",
  araucariaTrunk: "#7a6040",
  // olive (Mediterranean Europe)
  oliveGreen: "#8fab7a",
  oliveBright: "#b5c99a",
  oliveTrunk: "#7a6b5a",
  // banyan (South Asia)
  banyanGreen: "#2d6a2d",
  banyanMid: "#4a8a4a",
  banyanRoots: "#8b7355",
  // eucalyptus (Australia)
  eucalyptusBlue: "#5a9e8a",
  eucalyptusLight: "#7abfb0",
  eucalyptusTrunk: "#b0b8a8",
}

function parse(template: string, palette: Record<string, string>): Sprite {
  const lines = template.trim().split("\n")
  const width = Math.max(...lines.map((line) => line.length))
  const rows = lines
    .map((line) => line.padEnd(width, " "))
    .map((line) =>
      Array.from(line, (token): [string, string | null] => {
        const color = palette[token] ?? null
        return color ? ["█", color] : [" ", null]
      }),
    )
    .reverse()

  return { rows, width }
}

type Stage = "seed" | "sapling" | "young" | "full"
type SpriteSet = Record<Stage, Sprite>

const SPRITES: Record<string, SpriteSet> = {
  oak: {
    seed: parse(
      `
 g
 t
`,
      { g: COLORS.canopyMid, t: COLORS.trunkMid },
    ),
    sapling: parse(
      `
 gg
ggg
 t
`,
      { g: COLORS.canopyMid, t: COLORS.trunkMid },
    ),
    young: parse(
      `
  gg
 gGGg
ggGGgg
  tt
  tt
`,
      { g: COLORS.canopyMid, G: COLORS.canopyDark, t: COLORS.trunkMid },
    ),
    full: parse(
      `
   gg
 gGGGG
ggGGGGgg
 gGGGGg
   tt
   tt
`,
      { g: COLORS.canopyMid, G: COLORS.canopyDark, t: COLORS.trunkMid },
    ),
  },
  pine: {
    seed: parse(
      `
 g
 t
`,
      { g: COLORS.canopyDeep, t: COLORS.trunkDark },
    ),
    sapling: parse(
      `
  g
 gg
ggg
 t
`,
      { g: COLORS.canopyDeep, t: COLORS.trunkDark },
    ),
    young: parse(
      `
   g
  ggg
 gGGGg
ggGGGG
   t
   t
`,
      { g: COLORS.canopyDeep, G: COLORS.canopyDark, t: COLORS.trunkDark },
    ),
    full: parse(
      `
    g
   ggg
  gGGGg
 gGGGGGg
ggGGGGGG
 gGGGGG
    t
    t
`,
      { g: COLORS.canopyDeep, G: COLORS.canopyDark, t: COLORS.trunkDark },
    ),
  },
  birch: {
    seed: parse(
      `
 g
 b
`,
      { g: COLORS.canopyLight, b: COLORS.birchTrunk },
    ),
    sapling: parse(
      `
 gg
ghg
 b
`,
      { g: COLORS.canopyLight, h: COLORS.canopyBright, b: COLORS.birchTrunk },
    ),
    young: parse(
      `
  hg
 hggg
ggghhg
  bb
  bb
`,
      { g: COLORS.canopyLight, h: COLORS.canopyBright, b: COLORS.birchTrunk },
    ),
    full: parse(
      `
   hh
 hgggh
ggghhgg
 hgggh
   bb
   bb
`,
      { g: COLORS.canopyLight, h: COLORS.canopyBright, b: COLORS.birchTrunk },
    ),
  },
  willow: {
    seed: parse(
      `
 g
 t
`,
      { g: COLORS.canopyLight, t: COLORS.trunkMid },
    ),
    sapling: parse(
      `
 ggg
ggggg
 ttt
`,
      { g: COLORS.canopyLight, t: COLORS.trunkMid },
    ),
    young: parse(
      `
  gggg
 gggggg
gg ggg gg
gg     gg
   tt
   tt
`,
      { g: COLORS.canopyLight, t: COLORS.trunkMid },
    ),
    full: parse(
      `
   ggggg
 gggggggg
gg ggggg gg
gg  ggg  gg
gg       gg
    tt
    tt
`,
      { g: COLORS.canopyLight, t: COLORS.trunkMid },
    ),
  },
  cherry: {
    seed: parse(
      `
 p
 t
`,
      { p: COLORS.cherryPink, t: COLORS.trunkLight },
    ),
    sapling: parse(
      `
 pp
pPp
 t
`,
      { p: COLORS.cherryBloom, P: COLORS.cherryPink, t: COLORS.trunkLight },
    ),
    young: parse(
      `
  pP
 pPPp
pPPpPP
  tt
  tt
`,
      { p: COLORS.cherryBloom, P: COLORS.cherryPink, t: COLORS.trunkLight },
    ),
    full: parse(
      `
   pPp
 pPPPPp
pPPpPPPp
 pPPPpp
   tt
   tt
`,
      { p: COLORS.cherryBloom, P: COLORS.cherryPink, t: COLORS.trunkLight },
    ),
  },
  maple: {
    seed: parse(
      `
 r
 t
`,
      { r: COLORS.mapleOrange, t: COLORS.mapleTrunk },
    ),
    sapling: parse(
      `
 rr
rRr
 t
`,
      { r: COLORS.mapleOrange, R: COLORS.mapleRed, t: COLORS.mapleTrunk },
    ),
    young: parse(
      `
  rr
 rRRr
rrRRrr
  tt
  tt
`,
      { r: COLORS.mapleOrange, R: COLORS.mapleRed, t: COLORS.mapleTrunk },
    ),
    full: parse(
      `
   rr
 rRRRR
rrRRRRrr
 rRRRRr
   tt
   tt
`,
      { r: COLORS.mapleOrange, R: COLORS.mapleRed, t: COLORS.mapleTrunk },
    ),
  },
  ginkgo: {
    seed: parse(
      `
 g
 t
`,
      { g: COLORS.ginkgoGold, t: COLORS.ginkgoTrunk },
    ),
    sapling: parse(
      `
ggg
 g
 t
`,
      { g: COLORS.ginkgoGold, t: COLORS.ginkgoTrunk },
    ),
    young: parse(
      `
 gGGg
gGGGGg
  gg
  tt
  tt
`,
      { g: COLORS.ginkgoGold, G: COLORS.ginkgoDark, t: COLORS.ginkgoTrunk },
    ),
    full: parse(
      `
gGGGGGGg
 gGGGGg
  gGGg
   tt
   tt
   tt
`,
      { g: COLORS.ginkgoGold, G: COLORS.ginkgoDark, t: COLORS.ginkgoTrunk },
    ),
  },
  acacia: {
    seed: parse(
      `
 c
 t
`,
      { c: COLORS.acaciaCanopy, t: COLORS.acaciaTrunk },
    ),
    sapling: parse(
      `
 ccc
  t
  t
`,
      { c: COLORS.acaciaCanopy, t: COLORS.acaciaTrunk },
    ),
    young: parse(
      `
 ccccc
   t
   t
   t
`,
      { c: COLORS.acaciaCanopy, t: COLORS.acaciaTrunk },
    ),
    full: parse(
      `
cccccccc
   t
   t
   t
   t
`,
      { c: COLORS.acaciaCanopy, t: COLORS.acaciaTrunk },
    ),
  },
  baobab: {
    seed: parse(
      `
 l
 T
`,
      { l: COLORS.baobabLeaf, T: COLORS.baobabTrunk },
    ),
    sapling: parse(
      `
l l
 T
 TT
`,
      { l: COLORS.baobabLeaf, T: COLORS.baobabTrunk },
    ),
    young: parse(
      `
l l l
 TTTT
 TTTT
  TT
`,
      { l: COLORS.baobabLeaf, T: COLORS.baobabTrunk },
    ),
    full: parse(
      `
l l l l
 TTTTT
TTTTTTT
TTTTTTT
 TTTTT
`,
      { l: COLORS.baobabLeaf, T: COLORS.baobabTrunk },
    ),
  },
  dragonblood: {
    seed: parse(
      `
 d
 s
`,
      { d: COLORS.dragonDome, s: COLORS.dragonTrunk },
    ),
    sapling: parse(
      `
 ddd
  s
  s
`,
      { d: COLORS.dragonDome, s: COLORS.dragonTrunk },
    ),
    young: parse(
      `
 dDDd
ddDDdd
  ss
  ss
`,
      { d: COLORS.dragonDome, D: COLORS.dragonDomeDark, s: COLORS.dragonTrunk },
    ),
    full: parse(
      `
 dDDDd
dDDDDDd
 dDDDd
  ss
  ss
`,
      { d: COLORS.dragonDome, D: COLORS.dragonDomeDark, s: COLORS.dragonTrunk },
    ),
  },
  araucaria: {
    seed: parse(
      `
 a
 t
`,
      { a: COLORS.araucariaGreen, t: COLORS.araucariaTrunk },
    ),
    sapling: parse(
      `
  a
 aaa
  t
  t
`,
      { a: COLORS.araucariaGreen, t: COLORS.araucariaTrunk },
    ),
    young: parse(
      `
   a
  aAa
 a A a
   t
   t
`,
      { a: COLORS.araucariaGreen, A: COLORS.araucariaDark, t: COLORS.araucariaTrunk },
    ),
    full: parse(
      `
    a
   aAa
  a A a
 a  A  a
    t
    t
`,
      { a: COLORS.araucariaGreen, A: COLORS.araucariaDark, t: COLORS.araucariaTrunk },
    ),
  },
  olive: {
    seed: parse(
      `
 o
 t
`,
      { o: COLORS.oliveGreen, t: COLORS.oliveTrunk },
    ),
    sapling: parse(
      `
 oo
oOo
 t
`,
      { o: COLORS.oliveGreen, O: COLORS.oliveBright, t: COLORS.oliveTrunk },
    ),
    young: parse(
      `
  oO
 oOOo
oOoOoo
  tt
  tt
`,
      { o: COLORS.oliveGreen, O: COLORS.oliveBright, t: COLORS.oliveTrunk },
    ),
    full: parse(
      `
  oOo
 oOOOo
oOoOoOo
 oOoOo
  ttt
  ttt
`,
      { o: COLORS.oliveGreen, O: COLORS.oliveBright, t: COLORS.oliveTrunk },
    ),
  },
  banyan: {
    seed: parse(
      `
 B
 r
`,
      { B: COLORS.banyanMid, r: COLORS.banyanRoots },
    ),
    sapling: parse(
      `
 BB
BbB
 r
`,
      { B: COLORS.banyanMid, b: COLORS.banyanGreen, r: COLORS.banyanRoots },
    ),
    young: parse(
      `
  BB
 BbbB
BbBbBb
 r r
`,
      { B: COLORS.banyanMid, b: COLORS.banyanGreen, r: COLORS.banyanRoots },
    ),
    full: parse(
      `
  BBB
 BbBbB
BbBbBbB
 r r r
`,
      { B: COLORS.banyanMid, b: COLORS.banyanGreen, r: COLORS.banyanRoots },
    ),
  },
  eucalyptus: {
    seed: parse(
      `
 e
 t
`,
      { e: COLORS.eucalyptusBlue, t: COLORS.eucalyptusTrunk },
    ),
    sapling: parse(
      `
  e
 eEe
  t
  t
`,
      { e: COLORS.eucalyptusBlue, E: COLORS.eucalyptusLight, t: COLORS.eucalyptusTrunk },
    ),
    young: parse(
      `
   e
  eEe
 eEEe
eEEEe
  t
  t
  t
`,
      { e: COLORS.eucalyptusBlue, E: COLORS.eucalyptusLight, t: COLORS.eucalyptusTrunk },
    ),
    full: parse(
      `
    e
   eEe
  eEEe
 eEEEe
eEEEEe
   t
   t
   t
`,
      { e: COLORS.eucalyptusBlue, E: COLORS.eucalyptusLight, t: COLORS.eucalyptusTrunk },
    ),
  },
}

function getGrowthStage(growth: number): Stage {
  if (growth < 0.2) return "seed"
  if (growth < 0.5) return "sapling"
  if (growth < 0.8) return "young"
  return "full"
}

export function getSprite(type: string, growth: number): Sprite {
  const spriteSet = SPRITES[type]
  if (!spriteSet) {
    throw new Error(`Unknown tree type: ${type}`)
  }
  return spriteSet[getGrowthStage(growth)]
}
