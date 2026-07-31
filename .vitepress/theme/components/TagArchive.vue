<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, withBase } from 'vitepress'

import type { TagEntry, TagReference } from '../../utilities/tag-catalog'

const props = defineProps<{
    tag?: TagEntry
}>()

const route = useRoute()
const fromPath = ref('')

const normalizePath = (value: string) => {
    const pathOnly = value.replace(/[?#].*$/, '').replace(/\/$/, '')

    try {
        return decodeURI(pathOnly)
    } catch {
        return pathOnly
    }
}

const syncFromPath = () => {
    if (typeof window === 'undefined') {
        fromPath.value = ''
        return
    }

    const from = new URLSearchParams(window.location.search).get('from')
    if (!from || !from.startsWith('/posts/')) {
        fromPath.value = ''
        return
    }

    fromPath.value = normalizePath(from)
}

const returnPost = computed(() => {
    if (!props.tag || !fromPath.value) return null

    return props.tag.posts.find(
        (post) => normalizePath(post.url) === fromPath.value,
    ) || null
})

const tagHref = (tag: TagReference) => {
    const href = withBase(tag.href)
    if (!returnPost.value) return href

    return `${href}?from=${encodeURIComponent(returnPost.value.url)}`
}

const formatDate = (value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

onMounted(syncFromPath)
watch(() => route.path, syncFromPath)
</script>

<template>
    <main
        v-if="tag"
        class="tag-archive"
        :aria-labelledby="`tag-title-${tag.routeId}`"
    >
        <nav class="archive-nav" aria-label="标签页面导航">
            <a
                v-if="returnPost"
                :href="withBase(returnPost.url)"
                class="return-reading-link"
            >
                <span aria-hidden="true">←</span>
                <span>返回正在阅读的文章</span>
                <strong>{{ returnPost.title }}</strong>
            </a>
            <a v-else :href="withBase('/tags/')">← 返回全部标签</a>
        </nav>

        <header class="archive-hero">
            <p class="eyebrow">TAG_COLLECTION //</p>
            <h1 :id="`tag-title-${tag.routeId}`">{{ tag.name }}</h1>
            <p>共有 {{ tag.count }} 篇笔记使用了这个 Tag。</p>
        </header>

        <section class="post-grid" :aria-label="`${tag.name} 标签下的笔记`">
            <article v-for="post in tag.posts" :key="post.url" class="post-card">
                <div class="card-line" aria-hidden="true"></div>
                <div class="post-meta">
                    <span class="status-dot" aria-hidden="true"></span>
                    <span>{{ post.category }}</span>
                    <time v-if="post.date" :datetime="post.date">{{ formatDate(post.date) }}</time>
                </div>

                <h2>
                    <a :href="withBase(post.url)" class="post-link">{{ post.title }}</a>
                </h2>
                <p v-if="post.excerpt" class="post-excerpt">{{ post.excerpt }}</p>

                <div class="post-tags" aria-label="文章标签">
                    <a
                        v-for="postTag in post.tags"
                        :key="postTag.routeId"
                        :href="tagHref(postTag)"
                        :aria-current="postTag.routeId === tag.routeId ? 'page' : undefined"
                    >
                        # {{ postTag.name }}
                    </a>
                </div>

                <div class="post-footer" aria-hidden="true">
                    <span>READ_NOTE //</span>
                    <span class="arrow">→</span>
                </div>
            </article>
        </section>
    </main>

    <main v-else class="tag-archive tag-not-found">
        <p class="eyebrow">TAG_NOT_FOUND //</p>
        <h1>没有找到这个标签</h1>
        <a :href="withBase('/tags/')">返回全部标签</a>
    </main>
</template>

<style scoped>
.tag-archive {
    width: min(1152px, 100%);
    margin: 0 auto;
    padding: 28px 24px 72px;
}

.archive-nav {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 16px;
    margin-bottom: 32px;
}

.archive-nav > a {
    color: var(--vp-c-brand-1);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
}

.return-reading-link {
    display: inline-flex;
    max-width: 100%;
    align-items: center;
    gap: 7px;
}

.return-reading-link strong {
    overflow: hidden;
    color: var(--vp-c-text-1);
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.archive-hero {
    position: relative;
    margin-bottom: 32px;
    padding: 28px 30px;
    overflow: hidden;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
}

.archive-hero::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--vp-c-brand-1);
    content: '';
}

.eyebrow {
    margin: 0 0 8px;
    color: var(--vp-c-brand-1);
    font-family: var(--vp-font-family-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
}

.archive-hero h1,
.tag-not-found h1 {
    margin: 0;
    border: 0;
    color: var(--vp-c-text-1);
    font-size: clamp(30px, 5vw, 44px);
    line-height: 1.2;
}

.archive-hero > p:last-child {
    margin: 12px 0 0;
    color: var(--vp-c-text-2);
}

.post-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
    gap: 22px;
}

.post-card {
    position: relative;
    display: flex;
    min-height: 300px;
    flex-direction: column;
    overflow: hidden;
    padding: 26px;
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

.post-card:hover {
    transform: translateY(-4px);
    border-color: var(--vp-c-brand-1);
    box-shadow: var(--vp-shadow-2);
}

.post-card:hover .card-line {
    transform: scaleX(1);
    transform-origin: left center;
}

.post-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--vp-c-text-3);
    font-family: var(--vp-font-family-mono);
    font-size: 11px;
    font-weight: 700;
}

.post-meta time {
    margin-left: auto;
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--vp-c-brand-1);
    box-shadow: 0 0 8px var(--vp-c-brand-soft);
}

.post-card h2 {
    margin: 20px 0 10px;
    border: 0;
    color: var(--vp-c-text-1);
    font-size: 21px;
    line-height: 1.45;
}

.post-link {
    color: inherit;
    text-decoration: none;
}

.post-link::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    content: '';
}

.post-link:focus-visible::after {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: -3px;
}

.post-excerpt {
    display: -webkit-box;
    margin: 0 0 18px;
    overflow: hidden;
    color: var(--vp-c-text-2);
    font-size: 14px;
    line-height: 1.75;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}

.post-tags {
    position: relative;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: auto;
}

.post-tags a {
    padding: 4px 8px;
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    color: var(--vp-c-text-2);
    font-size: 12px;
    text-decoration: none;
}

.post-tags a:hover,
.post-tags a[aria-current='page'] {
    border-color: var(--vp-c-brand-1);
    color: var(--vp-c-brand-1);
}

.post-footer {
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--vp-c-divider);
    color: var(--vp-c-brand-1);
    font-family: var(--vp-font-family-mono);
    font-size: 11px;
    font-weight: 700;
}

.arrow {
    transition: transform 0.25s;
}

.post-card:hover .arrow {
    transform: translateX(4px);
}

.tag-not-found {
    text-align: center;
}

.tag-not-found a {
    display: inline-block;
    margin-top: 20px;
    color: var(--vp-c-brand-1);
}

@media (max-width: 640px) {
    .tag-archive {
        padding: 20px 16px 56px;
    }

    .archive-nav {
        align-items: stretch;
        flex-direction: column;
    }

    .archive-hero {
        padding: 24px;
    }

    .post-grid {
        grid-template-columns: 1fr;
    }
}
</style>
