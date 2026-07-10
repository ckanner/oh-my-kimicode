#!/usr/bin/env node

// src/components/teammode/scripts/team.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
function getTeamsDir() {
  return process.env.OMO_TEAMS_DIR ?? path.join(os.homedir(), ".omo", "teams");
}
function teamDir(sessionId) {
  return path.join(getTeamsDir(), sessionId);
}
function readTeam(sessionId) {
  const teamPath = path.join(teamDir(sessionId), "team.json");
  if (!fs.existsSync(teamPath)) return null;
  return JSON.parse(fs.readFileSync(teamPath, "utf-8"));
}
function writeTeam(sessionId, team) {
  const dir = teamDir(sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "team.json"), JSON.stringify(team, null, 2));
}
function init(sessionId) {
  const dir = teamDir(sessionId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "artifacts"), { recursive: true });
  writeTeam(sessionId, { members: [], createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  fs.writeFileSync(path.join(dir, "guide.md"), "# Team Guide\n", "utf-8");
  console.log(`Team initialized at ${dir}`);
}
function addMember(sessionId, focus, lens) {
  const team = readTeam(sessionId) ?? { members: [] };
  const member = {
    id: `member-${team.members.length + 1}`,
    focus: focus ?? "general",
    lens: lens ?? "implementation",
    joinedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  team.members.push(member);
  writeTeam(sessionId, team);
  console.log(`Added ${member.id}: focus=${member.focus}, lens=${member.lens}`);
}
function status(sessionId) {
  const team = readTeam(sessionId);
  if (!team) {
    console.log("Team not found");
    return;
  }
  console.log(JSON.stringify(team, null, 2));
}
function archive(sessionId) {
  const dir = teamDir(sessionId);
  if (!fs.existsSync(dir)) {
    console.log("Team not found");
    return;
  }
  const archiveDir = path.join(getTeamsDir(), "archive");
  fs.mkdirSync(archiveDir, { recursive: true });
  const target = path.join(archiveDir, `${sessionId}-${Date.now()}`);
  fs.renameSync(dir, target);
  console.log(`Team archived to ${target}`);
}
function deleteTeam(sessionId) {
  const dir = teamDir(sessionId);
  if (!fs.existsSync(dir)) {
    console.log("Team not found");
    return;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`Team ${sessionId} deleted`);
}
function main() {
  const [, , cmd, sessionId, ...rest] = process.argv;
  switch (cmd) {
    case "init":
      init(sessionId);
      break;
    case "add-member":
      addMember(sessionId, rest[0], rest[1]);
      break;
    case "status":
      status(sessionId);
      break;
    case "archive":
      archive(sessionId);
      break;
    case "delete":
      deleteTeam(sessionId);
      break;
    default:
      console.log(`Usage: team.ts {init|add-member|status|archive|delete} <sessionId> [focus] [lens]`);
      process.exit(1);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
export {
  addMember,
  archive,
  deleteTeam,
  getTeamsDir,
  init,
  status
};
