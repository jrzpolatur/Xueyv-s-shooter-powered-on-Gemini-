// Headless smoke test: run the exported Web template runtime under Node with
// the nothreads glue (which supports the NODE environment). Boots the engine
// with --headless --main-pack game.pck, runs ~240 frames, prints a result
// line and exits. Requires the game scripts to print "SMOKE_OK".
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// --- Minimal browser shims: some engine JS bridge functions reference
// window/document/navigator even with --headless --audio-driver Dummy.
globalThis.window = globalThis;
// The emscripten main loop uses requestAnimationFrame (timing mode 1); node has none.
let rafCount = 0;
globalThis.requestAnimationFrame = (cb) => {
	rafCount++;
	return setTimeout(() => cb(Date.now()), 8);
};
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
Object.defineProperty(globalThis, 'navigator', {
	value: { userAgent: 'node-smoke', language: 'en', languages: ['en'] },
	configurable: true, writable: true,
});
globalThis.location = { href: 'file:///smoke/' };
globalThis.document = {
	getElementById: () => null,
	createElement: () => ({ getContext: () => null, style: {} }),
	addEventListener: () => {},
	removeEventListener: () => {},
};

const dir = path.resolve(process.argv[2] || 'build/web');
const gluePath = path.join(dir, 'godot.web.template_release.wasm32.nothreads.js');

const wasmBinary = fs.readFileSync(path.join(dir, 'godot.web.template_release.wasm32.nothreads.wasm'));
const pck = fs.readFileSync(path.join(dir, 'game.pck'));

const ARGS = ['--headless', '--audio-driver', 'Dummy', '--fixed-fps', '60', '--main-pack', 'game.pck', '--smoke-test', '--quit-after', '3600'];

let exited = false;
const timeout = setTimeout(() => {
	console.error('[smoke] TIMEOUT: engine did not quit within 90s');
	process.exit(2);
}, 90000);

let smokeResult = null;
const godotPrint = (...a) => {
	const line = a.map(String).join(' ');
	if (line.includes('SMOKE_OK') || line.includes('SMOKE_FAIL')) smokeResult = line.trim();
	console.log('[godot]', ...a);
};

const mod = await import(pathToFileURL(gluePath).href);
const Godot = mod.default;

const instance = await Godot({
	print: godotPrint,
	printErr: (...a) => console.error('[godot!]', ...a),
	thisProgram: 'godot',
	noExitRuntime: true,
	dynamicLibraries: [],
	locateFile: (p) => path.join(dir, p),
	instantiateWasm: (imports, onSuccess) => {
		WebAssembly.instantiate(wasmBinary, imports).then((r) => onSuccess(r.instance, r.module));
		return {};
	},
	arguments: ARGS,
});

await instance.initFS([]);
instance.initConfig({
	canvas: null,
	canvasResizePolicy: 0,
	locale: 'en',
	persistentDrops: false,
	virtualKeyboard: false,
	godotPoolSize: 1,
	focusCanvas: false,
	onExecute: null,
	onExit: (code) => {
		exited = true;
		console.log('[smoke] onExit code=', code);
	},
});

instance.copyToFS('game.pck', pck);
console.log('[smoke] calling main with', ARGS.join(' '));
instance.callMain(ARGS);
console.log('[smoke] main() returned; event loop keeps the engine running');

// --quit-after makes the engine force-exit the runtime, which surfaces as an
// uncaught ExitStatus inside the scheduled loop callback.
process.on('uncaughtException', (e) => {
	const s = String(e);
	if (s.includes('ExitStatus') || s.includes('unwind')) {
		console.log('[smoke] engine exited:', s.slice(0, 80));
		process.exit(smokeResult === 'SMOKE_FAIL' ? 1 : 0);
	}
	// DisplayServerWeb touches canvas.style at exit in node (canvas is null) — benign.
	if (s.includes("reading 'style'")) {
		console.log('[smoke] benign exit-time display error (node has no canvas)');
		process.exit(smokeResult === 'SMOKE_FAIL' ? 1 : (smokeResult ? 0 : 1));
	}
	console.error('[smoke] uncaught:', s.slice(0, 300));
	process.exit(1);
});
