export type TProject = {
  name: string
  description: string
  type: "npm" | "packagist"
  downloads?: number
  homepage?: string
}

export type TProjects = TProject[]
