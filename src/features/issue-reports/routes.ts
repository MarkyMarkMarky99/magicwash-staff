import type { RouteRecordRaw } from 'vue-router'

export const issueReportRoutes: RouteRecordRaw[] = [
  {
    path: '/issue-reports',
    name: 'issue-reports',
    component: () => import('./pages/IssueReportListPage.vue'),
  },
  {
    path: '/issue-reports/new',
    name: 'issue-report-create',
    component: () => import('./pages/IssueReportFormPage.vue'),
    meta: { parent: 'issue-reports' },
  },
  {
    path: '/issue-reports/:id',
    name: 'issue-report-detail',
    component: () => import('./pages/IssueReportDetailPage.vue'),
    meta: { parent: 'issue-reports' },
    props: true,
  },
]
