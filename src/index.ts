import { inspect } from "node:util";

class MatchError extends Error {}

interface MatchInit {
  object: MatchableItem,
  append_match_data?: (this: MatchObj, data: MatchableItem) => MatchObj,
  set_match_data?: (this: MatchObj, data: MatchableItem) => MatchObj,
  set_match_arms?: (this: MatchObj, match_expressions: unknown[][]) => MatchObj,
  match?: (this: MatchObj, properties: string[] | string | MatchableItem, match_expressions?: unknown[][]) => unknown,
}

interface MatchObj {
    object: MatchableItem,
    append_match_data: (this: MatchObj) => MatchObj,
    set_match_data: (this: MatchObj, data: MatchableItem) => MatchObj,
    set_match_arms: (this: MatchObj, match_expressions: unknown[][]) => MatchObj,
    match: (this: MatchObj, properties: string[] | string | MatchableItem, match_expressions?: unknown[][]) => unknown,
    match_arms?: unknown[][],
}

export const ANY = { value: "any", type: "match_override" };

// not an enum so the js interop is better
export type MatchableOverride = { value: string, type: string };

// no arrays, single values only, no object recursion
export type MatchableValue = string | number | boolean;

export type MatchableItem = Record<string | number | symbol, MatchableValue>;

/* call it like match(["value", "length"], {
    [(23, 55), () => "hello"],
    [(match_plus.ANY, match_plus.ANY), () => "goodbye"]
})
*/
export function match(this: MatchObj, properties: string[] | string | MatchableItem, match_expressions?: unknown[][]): unknown {
  const props = typeof properties === "string" ? [properties] :
    Array.isArray(properties) ? properties :
    Object.keys(properties) as string[];
  properties;
  const value_list: MatchableValue[] = [];
  if (match_expressions === undefined && this.match_arms === undefined) {
    throw new MatchError("match arms must be provided");
  }
  const match_arms = (match_expressions === undefined ? this.match_arms : match_expressions) as unknown[][];

  for (const prop of props) {
    const value = this.object[prop];
    if (typeof value === "undefined") {
      throw new MatchError("cannot match with non-existent property " + prop);
    }
    if (!["string", "boolean", "symbol", "number"].includes(typeof value)) {
      throw new MatchError("invalid property type for " + prop + " with " + inspect(value));
    }
    value_list.push(value as MatchableValue);
  }
  for (const arm of match_arms) {
    if (arm.length !== props.length + 1) {
      throw new MatchError("invalid arm to prop length, with arm: " + inspect(arm));
    }
  }
  let valid_arm;
  for (const arm of match_arms) {
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
  const valid_arm_fn = valid_arm[props.length] as Function;
  
  return valid_arm_fn(...value_list);
}

function append_match_data(this: MatchObj, data: MatchableItem): MatchObj {
  this.object = { ...this.object, ...data };
  return this;
}

function set_match_data(this: MatchObj, data: MatchableItem): MatchObj {
  this.object = { ...data };
  return this;
}

function set_match_arms(this: MatchObj, match_arms: unknown[][]): MatchObj {
  this.match_arms = match_arms;
  return this;
}

export function generate(obj: MatchableItem): MatchObj {
  const match_obj: MatchInit = {
    object: { ...obj },
  };
  match_obj.match = match.bind(match_obj as MatchObj);
  match_obj.append_match_data = append_match_data.bind(match_obj as MatchObj);
  match_obj.set_match_data = set_match_data.bind(match_obj as MatchObj);
  match_obj.set_match_arms = set_match_arms.bind(match_obj as MatchObj);
  return match_obj as MatchObj;
}
