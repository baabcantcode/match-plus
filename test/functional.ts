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
      conditions: [1532, false],
      fn: (id: number) => "found new one with updated id " + id,
    },
  ]);
  console.log(matcher.data, matcher.match_arms);
  result = matcher.match();
  t.is(
    result,
    "found new one with updated id 1532",
    "will NOT match none found first (despite it being earlier in the match arms) since that is a less exact match"
  );
});
