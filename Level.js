import { ImageView, SpriteView, MultiView, BorderView } from './View.js';

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

		audio.preload = 'auto';
		audio.src = url;
		audio.load();
	});
}

// Renders the background of the game, including the gradient and parallax.
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

// Renders the foreground of the game, including the ground tiles and spikes.
class ForegroundView extends MultiView {
	constructor(ground_source, spike_source, spike_tiles) {
		super();

		// Add the ground and spike views.
		this.views.push(new ImageView(ground_source, 0, 0))
		this.views.push(new ImageView(spike_source, 0, 0));

		// Store the spike locations.
		this._spike_tiles = spike_tiles;
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

		// Return true to cancel default propagation.
		return true;
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
		this._lost = false;
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
			if (jump_distance >= this._jw && !this._lost) {
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
		if (!this._lost && this._jump_time < 0) {
			// Trigger jumping event.
			game.trigger('jump', { time: data.time });
		}
	}

	// Set the jump start time on jump.
	async jump(game, data) {
		this._jump_time = data.time;
	}

	// Clear the jump start time on land.
	async land(game, data) {
		this._jump_time = -1;
	}

	// Set the lose flags.
	async lose(game, data) {
		this._jump_time = data.time;
		this._lost = true;
	}
}

// Renders the game over screen after losing.
class LoseView extends ImageView {
	constructor(fadeout, darkness) {
		super('./assets/images/gameover.png', 0, 0);

		this._fadeout = fadeout;
		this._darkness = darkness;
	}

	// Reset the lose flags.
	async start(game, data) {
		this._lost = false;
		this._lost_time = -1;
	}

	async render(game, data) {
		// Only render if the game is over.
		if (this._lost) {
			// Darken the background by fading in a black overlay.
			let elapsed = data.time - this._lost_time;
			let alpha = Math.min(elapsed * this._darkness / this._fadeout, this._darkness);

			// Draw the overlay and the original image.
			game.rect(`rgba(0, 0, 0, ${alpha})`, 0, 0, game.w, game.h);
			await super.render(game);
		}
	}

	// If the game is over and we've faded out, restart on press.
	async press(game, data) {
		if (this._lost && data.time - this._lost_time > this._fadeout) {
			await game.start();
		}
	}

	// Update the lose flags.
	async lose(game, data) {
		this._lost = true;
		this._lost_time = data.time;
	}
}

// Renders the congratulations screen after winning.
class WinView extends ImageView {
	constructor(fadeout, darkness) {
		super('./assets/images/complete.png', 0, 0);

		this._fadeout = fadeout;
		this._darkness = darkness;
	}

	// Reset the win flags.
	async start(game, data) {
		this._won = false;
		this._won_time = -1;
	}

	async render(game, data) {
		// Only render if the game is over.
		if (this._won) {
			// Darken the background by fading in a black overlay.
			let elapsed = data.time - this._won_time;
			let alpha = Math.min(elapsed * this._darkness / this._fadeout, this._darkness);

			// Draw the overlay and the original image.
			game.rect(`rgba(0, 0, 0, ${alpha})`, 0, 0, game.w, game.h);
			await super.render(game);
		}
	}

	// If the game is won and we've faded out, return to title screen on press.
	async press(game, data) {
		if (this._won && data.time - this._won_time > this._fadeout) {
			await game.view({ name: 'title_screen' });
		}
	}

	// Update the win flags.
	async win(game, data) {
		this._won = true;
		this._won_time = data.time;
	}
}

// The main level view combining all component views and managing their events.
class LevelView extends MultiView {
	constructor(config) {
		super();

		// Calculate the game speed based on the beats per minute.
		this._speed = config.audio.beats_per_minute / 60 / 1000;

		// Calculate the tiles where spikes should occur based on the times.
		this._spike_tiles = config.map.spike_times.map(time => Math.floor(time * 1000 * this._speed));

		// Add a background view.
		this.views.push(new BackgroundView(
			config.background.top,
			config.background.bottom,
			config.parallax.source
		));

		// Add a foreground view.
		this.views.push(new ForegroundView(
			config.ground.source,
			config.spikes.source,
			this._spike_tiles,
		));

		// Add a player view.
		this.views.push(new PlayerView(
			config.player.source,
			config.player.frames,
			config.player.jump.width,
			config.player.jump.height,
		));

		// Add the win and lose views.
		this.views.push(new WinView(250, 0.5));
		this.views.push(new LoseView(250, 0.5));

		// Add the border view.
		this.views.push(new BorderView());

		this._config = config;
		this._tolerance = config.player.jump.tolerance;
	}

	// Create a level from a JSON configuration file.
	static async import(name) {
		// Load the configuration from the corresponding JSON file.
		let response = await fetch('assets/levels/' + name + '.json');

		// Return a new level constructed from the configuration.
		return new LevelView(await response.json());
	}

	async load() {
		// Load the audio and all child views simultaneously.
		await Promise.all([
			loadAudio(this._config.audio.source).then(audio => this._audio = audio),
			super.load(),
		]);
	}

	// Reset flags and start the music.
	async start(game, data) {
		// Reset the times and flags.
		this._jump_time = -1;
		this._won = false;
		this._lost = false;
		this._lost_time = -1;

		// Start the music.
		this._audio.volume = 1;
		this._audio.currentTime = 0;
		this._audio.play();
	}

	// Stop the music.
	async stop(game, data) {
		this._audio.pause();
		this._audio.currentTime = 0;
	}

	async render(game, data) {
		if (this._lost) {
			// If the game is over, adjust the volume to fade out.
			let elapsed = this._lost_time - data.time;
			this._audio.volume = Math.max(elapsed / 250 + 1, 0);
		}

		if (this._audio.ended && !this._won) {
			// Otherwise, trigger a win if the audio has ended.
			await game.trigger('win', { time: data.time });
		}

		// Get the distance travelled and in tiles and remainder.
		let distance = data.time * this._speed;
		let tile = Math.floor(distance);
		let offset = distance - tile;

		// Check for collisions.
		if (this._jump_time < 0 && !this._lost) {
			// If not mid-jump, check if the player is in an obstacle.
			for (let spike_tile of this._spike_tiles) {
				// If the player is within the spike range, failure has occurred.
				if (spike_tile - this._tolerance <= distance && distance <= spike_tile + this._tolerance) {
					// Trigger a lose event.
					await game.trigger('lose', { time: data.time });
				}
			}
		}

		// Render the child views with additional data.
		await this.forward('render', game, Object.assign({}, data, {
			distance: distance,
			tile: tile,
			offset: offset,
			speed: this._speed,
		}));

		return true;
	}

	// Register the jump start time.
	async jump(game, data) {
		this._jump_time = data.time;
	}

	// Clear the jump start time.
	async land(game, data) {
		this._jump_time = -1;
	}

	// Set the win flag.
	async win(game, data) {
		this._won = true;
	}

	// Set the lose flag and time.
	async lose(game, data) {
		this._lost = true;
		this._lost_time = data.time;
	}
}

export { BackgroundView, ForegroundView, PlayerView, LoseView, WinView, LevelView };
