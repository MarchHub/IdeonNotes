import assert from "node:assert/strict";
import test from "node:test";
import {
    createShareButtonController,
} from "../../.vitepress/theme/components/share-button-state.ts";

test("fake service 驱动 copied、fallback 和 manual 状态", async () => {
    const input = {
        canonicalPath: "/posts/中文",
        canonicalUrl: "https://yuufrag.machillka.com/posts/中文",
        title: "中文",
    };
    const copied = createShareButtonController(
        { share: async (_input, phase) => {
            phase?.("querying");
            phase?.("copying");
            return { status: "copied", url: input.canonicalUrl, fallback: true };
        } },
        () => input,
    );
    await copied.share();
    assert.match(copied.message.value, /原始链接/);
    assert.equal(copied.displayUrl.value, input.canonicalUrl);

    const manual = createShareButtonController(
        { share: async () => ({ status: "manual", url: input.canonicalUrl, fallback: false }) },
        () => input,
    );
    await manual.share();
    assert.equal(manual.displayUrl.value, input.canonicalUrl);

    manual.reset();
    assert.equal(manual.displayUrl.value, "");
});

test("用户取消安静回到 idle", async () => {
    const controller = createShareButtonController(
        { share: async () => ({ status: "cancelled", url: "https://x.test", fallback: false }) },
        () => ({ canonicalPath: "/posts/x", canonicalUrl: "https://x.test", title: "x" }),
    );
    await controller.share();
    assert.equal(controller.message.value, "");
    assert.equal(controller.busy.value, false);
});

test("下拉框内再次复制时保留成功反馈，避免文本闪烁", async () => {
    let calls = 0;
    let controller!: ReturnType<typeof createShareButtonController>;
    const messagesDuringSecondCopy: string[] = [];
    const url = "https://yuufrag.machillka.com/s/23456789ab";
    const service = {
        share: async (_input: unknown, phase?: (value: "querying" | "sharing" | "copying") => void) => {
            calls += 1;
            phase?.("querying");
            if (calls === 2) messagesDuringSecondCopy.push(controller.message.value);
            phase?.("copying");
            if (calls === 2) messagesDuringSecondCopy.push(controller.message.value);
            return { status: "copied" as const, url, fallback: false };
        },
    };
    controller = createShareButtonController(
        service,
        () => ({ canonicalPath: "/", canonicalUrl: url, title: "首页" }),
    );

    await controller.share();
    assert.equal(controller.message.value, "链接已复制");
    await controller.share();
    assert.deepEqual(messagesDuringSecondCopy, ["链接已复制", "链接已复制"]);
    assert.equal(controller.message.value, "链接已复制");
});
