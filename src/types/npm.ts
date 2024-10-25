export namespace TNpm {
  export type PackagesResponse = {
    objects: {
      package: {
        name: string
        scope: string
        version: string
        description?: string
        keywords?: string[]
        date: string
        links: {
          npm: string
          homepage?: string
          repository?: string
          bugs?: string
        }
        author?: {
          name: string
          email: string
          url: string
        }
        publisher: {
          username: string
          email: string
        }
        maintainers: {
          username: string
          email: string
        }[]
      }
      flags: {
        insecure: 0 | 1
      }
      score: {
        final: number
        detail: {
          quality: number
          popularity: number
          maintenance: number
        }
      }
      searchScore: number
    }[]
    total: number
    time: string
  }

  export type PackageResponse = {
    name: string
    type: string
    version: string
    description: string
    license: string
    homepage: string
    repository: {
      type: string
      url: string
      directory: string
    }
    exports: {
      [key: string]: {
        types: string
        import: string
      }
    }
    types: string
    bin: {
      [key: string]: string
    }
    peerDependencies: {
      [key: string]: string
    }
    dependencies: {
      [key: string]: string
    }
    devDependencies: {
      [key: string]: string
    }
    scripts: {
      [key: string]: string
    }
    _id: string
    bugs: {
      url: string
    }
    _integrity: string
    _resolved: string
    _from: string
    _nodeVersion: string
    _npmVersion: string
    dist: {
      integrity: string
      shasum: string
      tarball: string
      fileCount: number
      unpackedSize: number
      attestations: {
        url: string
        provenance: {
          predicateType: string
        }
      }
      signatures: {
        keyid: string
        sig: string
      }[]
    }
    _npmUser: {
      name: string
      email: string
    }
    directories: {}
    maintainers: {
      name: string
      email: string
    }[]
    _npmOperationalInternal: {
      host: string
      tmp: string
    }
    _hasShrinkwrap: boolean
  }

  export type PackageDownloadCountResponse = {
    downloads: number
    start: string
    end: string
    package: string
  }
}
