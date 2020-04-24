
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

const DISPLAY_WIDTH = 8;
const DISPLAY_HEIGHT = 4.5;
const PIXELS_PER_TILE = 32;

const BEATS_PER_MINUTE = 128;
const TILES_PER_BEAT = 1;
const SPEED = BEATS_PER_MINUTE * TILES_PER_BEAT / 60 / 1000;
const JUMP_HEIGHT = 1;
const JUMP_WIDTH = 1.75;

// View interface defines a renderable view for the game.
class View {
	async load() { }

	render(game, context) { }

	async press(game, x, y) { }

	start(game) { }

	stop() { }
}

class Game {
	constructor(canvas) {
		this._canvas = canvas;
		this._context = canvas.getContext('2d');

		// Bind the press function to the canvas click.
		this._canvas.addEventListener('mousedown', () => this.press());

		this._width = 0;
		this._height = 0;

		this._view_index = 0;
		this._view_names = [];
		this._view_values = [];

		this._running = false;
		this._start_time = null;
	}

	async load() {
		// Load the border images.
		this._borders = {
			top: await loadImage('assets/images/top_tiled.png'),
			left: await loadImage('assets/images/left_tiled.png'),
			right: await loadImage('assets/images/right_tiled.png'),
			bottom: await loadImage('assets/images/bottom_tiled.png'),
		};
	}

	get size() {
		return [this._width, this._height];
	}

	set size(dimensions) {
		this._width = dimensions[0];
		this._height = dimensions[1];
	}

	get view() {
		return this._view_values[this._view_index];
	}

	add_view(name, value) {
		// Store the view attributes.
		this._view_names.push(name);
		this._view_values.push(value);
	}

	async set_view(name) {
		// Stop rendering and wait for the rendering to finish.
		this.stop();

		// Get the index of the view.
		let index = this._view_names.indexOf(name);

		// Load the new view and its assets.
		await this._view_values[index].load();

		// Switch to the new view.
		this._view_index = index;

		// Start the new view.
		this.start();
	}

	async next_view() {
		// Get the index of the next view in the rotation.
		let index = (this._view_index + 1) % this._view_names.length;

		// Switch to the new view.
		await this.set_view(this._view_names[index]);
	}

	start() {
		this._running = true;
		this._start_time = new Date().getTime();
		this._view_values[this._view_index].start(this);
		this.render(this._view);
	}

	stop() {
		this._running = false;
		this._start_time = null;
		this._view_values[this._view_index].stop();
	}

	get elapsed() {
		return new Date().getTime() - this._start_time;
	}

	get_transform() {
		// Get the aspect ratios for the game and canvas.
		let game_aspect_ratio = this._width / this._height;
		let canvas_aspect_ratio = this._canvas.width / this._canvas.height;

		if (canvas_aspect_ratio < game_aspect_ratio) {
			// If the canvas is taller than the game.

			// Make the game fill the canvas width.
			let scale = this._canvas.width / this._width;
			// Shift the game down to the middle of the canvas.
			let translate = (this._canvas.height - this._height * scale) / 2;

			// Return the canvas transformation matrix.
			return [scale, 0, 0, scale, 0, translate];
		} else {
			// If the canvas is wider than the game.

			// Make the game fill the canvas height.
			let scale = this._canvas.height / this._height;
			// Shift the game left ot the middle of the canvas.
			let translate = (this._canvas.width - this._width * scale) / 2;

			// Return the canvas transformation matrix.
			return [scale, 0, 0, scale, translate, 0];
		}
	}

	render() {
		// Save the state of the canvas context.
		this._context.save();

		// Disable image smoothing to retain pixel clarity.
		this._context.imageSmoothingEnabled = false;

		// Get the transform and transform the context so the game context is full size.
		let transform = this.get_transform();
		this._context.transform(...transform);

		// Perform level rendering.
		this.view.render(this, this._context);

		// Render the left and right borders.
		for (var x = 0; x < transform[4] / transform[0]; x += 32) {
			this._context.drawImage(this._borders.left, -PIXELS_PER_TILE - x, 0);
			this._context.drawImage(this._borders.right, this._width + x, 0);
		}

		// Render the top and bottom borders.
		for (var y = 0; y < transform[5] / transform[0]; y += 32) {
			this._context.drawImage(this._borders.top, 0, -PIXELS_PER_TILE - y);
			this._context.drawImage(this._borders.bottom, 0, this._height + y);
		}

		// Restore the state of the canvas context.
		this._context.restore();

		// If the game is still running, render another frame.
		if (this._running) {
			requestAnimationFrame(() => this.render());
		}
	}

