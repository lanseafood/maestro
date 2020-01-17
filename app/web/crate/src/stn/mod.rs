use petgraph::graph::NodeIndex;
use petgraph::Graph;
use std::collections::HashMap;
use std::default::Default;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

mod interval;
pub use interval::Interval;

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
        None => {
          return Err(JsValue::from_str(&format!(
            "Could not find source node {}",
            edge.source
          )))
        }
      };
      let target = match self.node_indices.get(&edge.target) {
        Some(t) => t,
        None => {
          return Err(JsValue::from_str(&format!(
            "Could not find target node {}",
            edge.target
          )))
        }
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
        // look up the edge index
        let edge_index = match self.distance_graph.find_edge(*i_node, *j_node) {
          Some(e) => e,
          None => {
            return Err(JsValue::from_str(&format!(
              "Could not find edge [{}, {}]",
              i, j,
            )))
          }
        };

        let distance = match self.distance_graph.edge_weight(edge_index) {
          Some(d) => d,
          None => {
            return Err(JsValue::from_str(&format!(
              "Could not find edge weight [{}, {}]",
              i, j,
            )))
          }
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

          let current_distance = {
            match self.constraint_table.get(&(*i, *j)) {
              Some(d) => d,
              None => &std::f64::MAX,
            }
          };

          let new_distance = current_distance.min(distance_from + distance_to);

          if i == j && new_distance < 0. {
            let error_message = format!("negative cycle found on node ID {}", i);
            return Err(JsValue::from_str(&error_message));
          }

          if new_distance < *current_distance {
            self.constraint_table.insert((*i, *j), new_distance);
          }
        }
      }
    }
    Ok(())
  }
}

#[cfg(test)]
mod tests {
  extern crate wasm_bindgen_test;
  use super::*;
  use serde_json::json;
  use wasm_bindgen_test::*;

  #[wasm_bindgen_test]
  fn test_register_graph_no_input() {
    let input = json!(
      {
        "nodes": [],
        "edges": [],
      }
    );

    let mut stn = STN::new();

    let payload = {
      match JsValue::from_serde(&input) {
        Ok(p) => p,
        Err(e) => panic!("could not create payload | {:?}", e),
      }
    };

    match stn.register_graph(&payload) {
      Ok(u) => assert_eq!(0_usize, u, "No edges expected to be made"),
      Err(e) => panic!("failed running stn.register_graph | {:?}", e),
    }
  }
}
