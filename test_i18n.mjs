// Mock DOM and browser environment
global.navigator = { language: 'es-ES' };
global.document = {
    querySelectorAll: () => []
};

import { initI18n, t } from './js_modules/i18n.js';

initI18n();
console.log("Spanish Title:", t('ui.title'));
console.log("Spanish Start:", t('ui.start'));
console.log("Godship shape:", t('shape.godship'));
console.log("Metamorphosis interpolated:", t('game.metamorphosis', { seconds: 5 }));
