const FRONTMATTER_BOUNDARY = /^(?:---|\.\.\.)[ \t]*$/;
const H1_HEADING = /^ {0,3}#(?:[ \t]+|$)/;
const H2_HEADING = /^ {0,3}##(?:[ \t]+|$)/;
const FENCE_START = /^ {0,3}(`{3,}|~{3,})/;

function stripFrontmatter(content: string): string {
    const normalized = content
        .replace(/^\uFEFF/, "")
        .replace(/\r\n?/g, "\n");
    const lines = normalized.split("\n");

    if (lines[0]?.trim() !== "---") {
        return normalized;
    }

    const closingBoundary = lines.findIndex(
        (line, index) => index > 0 && FRONTMATTER_BOUNDARY.test(line.trim()),
    );

    return closingBoundary === -1
        ? normalized
        : lines.slice(closingBoundary + 1).join("\n");
}

export function extractHeadingExcerpt(content: string): string | undefined {
    const lines = stripFrontmatter(content).split("\n");
    let h1Index = -1;
    let fenceMarker = "";
    let fenceLength = 0;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const fence = line.match(FENCE_START)?.[1];

        if (fenceMarker) {
            if (
                fence
                && fence[0] === fenceMarker
                && fence.length >= fenceLength
                && line.trim().slice(fence.length).trim() === ""
            ) {
                fenceMarker = "";
                fenceLength = 0;
            }
            continue;
        }

        if (fence) {
            fenceMarker = fence[0];
            fenceLength = fence.length;
            continue;
        }

        if (h1Index === -1) {
            if (H1_HEADING.test(line)) {
                h1Index = index;
            }
            continue;
        }

        if (H2_HEADING.test(line)) {
            const excerpt = lines.slice(h1Index + 1, index).join("\n").trim();
            return excerpt || undefined;
        }
    }

    return undefined;
}
