/* ============================================================
   main.js — the only file that knows about every other module.
   Its one job is bootstrap order: create the particle field before
   anything asks it to burst, wire navigation before the intro tries
   to close it, and only start scroll-driven reveals once the intro
   hands off control (via 'intro:complete' on the bus).
============================================================ */

import './styles/variables.css';
import './styles/base.css';
import './styles/ambient.css';
import './styles/intro.css';
import './styles/navigation.css';
import './styles/hero.css';
import './styles/sections.css';
import './styles/lightbox.css';
import './styles/responsive.css';

import { bus } from './core/EventBus.js';
import { ParticleEngine } from './engines/ParticleEngine.js';
import { initAtmosphere } from './engines/AtmosphereEngine.js';
import { initCursorEngine } from './engines/CursorEngine.js';
import { initNavigationEngine } from './engines/NavigationEngine.js';
import { initScrollEngine } from './engines/ScrollEngine.js';
import { runIntro } from './engines/SceneEngine.js';
import { initHero } from './components/Hero.js';
import { initCountdown } from './components/Countdown.js';
import { initMusicPlayerUI } from './components/MusicPlayerUI.js';
import { initPageChrome } from './components/PageChrome.js';
import { initGalleryLightbox } from './components/GalleryLightbox.js';

// 1. things that must exist before the intro can burst petals or
//    close the nav index
ParticleEngine.init();
ParticleEngine.start();
initNavigationEngine();
initHero();

// 2. features independent of scroll/intro state
initAtmosphere();
initCursorEngine();
initCountdown();
initMusicPlayerUI();
initPageChrome();
initGalleryLightbox();

// 3. scroll-driven reveals only start once the intro releases
//    control of the scroll (see engines/SceneEngine.js → complete())
bus.on('intro:complete', () => initScrollEngine());

// 4. the intro itself, last — matches the original load order
//    (config → utils → petals → atmosphere → app → nav → hero →
//    scroll-reveal → music → countdown → intro)
runIntro();
