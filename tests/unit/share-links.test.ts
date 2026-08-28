import assert from "node:assert/strict";
import test from "node:test";
import fg from "fast-glob";
import path from "node:path";

import {
    SHARE_ID_ALPHABET,
    SHARE_ID_LENGTH,
    createShareLinkIndex,
    generateStaticShareId,
    isShareId,
    normalizeSharePageId,
    prepareShareLinks,
    resolveCanonicalHref,
    validateShareLinkRegistry,
    type ShareLinkRegistry,
} from "../../.vitepress/utilities/share-links.ts";

const projectRoot = path.resolve(import.meta.dirname, "../..");

function registry(
    records: ShareLinkRegistry["records"],
): ShareLinkRegistry {
    return { version: 1, records };
}

test("normalizes page ids as POSIX NFC paths", () => {
    assert.equal(
        normalizeSharePageId("\\posts\\A\u030A.md"),
        "posts/Å.md",
    );
    assert.equal(normalizeSharePageId("/posts/中文.md"), "posts/中文.md");
});

test("accepts only the fixed share id alphabet and length", () => {
    const validId = SHARE_ID_ALPHABET.slice(0, 1).repeat(SHARE_ID_LENGTH);

    assert.equal(isShareId(validId), true);
    assert.equal(isShareId("k7m2p9x4q"), false);
    assert.equal(isShareId("k7m2p9x4qdz"), false);
    assert.equal(isShareId("K7m2p9x4qd"), false);
    assert.equal(isShareId("k7m2p9x4o0"), false);
    assert.equal(isShareId("k7m2p9x4/2"), false);
});

test("generates deterministic fixed-width share ids", () => {
    const input = { pageId: "posts/软件工程/设计.md", attempt: 0 };
    const first = generateStaticShareId(input);
    const second = generateStaticShareId(input);

    assert.equal(first, second);
    assert.equal(first.length, SHARE_ID_LENGTH);
    assert.equal(isShareId(first), true);
    assert.notEqual(
        first,
        generateStaticShareId({ ...input, attempt: 1 }),
    );
});

test("prepares missing pages in stable order without mutating input", () => {
    const input = registry({});
    const pageIds = ["posts/B.md", "posts/中文.md", "posts/A.md"];
    const first = prepareShareLinks({ registry: input, pageIds });
    const second = prepareShareLinks({
        registry: input,
        pageIds: [...pageIds].reverse(),
    });

    assert.deepEqual(first.registry, second.registry);
    assert.deepEqual(input, registry({}));
    assert.equal(first.added.length, 3);
    assert.equal(first.unchangedCount, 0);
    assert.doesNotThrow(() => validateShareLinkRegistry(first.registry, pageIds));
});

test("retries a claimed candidate instead of overwriting it", () => {
    const pageId = "posts/碰撞.md";
    const firstCandidate = generateStaticShareId({ pageId, attempt: 0 });
    const nextCandidate = generateStaticShareId({ pageId, attempt: 1 });
    const input = registry({
        [firstCandidate]: { pageId: "posts/已有.md", status: "active" },
    });

    const result = prepareShareLinks({
        registry: input,
        pageIds: ["posts/已有.md", pageId],
    });

    assert.equal(result.registry.records[firstCandidate].pageId, "posts/已有.md");
    assert.equal(result.registry.records[nextCandidate].pageId, pageId);
    assert.deepEqual(result.added, [{ id: nextCandidate, pageId }]);
});

test("rejects multiple active ids for one page", () => {
    assert.throws(
        () =>
            createShareLinkIndex(
                registry({
                    "k7m2p9x4qd": { pageId: "posts/A.md", status: "active" },
                    "m7n2p9x4qd": { pageId: "posts/A.md", status: "active" },
                }),
            ),
        /页面存在多个 active 分享 ID：posts\/A\.md/,
    );
});

test("rejects an active id that targets a missing page", () => {
    assert.throws(
        () =>
            validateShareLinkRegistry(
                registry({
                    "k7m2p9x4qd": { pageId: "posts/A.md", status: "active" },
                }),
                ["posts/B.md"],
            ),
        /active 分享 ID 指向不存在页面：k7m2p9x4qd -> posts\/A\.md/,
    );
});

test("allows gone ids without allowing them to resolve", () => {
    const shareId = "k7m2p9x4qd";
    const input = registry({
        [shareId]: { pageId: "posts/已删除.md", status: "gone" },
    });
    const result = prepareShareLinks({
        registry: input,
        pageIds: ["posts/当前.md"],
    });
    const index = createShareLinkIndex(result.registry);

    assert.equal(resolveCanonicalHref(shareId, index), undefined);
    assert.equal(index.byId.get(shareId)?.status, "gone");
    assert.equal(result.added.length, 1);
});

test("resolves active ids through the canonical route utility", () => {
    const shareId = "k7m2p9x4qd";
    const index = createShareLinkIndex(
        registry({
            [shareId]: {
                pageId: "posts/软件工程/一个 页面.md",
                status: "active",
            },
        }),
    );

    assert.equal(
        resolveCanonicalHref(shareId, index),
        "/posts/软件工程/一个-页面",
    );
    assert.equal(resolveCanonicalHref("not-an-id", index), undefined);
});

test("current posts inventory can be assigned unique active ids", async () => {
    const pageIds = await fg("posts/**/*.md", {
        cwd: projectRoot,
        onlyFiles: true,
    });
    const result = prepareShareLinks({ registry: registry({}), pageIds });

    assert.equal(result.added.length, pageIds.length);
    assert.doesNotThrow(() => validateShareLinkRegistry(result.registry, pageIds));
});