	press(x, y) {
		// If a press event is not already in progress.
		if (!this._pressing) {
			this._pressing = true;

			// Call the view press function.
			this.view.press(this, x, y);

			this._pressing = false;
		}
	}
}

class TitleScreen extends View {
	async load() {
		this._title_screen = await loadImage('assets/images/Title_Screen.png');
	}

	render(_, context) {
		context.drawImage(this._title_screen, 0, 0);
	}

	press(game, x, y) {
		game.next_view();
	}
}

class BasicLevel extends View {
	constructor(config) {
		super();

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
		let promises = [];

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

	render(game, context) {
		if (this._audio.ended) {
			// If the song has ended, go to the next level.
			game.next_view();
		}

		// Get the distance travelled and in tiles and remainder.
		let distance = game.elapsed * this._speed;
		let tile = Math.floor(distance);
		let offset = distance - tile;

		// Create the background gradient.
		var gradient = context.createLinearGradient(0, 0, 0, DISPLAY_HEIGHT * PIXELS_PER_TILE);
		gradient.addColorStop(0, this._config.images.background.start);
		gradient.addColorStop(1, this._config.images.background.stop);

		// Draw the background.
		context.fillStyle = gradient;
		context.fillRect(0, 0, DISPLAY_WIDTH * PIXELS_PER_TILE, DISPLAY_HEIGHT * PIXELS_PER_TILE);

		// Draw parallax at half speed.
		for (let index = 0; index <= 1; index++) {
			context.drawImage(this._images['parallax'], (-distance / 2 % 16 + index * 16) * PIXELS_PER_TILE, 0);
		}

		// Draw ground by rendering 8 tiles shifted by the offset.
		for (let index = 0; index <= 8; index++) {
			context.drawImage(this._images['ground'], (index - offset) * PIXELS_PER_TILE, 112);
		}

		// Iterate over obstacles in the game.
		for (let obstacle_tile of this._map) {
			// If the obstacle is on the screen.
			if (tile <= obstacle_tile && obstacle_tile <= tile + DISPLAY_WIDTH) {
				// Draw the obstacle.
				context.drawImage(this._images['spikes'], (obstacle_tile - tile - offset) * PIXELS_PER_TILE, 2.5 * PIXELS_PER_TILE);
			}
		}

		// Cycle player through 4 animation frames per tile travelled.
		let frame = Math.floor((distance - tile) * 4 % 4);

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

		// Draw the player tile.
		context.drawImage(this._images['player'], frame * 32, 0, 32, 32, 0, (2.5 - jumpOffset) * PIXELS_PER_TILE, 32, 32);

		// Check for collisions.
		if (!this._jump_start) {
			// If not mid-jump, check if the player is in an obstacle.
			for (let obstacle_tile of this._map) {
				// If the player is within the spike range, failure has occurred.
				if (obstacle_tile - 0.75 <= distance && distance <= obstacle_tile + 0.75) {
					// Stop the game.
					game.stop();

					// Darken the game.
					context.fillStyle = '#00000088';
					context.fillRect(0, 0, DISPLAY_WIDTH * PIXELS_PER_TILE, DISPLAY_HEIGHT * PIXELS_PER_TILE);

					// Draw the game over screen.
					context.drawImage(this._images.retry, 0, 0);

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
	let game = new Game(canvas);
	await game.load();

	// Set the game rendering size.
	game.size = [DISPLAY_WIDTH * PIXELS_PER_TILE, DISPLAY_HEIGHT * PIXELS_PER_TILE];

	// Add the title screen view.
	game.add_view('title_screen', new TitleScreen());

	// Load in views for levels 1, 2, and 3.
	game.add_view('level_1', await BasicLevel.import('1'));
	game.add_view('level_2', await BasicLevel.import('2'));
	game.add_view('level_3', await BasicLevel.import('3'));

	// Start with the title screen view.
	game.set_view('title_screen');

	window.addEventListener('keypress', function () {
		switch (event.key) {
			case '1':
				game.set_view('level_1');
				break;
			case '2':
				game.set_view('level_2');
				break;
			case '3':
				game.set_view('level_3');
				break;
		}
	});
}

start();
