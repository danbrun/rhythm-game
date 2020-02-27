
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

// Zip 2 arrays into an object.
function zip(keys, values) {
	let object = {};

	for (let index in keys) {
		object[keys[index]] = values[index];
	}

	return object;
}

// Global variables for the game.
let context;
let images;

// Store the time of the last jump.
let jumpTime;

// Make the player jump.
function jump() {
	// Only update if not already set.
	if (!jumpTime) {
		jumpTime = new Date().getTime();
	}
}

function render() {
	let currentTime = new Date().getTime();

	// Draw background.
	context.drawImage(images['Background'], 0, 0);

	// Shift 1 pixel 80 times per second. Reset to 0 after 31 pixels.
	let shift = Math.floor(currentTime * 80 / 1000) % 32;

	// Draw ground.
	for (let index = 0; index <= 256; index += 32) {
		context.drawImage(images['Base_Tile_Square'], index - shift, 112);
	}

	// Switch player animation frames 8 times per second. Wrap to frame 0 after frame 3.
	let frame = Math.floor(currentTime * 8 / 1000) % 4;

	// Assume player is on the ground.
	let playerShift = 0;

	// If a jump is occurring.
	if (jumpTime) {
		// Get progress in 1 second jump.
		let jumpPercent = (currentTime - jumpTime) / 500;

		// If the jump has completed, reset the start time.
		if (jumpPercent >= 1) {
			jumpTime = null;
		} else {
			// Set the player shift based on an exponential function.
			playerShift = ((4 * jumpPercent) - (4 * Math.pow(jumpPercent, 2))) * 32;
		}
	}

	// Draw the player tile.
	context.drawImage(images['Player_Idle_Square-Sheet'], frame * 32, 0, 32, 32, 0, 80 - playerShift, 32, 32);

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

	// Start animating.
	requestAnimationFrame(render);
}

startGame();
