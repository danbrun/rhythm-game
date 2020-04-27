import { Game } from './Game.js';
import { View, ImageView, SpriteView, BorderView } from './View.js';

let levels = [];

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

// Class representing a bounding box.
class Box {
	// Create a box with the coordinates and dimensions.
	constructor(x, y, w, h) {
		this._x = x;
		this._y = y;
		this._w = w;
		this._h = h;
	}

	// Return true if the bounding box contains the given point.
	contains(x, y) {
		if (this._x <= x && x <= this._x + this._w) {
			if (this._y <= y && y <= this._y + this._w) {
				return true;
			}
		}

		return false;
	}
}

const DISPLAY_WIDTH = 8;
const DISPLAY_HEIGHT = 4.5;
const PIXELS_PER_TILE = 32;

const BEATS_PER_MINUTE = 128;
const TILES_PER_BEAT = 1;
const SPEED = BEATS_PER_MINUTE * TILES_PER_BEAT / 60 / 1000;
const JUMP_HEIGHT = 1;
const JUMP_WIDTH = 1.8;

class TitleScreen extends ImageView {
	constructor() {
		super('./assets/images/Title_Screen.png', 0, 0);

		this._border = new BorderView();
	}

	async load() {
		await Promise.all([super.load(), this._border.load()]);
	}

	async render(game) {
		super.render(game);

		await this._border.render(game);
	}

	async press(game, x, y) {
		await game.view(new LevelSelect());
		await game.start();
	}
}

class LevelSelect extends ImageView {
	constructor() {
		super('./assets/images/level_select.png', 0, 0);
	}

	async press(game, x, y) {
		if (new Box(1, 1.5, 2, 1.5).contains(x, y)) {
			// Level 1 pressed.
			await game.view(levels[0]);
		} else if (new Box(3, 1.5, 2, 1.5).contains(x, y)) {
			// Level 2 pressed.
			await game.view(levels[1]);
		} else if (new Box(5, 1.5, 2, 1.5).contains(x, y)) {
			// Level 3 pressed.
			await game.view(levels[2]);
		}
	}
}

class BasicLevel extends View {
	constructor(config) {
		super();

		// Create the player sprite.
		this._player = new SpriteView(config.images.player.source, 4, 0, 0, 1, 1);

		this._config = config;
		this._images = {};

		// Calculate the game speed based on the beats per minute.
		this._speed = this._config.audio.beats_per_minute / 60 / 1000;

		// Calculate the tiles where spikes should occur based on the times.
		this._map = this._config.map.spike_times.map(time => Math.floor(time * 1000 * this._speed));
	}

	static async import(name) {
		// Load the configuration from the corresponding JSON file.
		let response = await fetch('assets/levels/' + name + '.json');

		// Return a new level constructed from the configuration.
		return new BasicLevel(await response.json());
	}

	async load() {
		let promises = [this._player.load()];

		// Load the audio file.
		promises.push(loadAudio(this._config.audio.source).then(audio => this._audio = audio))

		// Load all of the image files.
		for (let [name, data] of Object.entries(this._config.images)) {
			if (data.source) {
				promises.push(loadImage(data.source).then(image => this._images[name] = image));
			}
		}

		await Promise.all(promises)
	}

