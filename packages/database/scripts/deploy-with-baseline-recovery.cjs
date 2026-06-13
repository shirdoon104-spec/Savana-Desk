const { spawnSync } = require("node:child_process");

const baselineMigration = "20260603000000_baseline_current_schema";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result;
}

function isKnownBaselineFailure(output) {
  return (
    output.includes(baselineMigration) &&
    (output.includes("P3009") ||
      output.includes("P3018") ||
      output.includes('type "ReservationStatus" already exists'))
  );
}

const deploy = run("prisma", ["migrate", "deploy"]);

if (deploy.status === 0) {
  process.exit(0);
}

const deployOutput = `${deploy.stdout || ""}\n${deploy.stderr || ""}`;

if (!isKnownBaselineFailure(deployOutput)) {
  process.exit(deploy.status || 1);
}

console.warn(
  `Recovering Prisma baseline migration ${baselineMigration} before retrying deploy.`,
);

const resolve = run("prisma", [
  "migrate",
  "resolve",
  "--applied",
  baselineMigration,
]);

if (resolve.status !== 0) {
  process.exit(resolve.status || 1);
}

const retry = run("prisma", ["migrate", "deploy"]);
process.exit(retry.status || 0);
