import { inspect } from "node:util";

class MatchError extends Error {}

export type MatchArm = {
  conditions: any[],
  // eslint-disable-next-line @typescript-eslint/ban-types
  fn: Function, // the runnable function should take the values checked in the conditions, in order
};

interface MatchInit {
  data: MatchableItem,
  options?: MatchOptions,
  append_data?: (this: MatchObj, data: MatchableItem) => MatchObj,
  set_data?: (this: MatchObj, data: MatchableItem) => MatchObj,
  set_match_arms?: (this: MatchObj, match_expressions: MatchArm[] | unknown[][]) => MatchObj,
  set_match_on?: (this: MatchObj, criteria: string[]) => MatchObj,
  match?: (this: MatchObj, { match_on, match_expressions }?: MatchArgument) => unknown,
}

interface MatchObj {
    data: MatchableItem,
    append_data: (this: MatchObj, data: MatchableItem) => MatchObj,
    set_data: (this: MatchObj, data: MatchableItem) => MatchObj,
    set_match_arms: (this: MatchObj, match_expressions: MatchArm[] | unknown[][]) => MatchObj,
    set_match_on: (this: MatchObj, criteria: string | string[] | MatchableItem) => MatchObj,
    match: (this: MatchObj, { match_on, match_expressions }?: MatchArgument) => unknown,
    match_arms?: MatchArm[],
    match_on?: string[],
    options: MatchOptions,
}

export const ANY = { value: "any", type: "match_override" };

// not an enum so the js interop is better
export type MatchableOverride = { value: string, type: string };

// no arrays, single values only, no object recursion
export type MatchableValue = any;

export type MatchableItem = Record<string | number | symbol, MatchableValue>;

export type MatchArgument = {
  match_on?: string[] | string | MatchableItem, 
  match_expressions?: MatchArm[] | unknown[][],
};

export type MatchOptions = {
  prioritization_mode: "ORDER" | "EXACT_MATCH",
  match_mode: "TYPE_CHECK" | "TYPE_COERCED" | "TRUTHY",
}

/* call it like match(["value", "length"], {
    [(23, 55), () => "hello"],
    [(match_plus.ANY, match_plus.ANY), () => "goodbye"]
})
*/
export function match(this: MatchObj, { match_on, match_expressions }: MatchArgument = {}): unknown {
  if (match_on !== undefined) {
    this.set_match_on(match_on);
  }
  const props = this.match_on;
  if (props === undefined) {
    throw new MatchError("properties must be set to MatchObj when not provided");
  }
  const value_list: MatchableValue[] = [];
  if (match_expressions === undefined && this.match_arms === undefined) {
    throw new MatchError("match arms must be set to MatchObj when not provided");
  }
  if (match_expressions !== undefined) {
    // console.log("got here with ", match_expressions);
    this.set_match_arms(match_expressions);
  }
  const match_arms = this.match_arms as MatchArm[];

  for (const prop of props) {
    const value = this.data[prop];
    if (typeof value === "undefined") {
      throw new MatchError("cannot match with non-existent property " + prop);
    }
    value_list.push(value as MatchableValue);
  }
  let valid_arm;
  let valid_arm_anti_sharpness = 999999999;
  for (const arm of match_arms) {
    let matched = true;
    let anti_sharpness = 0; // a measurement of how inexact the search was - will take most exact arm over any less exact arms
    for (const [index, value] of value_list.entries()) {
      const arm_value = arm.conditions[index];
      const is_overridable = typeof arm_value === "object" && arm_value !== null && "value" in arm_value && "type" in arm_value;
      const is_any_match = is_overridable && arm_value.value === "any" && arm_value.type === "match_override";
      if (is_any_match) {
        anti_sharpness += 1;
        continue;
      }
      switch(this.options.match_mode) {
      case "TYPE_CHECK": {

        break;
      }
      }
      
      if (value !== arm_value && !is_any_match) {
        // console.log(value, arm_value, arm);
        matched = false;
        break;
      }
    }
    if (matched && valid_arm_anti_sharpness > anti_sharpness) {
      valid_arm = arm;
      valid_arm_anti_sharpness = anti_sharpness;
      if (valid_arm_anti_sharpness === 0 || this.options.prioritization_mode === "ORDER") {
        break;
      }
    }
  }
  if (!valid_arm) {
    throw new MatchError("no matching arm determined");
  }

  return valid_arm.fn(...value_list);
}

function append_data(this: MatchObj, data: MatchableItem): MatchObj {
  this.data = { ...this.data, ...data };
  return this;
}

function set_data(this: MatchObj, data: MatchableItem): MatchObj {
  this.data = { ...data };
  return this;
}

function set_match_arms(this: MatchObj, match_arms: unknown[][] | MatchArm[]): MatchObj {
  const is_arms = match_arms.length > 0 && 
    "conditions" in match_arms[0] && Array.isArray(match_arms[0].conditions) &&
    "fn" in match_arms[0] && typeof match_arms[0].fn === "function";
  if (this.match_on !== undefined) {
    for (const arm of match_arms) {
      if (!is_arms && (!Array.isArray(arm) || arm.length !== this.match_on.length + 1)) {
        throw new MatchError("invalid match arms conditions for given criteria, try resetting criteria first");
      } else if (is_arms && (arm as MatchArm).conditions?.length !== this.match_on.length) {
        throw new MatchError("invalid match arms conditions for given criteria, try resetting criteria first");
      }
      if (!is_arms && typeof (arm as unknown[])[this.match_on.length] !== "function") {
        throw new MatchError("invalid match arms, no function found at end of arm");
      } else if (is_arms && typeof (arm as MatchArm).fn !== "function") {
        throw new MatchError("invalid match arms, no function found at end of arm");
      }
    }
  }

  if (is_arms) {
    this.match_arms = match_arms as MatchArm[];
  } else {
    const gen_arms: MatchArm[] = []; 
    for (const arm of match_arms) {
      gen_arms.push({
        conditions: (arm as any[]).slice(0, -1),
        // eslint-disable-next-line @typescript-eslint/ban-types
        fn: (arm as any[]).slice(-1)[0] as Function,
      });
    }
    this.match_arms = gen_arms;
  }

  return this;
}

function set_match_on(this: MatchObj, criteria: string[] | string | MatchableItem): MatchObj {
  const props = typeof criteria === "string" ? [criteria] :
    Array.isArray(criteria) ? criteria :
  Object.keys(criteria) as string[];
  this.match_on = props;
  return this;
}

export function generate(obj: MatchableItem): MatchObj {
  const match_obj: MatchInit = {
    data: { ...obj },
  };
  match_obj.options = {
    prioritization_mode: "ORDER",
    match_mode: "TYPE_CHECK",
  };
  match_obj.match = match.bind(match_obj as MatchObj);
  match_obj.append_data = append_data.bind(match_obj as MatchObj);
  match_obj.set_data = set_data.bind(match_obj as MatchObj);
  match_obj.set_match_arms = set_match_arms.bind(match_obj as MatchObj);
  match_obj.set_match_on = set_match_on.bind(match_obj as MatchObj);
  return match_obj as MatchObj;
}
