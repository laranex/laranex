import { TProject, TProjects } from "../types/project"
import { TNpm } from "../types/npm" // Adjust the path as needed
import { NPM_SCOPES } from "../constants"

export const useNpm = () => {
  const packages: TProjects = []

  const fetchPackagesFromNpm = async (): Promise<TProjects> => {
    packages.length = 0

    try {
      await Promise.all(
        NPM_SCOPES.map(async (scope) => {
          const packagesUnderOrganizationResponse = await fetch(
            `https://registry.npmjs.org/-/v1/search?text=scope:${scope}`,
          )

          const { objects: packagesUnderOrganization } =
            (await packagesUnderOrganizationResponse.json()) as TNpm.PackagesResponse

          const packageInformationPromises = Object.values(packagesUnderOrganization).map(async (object) => {
            const packageInformationResponse = await fetch(`https://registry.npmjs.org/${object.package.name}/latest`)

            const packageDownloadCountResponse = await fetch(
              `https://api.npmjs.org/downloads/point/last-year/${object.package.name}`,
            )

            const packageInformation = (await packageInformationResponse.json()) as TNpm.PackageResponse

            const packageDownloadCount =
              (await packageDownloadCountResponse.json()) as TNpm.PackageDownloadCountResponse

            const version = packageInformation.version

            return {
              name: packageInformation.name,
              description: packageInformation.description,
              type: "npm",
              downloads: packageDownloadCount.downloads,
              homepage: packageInformation.homepage || packageInformation.repository.url,
            } as TProject
          })

          packages.push(...(await Promise.all(packageInformationPromises)))
        }),
      )
    } catch (error) {
      console.error("Error fetching packages from npm:", error)
    }

    return packages
  }

  return {
    fetchPackagesFromNpm,
  }
}
