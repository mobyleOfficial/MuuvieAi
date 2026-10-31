#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFileSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";

const ROOT_DIR = process.cwd();

type ToolHandler = (args: Record<string, string>) => Promise<string>;

// Run a command with argv-array form (no shell). Avoids injection from
// any user-supplied argument that ends up in the command line.
function run(cmd: string, argv: string[]): string {
  return execFileSync(cmd, argv, {
    cwd: ROOT_DIR,
    encoding: "utf-8",
    stdio: "pipe",
  });
}

// The integration branch: `dev` in this ecosystem, with `develop` accepted
// for older clones. Matches .claude/verify-docs.sh.
function devBranch(): "dev" | "develop" {
  for (const ref of ["dev", "origin/dev"]) {
    try {
      run("git", ["rev-parse", "--verify", "--quiet", ref]);
      return "dev";
    } catch {
      // not this one
    }
  }
  return "develop";
}

// Switch to the integration branch and pull. Used by both feature- and
// release-branch creation so changes to the strategy land in one place.
function checkoutDevBaseAndPull(): void {
  run("git", ["checkout", devBranch()]);
  run("git", ["pull", "--ff-only"]);
}

// Submodule name allowlist — guards branch-name and path arguments that
// otherwise could be abused for git option/flag injection.
const SUBMODULES = new Set(["muuvie", "backend"]);
function assertSubmodule(name: string): void {
  if (!SUBMODULES.has(name)) {
    throw new Error(
      `Invalid submodule '${name}'. Allowed: ${[...SUBMODULES].join(", ")}`
    );
  }
}

// Git ref format: refuse names containing whitespace, control chars, or
// characters reserved by git (`~`, `^`, `:`, `?`, `*`, `[`, `\`, `..`,
// leading/trailing `/`). Letters, digits, `-`, `_`, `.`, `/` only.
function assertGitRef(name: string, label: string): void {
  if (!name || !/^[A-Za-z0-9._/-]+$/.test(name) || name.includes("..") ||
      name.startsWith("-") || name.startsWith("/") || name.endsWith("/")) {
    throw new Error(`Invalid ${label} '${name}'`);
  }
}

