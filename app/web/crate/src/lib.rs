/*
Possible data format from James:

const data = {
  nodes: [
    { id: 0, label: 'Arbitrary starting point' },    <-- TimeSync probably shouldn't create this one
    { id: 1, label: 'Start PET' },                   <-- and instead should just start here. Let a separate function/class add this uncertainty
    { id: 2, label: 'EV1 complete egress/setup' },
    { id: 3, label: 'EV2 complete egress/setup' },
    { id: 4, label: 'Both crew complete aft cable routing' },
    { id: 5, label: 'Both crew complete fwd cable routing' }
  ],
  edges: [
    { source: 0, target: 1, value: [60, 120], actor: 'all' },  <-- "value" should probably not be a range coming out of TimeSync
    { source: 1, target: 2, value: [60, 60], actor: 'EV1' },   <-- and instead should should just represent the as-planned values
    { source: 1, target: 3, value: [45, 45], actor: 'EV2' },   <-- so this other class/function can apply uncertainty.
    { source: 2, target: 4, value: [45, 45], actor: 'EV1' },
    { source: 3, target: 4, value: [60, 60], actor: 'EV2' },
    { source: 4, target: 5, value: [30, 30], actor: 'EV1' },
    { source: 4, target: 5, value: [30, 30], actor: 'EV2' },
  ]
};
*/

extern crate js_sys;
extern crate wasm_bindgen;

#[macro_use]
extern crate serde_derive;

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use web_sys::console;

mod stn;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

pub fn set_panic_hook() {
  #[cfg(feature = "console_error_panic_hook")]
  console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn run() -> Result<(), JsValue> {
  #[cfg(debug_assertions)]
  console_error_panic_hook::set_once();

  console::log_1(&JsValue::from_str("Initialized STN library"));

  Ok(())
}
