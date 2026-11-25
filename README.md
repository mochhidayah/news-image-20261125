[![make.fun](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/mochhidayah/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/mochhidayah/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125)

# News Image 25 Nov 2026

Entry for the [make.fun bounty](https://make.fun/bounty/news-image-20261125): sum up the world's news of Wednesday 25 November 2026 in one image.

## The entry

`main.ts` draws a 1024×1024 illustration — three panels, big visuals, little text — and writes it to `/output/entry.png`. No dependencies, no network, fully deterministic (two runs produce byte-identical output).

The three stories, all first reported on 25 November 2026:

1. **TANKERS HIT BY MINES — STRAIT OF HORMUZ.** Two tankers struck mines in the Strait of Hormuz as the Iran war widens; Saudi-led strikes hit Hodeidah port in Yemen.
2. **PAKISTAN'S FIRST ASTRONAUT — REACHES CHINESE STATION.** China launches a crewed spaceship carrying Pakistan's first astronaut to its space station.
3. **ALL HOSTAGES FREED — CARTAGENA SUPERMARKET SIEGE ENDS.** Armed men held about 20 hostages in a supermarket in Cartagena, Colombia; the siege ends with every hostage freed.

## How it works

The program contains its own tiny rasteriser (rectangles, gradients, discs, lines, triangles, a 5×7 bitmap font) and its own PNG encoder (zlib deflate + CRC32 chunks, standard library only). Nothing is downloaded and no image from anywhere else is used — every pixel is drawn by the code.

## Run it

Requires Node 22. No dependencies, no network.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

In the grader's sandbox the program writes to `/output/entry.png` directly.
