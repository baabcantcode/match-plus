class MatchError extends Error {}

export type MatchArm = {
  conditions: any[],
  // eslint-disable-next-line @typescript-eslint/ban-types
  fn: Function, // the runnable function should take the values checked in the conditions, in order
};

interface MatchObj {
    data: MatchableItem,
    append_data: (this: MatchObj, data: MatchableItem) => MatchObj,
    set_data: (this: MatchObj, data: MatchableItem) => MatchObj,
    set_match_arms: (this: MatchObj, match_expressions: MatchArm[] | unknown[][]) => MatchObj,
    set_match_on: (this: MatchObj, criteria: string | string[] | MatchableItem) => MatchObj,
    set_options: (this: MatchObj, options: PartialOptions | MatchOptions) => MatchObj,
    match: (this: MatchObj, { match_on, match_expressions }?: MatchArgument) => unknown,
    match_arms?: MatchArm[],
    match_on?: string[],
    options: MatchOptions,
}

type PartialObj = Partial<MatchObj>;

export const ANY = { value: "any", type: "match_override" };

// not an enum so the js interop is better
export type MatchableOverride = { value: string, type: string };

// no arrays, single values only, no object recursion
export type MatchableValue = any;

export type MatchableItem = Record<string | number | symbol, MatchableValue> | string | number | bigint | Array<string | number | bigint>;

export type MatchArgument = {
  match_on?: string[] | string | MatchableItem, 
  match_expressions?: MatchArm[] | unknown[][],
};

export type MatchOptions = {
  prioritization_mode: "ORDER" | "EXACT_MATCH",
  match_mode: "TYPE_CHECK" | "TYPE_COERCED" | "TRUTHY",
  criteria_type: "PROPERTIES" | "FULL_DATA",
  call_fn_args: "USE_MATCH_ON" | "FULL_DATA",
};

type PartialOptions = Partial<MatchOptions>;

/* call it like match(["value", "length"], {
    [(23, 55), () => "hello"],
    [(match_plus.ANY, match_plus.ANY), () => "goodbye"]
})
*/
function match(this: MatchObj, { match_on, match_expressions }: MatchArgument = {}): unknown {
  if (match_on !== undefined) {
    this.set_match_on(match_on);
  }
  if (this.match_on === undefined) {
    throw new MatchError("matchable properties must be set to MatchObj when not provided in match fn");
  }
  const value_list: MatchableValue[] = [];
  if (match_expressions === undefined && this.match_arms === undefined) {
    throw new MatchError("match arms must be set to MatchObj when not provided in match fn");
  }
  if (match_expressions !== undefined) {
    this.set_match_arms(match_expressions);
  }
  const match_arms = this.match_arms as MatchArm[];

  switch (this.options.criteria_type) {
  case "PROPERTIES": {
    if (typeof this.data !== "object") {
      throw new MatchError("criteria type must be FULL_DATA when using a non-object data");
    }
    for (const prop of this.match_on) {
      if (Array.isArray(this.data)) {
        value_list.push(this.data[parseInt(prop)] as MatchableValue);
      } else {
        value_list.push(this.data[prop] as MatchableValue);
      }
    }
    break;
  }
  case "FULL_DATA": {
    value_list.push(this.data as MatchableValue);
    break;
  }
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
        matched = arm_value === value;
        break;
      }
      case "TRUTHY": {
        matched = !!arm_value === !!value;
        break;
      }
      case "TYPE_COERCED": {
        matched = arm_value == value;
        break;
      }
      }
      
      if (!matched) {
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
  if (this.options.call_fn_args === "USE_MATCH_ON") {
    return valid_arm.fn(...value_list);
  } else {
    let run_data;
    switch (typeof this.data) {
    case "number":
    case "string":
    case "bigint": {
      run_data = this.data;
      break;
    }
    case "object": {
      if (Array.isArray(this.data)) {
        run_data = [...this.data];
      } else if (typeof this.data === "object") { // stupid a.f. typescript linter
        run_data = { ...this.data };
      }
      break;
    }
    }
    return valid_arm.fn(run_data);
  }
}

function append_data(this: MatchObj, data: MatchableItem): MatchObj {
  if (typeof this.data !== typeof data || Array.isArray(this.data) !== Array.isArray(data)) {
    throw new MatchError("invalid type change when appending data");
  }
  switch (typeof data) {
  case "number":
  case "string":
  case "bigint": {
    this.data = data;
    break;
  }
  case "object": {
    if (Array.isArray(this.data) && Array.isArray(data)) {
      this.data = [ ...this.data, ...data];
    } else { 
      this.data = { ...(this.data as object), ...(data as object) }; // stupid a.f. typescript linter
    }
    break;
  }
  }
  return this;
}

function set_data(this: MatchObj, data: MatchableItem): MatchObj {
  switch (typeof data) {
  case "bigint":
  case "number":
  case "string": {
    this.options.criteria_type = "FULL_DATA";
    this.match_on = ["FULL_DATA"];
    this.data = data;
    break;
  }
  case "object": {
    if (Array.isArray(data)) {
      this.data = [ ...data];
    } else { 
      this.data = { ...(data as object) }; // stupid a.f. typescript linter
    }
    break;
  }
  }
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
  // match on shouldn't be changed when we're using the non-full criteria type
  if (["number", "bigint", "string"].includes(typeof this.data)) {
    return this;
  }
  const props = typeof criteria === "string" ? [criteria] :
    Array.isArray(criteria) ? criteria :
  Object.keys(criteria) as string[];
  this.match_on = props;
  this.options.criteria_type = "PROPERTIES";
  return this;
}

function set_options(this: MatchObj, options: PartialOptions | MatchOptions): MatchObj {
  this.options = {
    ...this.options,
    ...options
  };
  return this;
}

export function generate(obj: MatchableItem, options?: PartialOptions | MatchOptions): MatchObj {
  const match_obj: PartialObj & { options: Record<string, string> } = {
    options: {
      prioritization_mode: "ORDER",
      match_mode: "TYPE_CHECK",
      call_fn_args: "USE_MATCH_ON",
      criteria_type: "PROPERTIES",
    }
  };
  match_obj.match = match.bind(match_obj as MatchObj);
  match_obj.append_data = append_data.bind(match_obj as MatchObj);
  match_obj.set_data = set_data.bind(match_obj as MatchObj);
  match_obj.set_match_arms = set_match_arms.bind(match_obj as MatchObj);
  match_obj.set_match_on = set_match_on.bind(match_obj as MatchObj);
  match_obj.set_options = set_options.bind(match_obj as MatchObj);
  const full_match_obj = match_obj as MatchObj;
  if (options !== undefined) {
    full_match_obj.set_options(options);
  }
  full_match_obj.set_data(obj);
  return full_match_obj;
}

export function match_once(
  obj: MatchableItem, 
  match_on: string | string[], 
  match_arms: MatchArm[] | unknown[][], 
  options?: PartialOptions | MatchOptions
) {
  const matcher = generate(obj, options);
  matcher.set_match_on(match_on);
  matcher.set_match_arms(match_arms);
  return matcher.match();
}
