/* ==========
   PARAMETERS
   ==========*/
const ASTEROIDS = 1000;
const ASTEROIDS_INIT_INNER = 20000;
const ASTEROIDS_INIT_OUTER = 40000;
const ASTEROID_DESTROYED_REWARD = 100;
const ASTEROID_MAX_SIZE = 200;
const ASTEROID_MIN_SIZE = ASTEROID_MAX_SIZE / 4;
const ASTEROID_SPEED_LIMIT = 10;
const ASTEROID_SPLIT_OFFSET = 200;
const ASTEROID_SPLIT_SPEED = ASTEROID_SPEED_LIMIT;
const BOUNDARY_CORRECTION_FORCE = 0.05;
const BOUNDARY_DAMPENING = 0.5;
const BOUNDARY_TOLERANCE = 100;
const BOUNDARY_TOLERANCE_ROIDS = 1000;
const FPS = 60;
const FRICTION = 0.99;
const G_CONST = 0.9; // Gravity Constant
const MAX_Z_DEPTH = 2.0;
const MIN_DURATION_TAP_TO_MOVE = 200;
const PLANETS_LIMIT = 12;
const PLANET_MAX_SIZE = ASTEROID_MAX_SIZE * 4;
const PLANET_THRESHOLD = ASTEROID_MAX_SIZE * 2;
const PLAYER_INITIAL_LIVES = 3;
const PLAYER_RELOAD_TIME_MAX = 8;
const SCALE_IN_MOUSE_MODE = 1.0;
const SCALE_IN_TOUCH_MODE = 0.5;
const SHIPS_COMBAT_ORBIT_DISTANCE = 340;
const SHIPS_LIMIT = 2 * 7 * PLANETS_LIMIT;
const SHIPS_SEPARATION_DISTANCE = 30;
const SHIPS_SPAWN_TIME = 1000;
const SHIP_BASE_MAX_SHIELD = 100;
const SHIP_BULLET1_LIFETIME = 60;
const SHIP_BULLET2_LIFETIME = SHIP_BULLET1_LIFETIME / 3;
const SHIP_BULLET_FADE_FRAMES = 5;
const SHIP_BULLET_GRAVITY_FACTOR = 90;
const SHIP_EVOLUTION_SCORE_STEP = 10 * ASTEROID_DESTROYED_REWARD; // Tier ship power improvement
const SHIP_FRIENDLY_BLUE_HUE = 210;
const SHIP_KILLED_REWARD = 200;
const SHIP_MAX_SPEED = 70;
const SHIP_RESISTANCE = 2;
const SHIP_SIGHT_RANGE = 2000;
const SHIP_SIZE = 50;
const SHIP_THRUST = 0.9;
const STATIONS_PER_PLANET = 1;
const STATIONS_SPAWN_TIMER = 300;
const STATION_KILLED_REWARD = 500;
const STATION_RESISTANCE = 6;
const WORLD_BOUNDS = 20000;
const ZOOM_LEVELS = [1000, 2000, 3000, 5000, 8000, 13000, 21000];
const suffixes = ["PRIME", "IV", "X", "ALPHA", "BETA", "MAJOR", "MINOR", "ZERO", "AEON"];
const syllables = ["KRON", "XER", "ZAN", "TOR", "AER", "ION", "ULA", "PROX", "VEX", "NOV", "SOL", "LUNA", "TER", "MAR", "JUP"];

/* ============
   DOM ELEMENTS
   ============*/
const canvas = document.getElementById('gameCanvas');
const canvasRadar = document.getElementById('radar-canvas');
const fadeOverlay = document.getElementById('fade-overlay');
const infoLED = document.getElementById('info-led');
const livesDisplay = document.getElementById('lives-display');
const asteroidCountDisplay = document.getElementById('asteroidCountEl');
const scoreDisplay = document.getElementById('scoreEl');
const startBtn = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');

const canvasContext = canvas.getContext('2d');
const canvasRadarContext = canvasRadar.getContext('2d');
