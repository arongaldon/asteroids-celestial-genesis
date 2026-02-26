// Mock DOM and browser environment
global.navigator = { language: 'es-ES' };
global.document = {
    querySelectorAll: () => []
};

// Use dynamic import for ES module
import('./js_modules/i18n.js').then(i18n => {
    i18n.initI18n();
    console.log("English translation for ASTEROIDS:", import('./js_modules/i18n.js').then(m => {
        // Can't easily switch navigator back and forth in same run if initI18n just sets currentLanguage
        console.log("Spanish Title:", m.t('ui.title'));
        console.log("Spanish Start:", m.t('ui.start'));
        console.log("Godship shape:", m.t('shape.godship'));
        console.log("Metamorphosis interpolated:", m.t('game.metamorphosis', {seconds: 5}));
    }));
});
