import DashboardPage from '@vcs-pw/ui/pages/dashboard.page';
import ProjectProfilePage from '@vcs-pw/ui/pages/project/profile.page';
import RepoCodeBranchQuickStartPage from '@vcs-pw/ui/pages/repo/code/branch-quickstart.page';
import RepoCodeBranchPage from '@vcs-pw/ui/pages/repo/code/branch.page';
import RepoRawFilePage from '@vcs-pw/ui/pages/repo/code/raw-file.page';
import RepoViewFilePage from '@vcs-pw/ui/pages/repo/code/view-file.page';
import PullOverviewPage from '@vcs-pw/ui/pages/repo/pulls/pull-overview.page';
import RepoSettingsPage from '@vcs-pw/ui/pages/repo/settings.page';
import RepoUploadFilePage from '@vcs-pw/ui/pages/repo/upload.page';
import UserSettingsPage from '@vcs-pw/ui/pages/user/settings.page';

export class PageRegistry {
  readonly dashboard = DashboardPage;
  readonly project = { profile: ProjectProfilePage };
  readonly repo = {
    settings: RepoSettingsPage,
    pulls: {
      overview: PullOverviewPage,
    },
    upload: RepoUploadFilePage,
    code: {
      branch: RepoCodeBranchPage,
      branchQuickStart: RepoCodeBranchQuickStartPage,
      viewFile: RepoViewFilePage,
      rawFile: RepoRawFilePage,
    },
  };
  readonly user = {
    settings: UserSettingsPage,
  };
}
