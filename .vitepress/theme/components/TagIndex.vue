<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'

import { data as tagCatalog } from '../tag-catalog.data'

const query = ref('')

const filteredTags = computed(() => {
    const keyword = query.value.trim().toLocaleLowerCase()
    if (!keyword) return tagCatalog.tags

    return tagCatalog.tags.filter((tag) =>
        tag.name.toLocaleLowerCase().includes(keyword),
    )
})
</script>

<template>
    <main class="tag-index" aria-labelledby="tag-index-title">
        <header class="tag-hero">
            <div class="section-mark" aria-hidden="true"></div>
            <div>
                <p class="eyebrow">TAG_INDEX //</p>
                <h1 id="tag-index-title">标签索引</h1>
            </div>
        </header>

        <section class="tag-overview" aria-label="标签统计">
            <div class="overview-item">
                <strong>{{ tagCatalog.tags.length }}</strong>
                <span>个标签</span>
            </div>
            <div class="overview-item">
                <strong>{{ tagCatalog.taggedPostCount }}</strong>
                <span>篇已标注笔记</span>
            </div>
        </section>

        <label class="tag-search">
            <span class="search-label">FILTER_TAGS</span>
            <input
                v-model="query"
                type="search"
                placeholder="输入标签名称"
                aria-label="筛选标签"
            />
            <span class="search-count" aria-live="polite">
                {{ filteredTags.length }} / {{ tagCatalog.tags.length }}
            </span>
        </label>

        <section v-if="filteredTags.length" class="tag-grid" aria-label="全部标签">
            <article v-for="tag in filteredTags" :key="tag.routeId" class="tag-card">
                <div class="card-line" aria-hidden="true"></div>
                <div class="tag-card-meta">
                    <span class="status-dot" aria-hidden="true"></span>
                    <span>{{ tag.count }} NOTES</span>
                </div>
                <h2>
                    <a :href="withBase(tag.href)" class="tag-card-link">{{ tag.name }}</a>
                </h2>
                <p>{{ tag.count }} 篇笔记正在使用这个 Tag</p>
                <div class="tag-card-footer" aria-hidden="true">
                    <span>VIEW_COLLECTION //</span>
                    <span class="arrow">→</span>
                </div>
            </article>
        </section>

        <div v-else class="empty-state">
            <p>没有找到匹配的标签</p>
            <button type="button" @click="query = ''">清空筛选</button>
        </div>
    </main>
</template>

<style scoped>
.tag-index {
    width: min(1152px, 100%);
    margin: 0 auto;
    padding: 32px 24px 72px;
}

.tag-hero {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 32px;
}

.section-mark {
    flex: 0 0 auto;
    width: 4px;
    height: 72px;
    margin-top: 7px;
    border-radius: 2px;
    background: var(--vp-c-brand-1);
    box-shadow: 0 0 12px var(--vp-c-brand-soft);
}

.eyebrow {
    margin: 0 0 6px;
    color: var(--vp-c-brand-1);
    font-family: var(--vp-font-family-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
}

.tag-hero h1 {
    margin: 0;
    border: 0;
    color: var(--vp-c-text-1);
    font-size: clamp(30px, 5vw, 44px);
    line-height: 1.2;
}

.lead {
    margin: 12px 0 0;
    color: var(--vp-c-text-2);
    line-height: 1.7;
}

.tag-overview {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}

.overview-item {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 18px 20px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
}

.overview-item strong {
    color: var(--vp-c-brand-1);
    font-family: var(--vp-font-family-mono);
    font-size: 24px;
}

.overview-item span {
    color: var(--vp-c-text-2);
    font-size: 14px;
}

.tag-search {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    margin-bottom: 28px;
    padding: 10px 14px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
}

.search-label,
.search-count {
    color: var(--vp-c-text-3);
    font-family: var(--vp-font-family-mono);
    font-size: 11px;
    font-weight: 700;
}

.tag-search input {
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--vp-c-text-1);
    font: inherit;
}

.tag-search:focus-within {
    border-color: var(--vp-c-brand-1);
    box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}

.tag-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
}

.tag-card {
    position: relative;
    display: flex;
    min-height: 210px;
    flex-direction: column;
    overflow: hidden;
    padding: 24px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
    transition:
        transform 0.25s,
        border-color 0.25s,
        box-shadow 0.25s;
}

.card-line {
    position: absolute;
    inset: 0 0 auto;
    height: 3px;
    background: var(--vp-c-brand-1);
    transform: scaleX(0);
    transform-origin: right center;
    transition: transform 0.3s;
}

.tag-card:hover {
    transform: translateY(-4px);
    border-color: var(--vp-c-brand-1);
    box-shadow: var(--vp-shadow-2);
}

.tag-card:hover .card-line {
    transform: scaleX(1);
    transform-origin: left center;
}

.tag-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--vp-c-text-3);
    font-family: var(--vp-font-family-mono);
    font-size: 11px;
    font-weight: 700;
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--vp-c-brand-1);
    box-shadow: 0 0 8px var(--vp-c-brand-soft);
}

.tag-card h2 {
    margin: 20px 0 8px;
    border: 0;
    color: var(--vp-c-text-1);
    font-size: 21px;
    line-height: 1.4;
}

.tag-card-link {
    color: inherit;
    text-decoration: none;
}

.tag-card-link::after {
    position: absolute;
    inset: 0;
    content: '';
}

.tag-card-link:focus-visible::after {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: -3px;
}

.tag-card p {
    margin: 0;
    color: var(--vp-c-text-2);
    font-size: 14px;
}

.tag-card-footer {
    display: flex;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 24px;
    color: var(--vp-c-brand-1);
    font-family: var(--vp-font-family-mono);
    font-size: 11px;
    font-weight: 700;
}

.arrow {
    transition: transform 0.25s;
}

.tag-card:hover .arrow {
    transform: translateX(4px);
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 48px 24px;
    border: 1px dashed var(--vp-c-divider);
    border-radius: 8px;
    color: var(--vp-c-text-2);
    text-align: center;
}

.empty-state p {
    margin: 0;
}

.empty-state button {
    padding: 8px 14px;
    border: 1px solid var(--vp-c-brand-1);
    border-radius: 8px;
    background: transparent;
    color: var(--vp-c-brand-1);
    cursor: pointer;
}

@media (max-width: 640px) {
    .tag-index {
        padding: 24px 16px 56px;
    }

    .tag-overview {
        grid-template-columns: 1fr;
    }

    .tag-search {
        grid-template-columns: 1fr auto;
    }

    .search-label {
        display: none;
    }
}
</style>
