import test from "ava";
import { generate, ANY, MatchableItem, MatchArm } from "../src/index.js";

test("can create match", (t) => {
  const data: MatchableItem = {
    item1: "animal",
    object: {
      help: "get help here",
    },
    is_complete: false,
    id: 252288,
  };
  const matcher = generate(data);
  // not advised to use like this, mixing of array and obj arguments to match fn
  let result = matcher.match({
    match_on: { item1: 1, id: 1 },
    match_expressions: [
      ["animal", 252, () => "found too low"],
      ["animal", 252288, () => "found exact"],
      [ANY, ANY, () => "none found"],
    ],
  });
  t.is(result, "found exact", "should use exact match before default");
  result = matcher.match({
    match_expressions: [
      ["animal", 252, () => "found low"],
      ["animal", "252288", () => "cant find, incompatible type"],
      [
        ANY,
        ANY,
        (item1: string, id: number) => `none found with ${item1} and ${id}`,
      ],
    ],
  });
  t.is(
    result,
    "none found with animal and 252288",
    "should be able to use previous property set"
  );
});

test("setters work", (t) => {
  const data: MatchableItem = {
    item1: "animal",
    object: {
      help: "get help here",
    },
    is_complete: false,
    id: 252288,
  };
  const matcher = generate(data);
  matcher.set_match_arms([
    ["252288", () => "found low"],
    [252288, () => "found exact"],
    [ANY, () => "none found"],
  ]);
  matcher.set_match_on("id");
  // not advised to use like this, mixing of array and obj arguments to match fn
  let result = matcher.match();
  t.is(result, "found exact", "should use exact match before default");
  matcher.append_data({ id: "252288" });
  matcher.set_match_on(["id", "is_complete"]);
  matcher.set_match_arms([
    { conditions: ["252288", false], fn: () => "found low" },
    { conditions: [252288, false], fn: () => "found exact" },
    { conditions: [ANY, ANY], fn: () => "none found" },
  ]);
  result = matcher.match();
  t.is(
    result,
    "found low",
    "should now use the updated id and swap to match on the first arm"
  );
  result = matcher.match();
  t.is(result, "found low", "should be consistent result");
  matcher.set_data({ id: 1532, is_complete: false });
  matcher.set_match_arms([
    ...(matcher.match_arms as MatchArm[]),
    {
      conditions: ["1532", false],
      fn: (id: number) => "found new one with updated string coerced id " + id,
    },
    {
      conditions: [1532, false],
      fn: (id: number) => "found new one with updated id " + id,
    },
  ]);
  console.log(matcher.data, matcher.match_arms);
  matcher.set_options({
    match_mode: "TYPE_COERCED",
    prioritization_mode: "EXACT_MATCH"
  });
  result = matcher.match();
  t.is(
    result,
    "found new one with updated string coerced id 1532",
    "will NOT match none found first (despite it being earlier in the match arms) since that is a less exact match"
  );
  matcher.set_options({
    match_mode: "TYPE_COERCED",
    prioritization_mode: "ORDER"
  });
  result = matcher.match();
  t.is(
    result,
    "none found",
    "will match none found first since its earlier in the match arms"
  );
  matcher.set_options({
    match_mode: "TYPE_CHECK",
    prioritization_mode: "EXACT_MATCH"
  });
  result = matcher.match();
  t.is(
    result,
    "found new one with updated id 1532",
    "does type checking so now goes down to the one with a number"
  );
  matcher.set_options({
    match_mode: "TRUTHY",
    prioritization_mode: "EXACT_MATCH"
  });
  result = matcher.match();
  t.is(
    result,
    "found low",
    "anything that evaluates to correct boolean would match now"
  );
});

test("is data update / reuse friendly", function (t) {
  const data: MatchableItem = {
    item1: "animal",
    object: {
      help: "get help here",
    },
    is_complete: false,
    id: 252288,
  };
  const g = generate(data, { call_fn_args: "FULL_DATA"});
  g.set_match_on({ is_complete: true, id: true });
  g.set_match_arms([
    [false, 2522, ({ item1 }: {item1: string}) => `my ${item1} needs to go to work`],
    [true, 252288, ({ item1 }: {item1: string}) => `my ${item1} needs to go stay at home`],
    [false, 252288, ({ item1 }: {item1: string}) => `my ${item1} should just chill out today`],
    [ANY, ANY, ({ object }: {object: { help: string }}) => `i think i need to ${object.help}`]
  ]);
  t.is(g.match(), "my animal should just chill out today", "returns full object so we can access item1 data instead of the matching criteria data");
  g.set_data({
    ...data,
    id: 2250
  });
  t.is(g.match(), "i think i need to get help here");
  data.id = 2522;
  t.is(g.match(), "i think i need to get help here", "the matcher uses a shallow copy so this should still match the any clause");
});

test("usable over arrays and with non-object data", function (t) {
  const data_array = [510, 2520, 3259, 52, 250, 99];
  const g = generate(data_array[0], { call_fn_args: "FULL_DATA", /*criteria_type: "FULL_DATA"*/ }); // will auto set criteria type due to datatype
  g.set_match_on(["this", "just", "wont", "be", "set"]); // this will be ignored since data type is not object
  g.set_match_arms([
    [250, ({ item1 }: {item1: string}) => `my ${item1} needs to go to work`], // this one works despite it being a number, linting wont do anything
    [99, (d: number) => `my ${d} needs to go stay at home`],
    [510, (d: string) => `my ${typeof d} should just chill out today`], // this wont be a string and will print `my number should just chill out today`
    [ANY, ({ object }: {object: any }) => `i think i need to ${object?.hi}`] // would need to use optionals in general
  ]);
  const match_array = [
    "my number should just chill out today",
    "i think i need to undefined",
    "i think i need to undefined",
    "i think i need to undefined",
    "my undefined needs to go to work",
    "my 99 needs to go stay at home"
  ];
  for (const [index, data] of data_array.entries()) {
    g.set_data(data);
    t.is(g.match(), match_array[index]);
  }
});
