import {
  applyStatusTransition,
  canTransition,
} from "../src/lib/posts/transitions";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(canTransition("idea", "drafting"), "idea→drafting");
assert(!canTransition("posted", "ready"), "posted↛ready");
assert(
  applyStatusTransition({ from: "ready", to: "scheduled" }).ok === false,
  "scheduled needs date"
);
assert(
  applyStatusTransition({
    from: "ready",
    to: "scheduled",
    scheduledFor: new Date(),
  }).ok === true,
  "scheduled with date"
);
const unsch = applyStatusTransition({
  from: "scheduled",
  to: "ready",
  scheduledFor: new Date(),
});
assert(unsch.ok && unsch.scheduledFor === null, "clear date on unschedule");
const posted = applyStatusTransition({ from: "ready", to: "posted" });
assert(posted.ok && posted.postedAt != null, "posted sets postedAt");

console.log("transitions: all assertions passed");
