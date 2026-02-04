/* ==========
   PARAMETERS
   ==========*/
const ASTEROIDS_PER_BELT = 2000;
const ASTEROID_BELT_INNER_RADIUS = 2000;
const ASTEROID_BELT_OUTER_RADIUS = 25000;
const ASTEROID_DESTROYED_REWARD = 100;
const ASTEROID_MAX_SIZE = 300;
const ASTEROID_MIN_SIZE = 70;
const ASTEROID_SPEED_LIMIT = 5;
const ASTEROID_SPLIT_OFFSET = 100;
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
const PLANETS_LIMIT = 10;
const PLANET_MAX_SIZE = 1000;
const PLANET_THRESHOLD = ASTEROID_MAX_SIZE;
const PLAYER_INITIAL_LIVES = 3;
const PLAYER_RELOAD_TIME_MAX = 8;
const SCALE_IN_MOUSE_MODE = 1.0;
const SCALE_IN_TOUCH_MODE = 0.5;
const SHIPS_COMBAT_ORBIT_DISTANCE = 340;
const SHIPS_LIMIT = PLANETS_LIMIT * 7;
const SHIPS_SEPARATION_DISTANCE = 50;
const SHIPS_SPAWN_TIME = 1000;
const SHIP_BASE_MAX_SHIELD = 100;
const SHIP_BULLET1_LIFETIME = 50;
const SHIP_BULLET1_SIZE = 5;
const SHIP_BULLET2_LIFETIME = 25;
const SHIP_BULLET2_SIZE = 3;
const SHIP_BULLET_FADE_FRAMES = 5;
const SHIP_BULLET_GRAVITY_FACTOR = 90;
const SHIP_EVOLUTION_SCORE_STEP = 1000;
const SHIP_FRIENDLY_BLUE_HUE = 210;
const SHIP_KILLED_REWARD = 200;
const SHIP_MAX_SPEED = 50;
const SHIP_RESISTANCE = 2;
const SHIP_SIGHT_RANGE = 1200; // Approx screen width: 1200
const SHIP_SIZE = 30;
const SHIP_THRUST = 0.9;
const STATIONS_PER_PLANET = 1;
const STATIONS_SPAWN_TIMER = 300;
const STATION_KILLED_REWARD = 500;
const STATION_RESISTANCE = 6;
const TOUCH_ROTATION_SENSITIVITY = 0.008;
const WORLD_BOUNDS = 25000;
const WORLD_SCALE = 5;
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
