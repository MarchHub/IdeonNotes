<script setup lang="ts">
import { computed } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'

import { data as tagCatalog } from '../tag-catalog.data'

const { frontmatter } = useData()
const route = useRoute()

const tags = computed(() => {
    const values = frontmatter.value.tags
    if (!Array.isArray(values)) return []

    return values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.normalize('NFC').trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .map((name) => tagCatalog.tags.find((tag) => tag.name === name))
        .filter((tag) => tag !== undefined)
})

const tagHref = (href: string) => {
    const encodedPath = route.path.replace(/[?#].*$/, '')
    let from = encodedPath

    try {
        from = decodeURI(encodedPath)
    } catch {
        // 保留原路径，聚合页仍会执行站内文章校验。
    }

    return `${withBase(href)}?from=${encodeURIComponent(from)}`
}
</script>

<template>
    <nav v-if="tags.length" class="article-tags" aria-label="文章标签">
        <a
            v-for="tag in tags"
            :key="tag.routeId"
            :href="tagHref(tag.href)"
        >
            # {{ tag.name }}
        </a>
    </nav>
</template>

<style scoped>
.article-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 56px 0 24px;
    padding-top: 24px;
    border-top: 1px solid var(--vp-c-divider);
}

.article-tags a {
    display: block;
    padding: 0 14px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-2);
    font-size: 13px;
    line-height: 34px;
    text-decoration: none;
    transition:
        background-color 0.2s,
        border-color 0.2s,
        color 0.2s,
        box-shadow 0.2s;
}

.article-tags a:hover,
.article-tags a:focus-visible {
    border-color: var(--vp-c-brand-1);
    background: var(--vp-c-brand-soft);
    color: var(--vp-c-brand-1);
    box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
    outline: none;
}

@media (max-width: 640px) {
    .article-tags {
        margin-top: 40px;
        padding-top: 20px;
    }
}
</style>
