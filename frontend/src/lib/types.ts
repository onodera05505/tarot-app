export type TarotCard = {
  id: number
  nameEn: string
  nameJa: string
  number: number
  arcanaType: string
  meaningUpright: string
  meaningReversed: string
  descriptionUpright: string
  descriptionReversed: string
  imageUrl: string
}

export type Orientation = 'upright' | 'reversed'

export type DrawnCard = {
  card: TarotCard
  orientation: Orientation
  keywords: string[]
}

export type ApiResponse<T> = {
  success: boolean
  data?: T
  message?: string
}
