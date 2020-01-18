use petgraph::graph::NodeIndex;
use petgraph::Graph;
use std::collections::HashMap;
use std::default::Default;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

mod interval;
pub use interval::Interval;

/// Default uncertainty for the edge between two nodes if the interval is not given
fn default_execution_uncertainty() -> f64 {
  0.1
}

#[wasm_bindgen]
#[derive(Debug, Default, Deserialize, Serialize)]
pub struct RegistrationOptions {
  /// Are distances in the form of [x, x] (keyed by edges[].minutes) instead of [lower, upper]? eg. set to true if edges are in the form of `{ "source": 1, "target": 2, "minutes": 5}`. Set to false if edges are in the form of `{ "source": 1, "target": 2, "interval": [4, 6] }`. Default false
  implicit_intervals: bool,
  /// How much uncertainty should be applied if interval definitions are implicit (see above). Value must be between 0 and 1 inclusive. Defaults to 0.1 (10%)
  #[serde(default = "default_execution_uncertainty")]
  execution_uncertainty: f64,
}

#[wasm_bindgen]
#[derive(Debug, Default, Deserialize, Serialize)]
pub struct RegistrationPayload {
  nodes: Vec<Activity>,
  edges: Vec<Edge>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct Edge {
  source: i32,
  target: i32,
  #[serde(default)]
  interval: Interval,
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

fn build_distance_graph(
  stn: &mut STN,
  data: &RegistrationPayload,
  options: &RegistrationOptions,
) -> Result<(usize, usize), String> {
  // TODO: we probably don't need nodes
  for node in data.nodes.iter() {
    // manually clone the activity
    let activity = node.clone();
    stn
      .node_indices
      .insert(node.id, stn.distance_graph.add_node(activity));
  }

  for edge in data.edges.iter() {
    // silently skip this edge if one of the nodes can't be found
    let source = match stn.node_indices.get(&edge.source) {
      Some(s) => s,
      None => return Err(format!("Could not find source node {}", edge.source)),
    };
    let target = match stn.node_indices.get(&edge.target) {
      Some(t) => t,
      None => return Err(format!("Could not find target node {}", edge.target)),
    };

    let mut lower = edge.interval.lower();
    let mut upper = edge.interval.upper();
    if options.implicit_intervals {
      // apply the uncertainty
      let error_estimate = edge.minutes * options.execution_uncertainty;
      lower = edge.minutes - error_estimate;
      upper = edge.minutes + error_estimate;
    }

    // outgoing upper interval
    stn.distance_graph.update_edge(*source, *target, upper);

    // incoming negative lower interval
    stn.distance_graph.update_edge(*target, *source, -lower);
  }

  Ok((
    stn.distance_graph.node_count(),
    stn.distance_graph.edge_count(),
  ))
}

#[wasm_bindgen]
pub struct RegistrationEnum(usize, usize);

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

  /// Register task data as a distance graph. Returns (node count, edge count) tuple
  #[wasm_bindgen(catch, method, js_name = registerGraph)]
  pub fn register_graph(
    &mut self,
    payload: &JsValue,
    options: &JsValue,
  ) -> Result<RegistrationEnum, JsValue> {
    let data: RegistrationPayload = payload.into_serde().unwrap();
    let options: RegistrationOptions = options.into_serde().unwrap();

    match build_distance_graph(self, &data, &options) {
      Ok(u) => return Ok(RegistrationEnum(u.0, u.1)),
      Err(e) => return Err(JsValue::from_str(&e)),
    };
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

  #[test]
  fn test_build_distance_graph() -> Result<(), String> {
    let payload = RegistrationPayload {
      nodes: vec![],
      edges: vec![],
    };
    let options = RegistrationOptions {
      implicit_intervals: true,
      execution_uncertainty: 0.,
    };

    let mut stn = STN::new();

    let res = build_distance_graph(&mut stn, &payload, &options)?;
    assert_eq!(
      (0_usize, 0_usize),
      res,
      "no nodes or edges should be created"
    );

    Ok(())
  }

  #[test]
  fn test_build_distance_graph_walkthrough_graph() -> Result<(), String> {
    // define the graph from the walkthrough
    let nodes = vec!["X_0", "Ls", "Le", "Ss", "Se"]
      .iter()
      .enumerate()
      .map(|(i, label)| Activity {
        id: (i + 1_usize) as i32,
        label: String::from(*label),
        bounds: Interval::default(),
      })
      .collect();

    let edges = vec![
      Edge {
        source: 1,
        target: 2,
        interval: Interval::new(10., 20.),
        minutes: 0.,
        action: String::from(""),
      },
      Edge {
        source: 2,
        target: 3,
        interval: Interval::new(30., 40.),
        minutes: 0.,
        action: String::from(""),
      },
      Edge {
        source: 4,
        target: 3,
        interval: Interval::new(10., 20.),
        minutes: 0.,
        action: String::from(""),
      },
      Edge {
        source: 4,
        target: 5,
        interval: Interval::new(40., 50.),
        minutes: 0.,
        action: String::from(""),
      },
      Edge {
        source: 1,
        target: 5,
        interval: Interval::new(60., 70.),
        minutes: 0.,
        action: String::from(""),
      },
    ];

    let data = RegistrationPayload {
      nodes: nodes,
      edges: edges,
    };

    let options = RegistrationOptions {
      implicit_intervals: false,
      execution_uncertainty: 0.,
    };

    let mut stn = STN::new();
    let (nodes_created, edges_created) = build_distance_graph(&mut stn, &data, &options)?;

    // just check that the graph was built
    assert_eq!(5_usize, nodes_created, "correct number of nodes created");
    assert_eq!(10_usize, edges_created, "correct number of edges created");

    // now make sure edge weights are correct
    struct Case {
      from: i32,
      to: i32,
      interval: Interval,
    }

    let cases = vec![
      Case {
        from: 1,
        to: 2,
        interval: Interval::new(10., 20.),
      },
      Case {
        from: 2,
        to: 3,
        interval: Interval::new(30., 40.),
      },
      Case {
        from: 4,
        to: 3,
        interval: Interval::new(10., 20.),
      },
      Case {
        from: 4,
        to: 5,
        interval: Interval::new(40., 50.),
      },
      Case {
        from: 1,
        to: 5,
        interval: Interval::new(60., 70.),
      },
    ];

    for c in cases.iter() {
      let from = {
        match stn.node_indices.get(&c.from) {
          Some(n) => n,
          None => panic!("could not find node index {}", c.from),
        }
      };
      let to = {
        match stn.node_indices.get(&c.to) {
          Some(n) => n,
          None => panic!("could not find index {}", c.to),
        }
      };
      let edge_to = {
        match stn.distance_graph.find_edge(*from, *to) {
          Some(edge) => edge,
          None => panic!("could not find edge indices ({} - {})", c.from, c.to),
        }
      };
      let weight_to = {
        match stn.distance_graph.edge_weight(edge_to) {
          Some(w) => w,
          None => panic!(
            "could not find weight between indices ({} - {})",
            c.from, c.to
          ),
        }
      };
      assert_eq!(
        c.interval.upper(),
        *weight_to,
        "({} - {}) = {}",
        c.from,
        c.to,
        c.interval.upper()
      );

      let edge_from = {
        match stn.distance_graph.find_edge(*to, *from) {
          Some(edge) => edge,
          None => panic!("could not find edge indices ({} - {})", c.from, c.to),
        }
      };
      let weight_from = {
        match stn.distance_graph.edge_weight(edge_from) {
          Some(w) => w,
          None => panic!(
            "could not find weight between indices ({} - {})",
            c.from, c.to
          ),
        }
      };
      assert_eq!(
        -c.interval.lower(),
        *weight_from,
        "({} - {}) = {}",
        c.to,
        c.from,
        -c.interval.lower()
      );
    }

    Ok(())
  }

  // TODO: test minute-style intervals

  #[wasm_bindgen_test]
  fn test_register_graph_converts_json_no_nodes() {
    let payload = {
      match JsValue::from_serde(&json!(
        {
          "nodes": [],
          "edges": [],
        }
      )) {
        Ok(p) => p,
        Err(e) => panic!("could not create payload | {:?}", e),
      }
    };

    let options = {
      match JsValue::from_serde(&json!(
        { "implicit_intervals": true }
      )) {
        Ok(p) => p,
        Err(e) => panic!("could not create payload | {:?}", e),
      }
    };

    let mut stn = STN::new();
    match stn.register_graph(&payload, &options) {
      Ok(u) => assert_eq!(
        (0_usize, 0_usize),
        (u.0, u.1),
        "No nodes or edges expected to be made"
      ),
      Err(e) => panic!("failed running stn.register_graph | {:?}", e),
    }
  }

  #[wasm_bindgen_test]
  fn test_register_graph_converts_json_two_nodes_two_edges() {
    let input = json!(
      {
        "nodes": [{"id": 0, "label": "X_0"}, {"id": 1, "label": "Ls"}],
        "edges": [{"minutes": 60, "source": 0, "target": 1}],
      }
    );

    let mut stn = STN::new();

    let payload = {
      match JsValue::from_serde(&input) {
        Ok(p) => p,
        Err(e) => panic!("could not create payload | {:?}", e),
      }
    };

    let options = {
      match JsValue::from_serde(&json!(
        { "implicit_intervals": true }
      )) {
        Ok(p) => p,
        Err(e) => panic!("could not create payload | {:?}", e),
      }
    };

    match stn.register_graph(&payload, &options) {
      Ok(u) => assert_eq!(
        (2_usize, 2_usize),
        (u.0, u.1),
        "Two nodes, two edges expected to be made"
      ),
      Err(e) => panic!("failed running stn.register_graph | {:?}", e),
    }
  }
}
