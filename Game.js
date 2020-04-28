class Game {
	// Create a game using a given canvas, target width and height, and tile size.
	constructor(canvas, w, h, tile_size) {
		// Store the canvas and context used by the game.
		this._canvas = canvas;
		this._context = canvas.getContext('2d');

		// Bind input hanlers to canvas events.
		this._canvas.addEventListener('mousedown', event => this.mousedown(event));
		this._canvas.addEventListener('touchstart', event => this.touchstart(event));

		// Store the width and height in tiles and the number of pixels per tile.
		this._w = w;
		this._h = h;
		this._tile_size = tile_size;

		// Store the running state and start time.
		this._running = false;
		this._start_time = null;

		// Store the rendering request and frame.
		this._request = null;
		this._frame = null;

		// Store view-level state information.
		this._state = {};

		// Unset press flag.
		this._pressing = false;
	}

	// Get the time elapsed since the game started.
	get elapsed() {
		return new Date().getTime() - this._start_time;
	}

	get w() { return this._w; }
	get h() { return this._h; }
	get tile_size() { return this._tile_size; }

	// Access the screen size of the game in pixels.
	get sw() { return this._canvas.width; }
	get sh() { return this._canvas.height; }

	// Get the last transformation applied to the canvas.
	get transform() { return this._transform; }

	get state() { return this._state; }

	// Calculate the transformation needed to make the game fit the canvas.
	get _transform() {
		// Get the aspect ratios for the game and canvas.
		let game_ratio = this._w / this._h;
		let canvas_ratio = this._canvas.width / this._canvas.height;

		// Get the width and height in pixels.
		let width = this._w * this._tile_size;
		let height = this._h * this._tile_size;

		if (canvas_ratio < game_ratio) {
			// If the canvas is taller than the game.

			// Make the game fill the canvas width.
			let scale = this._canvas.width / width;
			// Shift the game down to the middle of the canvas.
			let translate = (this._canvas.height - height * scale) / 2;

			// Return the canvas transformation matrix.
			return [scale, 0, 0, scale, 0, translate];
		} else {
			// If the canvas is wider than the game.

			// Make the game fill the canvas height.
			let scale = this._canvas.height / height;
			// Shift the game left ot the middle of the canvas.
			let translate = (this._canvas.width - width * scale) / 2;

			// Return the canvas transformation matrix.
			return [scale, 0, 0, scale, translate, 0];
		}
	}

	// Start rendering the game.
	async start() {
		// Wait for the view to load.
		await this._view.load();

		// Clear the game state.
		this._state = {};

		// If the view has a start handler, call it.
		if (this._view.start) {
			this._view.start(this);
		}

		// Set the running flag and start time.
		this._running = true;
		this._start_time = new Date().getTime();

		// Create a request for the next frame.
		this._request = requestAnimationFrame(() => this._frame = this.render());
	}

	// Stop rendering the game and wait for the current frame to finish.
	async stop() {
		if (!this._view) {
			return;
		}

		// If the view has a stop handler, call it.
		if (this._view.stop) {
			this._view.stop(this);
		}

		// Unset the running flag and start time.
		this._running = false;
		this._start_time = null;

		// If there is a request for another frame.
		if (this._request) {
			// Cancel the request.
			cancelAnimationFrame(this._request);
			this._request = null;
		}

		// If there is a frame in progress.
		if (this._frame) {
			// Wait for it to finish.
			await this._frame;
			this._frame = null;
		}
	}

	// Converts screen pixel coordinates to tile positions.
	localize(x, y) {
		// Calculate the transformation on the view.
		let transform = this.transform;

		// Convert the x and y coordinates to tile positions.
		x = (x - transform[4]) / (transform[0] * this._tile_size);
		y = (y - transform[5]) / (transform[3] * this._tile_size);

		return [x, y];
	}

	// Send a press event to the view given tile coordinates.
	async press(x, y) {
		// If a press is not already being handled.
		if (this._pressing == false) {
			// Set the pressing flag.
			this._pressing = true;

			// If the view has a press handler, call it.
			if (this._view.press) {
				await this._view.press(this, x, y);
			}

			// Unset the pressing flag.
			this._pressing = false;
		}
	}

	// Mouse click event handler.
	async mousedown(event) {
		// Call the press handler with the localized coordinates.
		await this.press(...this.localize(event.clientX, event.clientY));
	}

	// Touch screen event handler.
	async touchstart(event) {
		// Cancel the mouse event.
		event.preventDefault();

		// Get the first touch location.
		let touch = event.touches[0];

		// Call the press handler with the localized coordinates.
		await this.press(...this.localize(touch.clientX, touch.clientY));
	}

	// Change to a new view.
	async view(view) {
		// Wait for the current view to stop and the new view to load.
		await Promise.all([this.stop(), view.load()]);

		// Switch to the new view.
		this._view = view;

		// Start the new view.
		await this.start();
	}

	// Render a single frame from the current view in the game.
	async render() {
		// Save the state of the canvas context.
		this._context.save();

		// Disable smoothing on upscaled images.
		this._context.imageSmoothingEnabled = false;

		// Apply the canvas transformation to make the game fit the screen.
		this._context.transform(...this._transform);

		// Render the current view.
		await this._view.render(this);

		// Restore the saved state of the canvas context.
		this._context.restore();

		// If the game is still running.
		if (this._running) {
			// Create a request for the next frame.
			this._request = requestAnimationFrame(() => this._frame = this.render());
		}
	}

	// Draw an image onto the game canvas.
	draw(image, ...args) {
		// Render the image by converting converting units from tiles to pixels.
		this._context.drawImage(image, ...args.map(arg => arg * this._tile_size));
	}

	// Get a gradient fill style from the canvas.
	gradient(...args) {
		// Return the gradient with the tile units converted to pixels.
		return this._context.createLinearGradient(...args.map(arg => arg * this._tile_size));
	}

	// Fill a rectangle on the game canvas.
	rect(style, ...args) {
		// Fill the canvas in pixels instead of tiles.
		this._context.fillStyle = style;
		this._context.fillRect(...args.map(arg => arg * this._tile_size));
	}
}

export { Game };
