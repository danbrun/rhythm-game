window.presses = [];

class Game {
	// Create a game using a given canvas, target width and height, and tile size.
	constructor(canvas, w, h, tile_size) {
		// Store the canvas and context used by the game.
		this._canvas = canvas;
		this._context = canvas.getContext('2d');

		// Bind input hanlers to canvas events.
		this._canvas.addEventListener('mousedown', event => this._mousedown(event));
		this._canvas.addEventListener('touchstart', event => this._touchstart(event));

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

		// Store view registry and active view.
		this._views = {};
		this._view = null;

		// Unset press flag.
		this._pressing = false;
	}

	get w() { return this._w; }
	get h() { return this._h; }
	get tile_size() { return this._tile_size; }

	// Get the time since the game was started.
	get _time() {
		return new Date().getTime() - this._start_time;
	}

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

	// Trigger an event in the game with the name and data.
	async trigger(name, data) {
		if (name in this) {
			// If we have a handler, call it.
			await this[name](data);
		} else {
			// Forward the event downstream.
			await this.forward(name, data);
		}
	}

	// Forward an event to game view with the name and data.
	async forward(name, data) {
		// Trigger the view with the event data.
		await this._view.trigger(name, this, data);
	}

	// Start rendering the game.
	async start(data) {
		// Forward the start event to the view.
		await this.forward('start', data);

		// Set the running flag and start time.
		this._running = true;
		this._start_time = new Date().getTime();

		// Create a request for the next frame.
		this._request = requestAnimationFrame(() => this._frame = this.render());
	}

	// Stop rendering the game and wait for the current frame to finish.
	async stop(data) {
		// If there is a view being rendered.
		if (this._view) {
			// Forward the stop event to the view.
			await this.forward('stop', data);

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
	}

	// Render a single frame from the current view in the game.
	async render() {
		// Save the state of the canvas context.
		this._context.save();

		// Adjust canvas to upscale game to fit screen without smoothing.
		this._context.imageSmoothingEnabled = false;
		this._context.transform(...this._transform);

		// Render the current view.
		await this.forward('render', {
			width: this.w,
			height: this.h,
			transform: this._transform,
			tile_size: this._tile_size,
			time: this._time,
		});

		// Restore the saved state of the canvas context.
		this._context.restore();

		// If the game is still running, request the next frame.
		if (this._running) {
			this._request = requestAnimationFrame(() => this._frame = this.render());
		}
	}

	// Send a press event to the view given tile coordinates.
	async press(x, y) {
		// If a press is not already being handled.
		if (this._pressing == false) {
			this._pressing = true;

			// If the view has a press handler, call it.
			await this.forward('press', { x: x, y: y, time: this._time });

			this._pressing = false;
		}

		window.presses.push(this._time);
	}

	// Register a new view in the game.
	async register(data) {
		this._views[data.name] = data.view;
	}

	// Change to a registered view.
	async view(data) {
		let view = this._views[data.name];

		// Wait for the current view to stop and the new view to load.
		await Promise.all([this.stop(), view.load()]);

		// Switch to the new view.
		this._view = view;

		// Start the new view.
		await this.trigger('start', {});
	}

	// Mouse click raw event handler.
	_mousedown(event) {
		// Call the press handler with the localized coordinates.
		this.press(...this._localize(event.clientX, event.clientY));
	}

	// Touch screen raw event handler.
	_touchstart(event) {
		// Cancel the mouse event and get touch location.
		event.preventDefault();
		let touch = event.touches[0];

		// Call the press handler with the localized coordinates.
		this.press(...this._localize(touch.clientX, touch.clientY));
	}

	// Converts screen pixel coordinates to tile positions.
	_localize(x, y) {
		// Calculate the transformation on the view.
		let transform = this._transform;

		// Convert the x and y coordinates to tile positions.
		x = (x - transform[4]) / (transform[0] * this._tile_size);
		y = (y - transform[5]) / (transform[3] * this._tile_size);

		return [x, y];
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
