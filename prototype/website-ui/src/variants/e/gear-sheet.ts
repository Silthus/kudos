// Variant E gear sheet styles: the hedgehog slot and three emoji slots around the centre stage, and the turns of the panel and the stage.
export const gearCss = `
.gear-sheet{display:grid;gap:.625rem;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-areas:"stage stage stage" "hog hog hog" "e0 e1 e2"}
.gear-sheet>[data-area]{min-width:0}
@media (min-width:640px){.gear-sheet{grid-template-columns:minmax(0,11rem) minmax(0,1fr) 6.5rem;grid-template-rows:repeat(3,minmax(0,1fr));grid-template-areas:"hog stage e0" "hog stage e1" "hog stage e2"}}
.gear-stage{background:radial-gradient(closest-side,color-mix(in oklab,var(--foreground) 7%,transparent),transparent 75%),var(--muted)}
.gear-face{transform-origin:50% 40%;backface-visibility:hidden}
@media (prefers-reduced-motion:no-preference){
.gear-out-inventory{animation:gear-out-inventory .2s cubic-bezier(.5,0,.9,.4) both}
.gear-in-inventory{animation:gear-in-inventory .25s cubic-bezier(.2,.8,.2,1.15) both}
.gear-out-character{animation:gear-out-character .2s cubic-bezier(.5,0,.9,.4) both}
.gear-in-character{animation:gear-in-character .25s cubic-bezier(.2,.8,.2,1.15) both}
.stage-out-picker,.stage-out-portrait{animation:stage-out .2s cubic-bezier(.5,0,.9,.4) both}
.stage-in-picker{animation:stage-in-picker .25s cubic-bezier(.2,.8,.2,1.1) both}
.stage-in-portrait{animation:stage-in-portrait .25s cubic-bezier(.2,.8,.2,1.1) both}
}
@keyframes gear-out-inventory{to{transform:perspective(1400px) rotateY(90deg) rotateZ(-5deg) scale(.86);opacity:.35}}
@keyframes gear-in-inventory{from{transform:perspective(1400px) rotateY(-90deg) rotateZ(5deg) scale(.86);opacity:.35}}
@keyframes gear-out-character{to{transform:perspective(1400px) rotateY(-90deg) rotateZ(5deg) scale(.86);opacity:.35}}
@keyframes gear-in-character{from{transform:perspective(1400px) rotateY(90deg) rotateZ(-5deg) scale(.86);opacity:.35}}
@keyframes stage-out{to{transform:perspective(900px) rotateY(90deg);opacity:.5}}
@keyframes stage-in-picker{from{transform:perspective(900px) rotateY(-90deg);opacity:.5}}
@keyframes stage-in-portrait{from{transform:perspective(900px) rotateY(-90deg);opacity:.5}}
`;
