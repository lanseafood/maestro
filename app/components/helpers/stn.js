/** import async WASM code */
// TODO: type annotate this
let wasmModule;

/**
 * Get the collection of STN tools written in Rust/WASM.
 * @return {Promise<{STN, Interval, Activity}>}
 */
export const getSTNTools = () => new Promise((resolve, reject) => {
	if (wasmModule) {
		resolve(wasmModule);
		return;
	}

	import('../../../pkg')
		.then((m) => {
			wasmModule = m;
			resolve(m);
		})
		.catch((e) => {
			console.error('Unable to import STN module from WASM', e);
			reject(e);
		});
});
