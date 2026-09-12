/* ============================================================
   UTILS — small shared helpers. Nothing in here is specific to
   any one feature; every other module leans on these.
============================================================ */
'use strict';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoverCapable  = matchMedia('(hover:hover) and (pointer:fine)').matches;

const clamp = (v,a,b) => Math.min(b, Math.max(a,v));
const rand  = (a,b) => a + Math.random()*(b-a);
