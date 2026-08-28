import assert from "node:assert/strict";
import test from "node:test";
import {
    ShareLinkQueryError,
    StaticManifestShareLinkQuery,
} from "../../.vitepress/theme/services/share-link-query.ts";

const manifest = {
    version: 1 as const,
    registryHash: "a".repeat(64),
    shortOrigin: "https://yuufrag.machillka.com" as const,
    byCanonicalPath: { "/posts/中文 页面": "23456789ab" },
};

test("查询是惰性的，并发和后续调用只 fetch 一次", async () => {
    let calls = 0;
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const query = new StaticManifestShareLinkQuery({
        fetchImpl: async () => {
            calls += 1;
            await wait;
            return { ok: true, status: 200, json: async () => manifest };
        },
    });

    assert.equal(calls, 0);
    const first = query.findByCanonicalPath("/posts/%E4%B8%AD%E6%96%87%20%E9%A1%B5%E9%9D%A2?q=1");
    const second = query.findByCanonicalPath("/posts/中文 页面#x");
    assert.equal(calls, 1);
    release();
    assert.deepEqual(await first, {
        id: "23456789ab",
        url: "https://yuufrag.machillka.com/s/23456789ab",
    });
    assert.deepEqual(await second, await first);
    assert.equal(await query.findByCanonicalPath("/missing"), undefined);
    assert.equal(calls, 1);
});

test("网络、HTTP 和 schema 错误可区分", async () => {
    const fixtures = [
        { expected: "fetch", fetchImpl: async () => { throw new Error("offline"); } },
        { expected: "http", fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) },
        { expected: "schema", fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ version: 2 }) }) },
    ];

    for (const fixture of fixtures) {
        const query = new StaticManifestShareLinkQuery({ fetchImpl: fixture.fetchImpl });
        await assert.rejects(
            () => query.findByCanonicalPath("/posts/中文"),
            (error: unknown) => error instanceof ShareLinkQueryError && error.code === fixture.expected,
        );
    }
});

test("失败不永久缓存，下一次点击可以重试", async () => {
    let calls = 0;
    const query = new StaticManifestShareLinkQuery({
        fetchImpl: async () => {
            calls += 1;
            if (calls === 1) throw new Error("temporary offline");
            return { ok: true, status: 200, json: async () => manifest };
        },
    });
    await assert.rejects(query.findByCanonicalPath("/posts/中文 页面"));
    assert.notEqual(await query.findByCanonicalPath("/posts/中文 页面"), undefined);
    assert.equal(calls, 2);
});
