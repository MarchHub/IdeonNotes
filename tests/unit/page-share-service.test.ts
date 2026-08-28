import assert from "node:assert/strict";
import test from "node:test";
import {
    DefaultPageShareService,
    type ClipboardAdapter,
    type NativeShareAdapter,
    type PageShareInput,
} from "../../.vitepress/theme/services/page-share-service.ts";

const input: PageShareInput = {
    canonicalPath: "/posts/中文",
    canonicalUrl: "https://yuufrag.machillka.com/posts/%E4%B8%AD%E6%96%87",
    title: "中文",
};

function adapters(options: { native?: "ok" | "abort" | "fail" | "off"; clipboard?: "ok" | "fail" } = {}) {
    let copied: string | undefined;
    const native: NativeShareAdapter = {
        canShare: () => options.native !== "off",
        share: async () => {
            if (options.native === "abort") throw Object.assign(new Error(), { name: "AbortError" });
            if (options.native === "fail") throw new Error("share failed");
        },
    };
    const clipboard: ClipboardAdapter = {
        writeText: async (value) => {
            copied = value;
            if (options.clipboard === "fail") throw new Error("copy failed");
        },
    };
    return { native, clipboard, copied: () => copied };
}

test("native 成功与取消不会触发 Clipboard", async () => {
    for (const nativeResult of ["ok", "abort"] as const) {
        const a = adapters({ native: nativeResult });
        const service = new DefaultPageShareService(
            { findByCanonicalPath: async () => ({ id: "23456789ab", url: "https://yuufrag.machillka.com/s/23456789ab" }) },
            a.native,
            a.clipboard,
        );
        const result = await service.share(input);
        assert.equal(result.status, nativeResult === "ok" ? "shared" : "cancelled");
        assert.equal(a.copied(), undefined);
    }
});

test("native 技术失败回退复制，查询失败回退 canonical", async () => {
    const a = adapters({ native: "fail" });
    const service = new DefaultPageShareService(
        { findByCanonicalPath: async () => { throw new Error("manifest unavailable"); } },
        a.native,
        a.clipboard,
    );
    const result = await service.share(input);
    assert.deepEqual(result, { status: "copied", url: input.canonicalUrl, fallback: true });
    assert.equal(a.copied(), input.canonicalUrl);
});

test("未命中使用 canonical，Clipboard 失败返回 manual URL", async () => {
    const a = adapters({ native: "off", clipboard: "fail" });
    const service = new DefaultPageShareService(
        { findByCanonicalPath: async () => undefined },
        a.native,
        a.clipboard,
    );
    const result = await service.share(input);
    assert.equal(result.status, "manual");
    assert.equal(result.url, input.canonicalUrl);
    assert.equal(result.fallback, true);
});
