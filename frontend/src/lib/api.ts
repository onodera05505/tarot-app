import type { ApiResponse, DrawnCard, TarotCard } from './types'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8787'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const payload = (await res.json()) as ApiResponse<T>
  if (!payload.success || payload.data === undefined) {
    throw new Error(payload.message ?? 'API error')
  }
  return payload.data
}

export function fetchAllCards(signal?: AbortSignal): Promise<TarotCard[]> {
  return request<TarotCard[]>('/api/cards', { signal })
}

export function fetchCard(id: number, signal?: AbortSignal): Promise<TarotCard> {
  return request<TarotCard>(`/api/cards/${id}`, { signal })
}

type DrawResponse = { count: number; cards: DrawnCard[] }

export async function drawCards(count = 1, signal?: AbortSignal): Promise<DrawnCard[]> {
  const data = await request<DrawResponse>(`/api/draw?count=${count}`, { signal })
  return data.cards
}
