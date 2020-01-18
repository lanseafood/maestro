use petgraph::graph::NodeIndex;
use petgraph::Graph;
use std::collections::HashMap;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

mod interval;
pub use interval::Interval;

/// Default uncertainty for the edge between two nodes if the interval is not given
fn default_execution_uncertainty() -> f64 {
  0.1
}

// fn print_constraint_table(ct: &HashMap<(i32, i32), f64>) {
//   // TOOD
// }

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
  edges: Vec<Edge>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct Edge {
  source: i32,
  target: i32,
  #[serde(default)]
  interval: Interval,
  minutes: f64,
}

#[wasm_bindgen]
#[derive(Debug)]
pub struct STN {
  /// maps id to Node in Graph
  node_indices: HashMap<i32, NodeIndex>,
  distance_graph: Graph<i32, f64>,
  /// use ids to key the (column, row) of the constraint table
  constraint_table: HashMap<(i32, i32), f64>,
  elapsed_time: f64,
}

/// Build the distance graph. Returns (#nodes, #edges) tuple
fn build_distance_graph(
  stn: &mut STN,
  data: &RegistrationPayload,
  options: &RegistrationOptions,
) -> Result<(usize, usize), String> {
  // create nodes first from the edges
  let mut nodes: Vec<i32> = data
    .edges
    .iter()
    .flat_map(|e| vec![e.source, e.target])
    .collect();
  nodes.sort_unstable();
  nodes.dedup();

  for node in nodes.iter() {
    let node_index = stn.distance_graph.add_node(*node);
    stn.node_indices.insert(*node, node_index);
    // edge from any node to itself needs to be 0
    stn.distance_graph.add_edge(node_index, node_index, 0.);
  }

  // now set the edges with weights
  for edge in data.edges.iter() {
    // panic if one of the nodes can't be found
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

    // incoming negative lower interval
    stn.distance_graph.update_edge(*target, *source, -lower);

    // outgoing upper interval
    stn.distance_graph.update_edge(*source, *target, upper);
  }

  Ok((
    stn.distance_graph.node_count(),
    stn.distance_graph.edge_count(),
  ))
}

/// Perform All Pairs Shortest Paths algorithm and generate the constraint table
fn perform_apsp(stn: &mut STN) -> Result<(), String> {
  // FYI, we don't need to init. distances from a node to a node (i, i) to 0 because we already set (i, i) edge weights to 0 when we created the graph. The 0s will be added in the loop below

  // add known distances to the table
  for (i, i_node) in stn.node_indices.iter() {
    for (j, j_node) in stn.node_indices.iter() {
      // get the edge index if it exists. if not, this isn't a known distance
      let edge_index = match stn.distance_graph.find_edge(*i_node, *j_node) {
        Some(e) => e,
        None => continue,
      };

      let distance = match stn.distance_graph.edge_weight(edge_index) {
        Some(d) => d,
        None => return Err(format!("missing edge weight: [{}, {}]", i, j)),
      };

      // constraint_table is in (from row, to column) format
      let position = (*i, *j);
      stn.constraint_table.insert(position, *distance);
    }
  }

  let iter = 1_i32..stn.node_indices.len() as i32 + 1;

  // iterate over intermediates
  for k in iter.clone() {
    // i is the row in the constraint table
    for i in iter.clone() {
      // j is the column in the constraint table
      for j in iter.clone() {
        // constraint_table is in (from row, to column) format
        let position = (i, j);
        let d_ik = match stn.constraint_table.get(&(i, k)) {
          Some(d) => d,
          None => &std::f64::MAX,
        };
        let d_kj = match stn.constraint_table.get(&(k, j)) {
          Some(d) => d,
          None => &std::f64::MAX,
        };

        let d_current = {
          match stn.constraint_table.get(&position) {
            Some(d) => d,
            None => &std::f64::MAX,
          }
        };

        let d_new = d_current.min(*d_ik + *d_kj);

        if i == j && d_new < 0. {
          let error_message = format!(
            "negative cycle found on node ID {}: {} + {} = {}",
            i, d_ik, d_kj, d_new
          );
          return Err(error_message);
        }

        stn.constraint_table.insert(position, d_new);
      }
    }
  }

  Ok(())
}

/// (node count, edge count) tuple struct
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

  /// Register task data as a distance graph. Returns (node count, edge count) tuple. Note that an edge with weight 0 will be created for every node to itself
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
    match perform_apsp(self) {
      Ok(()) => return Ok(()),
      Err(e) => return Err(JsValue::from_str(&e)),
    };
  }
}

#[cfg(test)]
mod tests {
  extern crate wasm_bindgen_test;
  use super::*;
  use serde_json::json;
  use wasm_bindgen_test::*;