	async render(game) {
		if (this._audio.ended) {
			// If the song has ended, return to the level select.
			await game.view(new LevelSelect());
		}

		// Get the distance travelled and in tiles and remainder.
		let distance = game.elapsed * this._speed;
		let tile = Math.floor(distance);
		let offset = distance - tile;

		// Create the background gradient.
		var gradient = game.gradient(0, 0, 0, game.h);
		gradient.addColorStop(0, this._config.images.background.start);
		gradient.addColorStop(1, this._config.images.background.stop);

		// Draw the background.
		game.rect(gradient, 0, 0, game.w, game.h);

		// Draw parallax at half speed.
		for (let index = 0; index <= 1; index++) {
			game.draw(this._images['parallax'], -distance / 2 % 16 + index * 16, 0);
			// context.drawImage(this._images['parallax'], (-distance / 2 % 16 + index * 16) * PIXELS_PER_TILE, 0);
		}

		// Draw ground by rendering 8 tiles shifted by the offset.
		for (let index = 0; index <= 8; index++) {
			game.draw(this._images['ground'], index - offset, 3.5);
			// context.drawImage(this._images['ground'], (index - offset) * PIXELS_PER_TILE, 112);
		}

		// Iterate over obstacles in the game.
		for (let obstacle_tile of this._map) {
			// If the obstacle is on the screen.
			if (tile <= obstacle_tile && obstacle_tile <= tile + DISPLAY_WIDTH) {
				// Draw the obstacle.
				game.draw(this._images['spikes'], obstacle_tile - tile - offset, 2.5);
				// context.drawImage(this._images['spikes'], (obstacle_tile - tile - offset) * PIXELS_PER_TILE, 2.5 * PIXELS_PER_TILE);
			}
		}

		let jumpOffset = 0;

		// If a jump is occurring.
		if (this._jump_start) {
			// Get the distance travelled in the jump.
			let jumpDistance = distance - this._jump_start;

			if (jumpDistance < JUMP_WIDTH) {
				// If the jump is not finished, update the player offset.
				jumpOffset = JUMP_HEIGHT * (1 - Math.pow(2 * jumpDistance / JUMP_WIDTH - 1, 2));
			} else {
				// Otherwise end the jump.
				this._jump_start = undefined;
			}
		}

		// Cycle player through 4 animation frames per tile travelled.
		this._player.frame = Math.floor((distance - tile) * 4 % 4);
		this._player.y = 2.5 - jumpOffset;

		// Draw the player tile.
		this._player.render(game);

		// Check for collisions.
		if (!this._jump_start) {
			// If not mid-jump, check if the player is in an obstacle.
			for (let obstacle_tile of this._map) {
				// If the player is within the spike range, failure has occurred.
				if (obstacle_tile - 0.75 <= distance && distance <= obstacle_tile + 0.75) {
					// Stop the game.
					game.stop();

					// Darken the game.
					game.rect('#00000088', 0, 0, game.w, game.h);
					// context.fillStyle = '#00000088';
					// context.fillRect(0, 0, DISPLAY_WIDTH * PIXELS_PER_TILE, DISPLAY_HEIGHT * PIXELS_PER_TILE);

					// Draw the game over screen.
					game.draw(this._images.retry, 0, 0);
					// context.drawImage(this._images.retry, 0, 0);

					// Mark when the player lost.
					this._time_of_loss = new Date().getTime();
				}
			}
		}
	}

	start(game) {
		this._time_of_loss = null;
		this._jump_start = undefined;

		// Start the music.
		this._audio.play();
	}

	stop() {
		// Stop the music.
		this._audio.pause();
		this._audio.currentTime = 0;
	}

	press(game, x, y) {
		// If the player has lost the game.
		if (this._time_of_loss) {
			// Wait a second before letting them retry.
			if (new Date().getTime() - this._time_of_loss > 1000) {
				this._time_of_loss = null;
				game.start();
			}
		} else if (isNaN(this._jump_start)) {
			// If the player is not mid-jump, set the current poisition as the jump start point.
			this._jump_start = game.elapsed * this._speed;
		}
	}
}

async function start() {
	// Get the canvas.
	let canvas = document.getElementById('canvas');

	// Function for making the canvas fill the screen.
	function resize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	// Resize the canvas if the window size changes.
	window.addEventListener('resize', resize);
	resize();

	// Create a game using the canvas.
	let game = new Game(canvas, DISPLAY_WIDTH, DISPLAY_HEIGHT, PIXELS_PER_TILE);
	// await game.load();

	// Set the game rendering size.
	// game.size = [DISPLAY_WIDTH * PIXELS_PER_TILE, DISPLAY_HEIGHT * PIXELS_PER_TILE];

	await game.view(new TitleScreen());
	game.start();

	// Add the title screen and level select views.
	// game.add_view('title_screen', new TitleScreen());
	// game.add_view('level_select', new LevelSelect());

	// // Load in views for levels 1, 2, and 3.
	// game.add_view('level_1', await BasicLevel.import('1'));
	// game.add_view('level_2', await BasicLevel.import('2'));
	// game.add_view('level_3', await BasicLevel.import('3'));

	levels = [
		await BasicLevel.import('1'),
		await BasicLevel.import('2'),
		await BasicLevel.import('3'),
	]

	// // Start with the title screen view.
	// game.set_view('title_screen');
}

start();
