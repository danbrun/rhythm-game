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

	async press(game, data) {
		if (new Box(1, 1.5, 2, 1.5).contains(data.x, data.y)) {
			// Level 1 pressed.
			await game.view(levels[0]);
		} else if (new Box(3, 1.5, 2, 1.5).contains(data.x, data.y)) {
			// Level 2 pressed.
			await game.view(levels[1]);
		} else if (new Box(5, 1.5, 2, 1.5).contains(data.x, data.y)) {
			// Level 3 pressed.
			await game.view(levels[2]);
		}
	}
}

class GameOverView extends ImageView {
	constructor(fadeout, darkness) {
		super('./assets/images/gameover.png', 0, 0);

		this._fadeout = fadeout;
		this._darkness = darkness;
	}

	async start(game, data) {
		this._game_over = false;
		this._game_over_time = -1;
	}

	async render(game, data) {

		// Only render if the game is over.
		if (this._game_over) {
			let elapsed = data.time - this._game_over_time;
			let alpha = Math.min(elapsed * this._darkness / this._fadeout, this._darkness);

			game.rect(`rgba(0, 0, 0, ${alpha})`, 0, 0, game.w, game.h);
			await super.render(game);
		}
	}

	async press(game, data) {
		// If the game is over and a quarter of a second has passed since it ended.
		if (this._game_over && data.time - this._game_over_time > 250) {
			await game.start();
		}
	}

	async lose(game, data) {
		this._game_over = true;
		this._game_over_time = data.time;
	}
}

class BackgroundView extends ImageView {
	constructor(top_color, bottom_color, parallax_source) {
		super(parallax_source, 0, 0);

		this._top_color = top_color;
		this._bottom_color = bottom_color;
	}

	async render(game, data) {
		// Create the background gradient.
		var gradient = game.gradient(0, 0, 0, data.height);
		gradient.addColorStop(0, this._top_color);
		gradient.addColorStop(1, this._bottom_color);

		// Draw the background.
		game.rect(gradient, 0, 0, data.width, data.height);

		// Draw parallax at half speed.
		for (let index = 0; index <= 1; index++) {
			this.x = -(data.distance / 2) % 16 + (index * 16);

			await super.render(game, data);
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

	async start(game, data) {
		this._jump_time = -1;
	}

	async render(game, data) {
		// Draw ground by rendering 8 tiles shifted by the offset.
		for (let index = 0; index <= 8; index++) {
			this._views[0].x = index - data.offset;
			this._views[0].y = data.height - 1;

			await this._views[0].trigger('render', game, data);
		}

		// Iterate over obstacles in the game.
		for (let spike_tile of this._spike_tiles) {
			// If the obstacle is on the screen.
			if (data.tile <= spike_tile && spike_tile <= data.tile + game.w) {
				this._views[1].x = spike_tile - data.tile - data.offset;
				this._views[1].y = data.height - 2;

				await this._views[1].trigger('render', game, data);
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
	async start(game, data) {
		this._jump_time = -1;
		this._game_over = false;
	}

	// Render the player to the game.
	async render(game, data) {
		// Get the current tile the player is at.
		let tile = Math.floor(data.time * data.speed);

		// Set the frame in the player animation.
		this.frame = data.tile % 4;

		// Set the player position to its default.
		this.y = data.height - 2;

		// If a jump is in progress.
		if (this._jump_time >= 0) {
			// Get the distance travelled in the jump.
			let jump_distance = (data.time - this._jump_time) * data.speed;
			// Get the vertical offset for the current distance into the jump.
			let jump_offset = this._jh * (1 - Math.pow(2 * jump_distance / this._jw - 1, 2));

			// If the jump distance has exceeded the width of a jump.
			if (jump_distance >= this._jw && !this._game_over) {
				// Clear the jump start time.
				this._jump_time = -1;

				// Trigger landing event.
				game.trigger('land', { time: data.time });
			} else {
				// Otherwise add the jump vertical offset to the player position.
				this.y -= jump_offset;
			}
		}

		// Render the character.
		await super.render(game);
	}

	// Start a jump when pressed.
	async press(game, data) {
		// If the game is running and a jump is not in progress already.
		if (!this._game_over && this._jump_time < 0) {
			// Set the jump start time.
			this._jump_time = data.time;

			// Trigger jumping event.
			game.trigger('jump', { time: data.time });
		}
	}

	async lose(game, data) {
		this._jump_time = data.time;
		this._game_over = true;
	}
}

class BasicLevel extends MultiView {
	constructor(config) {
		super();

		// Calculate the game speed based on the beats per minute.
		this._speed = config.audio.beats_per_minute / 60 / 1000;

		// Calculate the tiles where spikes should occur based on the times.
		this._spike_tiles = config.map.spike_times.map(time => Math.floor(time * 1000 * this._speed));

		this._views = [
			new BackgroundView(
				config.images.background.start,
				config.images.background.stop,
				config.images.parallax.source
			),
			new ForegroundView(
				config.images.ground.source,
				config.images.spikes.source,
				this._spike_tiles,
			),
			new PlayerView(config.images.player.source, frames, JUMP_WIDTH, JUMP_HEIGHT),
			new GameOverView(250, 0.5),
			new BorderView(),
		];

		this._config = config;
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

	async start(game, data) {
		// Start the music.
		this._audio.volume = 1;
		this._audio.currentTime = 0;
		this._audio.play();

		this._jump_time = -1;
		this._game_over = false;

		await this.forward('start', game, { speed: this._speed });
	}

	async stop(game, data) {
		// Stop the music.
		this._audio.pause();
		this._audio.currentTime = 0;
	}

	async render(game, data) {
		if (this._game_over) {
			// If the game is over, adjust the volume to fade out.
			let elapsed = this._game_over_time - data.time;
			this._audio.volume = Math.max(elapsed / 250 + 1, 0);
		} else if (this._audio.ended) {
			// Otherwise, trigger a win if the audio has ended.
			await game.trigger('win', { time: data.time });
		}

		// Get the distance travelled and in tiles and remainder.
		let distance = data.time * this._speed;
		let tile = Math.floor(distance);
		let offset = distance - tile;

		// Check for collisions.
		if (this._jump_time < 0 && !this._game_over) {
			// If not mid-jump, check if the player is in an obstacle.
			for (let spike_tile of this._spike_tiles) {
				// If the player is within the spike range, failure has occurred.
				if (spike_tile - 0.7 <= distance && distance <= spike_tile + 0.7) {
					// Trigger a lose event.
					await game.trigger('lose', { time: data.time });
				}
			}
		}

		// Render the child views.
		await this.forward('render', game, Object.assign({}, data, {
			distance: distance,
			tile: tile,
			offset: offset,
			speed: this._speed,
		}));
	}

	async jump(game, data) {
		this._jump_time = data.time;

		this.forward('jump', game, data);
	}

	async land(game, data) {
		this._jump_time = -1;

		this.forward('land', game, data);
	}

	async lose(game, data) {
		this._game_over = true;
		this._game_over_time = data.time;

		this.forward('lose', game, data);
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
