import { Game } from './Game.js';
import { MultiView, ImageView, BorderView } from './View.js';
import { LevelView } from './Level.js';

// Creates a bounding box using the given position and size.
function bounds(x, y, w, h) {
	return {
		// Returns true if the given coordinates are within the box.
		contain: (cx, cy) => (x <= cx && cx <= x + w) && (y <= cy && cy <= y + h),
	}
}

// Title screen view shows on start.
class TitleScreen extends MultiView {
	// Construct with background image and borders.
	constructor() {
		super([
			new ImageView('./assets/images/Title_Screen.png', 0, 0),
			new BorderView(),
		]);
	}

	// Press continues to level select.
	async press(game, x, y) {
		await game.view({ name: 'level_select' });
	}
}

// Level select view for starting game.
class LevelSelect extends MultiView {
	// Construct with background image and borders.
	constructor() {
		super([
			new ImageView('./assets/images/level_select.png', 0, 0),
			new BorderView(),
		]);
	}

	// Press checks which level was chosen and starts it.
	async press(game, data) {
		if (bounds(1, 1.5, 2, 1.5).contain(data.x, data.y)) {
			// Level 1 pressed.
			await game.view({ name: 'level_1' });
		} else if (bounds(3, 1.5, 2, 1.5).contain(data.x, data.y)) {
			// Level 2 pressed.
			await game.view({ name: 'level_2' });
		} else if (bounds(5, 1.5, 2, 1.5).contain(data.x, data.y)) {
			// Level 3 pressed.
			await game.view({ name: 'level_3' });
		}
	}
}

const DISPLAY_WIDTH = 8;
const DISPLAY_HEIGHT = 4.5;
const PIXELS_PER_TILE = 32;

// Start function called automatically to setup the game.
(async function () {
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

	// Register title and level select views.
	await game.register({ name: 'title_screen', view: new TitleScreen() });
	await game.register({ name: 'level_select', view: new LevelSelect() });

	// Register default levels.
	await game.register({ name: 'level_1', view: await LevelView.import('1') });
	await game.register({ name: 'level_2', view: await LevelView.import('2') });
	await game.register({ name: 'level_3', view: await LevelView.import('3') });

	// Switch to the title screen.
	await game.view({ name: 'title_screen' });
})();
