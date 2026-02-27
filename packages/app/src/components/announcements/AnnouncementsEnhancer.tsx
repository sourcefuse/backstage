import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/* ── Severity badge config ────────────────────────────────────────── */

const SEVERITY_REGEX = /\[(CRITICAL|HIGH|MEDIUM|LOW)\]/i;

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: '#d32f2f', text: '#fff' },
  HIGH: { bg: '#f57c00', text: '#fff' },
  MEDIUM: { bg: '#fbc02d', text: '#212121' },
  LOW: { bg: '#90caf9', text: '#212121' },
};

/* ── Category quick-filter tabs ────────────────────────────────────── */

const CATEGORY_TABS = [
  { label: 'All', slug: '' },
  { label: 'Security', slug: 'security' },
  { label: 'Releases', slug: 'release' },
  { label: 'Dev', slug: 'dev' },
  { label: 'Infrastructure', slug: 'infra' },
  { label: 'General', slug: 'general' },
];

/* ── Inject severity badges into announcement cards ────────────────── */

function injectSeverityBadges(root: Element) {
  const cards = root.querySelectorAll('.bui-Card:not([data-sev])');
  cards.forEach(card => {
    card.setAttribute('data-sev', '1');

    const titleLink = card.querySelector('.bui-CardHeader a');
    if (!titleLink) return;

    const text = titleLink.textContent || '';
    const m = text.match(SEVERITY_REGEX);
    if (!m) return;

    const severity = m[1].toUpperCase();
    const c = SEVERITY_COLORS[severity];
    if (!c) return;

    const badge = document.createElement('span');
    badge.textContent = severity;
    badge.setAttribute('data-severity-badge', severity.toLowerCase());
    badge.style.cssText = `
      display:inline-block; background:${c.bg}; color:${c.text};
      font-size:0.6875rem; font-weight:700; padding:2px 8px;
      border-radius:4px; margin-left:8px; letter-spacing:0.5px;
      vertical-align:middle; line-height:1.4; flex-shrink:0;
    `;

    if (!card.querySelector('[data-severity-badge]')) {
      titleLink.after(badge);
    }
  });
}

/* ── Build the category tab bar DOM ────────────────────────────────── */

function buildTabBar(
  activeSlug: string,
  onTabClick: (slug: string) => void,
): HTMLDivElement {
  const bar = document.createElement('div');
  bar.id = 'ann-category-tabs';
  bar.style.cssText = `
    display:flex; gap:8px; flex-wrap:wrap;
    padding:16px 24px 8px; align-items:center;
  `;

  // Title
  const title = document.createElement('span');
  title.textContent = 'Announcements';
  title.style.cssText = `
    font-size:1.4rem; font-weight:700; color:#212d38;
    margin-right:16px;
  `;
  bar.appendChild(title);

  CATEGORY_TABS.forEach(tab => {
    const chip = document.createElement('button');
    chip.textContent = tab.label;
    chip.setAttribute('data-cat', tab.slug);
    const isActive = tab.slug === activeSlug;
    chip.style.cssText = `
      cursor:pointer; font-weight:600; font-size:0.8125rem;
      border-radius:20px; padding:5px 16px; border:1.5px solid ${isActive ? '#1a73e8' : '#d0d0d0'};
      background:${isActive ? '#1a73e8' : '#fff'}; color:${isActive ? '#fff' : '#555'};
      transition:all 0.15s ease; outline:none; font-family:inherit;
    `;
    chip.onmouseenter = () => {
      if (!isActive) {
        chip.style.borderColor = '#1a73e8';
        chip.style.color = '#1a73e8';
        chip.style.background = '#e8f0fe';
      }
    };
    chip.onmouseleave = () => {
      if (!isActive) {
        chip.style.borderColor = '#d0d0d0';
        chip.style.color = '#555';
        chip.style.background = '#fff';
      }
    };
    chip.onclick = () => onTabClick(tab.slug);
    bar.appendChild(chip);
  });

  // Admin link (right-aligned)
  const spacer = document.createElement('span');
  spacer.style.cssText = 'flex:1;';
  bar.appendChild(spacer);

  const admin = document.createElement('a');
  admin.href = '/announcements/admin';
  admin.textContent = 'Manage';
  admin.style.cssText = `
    font-size:0.8125rem; font-weight:600; color:#1a73e8;
    text-decoration:none;
  `;
  admin.onmouseenter = () => { admin.style.textDecoration = 'underline'; };
  admin.onmouseleave = () => { admin.style.textDecoration = 'none'; };
  bar.appendChild(admin);

  return bar;
}

