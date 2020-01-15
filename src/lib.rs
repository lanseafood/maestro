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
  links: [
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

// extern crate serde_json;
extern crate js_sys;
extern crate wasm_bindgen;

#[macro_use]
extern crate serde_derive;

use petgraph::graph::NodeIndex;
use petgraph::Graph;
use std::collections::HashMap;
use std::default::Default;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use web_sys::console;

mod interval;
pub use interval::Interval;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

pub fn set_panic_hook() {
  #[cfg(feature = "console_error_panic_hook")]
  console_error_panic_hook::set_once();
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct GraphPayload {
  nodes: Vec<Activity>,
  links: Vec<Link>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct Link {
  source: i32,
  target: i32,
  #[serde(default)]
  value: Interval,
  #[serde(default)]
  actor: String,
}

#[derive(Clone, Deserialize, Serialize, Debug)]
pub struct Activity {
  pub id: i32,
  pub label: String,
  #[serde(default)]
  pub bounds: Interval,
}

#[wasm_bindgen]
#[derive(Debug)]
pub struct STN {
  distance_graph: Graph<i32, f64>,
  constraint_table: HashMap<i32, HashMap<i32, f64>>,
  elapsed_time: f64,
}

#[wasm_bindgen]
impl STN {
  #[wasm_bindgen(constructor)]
  pub fn new() -> STN {
    STN {
      distance_graph: Graph::new(),
      constraint_table: HashMap::new(),
      elapsed_time: 0.,
    }
  }

  #[wasm_bindgen(js_name = toString)]
  pub fn to_string(&self) -> String {
    format!("{} elapsed time", self.elapsed_time)
  }

  /// Register task data as a distance graph. Returns the number of edges created.
  #[wasm_bindgen(catch, method, js_name = registerGraph)]
  pub fn register_graph(&mut self, payload: &JsValue) -> Result<usize, JsValue> {
    let data: GraphPayload = payload.into_serde().unwrap();

    let mut activity_nodes: HashMap<i32, NodeIndex> = HashMap::new();

    for node in data.nodes.iter() {
      activity_nodes.insert(node.id, self.distance_graph.add_node(node.id));
    }

    for link in data.links.iter() {
      let source = match activity_nodes.get(&link.source) {
        Some(s) => s,
        None => continue,
      };
      let target = match activity_nodes.get(&link.target) {
        Some(t) => t,
        None => continue,
      };

      self
        .distance_graph
        .update_edge(*source, *target, link.value.upper());

      self
        .distance_graph
        .update_edge(*target, *source, -link.value.lower());
    }

    // let res = format!("{:?}", data);
    // console::log_1(&JsValue::from_str(&res));

    Ok(self.distance_graph.edge_count())
  }

  // pub fn perform_APSP(&mut self) {
  //     //
  // }

  // pub fn create_activity(&mut self, name: String) {
  //     //
  // }

  // pub fn remove_activity(&mut self, name: String) {
  //     //
  // }

  // pub fn add_constraint(&mut self, from: String, to: String, interval: (f64, f64)) -> bool {
  //     // TODO: error handling between rust and JS?
  // }

  // pub fn query(&mut self, from: Activity, to: Activity) -> Interval {
  //     //
  // }

  // pub fn commit(&mut self, activity: Activity, time: f64) {
  //     //
  // }
}

#[wasm_bindgen]
pub fn run() -> Result<(), JsValue> {
  #[cfg(debug_assertions)]
  console_error_panic_hook::set_once();

  console::log_1(&JsValue::from_str("Initialized STN library"));

  Ok(())
}
