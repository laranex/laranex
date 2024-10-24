export namespace TPackagist {
  export type PackagesResponse = {
    packages: {
      [name: string]: {
        type: string;
        repository: string;
        abandoned: boolean;
      };
    };
  };

  export type PackageResponse = {
    package: {
      name: string;
      description: string;
      time: string;
      maintainers: {
        name: string;
        avatar_url: string;
      }[];
      versions: {
        [key: string]: {
          name: string;
          description: string;
          keywords: string[];
          homepage: string;
          version: string;
          version_normalized: string;
          license: string[];
          authors: {
            name: string;
            email: string;
          }[];
          source: {
            url: string;
            type: string;
            reference: string;
          };
          dist: {
            url: string;
            type: string;
            shasum: string;
            reference: string;
          };
          type: string;
          support: {
            discussions: string;
            issues: string;
            source: string;
          };
          funding: {
            url: string;
            type: string;
          }[];
          time: string;
          autoload: {
            "psr-4": {
              [namespace: string]: string;
            };
          };
          bin: string[];
          "default-branch"?: boolean;
          require: {
            [dependency: string]: string;
          };
        };
      };
      type: string;
      repository: string;
      github_stars: number;
      github_watchers: number;
      github_forks: number;
      github_open_issues: number;
      language: string;
      dependents: number;
      suggesters: number;
      downloads: {
        total: number;
        monthly: number;
        daily: number;
      };
      favers: number;
    };
  };
}
