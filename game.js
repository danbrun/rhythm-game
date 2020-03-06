
// Load an image asynchrnously.
async function loadImage(url) {
	return new Promise((resolve, reject) => {
		let image = new Image();

		image.addEventListener('load', function () {
			resolve(image);
		});

		image.addEventListener('error', function (event) {
			reject(event);
		});

		image.src = url;
	});
}

// Load audio asynchronously.
async function loadAudio(url) {
	return new Promise((resolve, reject) => {
		let audio = new Audio();

		audio.addEventListener('canplaythrough', function () {
			resolve(audio);
		});

		audio.addEventListener('error', function (event) {
			reject(event);
		});

		audio.src = url;
	});
}

// Zip 2 arrays into an object.
function zip(keys, values) {
	let object = {};

	for (let index in keys) {
		object[keys[index]] = values[index];
	}

	return object;
}

// Speed is 2 tiles per second.
const SPEED = 2 / 1000;
const JUMP_HEIGHT = 1;
const JUMP_WIDTH = 2;

const DISPLAY_WIDTH = 8;

// Global variables for the game.
let context;
let images;
let audio;
let start;

let obstacle_times = [
	1100,
	3070,
	5030,
	7000,
	8220,
	10190,
	12160,
	14130,
];

// Convert obstacle timing to tile positions.
let obstacle_tiles = [];
for (let i = 0; i < obstacle_times.length; i++) {
	obstacle_tiles[i] = Math.floor(obstacle_times[i] * SPEED) + 2;
}

// Store the time of the last jump.
let jumpStart;

// Make the player jump.
function jump() {
	// Only update if not already set.
	if (!jumpStart) {
		jumpStart = getDistance();
	}
}

// Get distance travelled.
function getDistance() {
	return (new Date().getTime() - start) * SPEED;
}

// Convert tile distance to pixels.
function tilesToPixels(tiles) {
	return Math.floor(tiles * 32);
}

function render() {
	let distance = getDistance();

	// Get the first tile and the offset to shift tiles.
	let tile = Math.floor(distance);
	let offset = distance - tile;

	// Draw background.
	context.drawImage(images['Background'], 0, 0);

	// Draw parallax at half speed.
	for (let index = 0; index <= 1; index++) {
		context.drawImage(images['Parallax1'], tilesToPixels(-distance / 2 % 16 + index * 16), 0);
	}

	// Draw ground by rendering 8 tiles shifted by the offset.
	for (let index = 0; index <= 8; index++) {
		context.drawImage(images['Base_Tile_Square'], tilesToPixels(index - offset), 112);
	}

	// Iterate over obstacles in the game.
	for (let obstacle_tile of obstacle_tiles) {
		// If the obstacle is on the screen.
		if (tile <= obstacle_tile && obstacle_tile <= tile + DISPLAY_WIDTH) {
			// Draw the obstacle.
			context.drawImage(images['Spike_Tile_Square'], tilesToPixels(obstacle_tile - tile - offset), tilesToPixels(2.5));
		}
	}

	// Cycle player through 4 animation frames per tile travelled.
	let frame = Math.floor((distance - tile) * 4 % 4);

	let jumpOffset = 0;

	// If a jump is occurring.
	if (jumpStart) {
		// Get the distance travelled in the jump.
		let jumpDistance = distance - jumpStart;

		if (jumpDistance < JUMP_WIDTH) {
			// If the jump is not finished, update the player offset.
			jumpOffset = JUMP_HEIGHT * (1 - Math.pow(2 * jumpDistance / JUMP_WIDTH - 1, 2));
		} else {
			// Otherwise end the jump.
			jumpStart = null;
		}
	}

	// Draw the player tile.
	context.drawImage(images['Player_Idle_Square-Sheet'], frame * 32, 0, 32, 32, 0, tilesToPixels(2.5 - jumpOffset), 32, 32);

	// Request another frame.
	requestAnimationFrame(render);
}

async function startGame() {
	// Get the drawing canvas and context.
	let canvas = document.getElementById('canvas');
	context = canvas.getContext('2d');

	// The names of all images in the game.
	let image_names = [
		'Background',
		'Base_Tile_Square',
		'Parallax1',
		'Player_Idle_Square-Sheet',
		'Spike_Tile_Square',
		'Title_Screen'
	];

	// Promises for image loading.
	let image_promises = [];

	// Populate the promises array with each image.
	for (let image_name of image_names) {
		image_promises.push(loadImage(`assets/images/${image_name}.png`))
	}

	// Get the image elements from the promises.
	let image_elements = await Promise.all(image_promises);

	// Zip images into an object.
	images = zip(image_names, image_elements);

	// Listening for clicks on the canvas to jump.
	canvas.addEventListener('click', jump);

	audio = await loadAudio('assets/music/MV Final Project Tutorial Section.wav');
	audio.play();

	// Set the start time.
	start = new Date().getTime();

	// Start animating.
	requestAnimationFrame(render);
}

startGame();
