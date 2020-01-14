extern crate wasm_bindgen;

// use std::collections::HashMap;
use std::fmt::{self, Formatter, Display};
use std::ops::{Add, AddAssign, BitXor, BitXorAssign, Neg, Sub, SubAssign};
use web_sys::console;
use wasm_bindgen::prelude::*;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[derive(Copy, Clone)]
#[derive(Debug)]
#[derive(PartialEq)]
struct Interval(f32, f32);

impl Display for Interval {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        // `f` is a buffer, and this method must write the formatted string into it
        // `write!` is like `format!`, but it will write the formatted string
        // into a buffer (the first argument)
        write!(f, "[{}, {}]", self.0, self.1)
    }
}

// [l_1, u_1] + [l_2, u_2] = [l_1 + l_2, u_1 + u_2]
impl Add for Interval {
    type Output = Interval;

    fn add(self, other: Interval) -> Interval {
        Interval(self.0 + other.0, self.1 + other.1)
    }
}

// [l_1, u_1] += [l_2, u_2] == [l_1 + l_2, u_1 + u_2]
impl AddAssign for Interval {
    fn add_assign(&mut self, other: Interval) {
        *self = Interval(self.0 + other.0, self.1 + other.1)
    }
}

// -[l_1, u_1] = [-u_1, -l_1]
impl Neg for Interval {
    type Output = Interval;

    fn neg(self) -> Interval {
        Interval(-self.1, -self.0)
    }
}

// [l_1, u_1] - [l_2, u_2] = [l_1, u_1] + [-u_2, -l_2] = [l_1 - u_2, u_1 - l_2]
impl Sub for Interval {
    type Output = Interval;

    fn sub(self, other: Interval) -> Interval {
        self + -other
    }
}

// [l_1, u_1] -= [l_2, u_2] = [l_1, u_1] + [-u_2, -l_2] = [l_1 - u_2, u_1 - l_2]
impl SubAssign for Interval {
    fn sub_assign(&mut self, other: Interval) {
        *self = *self + -other
    }
}

// l_1, u_1] ^ [l_2, u_2] = [\max(l_1, l_2), \min(u_1, u_2)]
// Union is not a BitXor operation, but I want to use the ^ operator anyway
impl BitXor for Interval {
    type Output = Interval;

    fn bitxor(self, other: Interval) -> Interval {
        Interval(self.0.max(other.0), self.1.min(other.1))
    }
}

// l_1, u_1] ^= [l_2, u_2] == [\max(l_1, l_2), \min(u_1, u_2)]
// Union is not a BitXor operation, but I want to use the ^= operator anyway
impl BitXorAssign for Interval {
    fn bitxor_assign(&mut self, other: Interval) {
        *self = Interval(self.0.max(other.0), self.1.min(other.1))
    }
}

// pub struct STN {
//     activities: HashMap<&Path, Interval>
// }

// #[wasm_bindgen]
// impl STN {
//     pub fn create_activity(&mut self) {
//         //
//     }

//     pub fn query(&mut self, from: Activity, to: Activity) -> Interval {
//         //
//     }
// }


