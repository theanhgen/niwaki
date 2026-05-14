export interface Tree {
  id: number
  type: string
  growth: number
  x: number
  plantedAt: string
  visitor?: string
}

export interface Forest {
  trees: Tree[]
  totalPrompts: number
  createdAt: string
  lastActiveDate?: string
  streak?: number
  viewerWidth?: number
}

export type Cell = { char: string; color: string | null }
export type Grid = Cell[][]

export interface Sprite {
  rows: [string, string | null][][]
  width: number
}
