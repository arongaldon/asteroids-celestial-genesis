import { PLAYER_CONFIG, ZOOM_LEVELS } from './config.js';
import { State } from './state.js';
import { fireEntityWeapon } from '../systems/combat.js';

export function changeRadarZoom(direction) {
    let newIndex = State.currentZoomIndex + direction;

    if (newIndex < 0) newIndex = 0;
    if (newIndex >= ZOOM_LEVELS.length) newIndex = ZOOM_LEVELS.length - 1;

    if (newIndex !== State.currentZoomIndex) {
        State.currentZoomIndex = newIndex;
        State.RADAR_RANGE = ZOOM_LEVELS[State.currentZoomIndex];
    }
}

export function shootLaser() {
    if (!State.gameRunning || State.playerShip.dead || State.victoryState) return;
    if (State.playerReloadTime > 0) return;
    State.playerReloadTime = PLAYER_CONFIG.RELOAD_TIME_MAX;
    fireEntityWeapon(State.playerShip, State.playerShipBullets, false);
}