const handlers: Record<string, ToolHandler> = {
  "sync-submodule": async (args) => {
    const { name } = args;
    if (!name) throw new Error("name parameter required");
    assertSubmodule(name);

    const submodulePath = path.join(ROOT_DIR, name);
    try {
      await fs.access(submodulePath);
    } catch {
      throw new Error(`Submodule '${name}' not found at ${submodulePath}`);
    }

    run("git", ["submodule", "update", "--remote", "--", name]);

    const commit = run("git", [
      "-C",
      name,
      "rev-parse",
      "--short",
      "HEAD",
    ]).trim();

    run("git", ["add", "--", name]);

    // `git status --porcelain -- <submodule>` reports a non-empty string when
    // the submodule's working tree is dirty (uncommitted changes inside) even
    // if the meta-repo's pointer didn't move. That would lead `git commit` to
    // fail since nothing is staged in the meta-repo. Use `git diff --cached
    // --quiet --` to ask the precise question: was the submodule pointer
    // staged for commit? Exit 0 = no staged change, 1 = staged change.
    let pointerStaged = false;
    try {
      run("git", ["diff", "--cached", "--quiet", "--", name]);
    } catch {
      pointerStaged = true;
    }

    if (!pointerStaged) {
      return `✓ Submodule '${name}' already up to date (${commit})`;
    }

    // Commit only the submodule pointer; do not sweep unrelated staged files.
    run("git", [
      "commit",
      "-m",
      `chore: update ${name} submodule reference`,
      "--",
      name,
    ]);

    return `✓ Synced '${name}' to ${commit}`;
  },

  "create-feature-branch": async (args) => {
    const { name } = args;
    if (!name) throw new Error("name parameter required");
    assertGitRef(name, "feature name");
    const branchName = `feature/${name}`;

    // Order matters here:
    //   1. Checkout the base branch and pull — gives us a clean, up-to-date
    //      starting point.
    //   2. Create the feature branch from base.
    //   3. Sync submodules ON the feature branch — any submodule-pointer
    //      commits land on the feature branch, NOT on `dev`, so the
    //      developer's local `dev` doesn't accumulate chore commits.
    checkoutDevBaseAndPull();
    run("git", ["checkout", "-b", branchName]);

    await handlers["sync-submodule"]({ name: "muuvie" });
    await handlers["sync-submodule"]({ name: "backend" });

    return `✓ Created feature branch '${branchName}' (submodules synced)`;
  },

  "create-release-branch": async (args) => {
    const { version } = args;
    if (!version) throw new Error("version parameter required");
    assertGitRef(version, "version");
    const branchName = `release/${version}`;

    // Same ordering as create-feature-branch — submodule-pointer commits
    // land on the release branch, not on `dev`.
    checkoutDevBaseAndPull();
    run("git", ["checkout", "-b", branchName]);

    await handlers["sync-submodule"]({ name: "muuvie" });
    await handlers["sync-submodule"]({ name: "backend" });

    return `✓ Created release branch '${branchName}' (submodules synced)`;
  },

  "open-pull-request": async (args) => {
    const { title, description } = args;
    if (!title) throw new Error("title parameter required");

    const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
    if (branch === "HEAD") {
      throw new Error(
        "Cannot open a pull request from a detached HEAD. Check out a branch first."
      );
    }
    assertGitRef(branch, "current branch");

    // Align with .claude/verify-docs.sh base-branch resolution:
    //   release/*, dev, develop, main -> main
    //   everything else               -> dev (develop on older clones)
    // Anything that lands on `main` must be an explicit release-style branch.
    let baseRef: "main" | "dev" | "develop" = devBranch();
    if (
      branch.startsWith("release/") ||
      branch === "dev" ||
      branch === "develop" ||
      branch === "main"
    ) {
      baseRef = "main";
    }

    run("git", ["push", "-u", "origin", branch]);

    // `gh pr create` needs either an explicit body or --fill in non-interactive
    // contexts (which is how the MCP server is always invoked) — otherwise it
    // hangs waiting for an editor. --fill seeds title/body from commit log,
    // overridden by --title we already pass.
    const ghArgv = ["pr", "create", "--title", title, "--base", baseRef];
    if (description) {
      ghArgv.push("--body", description);
    } else {
      ghArgv.push("--fill");
    }
    run("gh", ghArgv);

    return `✓ PR created: ${branch} → ${baseRef}`;
  },

  "check-status": async () => {
    const lines = (s: string) => s.trim().split("\n");

    const muuvieLines = lines(
      run("git", ["-C", "muuvie", "rev-parse", "HEAD", "origin/main"])
    );
    const backendLines = lines(
      run("git", ["-C", "backend", "rev-parse", "HEAD", "origin/main"])
    );

    const muuvieStale = muuvieLines[0] !== muuvieLines[1];
    const backendStale = backendLines[0] !== backendLines[1];

    let status = "Submodule Status:\n";
    status += `  muuvie:  ${muuvieStale ? "⚠ STALE" : "✓ up to date"}\n`;
    status += `  backend: ${backendStale ? "⚠ STALE" : "✓ up to date"}`;
    return status;
  },
};

const toolDefinitions = [
  {
    name: "sync-submodule",
    description:
      "Sync a submodule to the latest remote commit and update the reference",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Submodule name (muuvie or backend)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "create-feature-branch",
    description:
      "Sync submodules, checkout dev, and create a feature branch",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Feature name (becomes feature/name)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "create-release-branch",
    description:
      "Sync submodules, checkout dev, and create a release branch",
    inputSchema: {
      type: "object",
      properties: {
        version: {
          type: "string",
          description: "Version number (becomes release/version)",
        },
      },
      required: ["version"],
    },
  },
  {
    name: "open-pull-request",
    description:
      "Create a pull request (feature/fix branches → dev, release branches → main)",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "PR title (use Conventional Commits format)",
        },
        description: {
          type: "string",
          description: "PR description (optional)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "check-status",
    description: "Check which submodules are stale or up to date",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

const server = new Server(
  { name: "repo-management", version: "1.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = handlers[name];
  if (!handler) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    const result = await handler((args ?? {}) as Record<string, string>);
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    return {
      content: [
        { type: "text", text: (error as Error).message || String(error) },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
