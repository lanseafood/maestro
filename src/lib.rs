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
  edges: Vec<Edge>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct Edge {
  source: i32,
  target: i32,
  minutes: f64,
  #[serde(default)]
  action: String,
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
  /// maps id to Node in Graph
  node_indices: HashMap<i32, NodeIndex>,
  distance_graph: Graph<Activity, f64>,
  /// use ids to key the (column, row) of the constraint table
  constraint_table: HashMap<(i32, i32), f64>,
  elapsed_time: f64,
}

#[wasm_bindgen]
impl STN {
  #[wasm_bindgen(constructor)]
  pub fn new() -> STN {
    STN {
      node_indices: HashMap::new(),
      distance_graph: Graph::new(),
      constraint_table: HashMap::new(),
      elapsed_time: 0.,
    }
  }

  #[wasm_bindgen(js_name = toString)]
  pub fn to_string(&self) -> String {
    format!("{} elapsed time", self.elapsed_time)
  }

  /// Register task data as a distance graph. Returns the number of edges created. Adds 10% uncertainty to task time
  #[wasm_bindgen(catch, method, js_name = registerGraph)]
  pub fn register_graph(&mut self, payload: &JsValue) -> Result<usize, JsValue> {
    let data: GraphPayload = payload.into_serde().unwrap();

    for node in data.nodes.iter() {
      // manually clone the activity
      let activity = node.clone();
      self
        .node_indices
        .insert(node.id, self.distance_graph.add_node(activity));
    }

    for edge in data.edges.iter() {
      // silently skip this edge if one of the nodes can't be found
      let source = match self.node_indices.get(&edge.source) {
        Some(s) => s,
        None => continue,
      };
      let target = match self.node_indices.get(&edge.target) {
        Some(t) => t,
        None => continue,
      };

      // give 10% uncertainty to execution time
      let error_estimate = edge.minutes * 0.1;
      let interval = Interval::new(edge.minutes - error_estimate, edge.minutes + error_estimate);

      // outgoing upper interval
      self
        .distance_graph
        .update_edge(*source, *target, interval.upper());

      // incoming negative lower interval
      self
        .distance_graph
        .update_edge(*target, *source, -interval.lower());
    }

    Ok(self.distance_graph.edge_count())
  }

  /// Perform All Pairs Shortest Paths (Floyd-Warshall) algorithm to calculate inferred constraints.
  #[wasm_bindgen(catch, method, js_name = performAPSP)]
  pub fn perform_apsp(&mut self) -> Result<(), JsValue> {
    let node_iter = self.node_indices.iter();

    // init. distances from a node to a node to 0
    for (i, _i_node) in node_iter.clone() {
      self.constraint_table.insert((*i, *i), 0.);
    }

    // add known distances to the table
    for (i, i_node) in node_iter.clone() {
      for (j, j_node) in node_iter.clone() {
        // look up the edge index. silently fail if not found
        let edge_index = match self.distance_graph.find_edge(*i_node, *j_node) {
          Some(e) => e,
          None => continue,
        };

        let distance = match self.distance_graph.edge_weight(edge_index) {
          Some(d) => d,
          None => continue,
        };

        self.constraint_table.insert((*i, *j), *distance);
      }
    }

    // iterate over intermediates
    for (_k, k_node) in node_iter.clone() {
      for (i, i_node) in node_iter.clone() {
        for (j, j_node) in node_iter.clone() {
          let from = match self.distance_graph.find_edge(*i_node, *k_node) {
            Some(e) => e,
            // if no edge exists, move on
            None => continue,
          };
          let to = match self.distance_graph.find_edge(*k_node, *j_node) {
            Some(e) => e,
            // if no edge exists, move on
            None => continue,
          };

          let distance_from = match self.distance_graph.edge_weight(from) {
            Some(d) => d,
            // if no distance exists, move one
            None => continue,
          };

          let distance_to = match self.distance_graph.edge_weight(to) {
            Some(d) => d,
            // if no distance exists, move one
            None => continue,
          };

          let current_distance = match self.constraint_table.get(&(*i, *j)) {
            Some(d) => d,
            None => &std::f64::MAX,
          };

          let new_distance = distance_from + distance_to;

          self
            .constraint_table
            .insert((*i, *j), new_distance.min(*current_distance));
        }
      }
    }
    Ok(())
  }
}

#[wasm_bindgen]
pub fn run() -> Result<(), JsValue> {
  #[cfg(debug_assertions)]
  console_error_panic_hook::set_once();

  console::log_1(&JsValue::from_str("Initialized STN library"));

  Ok(())
}
