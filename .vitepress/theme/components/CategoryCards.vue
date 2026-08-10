<script setup lang="ts">
import { withBase } from "vitepress";
import { data as categories } from "../category.data";
</script>

<template>
    <section class="home-categories" aria-labelledby="category-title">
        <div class="category-container">
            <div class="category-heading">
                <div class="category-heading-deco"></div>
                <div>
                    <h2 id="category-title" class="category-title">
                        KNOWLEDGE_AREAS
                        <span class="category-title-cn">知识分类</span>
                    </h2>
                </div>
            </div>

            <div class="category-grid">
                <article v-for="(category, index) in categories" :key="category.name" class="category-card">
                    <div class="category-card-line"></div>
                    <div class="category-card-meta">
                        <span class="category-index">
                            {{ String(index + 1).padStart(2, "0") }}
                        </span>
                        <span class="category-count">
                            {{ category.count }} 篇文章
                        </span>
                    </div>
                    <h3 class="category-card-title">
                        <a :href="withBase(category.url)" class="category-card-link">
                            {{ category.title }}
                        </a>
                    </h3>
                    <p class="category-description">
                        {{ category.description }}
                    </p>
                    <div class="category-action" aria-hidden="true">
                        打开目录 <span>→</span>
                    </div>
                </article>
            </div>
        </div>
    </section>
</template>

<style scoped>
.home-categories {
    padding: 48px 24px 8px;
    background-color: transparent;
}

.category-container {
    max-width: 1152px;
    margin: 0 auto;
}

.category-heading {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 28px;
}

.category-heading-deco {
    flex: 0 0 auto;
    align-self: stretch;
    width: 4px;
    background: var(--y-grad);
    box-shadow: 0 0 10px var(--y-accent);
}

.category-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    color: var(--y-accent);
    font-family: var(--vp-font-family-mono);
    font-size: 24px;
    font-weight: 800;
}

.category-title-cn {
    color: var(--y-desc);
    font-size: 14px;
    letter-spacing: 0.1em;
}

.category-lead {
    margin: 6px 0 0;
    color: var(--y-desc);
    font-size: 14px;
}

.category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
}

.category-card {
    position: relative;
    display: flex;
    min-height: 176px;
    flex-direction: column;
    overflow: hidden;
    padding: 20px;
    border: 1px solid var(--y-border);
    border-radius: 8px;
    background: var(--y-bg);
    backdrop-filter: blur(12px);
    transition:
        transform 0.25s ease,
        border-color 0.25s ease,
        box-shadow 0.25s ease;
    -webkit-backdrop-filter: blur(12px);
}

.category-card-line {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 3px;
    background: var(--y-grad);
    transform: scaleX(0);
    transform-origin: right center;
    transition: transform 0.3s ease;
}

.category-card:hover {
    border-color: var(--y-accent);
    box-shadow: var(--y-shadow);
    transform: translateY(-4px);
}

.category-card:hover .category-card-line {
    transform: scaleX(1);
    transform-origin: left center;
}

.category-card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--y-date);
    font-family: var(--vp-font-family-mono);
    font-size: 11px;
    font-weight: 700;
}

.category-index {
    color: var(--y-yellow);
}

.category-card-title {
    margin: 15px 0 8px;
    color: var(--y-title);
    font-size: 18px;
    line-height: 1.35;
}

.category-card-link {
    color: inherit;
    text-decoration: none;
}

.category-card-link::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    border-radius: 8px;
    content: "";
}

.category-card-link:focus {
    outline: none;
}

.category-card-link:focus-visible::after {
    outline: 2px solid var(--y-accent);
    outline-offset: -3px;
}

.category-card:hover .category-card-title {
    color: var(--y-accent);
}

.category-description {
    display: -webkit-box;
    overflow: hidden;
    margin: 0;
    color: var(--y-desc);
    font-size: 13px;
    line-height: 1.55;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.category-action {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: auto;
    padding-top: 14px;
    color: var(--y-accent);
    font-family: var(--vp-font-family-mono);
    font-size: 11px;
    font-weight: 800;
}

.category-action span {
    transition: transform 0.25s ease;
}

.category-card:hover .category-action span {
    transform: translateX(4px);
}

@media (max-width: 640px) {
    .home-categories {
        padding: 36px 20px 0;
    }

    .category-title {
        align-items: flex-start;
        flex-direction: column;
        gap: 2px;
        font-size: 21px;
    }

    .category-grid {
        grid-template-columns: 1fr;
    }

    .category-card {
        min-height: 158px;
    }
}

@media (prefers-reduced-motion: reduce) {

    .category-card,
    .category-card-line,
    .category-action span {
        transition: none;
    }
}
</style>
