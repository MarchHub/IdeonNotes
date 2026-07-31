import assert from "node:assert/strict";
import test from "node:test";

import {
    absolutizeAssetUrl,
    rewriteHtmlAssetUrls,
    rewriteRssFeedAssets,
} from "../../.vitepress/utilities/rss-assets.ts";

const baseUrl = "https://yuufrag.example";

test("resolves relative and root asset URLs against the article", () => {
    const articleUrl = `${baseUrl}/posts/guide/article`;

    assert.equal(
        absolutizeAssetUrl("./assets/image.png", articleUrl),
        `${baseUrl}/posts/guide/assets/image.png`,
    );
    assert.equal(
        absolutizeAssetUrl("../shared/image.png", articleUrl),
        `${baseUrl}/posts/shared/image.png`,
    );
    assert.equal(
        absolutizeAssetUrl("/images/logo.png", articleUrl),
        `${baseUrl}/images/logo.png`,
    );
});

test("preserves external, protocol-relative, data and fragment URLs", () => {
    const articleUrl = `${baseUrl}/posts/article`;
    const preserved = [
        "https://cdn.example/image.png",
        "//cdn.example/image.png",
        "data:image/png;base64,AAAA",
        "#preview",
    ];

    for (const value of preserved) {
        assert.equal(absolutizeAssetUrl(value, articleUrl), value);
    }
});

test("rewrites src and srcset with page-built assets when available", () => {
    const articleUrl = `${baseUrl}/posts/article`;
    const rssHtml = [
        '<p><img src="./source.png" alt="preview"></p>',
        '<picture><source srcset="./small.webp 1x, ./large.webp 2x"></picture>',
    ].join("");
    const builtPageHtml = [
        '<main class="main VPDoc">',
        '<p><img src="/assets/source.hash.png" alt="preview"></p>',
        '<picture><source srcset="/assets/small.hash.webp 1x, /assets/large.hash.webp 2x"></picture>',
        "</main>",
    ].join("");

    assert.equal(
        rewriteHtmlAssetUrls(rssHtml, articleUrl, builtPageHtml),
        [
            `<p><img src="${baseUrl}/assets/source.hash.png" alt="preview"></p>`,
            `<picture><source srcset="${baseUrl}/assets/small.hash.webp 1x, ${baseUrl}/assets/large.hash.webp 2x"></picture>`,
        ].join(""),
    );
});

test("falls back to standard URL resolution without built page HTML", () => {
    const articleUrl = `${baseUrl}/posts/guide/article`;
    const rssHtml = '<img src="./image.png"><source srcset="./one.webp 1x, ./two.webp 2x">';

    assert.equal(
        rewriteHtmlAssetUrls(rssHtml, articleUrl),
        `<img src="${baseUrl}/posts/guide/image.png"><source srcset="${baseUrl}/posts/guide/one.webp 1x, ${baseUrl}/posts/guide/two.webp 2x">`,
    );
});

test("rewrites each RSS item using its own article page", () => {
    const feed = `<rss><channel>
<item><link>${baseUrl}/posts/first/article</link><content:encoded><![CDATA[<img src="./image.png">]]></content:encoded></item>
<item><link>${baseUrl}/posts/second/article</link><content:encoded><![CDATA[<img src="./image.png">]]></content:encoded></item>
</channel></rss>`;
    const rewritten = rewriteRssFeedAssets(feed, () => undefined);

    assert.match(rewritten, new RegExp(`${baseUrl}/posts/first/image\\.png`));
    assert.match(rewritten, new RegExp(`${baseUrl}/posts/second/image\\.png`));
});