/* ── Delegated card click handler ──────────────────────────────────── */

function cardClickHandler(e: Event) {
  const target = e.target as HTMLElement;
  // Don't intercept clicks on links, buttons, tags, or severity badges
  if (target.closest('a, button, .bui-Tag, [data-severity-badge]')) return;

  const card = target.closest('.bui-Card') as HTMLElement | null;
  if (!card) return;

  const link = card.querySelector('.bui-CardHeader a') as HTMLAnchorElement | null;
  if (link?.href) link.click();
}

/* ── The enhancer component — renders nothing, mutates DOM ─────────── */

export function AnnouncementsEnhancer() {
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const observerRef = useRef<MutationObserver | null>(null);
  const isAnnouncementsPage = pathname === '/announcements' || pathname === '/announcements/';

  useEffect(() => {
    if (!isAnnouncementsPage) return;

    const activeCategory = searchParams.get('category') || '';

    const onTabClick = (slug: string) => {
      const next = new URLSearchParams(window.location.search);
      if (slug) {
        next.set('category', slug);
      } else {
        next.delete('category');
      }
      next.delete('tags');
      setSearchParams(next, { replace: true });
    };

    // Wait for the plugin DOM to render
    const initTimer = setTimeout(() => {
      // --- Inject tab bar above the plugin's header ---
      const existing = document.getElementById('ann-category-tabs');
      if (existing) existing.remove();

      const headerPage = document.querySelector('.bui-HeaderPage') as HTMLElement | null;
      const container = headerPage?.parentElement || document.querySelector('.bui-Container')?.parentElement;
      if (container) {
        const tabBar = buildTabBar(activeCategory, onTabClick);
        container.insertBefore(tabBar, container.firstChild);
        // Hide plugin's built-in header (we render our own title in tabs)
        if (headerPage) headerPage.style.display = 'none';
      }

      // --- Inject severity badges ---
      const gridRoot = document.querySelector('.bui-Grid');
      if (gridRoot) {
        injectSeverityBadges(gridRoot);
      }

      // --- Card click delegation ---
      const contentArea = document.querySelector('.bui-Container') || document.body;
      contentArea.addEventListener('click', cardClickHandler);

      // --- MutationObserver for re-injecting badges on pagination/filter ---
      if (observerRef.current) observerRef.current.disconnect();
      const obs = new MutationObserver(() => {
        const grid = document.querySelector('.bui-Grid');
        if (grid) injectSeverityBadges(grid);
      });
      const target = document.querySelector('.bui-Container');
      if (target) obs.observe(target, { childList: true, subtree: true });
      observerRef.current = obs;
    }, 400);

    return () => {
      clearTimeout(initTimer);
      const tabBar = document.getElementById('ann-category-tabs');
      if (tabBar) tabBar.remove();
      // Restore plugin header visibility
      const hdr = document.querySelector('.bui-HeaderPage') as HTMLElement | null;
      if (hdr) hdr.style.display = '';
      const contentArea = document.querySelector('.bui-Container') || document.body;
      contentArea.removeEventListener('click', cardClickHandler);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      // Clean up severity attributes so they re-inject on return
      document.querySelectorAll('[data-sev]').forEach(el => el.removeAttribute('data-sev'));
    };
  }, [isAnnouncementsPage, searchParams, setSearchParams]);

  return null; // Renders nothing — all work is DOM-level
}
