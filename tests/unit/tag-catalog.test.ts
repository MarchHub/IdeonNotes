import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
    buildTagCatalog,
    createTagHref,
    createTagRouteId,
    normalizeTag,
    tagCatalogFilePath,
    writeTagCatalog,
} from "../../.vitepress/utilities/tag-catalog.ts";

async function withTemporaryProject(
    callback: (projectRoot: string) => Promise<void>,
): Promise<void> {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "yuufrag-tags-"));

    try {
        await callback(projectRoot);
    } finally {
        await rm(projectRoot, { recursive: true, force: true });
    }
}

async function writePost(
    projectRoot: string,
    relativePath: string,
    source: string,
): Promise<void> {
    const outputPath = path.join(projectRoot, "posts", relativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, source, "utf8");
}

test("normalizes labels while keeping exact spelling semantics", () => {
    assert.equal(normalizeTag("  Shader   与材质  "), "Shader 与材质");
    assert.notEqual(createTagRouteId("Go"), createTagRouteId("go"));
    assert.notEqual(createTagRouteId("C++"), createTagRouteId("C#"));
    assert.match(createTagHref("实时渲染"), /^\/tags\/.+--[a-f\d]{8}$/);
});

test("builds a deterministic catalog with canonical article routes", async () => {
    await withTemporaryProject(async (projectRoot) => {
        await writePost(
            projectRoot,
            "编程语言/A B.md",
            `---
title: GORM
date: 2025-08-15
tags:
  - Go
  - 数据库
  - Go
---
# GORM

使用结构体映射数据库表。
`,
        );
        await writePost(
            projectRoot,
            "软件工程/数据库.md",
            `---
tags:
  - 数据库
---
# 数据库基础

介绍数据库基础。
`,
        );
        await writePost(
            projectRoot,
            "草稿.md",
            `---
publish: false
tags:
  - 不应公开
---
# 草稿
`,
        );
        await writePost(
            projectRoot,
            "无标签.md",
            `---
tags:
---
# 无标签
`,
        );

        const first = await buildTagCatalog(projectRoot);
        const second = await buildTagCatalog(projectRoot);

        assert.deepEqual(first, second);
        assert.equal(first.postCount, 3);
        assert.equal(first.taggedPostCount, 2);
        assert.deepEqual(
            first.tags.map((tag) => [tag.name, tag.count]),
            [
                ["数据库", 2],
                ["Go", 1],
            ],
        );

        const go = first.tags.find((tag) => tag.name === "Go");
        assert.ok(go);
        assert.equal(go.posts[0].url, "/posts/编程语言/A-B");
        assert.equal(go.posts[0].excerpt, "使用结构体映射数据库表。");
        assert.deepEqual(
            go.posts[0].tags.map((tag) => tag.name),
            ["Go", "数据库"],
        );

        await writeTagCatalog(projectRoot);
        const generated = await readFile(tagCatalogFilePath(projectRoot), "utf8");
        assert.equal(generated, `${JSON.stringify(first, null, 2)}\n`);
    });
});

test("rejects a non-array tags field with the source path", async () => {
    await withTemporaryProject(async (projectRoot) => {
        await writePost(
            projectRoot,
            "错误.md",
            `---
tags: Go
---
# 错误示例
`,
        );

        await assert.rejects(
            () => buildTagCatalog(projectRoot),
            /posts\/错误\.md: tags 必须是字符串数组/,
        );
    });
});