#[wasm_bindgen]
pub fn run() -> Result<(), JsValue> {
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();

    console::log_1(&JsValue::from_str("Initialized STN library"));

    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interval_add() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval
        }

        let cases = vec![
            Case {
                in1: Interval(1_f32, 1_f32),
                in2: Interval(2_f32, 2_f32),
                out: Interval(3_f32, 3_f32)
            },
            Case {
                in1: Interval(0_f32, 0_f32),
                in2: Interval(2_f32, 2_f32),
                out: Interval(2_f32, 2_f32)
            },
            Case {
                in1: Interval(1.5_f32, 1.5_f32),
                in2: Interval(2_f32, 2_f32),
                out: Interval(3.5_f32, 3.5_f32)
            },
        ];

        for case in cases.iter() {
            let res = case.in1 + case.in2;

            assert_eq!(case.out, res, "{} + {} == {}", case.in1, case.in2, case.out);
        }
    }

    #[test]
    fn test_interval_add_assign() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval
        }

        let mut cases = vec![
            Case {
                in1: Interval(1_f32, 1_f32),
                in2: Interval(2_f32, 2_f32),
                out: Interval(3_f32, 3_f32)
            },
            Case {
                in1: Interval(0_f32, 0_f32),
                in2: Interval(2_f32, 2_f32),
                out: Interval(2_f32, 2_f32)
            },
            Case {
                in1: Interval(1.5_f32, 1.5_f32),
                in2: Interval(2_f32, 2_f32),
                out: Interval(3.5_f32, 3.5_f32)
            },
        ];

        for case in cases.iter_mut() {
            case.in1 += case.in2;

            assert_eq!(case.out, case.in1, "{} += {} == {}", case.in1, case.in2, case.out);
        }
    }

    #[test]
    fn test_interval_sub() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval
        }

        let cases = vec![
            Case {
                in1: Interval(2_f32, 2_f32),
                in2: Interval(1_f32, 1_f32),
                out: Interval(1_f32, 1_f32)
            },
            Case {
                in1: Interval(2_f32, 2_f32),
                in2: Interval(2_f32, 2_f32),
                out: Interval(0_f32, 0_f32),
            },
            Case {
                in1: Interval(2_f32, 2_f32),
                in2: Interval(1.5_f32, 1.5_f32),
                out: Interval(0.5_f32, 0.5_f32)
            },
        ];

        for case in cases.iter() {
            let res = case.in1 - case.in2;

            assert_eq!(case.out, res, "{} - {} == {}", case.in1, case.in2, case.out);
        }
    }

    #[test]
    fn test_interval_sub_assign() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval
        }

        let mut cases = vec![
            Case {
                in1: Interval(2_f32, 2_f32),
                in2: Interval(1_f32, 1_f32),
                out: Interval(1_f32, 1_f32)
            },
            Case {
                in1: Interval(2_f32, 2_f32),
                in2: Interval(2_f32, 2_f32),
                out: Interval(0_f32, 0_f32),
            },
            Case {
                in1: Interval(2_f32, 2_f32),
                in2: Interval(1.5_f32, 1.5_f32),
                out: Interval(0.5_f32, 0.5_f32)
            },
        ];

        for case in cases.iter_mut() {
            case.in1 -= case.in2;

            assert_eq!(case.out, case.in1, "{} -= {} == {}", case.in1, case.in2, case.out);
        }
    }

    #[test]
    fn test_interval_union() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval
        }

        let cases = vec![
            Case {
                in1: Interval(1_f32, 3_f32),
                in2: Interval(2_f32, 4_f32),
                out: Interval(2_f32, 3_f32)
            },
            Case {
                in1: Interval(0_f32, 10.1_f32),
                in2: Interval(1_f32, 12_f32),
                out: Interval(1_f32, 10.1_f32),
            },
        ];

        for case in cases.iter() {
            let res = case.in1 ^ case.in2;

            assert_eq!(case.out, res, "{} ^ {} == {}", case.in1, case.in2, case.out);
        }
    }

    #[test]
    fn test_interval_union_assign() {
        struct Case {
            in1: Interval,
            in2: Interval,
            out: Interval
        }

        let mut cases = vec![
            Case {
                in1: Interval(1_f32, 3_f32),
                in2: Interval(2_f32, 4_f32),
                out: Interval(2_f32, 3_f32)
            },
            Case {
                in1: Interval(0_f32, 10.1_f32),
                in2: Interval(1_f32, 12_f32),
                out: Interval(1_f32, 10.1_f32),
            },
        ];

        for case in cases.iter_mut() {
            case.in1 ^= case.in2;

            assert_eq!(case.out, case.in1, "{} ^= {} == {}", case.in1, case.in2, case.out);
        }
    }
}
