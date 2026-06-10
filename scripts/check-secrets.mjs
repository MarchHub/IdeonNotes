import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const patterns = [
    {
        name: "GitHub token",
        value: /\b(?:github_pat_|gh[pousr]_|ghs_)[A-Za-z0-9_]{20,}\b/g,
    },
    {
        name: "GitHub token assignment",
        value: /^\s*GITHUB_TOKEN\s*=\s*[^\s#][^\r\n]*$/gm,
    },
    {
        name: "Private key",
        value: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    },
];

const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
);

if (result.status !== 0) {
    console.error("Unable to list files for secret scanning.");
    process.exit(1);
}

const findings = [];

for (const file of result.stdout.split("\0").filter(Boolean)) {
    let content;

    try {
        content = readFileSync(file, "utf8");
    } catch {
        continue;
    }

    if (content.includes("\0")) continue;

    for (const pattern of patterns) {
        pattern.value.lastIndex = 0;
        let match;

        while ((match = pattern.value.exec(content)) !== null) {
            const line = content.slice(0, match.index).split("\n").length;
            findings.push(`${file}:${line} (${pattern.name})`);
        }
    }
}

if (findings.length > 0) {
    console.error("Potential secrets found in files that can be committed:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exit(1);
}

console.log("No potential secrets found in committable files.");
