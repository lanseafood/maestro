extern crate wasm_bindgen;

use web_sys::console;
use wasm_bindgen::prelude::*;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet(msg: &str) {
    let intro = "wasm says: ";
    let message = format!("{}{}", intro, msg);
    alert(&message);
}

#[wasm_bindgen]
pub fn run() -> Result<(), JsValue> {
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();

    console::log_1(&JsValue::from_str("Hello from Rust!"));

    Ok(())
}

pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}