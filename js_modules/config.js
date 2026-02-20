export const ASTEROIDS = 2000;
export const ASTEROIDS_INIT_INNER = 10000;
export const ASTEROIDS_INIT_OUTER = 50000;
export const ASTEROID_DESTROYED_REWARD = 100;
export const ASTEROID_MAX_SIZE = 200;
export const ASTEROID_MIN_SIZE = ASTEROID_MAX_SIZE / 4;
export const ASTEROID_SPEED_LIMIT = 10;
export const ASTEROID_SPLIT_OFFSET = 200;
export const ASTEROID_SPLIT_SPEED = ASTEROID_SPEED_LIMIT;
export const BOUNDARY_CORRECTION_FORCE = 0.05;
export const BOUNDARY_DAMPENING = 0.5;
export const BOUNDARY_TOLERANCE = 100;
export const BOUNDARY_TOLERANCE_ROIDS = 1000;
export const FPS = 60;
export const FRICTION = 0.99;
export const G_CONST = 0.9;
export const MAX_Z_DEPTH = 1.0;
export const MIN_DURATION_TAP_TO_MOVE = 200;
export const PLANETS_LIMIT = 5;
export const PLANET_MAX_SIZE = 1000;
export const PLAYER_INITIAL_LIVES = 3;
export const PLAYER_RELOAD_TIME_MAX = 8;
export const SCALE_IN_MOUSE_MODE = 1.0;
export const SCALE_IN_TOUCH_MODE = 0.5;
export const SHIPS_COMBAT_ORBIT_DISTANCE = 340;
export const SHIPS_LIMIT = 2 * 7 * PLANETS_LIMIT;
export const SHIPS_SEPARATION_DISTANCE = 30;
export const SHIPS_SPAWN_TIME = 1000;
export const SHIP_BASE_MAX_SHIELD = 100;
export const SHIP_BULLET1_LIFETIME = 60;
export const SHIP_BULLET2_LIFETIME = SHIP_BULLET1_LIFETIME / 3;
export const SHIP_BULLET_FADE_FRAMES = 5;
export const SHIP_BULLET_GRAVITY_FACTOR = 90;
export const SHIP_EVOLUTION_SCORE_STEP = 1000;
export const SHIP_FRIENDLY_BLUE_HUE = 210;
export const SHIP_KILLED_REWARD = 200;
export const SHIP_MAX_SPEED = 70;
export const SHIP_RESISTANCE = 2;
export const SHIP_SIGHT_RANGE = 2000;
export const SHIP_SIZE = 50;
export const SHIP_THRUST = 0.9;
export const STATIONS_PER_PLANET = 1;
export const STATIONS_SPAWN_TIMER = 300;
export const STATION_KILLED_REWARD = 500;
export const STATION_RESISTANCE = 6;
export const WORLD_BOUNDS = 20000;
export const ZOOM_LEVELS = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000];
export const suffixes = ["PRIME", "IV", "X", "ALPHA", "BETA", "MAJOR", "MINOR", "ZERO", "AEON"];
export const syllables = ["KRON", "XER", "ZAN", "TOR", "AER", "ION", "ULA", "PROX", "VEX", "NOV", "SOL", "LUNA", "TER", "MAR", "JUP"];

// DOM elements initialized late to ensure they exist
export const DOM = {
   canvas: null,
   canvasRadar: null,
   fadeOverlay: null,
   infoLED: null,
   livesDisplay: null,
   asteroidCountDisplay: null,
   scoreDisplay: null,
   startBtn: null,
   startScreen: null,
   canvasContext: null,
   canvasRadarContext: null,
   init() {
      this.canvas = document.getElementById('gameCanvas');
      this.canvasRadar = document.getElementById('radar-canvas');
      this.fadeOverlay = document.getElementById('fade-overlay');
      this.infoLED = document.getElementById('info-led');
      this.livesDisplay = document.getElementById('lives-display');
      this.asteroidCountDisplay = document.getElementById('asteroidCountEl');
      this.scoreDisplay = document.getElementById('scoreEl');
      this.startBtn = document.getElementById('start-btn');
      this.startScreen = document.getElementById('start-screen');
      if (this.canvas) this.canvasContext = this.canvas.getContext('2d');
      if (this.canvasRadar) this.canvasRadarContext = this.canvasRadar.getContext('2d');
   }
};
