// Interface for View classes.
class View {
	// Views can load assets.
	async load() { }

	// Trigger event behavior using member functions.
	async trigger(name, game, data) {
		if (name in this) {
			// If we have a handler method, call it.
			await this[name](game, data);
		}
	}

	// Forward events downstream to child views.
	async forward(name, game, data) {
		// Do nothing because this view does not contain children.
	}
}

// View class that runs a series of child views.
class MultiView extends View {
	// Create a multiview with an optional list of child views.
	constructor(views) {
		super();

		// Initialize to an empty list if not given views.
		this._views = views || [];
	}

	// Access the view list.
	get views() {
		return this._views;
	}

	// Load the child views.
	async load() {
		// Start loading all at once and wait for all to finish.
		await Promise.all(this._views.map(child => child.load()));
	}

	// Trigger events to multiple views.
	async trigger(name, game, data) {
		if (name in this) {
			// If there is an event handler, call it.
			await this[name](game, data);
		} else {
			// Otherwise forward the event.
			await this.forward(name, game, data);
		}
	}

	// Forward events downstream to child views.
	async forward(name, game, data) {
		// Call the handler for each child view.
		for (let view of this._views) {
			await view.trigger(name, game, data);
		}
	}
}

// Basic View class for displaying a single static image.
class ImageView extends View {
	// Construct an ImageView using a source URL, tile position, and optional tile dimensions.
	constructor(source, x, y, w, h) {
		super();

		// Store the URL and define the loaded image variable.
		this._source = source;
		this._image = null;

		// Store the position and dimensions given in tile units.
		this._x = x;
		this._y = y;
		this._w = w;
		this._h = h;
	}

	get x() { return this._x; }
	set x(x) { this._x = x; }

	get y() { return this._y; }
	set y(y) { this._y = y; }

	get w() { return this._w; }
	set w(w) { this._w = w; }

	get h() { return this._h; }
	set h(h) { this._h = h; }

	// Load the image from the URL asynchronously.
	async load(game) {
		await new Promise((resolve, reject) => {
			// Create the image instance.
			let image = new Image(this._source);

			// Store the image and resolve on load.
			image.addEventListener('load', () => { this._image = image; resolve() });
			// Reject the promise on error.
			image.addEventListener('error', reject);

			// Start loading by defining the image source.
			image.src = this._source;
		});
	}

	// Render the image onto the Game class.
	async render(game, data) {
		// Check that the image is already loaded first.
		if (this._image) {
			if (this._w && this._h) {
				// Draw the image into the game with the position and dimensions.
				game.draw(this._image, this._x, this._y, this._w, this._h);
			} else {
				// Draw the image into the game with the position and default dimensions.
				game.draw(this._image, this._x, this._y);
			}
		}
	}
}

// View for displaying frames from a sprite image.
class SpriteView extends ImageView {
	// Construct the SpriteView using the source, number of frames, position, and dimensions.
	constructor(source, frames, x, y, w, h) {
		super(source, x, y, w, h);

		// Store the number of frames and current frame.
		this._frames = frames;
		this._frame = 0;
	}

	get frame() { return this._frame; }
	set frame(value) { this._frame = value; }

	// Render the sprite onto the Game class.
	async render(game, data) {
		// Check that the image is already loaded first.
		if (this._image) {
			// Draw the current frame of the sprite into the specified position.
			game.draw(this._image, this._frame * this._w, 0, this._w, this._h, this._x, this._y, this._w, this._h);
		}
	}
}

// View for rendering the frame around the game area.
class BorderView extends MultiView {
	// Create the top, left, right, and bottom image views and construct the underlying MultiView.
	constructor() {
		super([
			new ImageView('./assets/images/top_tiled.png', 0, 0),
			new ImageView('./assets/images/left_tiled.png', 0, 0),
			new ImageView('./assets/images/right_tiled.png', 0, 0),
			new ImageView('./assets/images/bottom_tiled.png', 0, 0),
		]);
	}

	// Override the MultiView rendering function to move the borders into the proper locations.
	async render(game, data) {
		let transform = data.transform;
		let tile_size = data.tile_size;

		// Render the left and right borders.
		for (var x = 0; x < (transform[4] / transform[0]) / tile_size; x++) {
			this._views[1].x = -(x + 1);
			this._views[2].x = data.width + x;

			await this._views[1].trigger('render', game, data);
			await this._views[2].trigger('render', game, data);
		}

		// Render the top and bottom borders.
		for (var y = 0; y < (transform[5] / transform[3]) / tile_size; y++) {
			this._views[0].y = -(y + 1);
			this._views[3].y = data.height + y;

			await this._views[0].trigger('render', game, data);
			await this._views[3].trigger('render', game, data);
		}
	}
}

export { View, MultiView, ImageView, SpriteView, BorderView };
