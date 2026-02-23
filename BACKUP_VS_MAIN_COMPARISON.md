# Comparison: backup-22-feb vs main branch

## Summary
The `backup-22-feb` branch represents a **cleaner, stripped-down version** of Backstage without monitoring integrations. The `main` branch has **extensive monitoring and observability features** that are missing from backup-22-feb.

---

## What's in backup-22-feb that's MISSING from main:

### 1. **React Import Fix for HomePage**
- **Commit:** `227cbcd fix(home): add missing React import to HomePage`
- **Status:** This fix is in backup-22-feb but NOT in main
- **Impact:** HomePage may have React-related issues in main

### 2. **Cleaner GitHub Integration Configuration**
In `app-config.yaml`, backup-22-feb has:
- No `apiBaseUrl` specification (uses default)
- No rate limit configuration
- Simpler, more streamlined GitHub config

### 3. **Simplified Catalog Discovery**
- No `biz-book-api` repository exclusion filter
- Catalog sync frequency: 3 hours (vs 1 hour in main)
- GitHub org discovery frequency: 3 hours (vs 1 hour in main)
- **Rationale:** Reduces GitHub API rate limit usage

### 4. **No Local Catalog Entities**
backup-22-feb does NOT have:
- `../../catalog-info.yaml` location
- `../../examples/entities.yaml` location
- Cleaner separation between code and catalog data

### 5. **Reduced TechDocs Cache Configuration**
- No explicit cache TTL or read timeout settings
- Simpler TechDocs configuration

---

## What's in main that's MISSING from backup-22-feb:

### 1. **AWS Cost Explorer Integration** ❌
- File: `packages/app/src/components/aws/AwsCostEntityTab.tsx` (1,812 lines)
- File: `packages/backend/src/plugins/aws-cost-settings.ts` (690 lines)
- Complete AWS cost monitoring and ECS/Lambda metrics
- Entity-level cost tracking

### 2. **Grafana Integration** ❌
- File: `packages/app/src/components/grafana/GrafanaEntityTab.tsx` (1,168 lines)
- File: `packages/backend/src/plugins/grafana-settings.ts` (195 lines)
- Grafana dashboard embedding
- Alert integration
- Config: `grafana.domain` and `unifiedAlerting` settings
- CSP `frame-src` directive for iframe embedding

### 3. **Prometheus Integration** ❌
- File: `packages/app/src/components/prometheus/PrometheusEntityTab.tsx` (871 lines)
- File: `packages/backend/src/plugins/prometheus-settings.ts` (146 lines)
- Prometheus metrics visualization
- Custom query interface

### 4. **New Relic Integration** ❌
- File: `packages/app/src/components/newrelic/NewRelicApmCard.tsx` (354 lines)
- File: `packages/app/src/components/newrelic/NewRelicFacadesTab.tsx` (411 lines)
- APM monitoring
- Proxy configuration: `/newrelic/apm/api` and `/newrelic/api`
- API key authentication

### 5. **Enhanced Security Configuration** ❌
In `app-config.yaml`, main has:
- CSP `frame-src` directive for Grafana iframe embedding
- New Relic proxy endpoints with authentication

### 6. **Additional Dependencies** ❌
In `packages/app/package.json`, main has monitoring-related packages

### 7. **Logo File** ❌
- File: `packages/app/src/components/Root/logo/wlogo.png`
- This logo exists in main but NOT in backup-22-feb

### 8. **Backend Plugin Registrations** ❌
In `packages/backend/src/index.ts`, main registers:
- AWS cost settings plugin
- Grafana settings plugin
- Prometheus settings plugin

### 9. **EntityPage Monitoring Tabs** ❌
In `packages/app/src/components/catalog/EntityPage.tsx`, main has:
- AWS Cost tab
- Grafana tab
- Prometheus tab
- New Relic APM cards

### 10. **App-level Monitoring Imports** ❌
In `packages/app/src/App.tsx`, main imports monitoring components

---

## Key Configuration Differences

### app-config.yaml

| Setting | backup-22-feb | main |
|---------|---------------|------|
| GitHub API Base URL | Not specified | `https://api.github.com` |
| GitHub Rate Limit | Not configured | `4500/hour` with 1h window |
| Catalog Sync Frequency | 3 hours | 1 hour |
| GitHub Org Discovery | 3 hours | 1 hour |
| TechDocs Cache TTL | Not configured | 1 hour (3600000ms) |
| TechDocs Read Timeout | Not configured | 5 seconds |
| Repository Filter | `.*` (all) | `^(?!biz-book-api$).*` (excludes biz-book-api) |
| CSP frame-src | Not configured | Allows http/https for Grafana |
| New Relic Proxy | Not configured | Configured with API key |
| Grafana Config | Not configured | Domain + unifiedAlerting |
| Local Catalog Files | Not included | `catalog-info.yaml`, `examples/entities.yaml` |

---

## Recommendations

### If you want a **clean, lightweight Backstage** (backup-22-feb):
✅ No monitoring overhead
✅ Reduced GitHub API usage (3-hour sync)
✅ Simpler configuration
✅ No iframe security concerns
⚠️ Missing observability features
⚠️ React import fix needed for HomePage

### If you want **full observability** (main):
✅ Complete monitoring stack (AWS, Grafana, Prometheus, New Relic)
✅ Real-time cost tracking
✅ Performance metrics
✅ More frequent catalog updates
⚠️ Higher GitHub API usage
⚠️ More complex configuration
⚠️ Should apply React import fix from backup-22-feb

---

## Action Items

1. **Apply React Import Fix to Main**
   - Cherry-pick commit `227cbcd` from backup-22-feb to main
   - Or manually add `import React from 'react'` to HomePage.tsx in main

2. **Consider GitHub Rate Limit Settings**
   - backup-22-feb's 3-hour sync reduces API calls
   - Evaluate if main's 1-hour sync causes rate limit issues

3. **Review Monitoring Need**
   - If monitoring isn't actively used, consider removing from main
   - If monitoring is essential, keep main as-is

4. **Logo File Decision**
   - Determine if wlogo.png is needed
   - Add to backup-22-feb or remove from main

---

## File Count Summary

**Total files changed:** 17

**Lines changed:**
- backup-22-feb → main: +8,136 lines (adds monitoring)
- main → backup-22-feb: -8,136 lines (removes monitoring)

**Breakdown:**
- AwsCostEntityTab.tsx: 1,812 lines
- GrafanaEntityTab.tsx: 1,168 lines
- PrometheusEntityTab.tsx: 871 lines
- aws-cost-settings.ts: 690 lines
- NewRelicFacadesTab.tsx: 411 lines
- NewRelicApmCard.tsx: 354 lines
- grafana-settings.ts: 195 lines
- prometheus-settings.ts: 146 lines
- Other files: ~3,500 lines (config, dependencies, registrations)
