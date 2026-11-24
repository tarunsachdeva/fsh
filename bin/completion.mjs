import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

// readline passes the input up to the cursor. Complete its final path fragment
// without changing the natural-language words preceding it.
export function completePath(line, cwd) {
  const token = /(?:\\.|[^\s])*$/.exec(line)[0];
  const value = token.replace(/\\(.)/g, "$1");
  const slash = value.lastIndexOf("/");
  const directory = slash < 0 ? "" : value.slice(0, slash + 1);
  const prefix = value.slice(slash + 1);
  const location = directory.startsWith("~/") ? resolve(homedir(), directory.slice(2)) : resolve(cwd, directory || ".");

  try {
    const matches = readdirSync(location, { withFileTypes: true })
      .filter((entry) => entry.name.startsWith(prefix) && (!entry.name.startsWith(".") || prefix.startsWith(".")))
      .map((entry) => {
        const path = `${directory}${entry.name}${entry.isDirectory() ? "/" : ""}`;
        return line.slice(0, -token.length) + path.replace(/[\\\s"'`$;&|<>()[\]{}*?!]/g, "\\$&");
      })
      .sort();
    return [matches, line];
  } catch {
    return [[], line];
  }
}
