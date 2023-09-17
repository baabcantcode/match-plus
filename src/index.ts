import { inspect } from "node:util";

class MatchError extends Error {}

type MatchObj<T> = {
    object: T,
    match: (this: MatchableItem, properties: string[] | string, match_expressions: unknown[][]) => unknown,
}

export const ANY = { value: "any", type: "match_override" };

// not an enum so the js interop is better
export type MatchableOverride = { value: string, type: string };

// no arrays, single values only, no object recursion
export type MatchableValue = string | number | boolean;

export type MatchableItem = Record<string | number | symbol, MatchableValue>;

/* call it like match(["value", "length"], {
    [23, 55, () => "hello"],
    [match_plus.ANY, match_plus.ANY, () => "goodbye"]
})
*/
export function match(this: MatchableItem, properties: string[] | string, match_expressions: unknown[][]): unknown {
  const props = typeof properties === "string" ? [properties] : properties;
  const value_list: MatchableValue[] = [];
  for (const prop of props) {
    const value = this[prop];
    if (typeof value === "undefined") {
      throw new MatchError("cannot match with non-existent property " + prop);
    }
    if (!["string", "boolean", "symbol", "number"].includes(typeof value)) {
      throw new MatchError("invalid property type for " + prop + " with " + inspect(value));
    }
    value_list.push(value as MatchableValue);
  }
  for (const arm of match_expressions) {
    if (arm.length !== props.length + 1) {
      throw new MatchError("invalid arm to prop length, with arm: " + inspect(arm));
    }
  }
  let valid_arm;
  for (const arm of match_expressions) {
    let matched = true;
    for (const [index, value] of value_list.entries()) {
      const arm_value = arm[index];
      const is_overridable = typeof arm_value === "object" && arm_value !== null && "value" in arm_value && "type" in arm_value;
      if (value !== arm_value && !(is_overridable && arm_value.value === "any" && arm_value.type === "match_override")) {
        console.log(value, arm_value, arm);
        matched = false;
        break;
      }
    }
    if (matched) {
      valid_arm = arm;
      break;
    }
  }
  if (!valid_arm) {
    throw new MatchError("no matching arm determined");
  }
  const is_callable = typeof valid_arm === "object" &&
   valid_arm !== null &&
   props.length in valid_arm &&
   typeof valid_arm[props.length] === "function";
  if (!is_callable) {
    throw new MatchError("matched arm does not have a callable function");
  }
  // eslint-disable-next-line @typescript-eslint/ban-types
  valid_arm = valid_arm as Function[];
  
  return valid_arm[props.length](...value_list);
}

export function generate(obj: MatchableItem): MatchObj<MatchableItem> {
  return { 
    object: obj,
    match: match.bind(obj),
  };
}
