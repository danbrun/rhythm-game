import { Game } from './Game.js';
import { View, MultiView, ImageView, SpriteView, BorderView } from './View.js';

let levels = [];

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

class TitleScreen extends MultiView {
	constructor() {
		super([
			new ImageView('./assets/images/Title_Screen.png', 0, 0),
			new BorderView(),
		]);
	}

	async press(game, x, y) {
		await game.view(new LevelSelect());
		await game.start();
	}
}

class LevelSelect extends MultiView {
	constructor() {
		super([
			new ImageView('./assets/images/level_select.png', 0, 0),
			new BorderView(),
		]);
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

class GameOverView extends ImageView {
	constructor() {
		super('./assets/images/gameover.png', 0, 0);
	}

	async render(game) {
		// Only render if the game is over.
		if (game.state.game_over) {
			game.rect('#00000088', 0, 0, game.w, game.h);
			await super.render(game);
		}
	}

	async press(game) {
		// If the game is over and a quarter of a second has passed since it ended.
		if (game.state.game_over && game.elapsed - game.state.game_over_time > 250) {
			await game.start();
		}
	}
}

class BackgroundView extends ImageView {
	constructor(top_color, bottom_color, parallax_source) {
		super(parallax_source, 0, 0);

		this._top_color = top_color;
		this._bottom_color = bottom_color;
	}

	async render(game) {
		let distance = game.elapsed * game.state.speed;

		// Create the background gradient.
		var gradient = game.gradient(0, 0, 0, game.h);
		gradient.addColorStop(0, this._top_color);
		gradient.addColorStop(1, this._bottom_color);

		// Draw the background.
		game.rect(gradient, 0, 0, game.w, game.h);

		// Draw parallax at half speed.
		for (let index = 0; index <= 1; index++) {
			this.x = -distance / 2 % 16 + index * 16;

			await super.render(game);
		}
	}
}

class ForegroundView extends MultiView {
	constructor(ground_source, spike_source, spike_tiles) {
		super([
			new ImageView(ground_source, 0, 0),
			new ImageView(spike_source, 0, 0),
		]);

		this._spike_tiles = spike_tiles;
	}

	async render(game) {
		let distance = game.elapsed * game.state.speed;
		let tile = Math.floor(distance);
		let offset = distance - tile;

		// Draw ground by rendering 8 tiles shifted by the offset.
		for (let index = 0; index <= 8; index++) {
			this._children[0].x = index - offset;
			this._children[0].y = game.h - 1;

			await this._children[0].render(game);
		}

		// Iterate over obstacles in the game.
		for (let spike_tile of this._spike_tiles) {
			// If the obstacle is on the screen.
			if (tile <= spike_tile && spike_tile <= tile + game.w) {
				this._children[1].x = spike_tile - tile - offset;
				this._children[1].y = game.h - 2;

				await this._children[1].render(game);
			}
		}
	}
}

// Renders the player character and handles jumping.
class PlayerView extends SpriteView {
	// Creates a player view using an image, number of frames, movement speed, and jump dimensions.
	constructor(source, frames, w, h) {
		super(source, frames, 0, 0, 1, 1);

		// Store the dimensions of a jump.
		this._jw = w;
		this._jh = h;
	}

	// Reset the jump state on start.
	async start(game) {
		game.state.jump_time = -1;
	}

	// Render the player to the game.
	async render(game) {
		// Get the current tile the player is at.
		let tile = Math.floor(game.elapsed * game.state.speed);

		// Set the frame in the player animation.
		this.frame = tile % 4;

		// Set the player position to its default.
		this.y = game.h - 2;

		// If a jump is in progress.
		if (game.state.jump_time >= 0) {
			// Get the distance travelled in the jump.
			let jump_distance = (game.elapsed - game.state.jump_time) * game.state.speed;
			// Get the vertical offset for the current distance into the jump.
			let jump_offset = this._jh * (1 - Math.pow(2 * jump_distance / this._jw - 1, 2));

			// If the jump distance has exceeded the width of a jump.
			if (jump_distance >= this._jw) {
				// Clear the jump start time.
				game.state.jump_time = -1;
			} else {
				// Otherwise add the jump vertical offset to the player position.
				this.y -= jump_offset;
			}
		}

		// Render the character.
		await super.render(game);
	}

	// Start a jump when pressed.
	async press(game, x, y) {
		// If the game is running and a jump is not in progress already.
		if (!game.state.game_over && game.state.jump_time < 0) {
			// Set the jump start time.
			game.state.jump_time = game.elapsed;
		}
	}
}

class BasicLevel extends MultiView {
	constructor(config) {
		// Calculate the game speed based on the beats per minute.
		let speed = config.audio.beats_per_minute / 60 / 1000;

		// Calculate the tiles where spikes should occur based on the times.
		let map = config.map.spike_times.map(time => Math.floor(time * 1000 * speed));

		super([
			new BackgroundView(
				config.images.background.start,
				config.images.background.stop,
				config.images.parallax.source
			),
			new ForegroundView(config.images.ground.source, config.images.spikes.source, map),
			new PlayerView(config.images.player.source, frames, JUMP_WIDTH, JUMP_HEIGHT),
			new GameOverView(),
			new BorderView(),
		]);

		this._config = config;
		this._map = map;
		this._speed = speed;
		this._images = {};
	}

	static async import(name) {
		// Load the configuration from the corresponding JSON file.
		let response = await fetch('assets/levels/' + name + '.json');

		// Return a new level constructed from the configuration.
		return new BasicLevel(await response.json());
	}

	async load() {
		await Promise.all([
			loadAudio(this._config.audio.source).then(audio => this._audio = audio),
			super.load(),
		]);
	}

	async render(game) {
		if (this._audio.ended) {
			// If the song has ended, return to the level select.
			await game.view(new LevelSelect());
		}

		// Get the distance travelled and in tiles and remainder.
		let distance = game.elapsed * this._speed;
		let tile = Math.floor(distance);

		// Render the child views.
		await super.render(game);

		// Check for collisions.
		if (game.state.jump_time < 0) {
			// If not mid-jump, check if the player is in an obstacle.
			for (let obstacle_tile of this._map) {
				// If the player is within the spike range, failure has occurred.
				if (obstacle_tile - 0.75 <= distance && distance <= obstacle_tile + 0.75) {
					// Stop the game.
					game.state.game_over = true;
					game.state.game_over_time = game.elapsed;

					// Pause the music.
					this._audio.pause();
				}
			}
		}
	}

	async start(game) {
		game.state.speed = this._speed;

		await super.start(game);

		// Start the music.
		this._audio.play();
	}

	stop() {
		// Stop the music.
		this._audio.pause();
		this._audio.currentTime = 0;
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
