import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import matter from "gray-matter";

import { pageIdToPublicHref } from "./route-paths.ts";

const TAG_WHITESPACE_PATTERN = /\s+/gu;
const TAG_SLUG_SEPARATOR_PATTERN = /[^\p{Letter}\p{Number}]+/gu;
const MARKDOWN_FENCE_PATTERN = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const GENERATED_CATALOG_PATH = ".vitepress/generated/tag-catalog.json";

export interface TagReference {
    name: string;
    routeId: string;
    href: string;
}

export interface TagPost {
    title: string;
    url: string;
    category: string;
    date?: string;
    excerpt?: string;
    tags: TagReference[];
}

export interface TagEntry extends TagReference {
    count: number;
    posts: TagPost[];
}

export interface TagCatalog {
    schemaVersion: 1;
    sourceHash: string;
    postCount: number;
    taggedPostCount: number;
    tags: TagEntry[];
}

interface ParsedPost extends Omit<TagPost, "tags"> {
    sourcePageId: string;
    tagNames: string[];
}

export function normalizeTag(rawTag: string): string {
    return rawTag.normalize("NFC").trim().replace(TAG_WHITESPACE_PATTERN, " ");
}

export function createTagRouteId(rawTag: string): string {
    const tag = normalizeTag(rawTag);

    if (!tag) {
        throw new Error("Tag 不能为空。");
    }

    const readable = tag
        .toLocaleLowerCase()
        .replace(TAG_SLUG_SEPARATOR_PATTERN, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    const hash = createHash("sha256").update(tag).digest("hex").slice(0, 8);

    return `${readable || "tag"}--${hash}`;
}

export function createTagHref(rawTag: string): string {
    return pageIdToPublicHref(`tags/${createTagRouteId(rawTag)}.md`);
}

function normalizeTags(value: unknown, sourcePageId: string): string[] {
    if (value === undefined || value === null) return [];

    if (!Array.isArray(value)) {
        throw new Error(`${sourcePageId}: tags 必须是字符串数组。`);
    }

    const tags: string[] = [];
    const seen = new Set<string>();

    value.forEach((item, index) => {
        if (typeof item !== "string") {
            throw new Error(
                `${sourcePageId}: tags[${index}] 必须是字符串。`,
            );
        }

        const tag = normalizeTag(item);
        if (!tag) {
            throw new Error(`${sourcePageId}: tags[${index}] 不能为空。`);
        }

        if (!seen.has(tag)) {
            seen.add(tag);
            tags.push(tag);
        }
    });

    return tags;
}

function resolveTitle(
    frontmatter: Record<string, unknown>,
    body: string,
    sourcePageId: string,
): string {
    if (typeof frontmatter.title === "string" && frontmatter.title.trim()) {
        return frontmatter.title.trim();
    }

    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
    if (heading) return heading;

    return path.posix.basename(sourcePageId, ".md");
}

function resolveDate(value: unknown): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;

    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return undefined;

    return date.toISOString();
}

function cleanExcerptBlock(block: string): string {
    return block
        .replace(/^\s{0,3}#{1,6}\s+/gm, "")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/[*_~=#]/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveExcerpt(
    frontmatter: Record<string, unknown>,
    body: string,
): string | undefined {
    if (
        typeof frontmatter.description === "string" &&
        frontmatter.description.trim()
    ) {
        return frontmatter.description.trim();
    }

    const content = body.replace(MARKDOWN_FENCE_PATTERN, "");
    const block = content
        .split(/\r?\n\s*\r?\n/)
        .map((candidate) => candidate.trim())
        .find(
            (candidate) =>
                candidate.length > 0 &&
                !candidate.startsWith("#") &&
                !candidate.startsWith("<script") &&
                !candidate.startsWith("import "),
        );

    if (!block) return undefined;

    const excerpt = cleanExcerptBlock(block);
    if (!excerpt) return undefined;

    return excerpt.length > 160 ? `${excerpt.slice(0, 157)}...` : excerpt;
}

function compareText(left: string, right: string): number {
    return left.localeCompare(right, "zh-CN", { sensitivity: "base" });
}

function comparePosts(left: ParsedPost, right: ParsedPost): number {
    if (left.date && right.date && left.date !== right.date) {
        return right.date.localeCompare(left.date);
    }
    if (left.date !== right.date) return left.date ? -1 : 1;

    const titleOrder = compareText(left.title, right.title);
    return titleOrder || left.sourcePageId.localeCompare(right.sourcePageId);
}

export async function buildTagCatalog(
    projectRoot: string,
): Promise<TagCatalog> {
    const sourceFiles = await fg("posts/**/*.md", {
        cwd: projectRoot,
        onlyFiles: true,
    });
    sourceFiles.sort();

    const sourceHasher = createHash("sha256");
    const parsedPosts: ParsedPost[] = [];

    for (const sourcePageId of sourceFiles) {
        const absolutePath = path.join(projectRoot, sourcePageId);
        const source = await readFile(absolutePath, "utf8");
        sourceHasher.update(sourcePageId).update("\0").update(source).update("\0");

        const parsed = matter(source);
        const frontmatter = parsed.data as Record<string, unknown>;
        if (frontmatter.publish === false) continue;

        const tagNames = normalizeTags(frontmatter.tags, sourcePageId);
        const relativeParts = sourcePageId.split("/");

        parsedPosts.push({
            sourcePageId,
            title: resolveTitle(frontmatter, parsed.content, sourcePageId),
            url: pageIdToPublicHref(sourcePageId),
            category: relativeParts[1] || "未分类",
            date: resolveDate(frontmatter.date),
            excerpt: resolveExcerpt(frontmatter, parsed.content),
            tagNames,
        });
    }

    const tagNames = [...new Set(parsedPosts.flatMap((post) => post.tagNames))];
    const references = new Map<string, TagReference>(
        tagNames.map((name) => [
            name,
            {
                name,
                routeId: createTagRouteId(name),
                href: createTagHref(name),
            },
        ]),
    );

    const tags = tagNames.map<TagEntry>((name) => {
        const reference = references.get(name)!;
        const posts = parsedPosts
            .filter((post) => post.tagNames.includes(name))
            .sort(comparePosts)
            .map<TagPost>((post) => ({
                title: post.title,
                url: post.url,
                category: post.category,
                date: post.date,
                excerpt: post.excerpt,
                tags: post.tagNames.map((tagName) => references.get(tagName)!),
            }));

        return {
            ...reference,
            count: posts.length,
            posts,
        };
    });

    tags.sort(
        (left, right) =>
            right.count - left.count || compareText(left.name, right.name),
    );

    return {
        schemaVersion: 1,
        sourceHash: sourceHasher.digest("hex"),
        postCount: parsedPosts.length,
        taggedPostCount: parsedPosts.filter((post) => post.tagNames.length > 0)
            .length,
        tags,
    };
}

export function tagCatalogFilePath(projectRoot: string): string {
    return path.join(projectRoot, GENERATED_CATALOG_PATH);
}

export async function writeTagCatalog(projectRoot: string): Promise<TagCatalog> {
    const catalog = await buildTagCatalog(projectRoot);
    const outputPath = tagCatalogFilePath(projectRoot);
    const temporaryPath = `${outputPath}.${process.pid}.tmp`;

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
    await rename(temporaryPath, outputPath);

    return catalog;
}
