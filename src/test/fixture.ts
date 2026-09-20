/**
 * Fixture data + resolver for the mocked Supabase client.
 *
 * Scenario: Luis (the signed-in user) and Mara are accepted friends, both
 * private. On Wednesday 2026-09-16 Luis climbs at "Vertical Hub" and Mara at the
 * one-off gym "Boulder Barn".
 */
import { TEST_USER_ID, createSupabaseMock, type MockResolver, type MockSupabaseClient } from './supabaseMock'

export const FRIEND_ID = '22222222-2222-2222-2222-222222222222'
export const GYM_ID = '33333333-3333-3333-3333-333333333333'

const timestamp = '2026-09-01T10:00:00.000Z'

export const meProfile = {
  id: TEST_USER_ID,
  username: 'luis',
  display_name: 'Luis',
  visibility: 'private',
  created_at: timestamp,
  updated_at: timestamp,
}

export const friendProfile = {
  id: FRIEND_ID,
  username: 'mara',
  display_name: 'Mara',
  visibility: 'private',
  created_at: timestamp,
  updated_at: timestamp,
}

export const gymFixture = {
  id: GYM_ID,
  name: 'Vertical Hub',
  city: null,
  region: 'Luzon',
  created_by: null,
  created_at: timestamp,
}

export const friendshipFixture = {
  id: '44444444-4444-4444-4444-444444444444',
  requester_id: FRIEND_ID,
  addressee_id: TEST_USER_ID,
  status: 'accepted',
  created_at: timestamp,
  updated_at: timestamp,
}

export const climbFixture = [
  {
    id: '55555555-5555-5555-5555-555555555555',
    user_id: TEST_USER_ID,
    climb_date: '2026-09-16',
    start_time: '18:30:00',
    end_time: '21:00:00',
    gym_id: GYM_ID,
    custom_gym_name: null,
    note: 'Bouldering',
    created_at: timestamp,
    updated_at: timestamp,
    gym: { id: GYM_ID, name: 'Vertical Hub' },
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    user_id: FRIEND_ID,
    climb_date: '2026-09-16',
    start_time: '07:00:00',
    end_time: '09:00:00',
    gym_id: null,
    custom_gym_name: 'Boulder Barn',
    note: null,
    created_at: timestamp,
    updated_at: timestamp,
    gym: null,
  },
]

const resolver: MockResolver = ({ table, filters }) => {
  switch (table) {
    case 'profiles': {
      const singleId = filters.id
      if (typeof singleId === 'string') {
        const match = [meProfile, friendProfile].find((profile) => profile.id === singleId)
        return { data: match ?? null, error: null }
      }
      const ids = filters['in.id']
      if (Array.isArray(ids)) {
        return {
          data: [meProfile, friendProfile].filter((profile) => ids.includes(profile.id)),
          error: null,
        }
      }
      return { data: [meProfile, friendProfile], error: null }
    }
    case 'climbs': {
      const ids = filters['in.user_id']
      const rows = Array.isArray(ids)
        ? climbFixture.filter((climb) => ids.includes(climb.user_id))
        : climbFixture
      return { data: rows, error: null }
    }
    case 'friendships':
      return { data: [friendshipFixture], error: null }
    case 'gyms':
      return { data: [gymFixture], error: null }
    default:
      return { data: null, error: null }
  }
}

export function createClimbcalSupabaseMock(): MockSupabaseClient {
  return createSupabaseMock(resolver)
}