  #[test]
  fn test_build_distance_graph_empty_input() -> Result<(), String> {
    let payload = RegistrationPayload { edges: vec![] };
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
    let edges = vec![
      Edge {
        source: 1,
        target: 2,
        interval: Interval::new(10., 20.),
        minutes: 0.,
      },
      Edge {
        source: 2,
        target: 3,
        interval: Interval::new(30., 40.),
        minutes: 0.,
      },
      Edge {
        source: 4,
        target: 3,
        interval: Interval::new(10., 20.),
        minutes: 0.,
      },
      Edge {
        source: 4,
        target: 5,
        interval: Interval::new(40., 50.),
        minutes: 0.,
      },
      Edge {
        source: 1,
        target: 5,
        interval: Interval::new(60., 70.),
        minutes: 0.,
      },
    ];

    let data = RegistrationPayload { edges: edges };

    let options = RegistrationOptions {
      implicit_intervals: false,
      execution_uncertainty: 0.,
    };

    let mut stn = STN::new();
    let (nodes_created, edges_created) = build_distance_graph(&mut stn, &data, &options)?;

    // just check that the graph was built
    assert_eq!(5_usize, nodes_created, "correct number of nodes created");
    assert_eq!(15_usize, edges_created, "correct number of edges created");

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
  #[test]
  fn test_build_distance_graph_implicit_intervals() -> Result<(), String> {
    // define the graph from the walkthrough
    let edges = vec![
      Edge {
        source: 1,
        target: 2,
        interval: Interval::default(),
        minutes: 10.,
      },
      Edge {
        source: 2,
        target: 3,
        interval: Interval::default(),
        minutes: 20.,
      },
      Edge {
        source: 4,
        target: 3,
        interval: Interval::default(),
        minutes: 30.,
      },
      Edge {
        source: 4,
        target: 5,
        interval: Interval::default(),
        minutes: 40.,
      },
      Edge {
        source: 1,
        target: 5,
        interval: Interval::default(),
        minutes: 50.,
      },
    ];

    let data = RegistrationPayload { edges: edges };

    let options = RegistrationOptions {
      implicit_intervals: true,
      execution_uncertainty: 0.1,
    };

    let mut stn = STN::new();
    let (nodes_created, edges_created) = build_distance_graph(&mut stn, &data, &options)?;

    // just check that the graph was built
    assert_eq!(5_usize, nodes_created, "correct number of nodes created");
    assert_eq!(15_usize, edges_created, "correct number of edges created");

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
        interval: Interval::new(9., 11.),
      },
      Case {
        from: 2,
        to: 3,
        interval: Interval::new(18., 22.),
      },
      Case {
        from: 4,
        to: 3,
        interval: Interval::new(27., 33.),
      },
      Case {
        from: 4,
        to: 5,
        interval: Interval::new(36., 44.),
      },
      Case {
        from: 1,
        to: 5,
        interval: Interval::new(45., 55.),
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

    // make sure (i, i) weights are 0
    for i in 1..6 {
      let node_index = {
        match stn.node_indices.get(&i) {
          Some(n) => n,
          None => panic!("could not find index {}", i),
        }
      };
      let edge = {
        match stn.distance_graph.find_edge(*node_index, *node_index) {
          Some(edge) => edge,
          None => panic!("could not find edge indices ({} - {})", i, i),
        }
      };
      let weight = {
        match stn.distance_graph.edge_weight(edge) {
          Some(w) => w,
          None => panic!("could not find weight between indices ({} - {})", i, i),
        }
      };
      assert_eq!(0., *weight, "({} - {}) = 0 got {}", i, i, *weight);
    }

    Ok(())
  }

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
        (2_usize, 4_usize),
        (u.0, u.1),
        "Two nodes, 4 edges expected to be made"
      ),
      Err(e) => panic!("failed running stn.register_graph | {:?}", e),
    }
  }

  #[test]
  fn test_perform_apsp_against_walkthrough_data() -> Result<(), String> {
    // define the graph from the walkthrough
    let edges = vec![
      Edge {
        source: 1,
        target: 2,
        interval: Interval::new(10., 20.),
        minutes: 0.,
      },
      Edge {
        source: 2,
        target: 3,
        interval: Interval::new(30., 40.),
        minutes: 0.,
      },
      Edge {
        source: 4,
        target: 3,
        interval: Interval::new(10., 20.),
        minutes: 0.,
      },
      Edge {
        source: 4,
        target: 5,
        interval: Interval::new(40., 50.),
        minutes: 0.,
      },
      Edge {
        source: 1,
        target: 5,
        interval: Interval::new(60., 70.),
        minutes: 0.,
      },
    ];

    let data = RegistrationPayload { edges: edges };

    let options = RegistrationOptions {
      implicit_intervals: false,
      execution_uncertainty: 0.,
    };

    let mut stn = STN::new();
    build_distance_graph(&mut stn, &data, &options)?;
    perform_apsp(&mut stn)?;

    // full STN with implicit constraints from the walkthrough example
    // ((from, to), distance)
    let expected_constraint_table: HashMap<(i32, i32), f64> = [
      ((1, 1), 0.),
      ((1, 2), 20.),
      ((1, 3), 50.),
      ((1, 4), 30.),
      ((1, 5), 70.),
      ((2, 1), -10.),
      ((2, 2), 0.),
      ((2, 3), 40.),
      ((2, 4), 20.),
      ((2, 5), 60.),
      ((3, 1), -40.),
      ((3, 2), -30.),
      ((3, 3), 0.),
      ((3, 4), -10.),
      ((3, 5), 30.),
      ((4, 1), -20.),
      ((4, 2), -10.),
      ((4, 3), 20.),
      ((4, 4), 0.),
      ((4, 5), 50.),
      ((5, 1), -60.),
      ((5, 2), -50.),
      ((5, 3), -20.),
      ((5, 4), -40.),
      ((5, 5), 0.),
    ]
    .iter()
    .cloned()
    .collect();

    assert_eq!(
      expected_constraint_table.len(),
      stn.constraint_table.len(),
      "constraint tables are the same size"
    );

    for (i, dist) in expected_constraint_table.iter() {
      assert_eq!(
        *dist, stn.constraint_table[i],
        "{:?} want {}, got {}",
        i, *dist, stn.constraint_table[i],
      )
    }

    Ok(())
  }
}
