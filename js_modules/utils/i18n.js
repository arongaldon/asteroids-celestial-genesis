export const translations = {
    en: {
        "ui.title": "ASTEROIDS: CELESTIAL GENESIS",
        "ui.start": "START",
        "ui.restart": "RESTART JOURNEY",
        "ui.intro_msg": "The Classic, reimagined by Aron Galdon. Have a safe trip!",

        "game.gameover_player": "The universe trembles at your power, but who are you now without a home? You reached for divinity and crushed the cradle that once held you.",
        "game.gameover_enemy": "An organized malice fell upon your cradle. Your homeworld was overwhelmed by a synchronized enemy advance, and the sky burned before the void claimed all.",
        "game.gameover_collision": "A cosmic dance turned into tragedy. Two worlds collided in the cold silence of space, and your history was erased in an instant flash of light.",
        "game.gameover_normal": "Your journey ends here. The stars remain indifferent to your passing, yet your echo lingers in the void.",
        "game.home_lost_player": "Home destroyed by you!",
        "game.home_lost_enemy": "Home crushed by enemy invasion!",
        "game.home_lost_collision": "Home destroyed by a collision!",

        "game.victory_msg": "Congratulations: your planet will love you forever.",
        "game.mission_accomplished": "mission accomplished!",
        "game.system_purified": "THE SYSTEM IS PURIFIED. ENEMIES JOIN THE CAUSE.",

        "game.metamorphosis": "Metamorphosis: {seconds} seconds remaining...",
        "game.godship_activated": "THE GODSHIP ACTIVATED",
        "game.divine_meta_begins": "THE DIVINE METAMORPHOSIS BEGINS...",
        "game.dangerous_shots": "ANY SHOT FROM NOW ON COULD BE DANGEROUS.",
        "game.evolved_to": "EVOLVED TO {shape}",
        "game.devolved_to": "DEVOLVED TO {shape}",

        "game.betrayal": "⚠ BETRAYAL: YOU ARE NOW A LONE WOLF!",
        "game.extra_life": "EXTRA LIFE!",
        "game.lethal_radius_warning": "WARNING: LETHAL RADIUS OVERLAPS FRIENDS/HOME",

        "game.planet_vaporized": "PLANET {name} VAPORIZED",
        "game.home_planet_name": "HOME",
        "game.warn_shoot_home": "That's your home planet!",
        "game.warn_cease_fire": "⚠ WARNING: CEASE FIRE ON ALLIES!",
        "game.warn_home_attack": "⚠ WARNING: HOME PLANET UNDER ATTACK!",

        "shape.godship": "THE GODSHIP",
        "shape.hyperion": "THE HYPERION",
        "shape.titan": "THE TITAN",
        "shape.celestial": "THE CELESTIAL",
        "shape.sphere": "THE SPHERE",
        "shape.triangle": "TRIANGLE",
        "shape.square": "SQUARE",
        "shape.pentagon": "PENTAGON",
        "shape.hexagon": "HEXAGON",
        "shape.heptagon": "HEPTAGON",
        "shape.octagon": "OCTAGON",
        "shape.nonagon": "NONAGON",
        "shape.decagon": "DECAGON"
    },
    es: {
        "ui.title": "ASTEROIDES: GÉNESIS CELESTIAL",
        "ui.start": "INICIAR",
        "ui.restart": "REINICIAR VIAJE",
        "ui.intro_msg": "El clásico, reimaginado por Arón Galdón. ¡Buen viaje!",

        "game.gameover_player": "El universo tiembla ante tu poder, pero ¿quién eres ahora sin un hogar? Alcanzaste la divinidad y aplastaste la cuna que te albergó.",
        "game.gameover_enemy": "Una malicia organizada cayó sobre tu cuna. Tu mundo fue abrumado por un avance enemigo sincronizado, y el cielo ardió antes de que el vacío lo reclamara todo.",
        "game.gameover_collision": "Una danza cósmica convertida en tragedia. Dos mundos colisionaron en el frío silencio del espacio, y tu historia fue borrada en un instante de luz.",
        "game.gameover_normal": "Tu viaje termina aquí. Las estrellas permanecen indiferentes a tu paso, pero tu eco perdurará en el vacío.",
        "game.home_lost_player": "¡Hogar destruido por ti!",
        "game.home_lost_enemy": "¡Hogar aplastado por invasión enemiga!",
        "game.home_lost_collision": "¡Hogar destruido por una colisión!",

        "game.victory_msg": "Felicidades: tu planeta te amará por siempre.",
        "game.mission_accomplished": "¡Misión cumplida!",
        "game.system_purified": "EL SISTEMA ESTÁ PURIFICADO. LOS ENEMIGOS SE UNEN A LA CAUSA.",

        "game.metamorphosis": "Metamorfosis: {seconds} segundos restantes...",
        "game.godship_activated": "LA NAVE DIVINA ACTIVADA",
        "game.divine_meta_begins": "LA METAMORFOSIS DIVINA COMIENZA...",
        "game.dangerous_shots": "CUALQUIER DISPARO A PARTIR DE AHORA PODRÍA SER PELIGROSO.",
        "game.evolved_to": "EVOLUCIONÓ A {shape}",
        "game.devolved_to": "DEVOLUCIONÓ A {shape}",

        "game.betrayal": "⚠ TRAICIÓN: ¡AHORA ERES UN LOBO SOLITARIO!",
        "game.extra_life": "¡VIDA EXTRA!",
        "game.lethal_radius_warning": "ADVERTENCIA: RADIO LETAL SE SUPERPONE A AMIGOS/HOGAR",

        "game.planet_vaporized": "PLANETA {name} VAPORIZADO",
        "game.home_planet_name": "HOGAR",
        "game.warn_shoot_home": "¡Ese es tu planeta hogar!",
        "game.warn_cease_fire": "⚠ ADVERTENCIA: ¡ALTO EL FUEGO A LOS ALIADOS!",
        "game.warn_home_attack": "⚠ ADVERTENCIA: ¡PLANETA HOGAR BAJO ATAQUE!",

        "shape.godship": "LA NAVE DIVINA",
        "shape.hyperion": "EL HIPERION",
        "shape.titan": "EL TITAN",
        "shape.celestial": "EL CELESTIAL",
        "shape.sphere": "LA ESFERA",
        "shape.triangle": "TRIANGULO",
        "shape.square": "CUADRADO",
        "shape.pentagon": "PENTAGONO",
        "shape.hexagon": "HEXAGONO",
        "shape.heptagon": "HEPTAGONO",
        "shape.octagon": "OCTAGONO",
        "shape.nonagon": "NONAGONO",
        "shape.decagon": "DECAGONO"
    }
};

let currentLanguage = 'en';

export function initI18n() {
    // Detect language from browser
    if (navigator.language && navigator.language.toLowerCase().startsWith('es')) {
        currentLanguage = 'es';
    } else {
        currentLanguage = 'en';
    }

    // Translate DOM elements marked with data-i18n
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLanguage][key]) {
            // Note: Since some might have inner HTML, we check if they're text containers
            el.innerText = translations[currentLanguage][key];
        }
    });
}

export function t(key, params = {}) {
    let text = translations[currentLanguage][key] || key;

    // Replace parameters like {name}, {seconds}
    for (const [pKey, pVal] of Object.entries(params)) {
        text = text.replace(new RegExp('\\{' + pKey + '\\}', 'g'), pVal);
    }

    return text;
}
