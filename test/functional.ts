import test from "ava";
import { generate, ANY, MatchableItem } from "../src/index.js";


test("can create match", (t) => {
  const data: MatchableItem = {
    item1: "animal",
    // object: {
    //   help: "get help here"
    // },
    is_complete: false,
    id: 252288
  };
  let matcher = generate(data);
  // not advised to use like this, mixing of array and obj arguments to match fn
  let result = matcher.match({item1: 1, id: 1}, [
    ["animal", 252, () => "found low"],
    ["animal", 252288, () => "found high"],
    [ANY, ANY, () => "none found"]
  ]);
  t.is(result, 'found high');
});
