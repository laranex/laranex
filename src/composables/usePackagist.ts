import { TProject, TProjects } from "../types/project"
import { TPackagist } from "../types/packagist" // Adjust the path as needed
import { PACKAGIST_VENDORS } from "../constants"

export const usePackagist = () => {
  const packages: TProjects = []

  const fetchPackagesFromPackagist = async (): Promise<TProjects> => {
    packages.length = 0

    try {
      await Promise.all(
        PACKAGIST_VENDORS.map(async (vendor) => {
          const packagesUnderOrganizationResponse = await fetch(
            `https://packagist.org/packages/list.json?vendor=${vendor}&fields[]=type&fields[]=repository&fields[]=abandoned`,
          )

          const { packages: packagesUnderOrganization } =
            (await packagesUnderOrganizationResponse.json()) as TPackagist.PackagesResponse

          const packageInformationPromises = Object.keys(packagesUnderOrganization).map(async (pkg) => {
            const packageInformationResponse = await fetch(`https://packagist.org/packages/${pkg}.json`)

            const { package: packageInformation } =
              (await packageInformationResponse.json()) as TPackagist.PackageResponse

            const version = Object.keys(packageInformation.versions)[0]

            return {
              name: packageInformation.name,
              description: packageInformation.description,
              type: "packagist",
              downloads: packageInformation.downloads.total,
              homepage: packageInformation.versions[version]?.homepage || packageInformation.repository,
            } as TProject
          })

          packages.push(...(await Promise.all(packageInformationPromises)))
        }),
      )
    } catch (error) {
      console.error("Error fetching packages from packagist:", error)
    }

    return packages
  }

  return {
    fetchPackagesFromPackagist,
  }
}
