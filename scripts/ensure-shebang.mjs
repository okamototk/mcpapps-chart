import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetPath = path.join(__dirname, "..", "dist", "main.js");
const shebang = "#!/usr/bin/env node\n";

const contents = await fs.readFile(targetPath, "utf-8");
if (!contents.startsWith(shebang)) {
  await fs.writeFile(targetPath, shebang + contents, "utf-8");
}
