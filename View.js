// Interface for View classes.
class View {
	// Views can load assets.
	async load() { }

	// Views can render assets into a Game.
	async render(game) { }
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
		return new Promise((resolve, reject) => {
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
	async render(game) {
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
	async render(game) {
		// Check that the image is already loaded first.
		if (this._image) {
			// Draw the current frame of the sprite into the specified position.
			game.draw(this._image, this._frame * this._w, 0, this._w, this._h, this._x, this._y, this._w, this._h);
		}
	}
}

export { View, ImageView, SpriteView };
